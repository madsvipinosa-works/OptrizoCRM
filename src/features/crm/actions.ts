"use server";

import { db } from "@/db";
import { leads, inquiries, users, leadActivityLogs, agencyProjects, milestones, projectStakeholders, leadAssignees, serviceTemplates, taskTemplates, tasks } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, inArray, and } from "drizzle-orm";
import { leadUpdateSchema, type LeadUpdateValues } from "@/lib/schemas";
import { sendClientWelcomeEmail } from "@/lib/notifications";
import { auth } from "@/auth";
import { notifyAllAdmins } from "@/features/notifications/actions";
import { logAction } from "@/features/audit/actions";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
};

export async function createInquiry(data: { name: string, email: string, source: string, service?: string, budget?: string, notes?: string }): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }
    try {
        await db.insert(inquiries).values({
            name: data.name,
            email: data.email,
            subject: data.service || "Manual Inquiry",
            message: data.notes || "Manual Entry",
            source: data.source,
            status: "Unread",
        });
        await logAction("CREATE", "Inquiry", `Manually created inquiry for ${data.name}`);
        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead created successfully" };
    } catch(e) {
        return { success: false, message: "Failed to create lead" };
    }
}



export async function updateLead(id: string, data: LeadUpdateValues): Promise<ActionState> {
    // 1. Auth Check (Admin or Editor)
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
        return { success: false, message: "Unauthorized: Access required." };
    }

    // 2. Validate Input
    const validated = leadUpdateSchema.safeParse(data);
    if (!validated.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: validated.error.flatten().fieldErrors,
        };
    }

    // 3. Update Database
    try {
        // Extract assigneeIds if present to handle junction table separately
        const { assigneeIds, ...updateFields } = validated.data;
        
        await db.update(leads)
            .set({
                ...updateFields,
                updatedAt: new Date(),
            })
            .where(eq(leads.id, id));

        // If an assignment was made, write to the junction table
        // (Wiping previous assignees for this UI action if it's a 1-to-many overwrite, or just accumulating)
        if (assigneeIds !== undefined) {
            await db.delete(leadAssignees).where(eq(leadAssignees.leadId, id));
            if (assigneeIds && assigneeIds.length > 0) {
                await db.insert(leadAssignees).values(
                    assigneeIds.map(userId => ({ leadId: id, userId }))
                );
            }
        }

        await logAction("UPDATE", "Lead", `Lead ${id} properties updated.`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead updated successfully" };
    } catch (error) {
        console.error("Failed to update lead:", error);
        return { success: false, message: "Database error: Failed to update lead." };
    }
}

export async function addLeadNote(leadId: string, content: string, activityType: "Call" | "Email" | "Meeting" | "Note" = "Note"): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
        return { success: false, message: "Unauthorized" };
    }

    if (!content.trim()) {
        return { success: false, message: "Note cannot be empty" };
    }

    try {
        await db.insert(leadActivityLogs).values({
            leadId,
            authorId: session.user.id!,
            content: content.trim(),
            activityType: activityType,
        });

        await logAction("CREATE", "Lead Note", `Logged ${activityType} for Lead ${leadId}`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Note added" };
    } catch (error) {
        console.error("Failed to add note:", error);
        return { success: false, message: "Failed to add note" };
    }
}

export async function getAnalyticsData() {
    // 1. Auth Check - Wrapped in try/catch to handle NextAuth JWTSessionErrors gracefully
    let session;
    try {
        session = await auth();
    } catch (e) {
        console.error("Auth Session Error in getAnalyticsData:", e);
        return null; // Return null gracefully instead of crashing the page
    }

    if (!session?.user || session.user.role !== "admin") {
        return null;
    }

    try {
        const allLeads = await db.select().from(leads);

        // 2. KPI Calculations
        const totalLeads = allLeads.length;
        const wonLeads = allLeads.filter(l => l.status === "Closed Won").length;
        const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

        // Estimate Revenue (naive parsing of budget string e.g. "$1k - $5k")
        const pipelineValue = allLeads
            .filter(l => !(["Closed Lost", "Pending Approval"] as string[]).includes(l.status || "")) // Filter out terminal or raw states
            .reduce((acc, lead) => {
                if (!lead.budget) return acc;
                // Extract first number
                const match = lead.budget.match(/\d+/);
                const val = match ? parseInt(match[0]) : 0;
                // If it looks like 'k', multiply by 1000
                const multiplier = lead.budget.toLowerCase().includes('k') ? 1000 : 1;
                return acc + (val * multiplier);
            }, 0);

        // 3. Chart Data Preparation

        // Pipeline Distribution
        const pipelineData = [
            { name: "Pending", value: allLeads.filter(l => l.status === "Pending Approval").length, fill: "#3b82f6" },
            { name: "In Review", value: allLeads.filter(l => l.status === "In Review").length, fill: "#a855f7" },
            { name: "Proposal", value: allLeads.filter(l => l.status === "Proposal Sent").length, fill: "#eab308" },
            { name: "Won", value: allLeads.filter(l => l.status === "Closed Won").length, fill: "#22c55e" },
            { name: "Lost", value: allLeads.filter(l => l.status === "Closed Lost").length, fill: "#6b7280" },
        ];

        // Lead Sources
        const sourceCounts: Record<string, number> = {};
        allLeads.forEach(l => {
            const src = l.source || "Direct";
            sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        });
        const sourceData = Object.entries(sourceCounts).map(([name, value], i) => ({
            name,
            value,
            fill: ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"][i % 5]
        }));

        // Recent Trend (Last 30 Days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // Group by day
        const trendMap = new Map<string, number>();
        // Initialize last 30 days with 0
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            trendMap.set(d.toISOString().split('T')[0], 0);
        }

        allLeads.forEach(l => {
            const dateStr = new Date(l.createdAt).toISOString().split('T')[0];
            if (trendMap.has(dateStr)) {
                trendMap.set(dateStr, (trendMap.get(dateStr) || 0) + 1);
            }
        });

        // Convert to array and reverse (oldest first)
        const trendData = Array.from(trendMap.entries())
            .map(([date, count]) => ({ date: date.slice(5), count })) // MM-DD
            .reverse();

        // Active Lead Management KPIs
        const now = new Date();
        let totalAgeDays = 0;
        let agedLeadsCount = 0;
        let staleLeadsCount = 0;
        let actionedLeadsCount = 0;

        allLeads.forEach(l => {
            const created = new Date(l.createdAt);
            const updated = new Date(l.updatedAt);
            const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
            const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 3600 * 24);

            // Lead Aging: How long a lead has been in raw inquiry state
            if (l.status === "Pending Approval") {
                totalAgeDays += daysSinceCreation;
                agedLeadsCount++;
            }

            // Stale Leads: Not in terminal state AND untouched for > 2 days
            if (!(["Closed Won", "Closed Lost"] as string[]).includes(l.status || "") && daysSinceUpdate > 2) {
                staleLeadsCount++;
            }

            // Response Rate: Leads moved out of initial inquiry
            if (l.status !== "Pending Approval") {
                actionedLeadsCount++;
            }
        });

        const avgLeadAgeDays = agedLeadsCount > 0 ? (totalAgeDays / agedLeadsCount).toFixed(1) : "0";
        const responseRate = totalLeads > 0 ? ((actionedLeadsCount / totalLeads) * 100).toFixed(0) : "0";

        // Advanced ROI & Intelligence Metrics
        const settings = await db.query.siteSettings.findFirst();
        const monthlyMarketingSpend = settings?.monthlyMarketingSpend || 1000;
        const adminHoursPerProject = settings?.adminHoursSavedPerProject || 2;

        const clv = wonLeads > 0 ? Math.round(pipelineValue / wonLeads).toLocaleString() : "0";
        const romi = pipelineValue > 0 ? Math.round(((pipelineValue - monthlyMarketingSpend) / monthlyMarketingSpend) * 100) : 0;
        const adminHoursSaved = wonLeads * adminHoursPerProject;

        return {
            kpi: {
                totalLeads,
                wonLeads,
                conversionRate,
                pipelineValue: pipelineValue.toLocaleString(),
                avgLeadAgeDays,
                staleLeadsCount,
                responseRate,
                clv,
                romi,
                adminHoursSaved,
            },
            charts: {
                pipeline: pipelineData,
                sources: sourceData,
                trend: trendData
            }
        };

    } catch (error) {
        console.error("Analytics Error:", error);
        return null;
    }
}

export async function markLeadAsWon(leadId: string, isSystemAction: boolean = false): Promise<ActionState> {
    const session = await auth();
    
    // Only enforce auth check if it's not a programmatic system action (e.g. client proposal acceptance)
    if (!isSystemAction) {
        if (!session?.user || session.user.role !== "admin") {
            return { success: false, message: "Unauthorized" };
        }
    }

    try {
        // 1. Fetch Lead
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId),
            with: { client: true }
        });

        if (!lead) return { success: false, message: "Lead not found" };
        if (lead.status === "Closed Won") return { success: false, message: "Lead is already won!" };

        if (!lead.client) return { success: false, message: "Client data not associated with this lead" };
        
        let clientUserId = lead.clientId;
        
        // VERY STRICT ROLE CHECK - NEVER DOWNGRADE AN ADMIN OR EDITOR TO CLIENT
        if (lead.client.role !== "admin" && lead.client.role !== "editor") {
            await db.update(users).set({ role: "client" }).where(eq(users.id, lead.clientId));
            console.log(`[SYS_LOG] 👤 Upgraded existing User account to Client for ${lead.client.email}`);
        } else {
            console.log(`[SYS_LOG] 🛡️ Protected Agency Staff role: Existing User account kept role '${lead.client.role}' for ${lead.client.email}`);
        }

        // 3. Create Operational Project (PM Engine)
        const [newProject] = await db.insert(agencyProjects).values({
            title: lead.serviceId ? `${lead.businessName || lead.client.name} Project` : `${lead.businessName || lead.client.name} Project`,
            description: lead.goals,
            leadId: lead.id,
            status: "Kickoff",
        }).returning({ id: agencyProjects.id, title: agencyProjects.title });
        
        // 3.5 Write to projectStakeholders Junction Table
        await db.insert(projectStakeholders).values({
            projectId: newProject.id,
            userId: clientUserId
        });
        console.log(`[SYS_LOG] 🚀 Provisioned Agency Project: ${newProject.id} with Stakeholder ${clientUserId}`);

        // 4. Create Default Milestone Scaffolding or Apply Templates
        let templateApplied = false;
        if (lead.serviceId) {
            const template = await db.query.serviceTemplates.findFirst({
                where: eq(serviceTemplates.id, lead.serviceId),
                with: { tasks: true }
            });
            
            if (template && template.tasks && template.tasks.length > 0) {
                // Group by milestoneTitle and order
                const milestonesMap = new Map<string, typeof template.tasks>();
                for (const t of template.tasks) {
                    const key = `${t.milestoneOrder}-${t.milestoneTitle}`;
                    if (!milestonesMap.has(key)) milestonesMap.set(key, []);
                    milestonesMap.get(key)!.push(t);
                }

                for (const [key, tskArr] of milestonesMap.entries()) {
                    const splitIdx = key.indexOf('-');
                    const order = parseInt(key.substring(0, splitIdx), 10);
                    const title = key.substring(splitIdx + 1);

                    const [newMs] = await db.insert(milestones).values({
                        projectId: newProject.id,
                        title,
                        order,
                        status: "Pending"
                    }).returning({ id: milestones.id });

                    const tasksToInsert = tskArr.map(t => ({
                        projectId: newProject.id,
                        milestoneId: newMs.id,
                        title: t.title,
                        description: t.description,
                        requiresProof: t.requiresProof,
                        status: "Todo" as const,
                    }));
                    await db.insert(tasks).values(tasksToInsert);
                }
                templateApplied = true;
                console.log(`[SYS_LOG] 🗺️ Generated project milestones from template '${template.name}'.`);
            }
        }

        if (!templateApplied) {
            await db.insert(milestones).values([
                { projectId: newProject.id, title: "Discovery", status: "Pending", order: 1 },
                { projectId: newProject.id, title: "Design", status: "Pending", order: 2 },
                { projectId: newProject.id, title: "Development", status: "Pending", order: 3 },
                { projectId: newProject.id, title: "QA & Launch", status: "Pending", order: 4 },
            ]);
            console.log(`[SYS_LOG] 🗺️ Generated default project milestones.`);
        }

        // 5. Update Lead Status
        await db.update(leads)
            .set({ status: "Closed Won", updatedAt: new Date() })
            .where(eq(leads.id, leadId));

        // 6. Send Client Portal Credentials via Email
        await sendClientWelcomeEmail({
            name: lead.client.name || "Client",
            email: lead.client.email,
            projectName: newProject.title
        });

        await notifyAllAdmins(`Lead ${lead.businessName || lead.client.name} won! Project "${newProject.title}" provisioned.`, "deal_won", `/dashboard/pm/${newProject.id}`);

        await logAction("UPDATE", "Lead", `Lead ${lead.id} marked as Won and Project ${newProject.id} provisioned.`);

        revalidatePath("/dashboard/leads");

        return { success: true, message: "Success! Project Provisioned & Client Notified." };
    } catch (error) {
        console.error("Failed to mark lead as won:", error);
        return { success: false, message: "Database Error: Could not execute Won workflow." };
    }
}

export async function archiveLead(leadId: string): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
        return { success: false, message: "Unauthorized: Admins only." };
    }

    try {
        await db.update(leads)
            .set({ isArchived: true, updatedAt: new Date() })
            .where(eq(leads.id, leadId));

        await logAction("UPDATE", "Lead", `Lead ${leadId} archived.`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead securely archived." };
    } catch (error) {
        console.error("Failed to archive lead:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateLeadStatusWithAudit(
    leadId: string,
    newStatus: "Pending Approval" | "In Review" | "Proposal Sent" | "Closed Won" | "Closed Lost",
    reasonNotes?: string
): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId)
        });

        if (!lead) return { success: false, message: "Lead not found" };

        if (newStatus === "Closed Won") {
            return await markLeadAsWon(leadId);
        }

        const oldStatus = lead.status;
        await db.update(leads)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(leads.id, leadId));

        const logContent = `Status updated from "${oldStatus}" to "${newStatus}"${reasonNotes ? `: ${reasonNotes}` : ""}`;
        await db.insert(leadActivityLogs).values({
            leadId,
            authorId: session.user.id || null,
            activityType: "System",
            content: logContent,
        });

        await logAction("UPDATE", "Lead", `Lead ${leadId} status changed from ${oldStatus} to ${newStatus}`);

        revalidatePath("/dashboard/leads");
        revalidatePath(`/dashboard/leads/${leadId}`);

        return { success: true, message: `Lead status updated to ${newStatus}` };
    } catch (error) {
        console.error("Failed to update lead status:", error);
        return { success: false, message: "Failed to update lead status" };
    }
}

export async function bulkUpdateLeadStatus(
    leadIds: string[],
    newStatus: "Pending Approval" | "In Review" | "Proposal Sent" | "Closed Won" | "Closed Lost"
): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    if (!leadIds || leadIds.length === 0) {
        return { success: false, message: "No leads selected" };
    }

    try {
        if (newStatus === "Closed Won") {
            for (const id of leadIds) {
                await markLeadAsWon(id);
            }
        } else {
            await db.update(leads)
                .set({ status: newStatus, updatedAt: new Date() })
                .where(inArray(leads.id, leadIds));

            const logEntries = leadIds.map(id => ({
                leadId: id,
                authorId: session.user.id || null,
                activityType: "System" as const,
                content: `Bulk status update to "${newStatus}"`,
            }));
            await db.insert(leadActivityLogs).values(logEntries);

            await logAction("UPDATE", "Lead", `Bulk status update for ${leadIds.length} leads to ${newStatus}`);
        }

        revalidatePath("/dashboard/leads");
        return { success: true, message: `Updated status for ${leadIds.length} leads to ${newStatus}` };
    } catch (error) {
        console.error("Failed bulk update lead status:", error);
        return { success: false, message: "Failed to perform bulk update" };
    }
}

export async function bulkAssignLeads(
    leadIds: string[],
    assigneeUserIds: string[]
): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
        return { success: false, message: "Unauthorized: Admin access required" };
    }

    if (!leadIds || leadIds.length === 0) {
        return { success: false, message: "No leads selected" };
    }

    try {
        for (const leadId of leadIds) {
            await db.delete(leadAssignees).where(eq(leadAssignees.leadId, leadId));
            if (assigneeUserIds && assigneeUserIds.length > 0) {
                await db.insert(leadAssignees).values(
                    assigneeUserIds.map(userId => ({ leadId, userId }))
                );
            }
        }

        await logAction("UPDATE", "Lead", `Bulk assigned ${leadIds.length} leads to ${assigneeUserIds.length} staff users`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: `Successfully updated assignees for ${leadIds.length} leads` };
    } catch (error) {
        console.error("Failed bulk assign leads:", error);
        return { success: false, message: "Failed to update assignees" };
    }
}



