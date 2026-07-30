"use server";

import { db } from "@/db";
import { leads, inquiries, users, leadActivityLogs, agencyProjects, milestones, projectStakeholders, leadAssignees, serviceTemplates, taskTemplates, tasks, proposals, passwordResetTokens } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, inArray, and } from "drizzle-orm";
import { leadUpdateSchema, type LeadUpdateValues } from "@/lib/schemas";
import { sendClientWelcomeEmail, sendClientOnboardingEmail } from "@/lib/notifications";
import { auth, hasRole } from "@/auth";
import { notifyAllAdmins } from "@/features/notifications/actions";
import { logAction } from "@/features/audit/actions";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
};

export async function createInquiry(data: { name: string, email: string, source: string, service?: string, budget?: string, notes?: string }): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
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

export async function convertInquiryToLead(inquiryId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const inquiry = await db.query.inquiries.findFirst({
            where: eq(inquiries.id, inquiryId),
        });

        if (!inquiry) return { success: false, message: "Inquiry not found" };

        let clientUser = await db.query.users.findFirst({
            where: eq(users.email, inquiry.email),
        });

        let isNewUser = false;
        let token = "";

        if (!clientUser) {
            isNewUser = true;
            // Generate a random secure password for the placeholder account
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const [newUser] = await db.insert(users).values({
                email: inquiry.email,
                name: inquiry.name,
                password: hashedPassword,
                role: "client",
            }).returning();
            clientUser = newUser;
            
            // Generate password reset token for onboarding
            token = crypto.randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

            await db.insert(passwordResetTokens).values({
                email: inquiry.email,
                token,
                expiresAt,
            });
        }

        // Create the lead
        const [newLead] = await db.insert(leads).values({
            clientId: clientUser.id,
            businessName: inquiry.name, // Using name as fallback business name
            goals: inquiry.message,
            source: inquiry.source,
            status: "Pending Approval",
        }).returning();

        // Update inquiry status
        await db.update(inquiries).set({ status: "Archived" }).where(eq(inquiries.id, inquiryId));

        await logAction("CREATE", "Lead", `Converted inquiry ${inquiryId} to Lead ${newLead.id}`);

        if (isNewUser) {
            const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000');
            const resetUrl = `${baseUrl}/reset-password?token=${token}`;
            
            await sendClientOnboardingEmail({
                name: clientUser.name || "Client",
                email: clientUser.email,
                resetUrl,
            });
        }

        revalidatePath("/dashboard/inquiries");
        revalidatePath("/dashboard/leads");

        return { success: true, message: "Inquiry successfully converted to Lead" };
    } catch (e) {
        console.error("Failed to convert inquiry to lead:", e);
        return { success: false, message: "Database Error" };
    }
}

export async function updateLead(id: string, data: LeadUpdateValues): Promise<ActionState> {
    // 1. Auth Check (Admin or Editor)
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
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
    if (!hasRole(session, ["superadmin", "sales"])) {
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

export async function getUnifiedDashboardData() {
    let session;
    try {
        session = await auth();
    } catch (e) {
        console.error("Auth Session Error in getUnifiedDashboardData:", e);
        return null;
    }

    if (!hasRole(session, ["superadmin", "sales"])) {
        return null;
    }

    try {
        // Parallel Drizzle Fetching
        const [allLeads, allProjects, allTasks, allProposals] = await Promise.all([
            db.select().from(leads),
            db.query.agencyProjects.findMany({
                with: {
                    lead: true,
                }
            }),
            db.query.tasks.findMany({
                with: {
                    project: true,
                }
            }),
            db.query.proposals.findMany({
                with: {
                    lead: true,
                }
            })
        ]);

        // 1. KPI Calculations
        let totalPipelineValue = 0;
        let weightedPipelineValue = 0;
        let wonLeadsCount = 0;
        let lostLeadsCount = 0;

        allLeads.forEach((l) => {
            if (l.status === "Closed Won") wonLeadsCount++;
            else if (l.status === "Closed Lost") lostLeadsCount++;
            
            if (["Pending Approval", "In Review", "Proposal Sent"].includes(l.status)) {
                totalPipelineValue += l.estimatedValue;
                
                if (l.status === "Pending Approval") {
                    weightedPipelineValue += l.estimatedValue * 0.10;
                } else if (l.status === "In Review") {
                    weightedPipelineValue += l.estimatedValue * 0.40;
                } else if (l.status === "Proposal Sent") {
                    weightedPipelineValue += l.estimatedValue * 0.80;
                }
            }
        });

        // Win/Loss Rate
        const totalClosed = wonLeadsCount + lostLeadsCount;
        const winRatePercentage = totalClosed > 0 
            ? ((wonLeadsCount / totalClosed) * 100).toFixed(1) 
            : "0.0";

        // Active Projects
        const activeProjects = allProjects.filter(p => !["Completed", "Archived"].includes(p.status));
        const activeProjectsCount = activeProjects.length;

        // Task Completion Velocity
        const doneTasksCount = allTasks.filter(t => t.status === "Done").length;
        const totalTasksCount = allTasks.length;
        const taskCompletionRate = totalTasksCount > 0
            ? ((doneTasksCount / totalTasksCount) * 100).toFixed(1)
            : "0.0";

        // 2. Visualizations Data
        const taskStatusCounts = {
            "In Progress": 0,
            Blocked: 0,
            Todo: 0,
            Done: 0,
        };
        allTasks.forEach(t => {
            if (taskStatusCounts[t.status as keyof typeof taskStatusCounts] !== undefined) {
                taskStatusCounts[t.status as keyof typeof taskStatusCounts]++;
            }
        });

        const taskDonutData = [
            { name: "In Progress", value: taskStatusCounts["In Progress"], fill: "#f59e0b" },
            { name: "Blocked", value: taskStatusCounts.Blocked, fill: "#f43f5e" },
            { name: "Todo", value: taskStatusCounts.Todo, fill: "#6366f1" },
            { name: "Done", value: taskStatusCounts.Done, fill: "#10b981" },
        ];

        // Lead Source Bar Chart Data
        const sourceMap: Record<string, { total: number; won: number }> = {};
        allLeads.forEach(l => {
            const src = l.source || "Direct Inquiry";
            if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0 };
            sourceMap[src].total++;
            if (l.status === "Closed Won") sourceMap[src].won++;
        });

        const leadSourceData = Object.entries(sourceMap).map(([name, data]) => ({
            name,
            total: data.total,
            won: data.won,
        }));

        // Revenue & Lead Trend (Last 30 days)
        const today = new Date();
        const trendMap = new Map<string, { date: string; leads: number; won: number; value: number }>();
        
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            const displayDate = `${d.getMonth() + 1}/${d.getDate()}`;
            trendMap.set(dateStr, { date: displayDate, leads: 0, won: 0, value: 0 });
        }

        allLeads.forEach(l => {
            const dateStr = new Date(l.createdAt).toISOString().split("T")[0];
            if (trendMap.has(dateStr)) {
                const item = trendMap.get(dateStr)!;
                item.leads++;
                if (l.status === "Closed Won") {
                    item.won++;
                }
                item.value += l.estimatedValue;
            }
        });

        const trendData = Array.from(trendMap.values());

        // 3. "Action Required" Triage Queue
        const now = new Date();
        const actionQueue: Array<{
            id: string;
            type: "blocked_task" | "pending_proposal" | "stale_lead";
            title: string;
            subtitle: string;
            urgency: "high" | "medium" | "low";
            link: string;
            badgeText: string;
            createdAt: string;
        }> = [];

        // Blocked Tasks (High / Red)
        allTasks.forEach(t => {
            if (t.status === "Blocked" || t.isBlockedByClient) {
                actionQueue.push({
                    id: `task-${t.id}`,
                    type: "blocked_task",
                    title: `Blocked Task: "${t.title}"`,
                    subtitle: `Project: ${t.project?.title || "Unknown"} ${t.blockedReason ? `— Reason: ${t.blockedReason}` : ""}`,
                    urgency: "high",
                    link: `/dashboard/pm/${t.projectId}`,
                    badgeText: "Action Required",
                    createdAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
                });
            }
        });

        // Pending Proposals (Medium / Yellow)
        allProposals.forEach(p => {
            if (p.status === "Sent") {
                actionQueue.push({
                    id: `prop-${p.id}`,
                    type: "pending_proposal",
                    title: `Proposal Awaiting Client Acceptance`,
                    subtitle: `Lead: ${p.lead?.businessName || "Client"} — Sent on ${new Date(p.updatedAt).toLocaleDateString()}`,
                    urgency: "medium",
                    link: `/proposal/${p.id}`,
                    badgeText: "Proposal Sent",
                    createdAt: new Date(p.updatedAt).toISOString(),
                });
            }
        });

        // Stale Leads (Low / Orange)
        allLeads.forEach(l => {
            if (["Pending Approval", "In Review"].includes(l.status)) {
                const daysInactive = Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / (1000 * 3600 * 24));
                if (daysInactive >= 2) {
                    actionQueue.push({
                        id: `lead-${l.id}`,
                        type: "stale_lead",
                        title: `Stale Lead: "${l.businessName || "Unnamed Lead"}"`,
                        subtitle: `Status: ${l.status} — Inactive for ${daysInactive} day${daysInactive === 1 ? "" : "s"}`,
                        urgency: "low",
                        link: `/dashboard/leads`,
                        badgeText: `${daysInactive}d Idle`,
                        createdAt: new Date(l.updatedAt).toISOString(),
                    });
                }
            }
        });

        // Sort action queue by urgency
        const urgencyWeight = { high: 3, medium: 2, low: 1 };
        actionQueue.sort((a, b) => {
            if (urgencyWeight[b.urgency] !== urgencyWeight[a.urgency]) {
                return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return {
            kpis: {
                pipelineValue: totalPipelineValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                weightedPipelineValue: weightedPipelineValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                rawPipelineValue: totalPipelineValue,
                winRatePercentage,
                wonLeadsCount,
                lostLeadsCount,
                totalClosedCount: totalClosed,
                activeProjectsCount,
                taskCompletionRate,
                doneTasksCount,
                totalTasksCount,
                totalLeadsCount: allLeads.length,
            },
            charts: {
                taskDonutData,
                leadSourceData,
                trendData,
            },
            actionQueue,
        };

    } catch (error) {
        console.error("Unified Dashboard Analytics Error:", error);
        return null;
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

    if (!hasRole(session, ["superadmin", "sales"])) {
        return null;
    }

    try {
        const allLeads = await db.select().from(leads);

        // 2. KPI Calculations
        const totalLeads = allLeads.length;
        const wonLeads = allLeads.filter(l => l.status === "Closed Won").length;
        const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

        // Estimate Revenue (sum of estimated values)
        const pipelineValue = allLeads
            .filter(l => !(["Closed Lost", "Pending Approval"] as string[]).includes(l.status || "")) // Filter out terminal or raw states
            .reduce((acc, lead) => {
                return acc + lead.estimatedValue;
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

        const clv = wonLeads > 0 ? Math.round(pipelineValue / wonLeads).toLocaleString() : "0";

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
        if (!hasRole(session, ["superadmin", "sales"])) {
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
        const internalRoles = ["superadmin", "sales", "manager", "developer", "content_editor"];
        if (!internalRoles.includes(lead.client.role)) {
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
    if (!hasRole(session, ["superadmin", "sales"])) {
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

async function validateLeadTransition(
    leadId: string,
    newStatus: "Pending Approval" | "In Review" | "Proposal Sent" | "Closed Won" | "Closed Lost"
): Promise<{ valid: boolean; error?: string }> {
    if (newStatus === "Proposal Sent") {
        const proposal = await db.query.proposals.findFirst({
            where: and(eq(proposals.leadId, leadId), eq(proposals.status, "Sent"))
        });
        if (!proposal) return { valid: false, error: "Cannot move to Proposal Sent. This lead requires a sent proposal." };
    }

    if (newStatus === "Closed Won") {
        const proposal = await db.query.proposals.findFirst({
            where: and(eq(proposals.leadId, leadId), eq(proposals.status, "Approved"))
        });
        if (!proposal) return { valid: false, error: "Cannot move to Closed Won. This lead requires an approved proposal." };
    }
    
    return { valid: true };
}

export async function updateLeadStatusWithAudit(
    leadId: string,
    newStatus: "Pending Approval" | "In Review" | "Proposal Sent" | "Closed Won" | "Closed Lost",
    reasonNotes?: string
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId)
        });

        if (!lead) return { success: false, message: "Lead not found" };

        const validation = await validateLeadTransition(leadId, newStatus);
        if (!validation.valid) {
            return { success: false, message: validation.error };
        }

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
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!leadIds || leadIds.length === 0) {
        return { success: false, message: "No leads selected" };
    }

    try {
        const validLeadIds: string[] = [];
        const errors: Record<string, string[]> = {};
        
        for (const id of leadIds) {
            const validation = await validateLeadTransition(id, newStatus);
            if (validation.valid) {
                validLeadIds.push(id);
            } else {
                errors[id] = [validation.error || "Validation failed"];
            }
        }
        
        if (validLeadIds.length === 0) {
            return { 
                success: false, 
                message: "No leads passed validation for this stage.", 
                errors 
            };
        }

        if (newStatus === "Closed Won") {
            for (const id of validLeadIds) {
                await markLeadAsWon(id);
            }
        } else {
            await db.update(leads)
                .set({ status: newStatus, updatedAt: new Date() })
                .where(inArray(leads.id, validLeadIds));

            const logEntries = validLeadIds.map(id => ({
                leadId: id,
                authorId: session.user.id || null,
                activityType: "System" as const,
                content: `Bulk status update to "${newStatus}"`,
            }));
            await db.insert(leadActivityLogs).values(logEntries);

            await logAction("UPDATE", "Lead", `Bulk status update for ${validLeadIds.length} leads to ${newStatus}`);
        }

        revalidatePath("/dashboard/leads");
        
        if (Object.keys(errors).length > 0) {
            return {
                success: true,
                message: `Updated ${validLeadIds.length} leads. ${Object.keys(errors).length} leads failed validation.`,
                errors
            };
        }

        return { success: true, message: `Updated status for ${validLeadIds.length} leads to ${newStatus}` };
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
    if (!hasRole(session, ["superadmin", "sales"])) {
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



