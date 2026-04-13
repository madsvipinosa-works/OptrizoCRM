"use server";

import { db } from "@/db";
import { leads, users, leadNotes, agencyProjects, milestones, projectStakeholders, leadAssignees } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
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

export async function updateLead(id: string, data: LeadUpdateValues): Promise<ActionState> {
    // 1. Auth Check (Admin or Editor)
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
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
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    if (!content.trim()) {
        return { success: false, message: "Note cannot be empty" };
    }

    try {
        await db.insert(leadNotes).values({
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

    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return null;
    }

    try {
        const allLeads = await db.select().from(leads);

        // 2. KPI Calculations
        const totalLeads = allLeads.length;
        const wonLeads = allLeads.filter(l => l.status === "Won" || l.status === "Completed").length;
        const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

        // Estimate Revenue (naive parsing of budget string e.g. "$1k - $5k")
        const pipelineValue = allLeads
            .filter(l => !(["Lost", "New"] as string[]).includes(l.status || "")) // Filter out terminal or raw states
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
            { name: "New", value: allLeads.filter(l => l.status === "New Inquiry" || l.status === "New").length, fill: "#3b82f6" },
            { name: "Qualified", value: allLeads.filter(l => l.status === "Qualified" || l.status === "Contacted").length, fill: "#a855f7" },
            { name: "Proposal", value: allLeads.filter(l => l.status === "Proposal Sent" || l.status === "In Progress").length, fill: "#eab308" },
            { name: "Won", value: allLeads.filter(l => l.status === "Won" || l.status === "Completed").length, fill: "#22c55e" },
            { name: "Lost", value: allLeads.filter(l => l.status === "Lost").length, fill: "#6b7280" },
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
            if (l.status === "New Inquiry" || l.status === "New") {
                totalAgeDays += daysSinceCreation;
                agedLeadsCount++;
            }

            // Stale Leads: Not in terminal state AND untouched for > 2 days
            if (!(["Won", "Completed", "Lost"] as string[]).includes(l.status || "") && daysSinceUpdate > 2) {
                staleLeadsCount++;
            }

            // Response Rate: Leads moved out of initial inquiry
            if (!(["New Inquiry", "New"] as string[]).includes(l.status || "")) {
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
        if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
            return { success: false, message: "Unauthorized" };
        }
    }

    try {
        // 1. Fetch Lead
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId)
        });

        if (!lead) return { success: false, message: "Lead not found" };
        if (lead.status === "Completed") return { success: false, message: "Lead is already won!" };

        // 2. Ensure Client User Exists
        let clientUserId = "";
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, lead.email)
        });

        if (!existingUser) {
            const [newUser] = await db.insert(users).values({
                name: lead.name,
                email: lead.email,
                role: "client",
            }).returning({ id: users.id });
            clientUserId = newUser.id;
            console.log(`[SYS_LOG] 👤 Created new Client User account for ${lead.email}`);
        } else {
            clientUserId = existingUser.id;
            // VERY STRICT ROLE CHECK - NEVER DOWNGRADE AN ADMIN OR EDITOR TO CLIENT
            if (existingUser.role !== "admin" && existingUser.role !== "editor") {
                await db.update(users).set({ role: "client" }).where(eq(users.id, existingUser.id));
                console.log(`[SYS_LOG] 👤 Upgraded existing User account to Client for ${lead.email}`);
            } else {
                console.log(`[SYS_LOG] 🛡️ Protected Agency Staff role: Existing User account kept role '${existingUser.role}' for ${lead.email}`);
            }
        }

        // 3. Create Operational Project (PM Engine)
        const [newProject] = await db.insert(agencyProjects).values({
            title: lead.service ? `${lead.name} - ${lead.service}` : `${lead.name} Project`,
            description: lead.notes || lead.message,
            leadId: lead.id,
            status: "Kickoff",
        }).returning({ id: agencyProjects.id, title: agencyProjects.title });
        
        // 3.5 Write to projectStakeholders Junction Table
        await db.insert(projectStakeholders).values({
            projectId: newProject.id,
            userId: clientUserId
        });
        console.log(`[SYS_LOG] 🚀 Provisioned Agency Project: ${newProject.id} with Stakeholder ${clientUserId}`);

        // 4. Create Default Milestone Scaffolding
        await db.insert(milestones).values([
            { projectId: newProject.id, title: "Discovery", status: "Pending", order: 1 },
            { projectId: newProject.id, title: "Design", status: "Pending", order: 2 },
            { projectId: newProject.id, title: "Development", status: "Pending", order: 3 },
            { projectId: newProject.id, title: "QA & Launch", status: "Pending", order: 4 },
        ]);
        console.log(`[SYS_LOG] 🗺️ Generated default project milestones.`);

        // 5. Update Lead Status
        await db.update(leads)
            .set({ status: "Won", updatedAt: new Date() })
            .where(eq(leads.id, leadId));

        // 6. Send Client Portal Credentials via Email
        await sendClientWelcomeEmail({
            name: lead.name,
            email: lead.email,
            projectName: newProject.title
        });

        await notifyAllAdmins(`Lead ${lead.name} won! Project "${newProject.title}" provisioned.`, "deal_won", `/dashboard/pm/${newProject.id}`);

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


