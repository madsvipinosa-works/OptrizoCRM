"use server";

import { db } from "@/db";
import { leads, inquiries, users, leadActivityLogs, agencyProjects, milestones, projectStakeholders, leadAssignees, serviceTemplates, taskTemplates, tasks, proposals, passwordResetTokens } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, inArray, and, sql } from "drizzle-orm";
import { leadUpdateSchema, transitionLeadSchema, logLeadActivitySchema, type LeadUpdateValues, type TransitionLeadValues, type LogLeadActivityValues } from "@/lib/schemas";
import { calculateLeadScore } from "@/features/crm/utils/leadScoring";
import { parseBudgetToEstimatedValue } from "@/lib/utils";
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

export async function createLead(data: {
    businessName: string;
    contactName?: string;
    contactEmail: string;
    contactPhone?: string;
    serviceId?: string;
    budget?: string;
    estimatedValue?: number;
    timelineExpectation?: string;
    goals?: string;
    industry?: string;
    source?: string;
}): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        // 1. Find or create client user
        let clientUser = await db.query.users.findFirst({
            where: eq(users.email, data.contactEmail),
        });

        if (!clientUser) {
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const [newUser] = await db.insert(users).values({
                email: data.contactEmail,
                name: data.contactName || data.businessName,
                password: hashedPassword,
                role: "client",
            }).returning();
            clientUser = newUser;
        }

        // 2. Parse estimated value and calculate lead score
        const estimatedValue = data.estimatedValue || (data.budget ? parseBudgetToEstimatedValue(data.budget) : 0);
        const { score: leadScore, priority } = calculateLeadScore({
            estimatedValue,
            budget: data.budget,
            timelineExpectation: data.timelineExpectation,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            goals: data.goals,
            serviceId: data.serviceId,
        });

        // 3. Create lead
        const [newLead] = await db.insert(leads).values({
            clientId: clientUser.id,
            businessName: data.businessName,
            contactName: data.contactName,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            serviceId: data.serviceId || null,
            budget: data.budget,
            estimatedValue,
            leadScore,
            priority,
            timelineExpectation: data.timelineExpectation,
            goals: data.goals,
            industry: data.industry,
            status: "New Lead",
            source: data.source || "Manual Entry",
            lastContactedAt: new Date(),
        }).returning();

        // 4. Log initial creation note
        await db.insert(leadActivityLogs).values({
            leadId: newLead.id,
            authorId: session.user.id || null,
            activityType: "System",
            content: `Lead created with initial score of ${leadScore} (${priority}).`,
        });

        await logAction("CREATE", "Lead", `Created lead "${data.businessName}" (${newLead.id})`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: `Lead "${data.businessName}" created successfully` };
    } catch (e) {
        console.error("Failed to create lead:", e);
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

        const { score: leadScore, priority } = calculateLeadScore({
            contactEmail: inquiry.email,
            contactPhone: null,
            goals: inquiry.message,
            estimatedValue: 0,
        });

        // Create the lead
        const [newLead] = await db.insert(leads).values({
            clientId: clientUser.id,
            businessName: inquiry.name,
            contactName: inquiry.name,
            contactEmail: inquiry.email,
            goals: inquiry.message,
            source: inquiry.source || "Website Form",
            leadScore,
            priority,
            status: "New Lead",
            lastContactedAt: new Date(),
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

export async function logLeadActivity(data: LogLeadActivityValues): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    const validated = logLeadActivitySchema.safeParse(data);
    if (!validated.success) {
        return { success: false, message: "Invalid activity data", errors: validated.error.flatten().fieldErrors };
    }

    try {
        const { leadId, activityType, content, nextFollowUpDate } = validated.data;
        const now = new Date();
        const followUp = nextFollowUpDate ? new Date(nextFollowUpDate) : null;

        await db.transaction(async (tx) => {
            // 1. Insert activity log
            await tx.insert(leadActivityLogs).values({
                leadId,
                authorId: session.user.id || null,
                content: content.trim(),
                activityType,
            });

            // 2. Update lead's lastContactedAt and nextFollowUpDate
            await tx.update(leads)
                .set({
                    lastContactedAt: now,
                    nextFollowUpDate: followUp,
                    updatedAt: now,
                })
                .where(eq(leads.id, leadId));
        });

        await logAction("CREATE", "Lead Activity", `Logged ${activityType} for lead ${leadId}`);

        revalidatePath("/dashboard/leads");
        revalidatePath(`/dashboard/leads/${leadId}`);
        return { success: true, message: "Activity logged successfully" };
    } catch (error) {
        console.error("Failed to log lead activity:", error);
        return { success: false, message: "Failed to log activity" };
    }
}

export async function addLeadNote(leadId: string, content: string, activityType: "Call" | "Email" | "Meeting" | "Note" = "Note"): Promise<ActionState> {
    return logLeadActivity({ leadId, content, activityType });
}

export async function transitionLeadStage(data: TransitionLeadValues): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    const validated = transitionLeadSchema.safeParse(data);
    if (!validated.success) {
        return {
            success: false,
            message: "Validation failed: " + (validated.error.issues[0]?.message || "Invalid input"),
            errors: validated.error.flatten().fieldErrors,
        };
    }

    const { leadId, newStatus, lossReason, lossNotes, reasonNotes } = validated.data;

    try {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId),
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
        const now = new Date();

        await db.transaction(async (tx) => {
            const updatePayload: any = {
                status: newStatus,
                updatedAt: now,
            };

            if (newStatus === "Closed Lost") {
                updatePayload.lossReason = lossReason || "other";
                updatePayload.lossNotes = lossNotes || null;
            }

            await tx.update(leads)
                .set(updatePayload)
                .where(eq(leads.id, leadId));

            const logContent = newStatus === "Closed Lost"
                ? `Lead marked as Closed Lost (Reason: ${lossReason?.replace(/_/g, " ") || "Not specified"})${lossNotes ? ` - Notes: ${lossNotes}` : ""}`
                : `Stage transitioned from "${oldStatus}" to "${newStatus}"${reasonNotes ? `: ${reasonNotes}` : ""}`;

            await tx.insert(leadActivityLogs).values({
                leadId,
                authorId: session.user.id || null,
                activityType: "System",
                content: logContent,
            });
        });

        await logAction("UPDATE", "Lead", `Lead ${leadId} status changed from ${oldStatus} to ${newStatus}`);

        revalidatePath("/dashboard/leads");
        revalidatePath(`/dashboard/leads/${leadId}`);

        return { success: true, message: `Lead moved to ${newStatus}` };
    } catch (error) {
        console.error("Failed to transition lead stage:", error);
        return { success: false, message: "Failed to update lead status" };
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
        const [analytics, allLeads, allProjects, allTasks, allProposals] = await Promise.all([
            db.select({
                totalPipelineValue: sql<string>`COALESCE(SUM(${leads.estimatedValue}) FILTER (WHERE ${leads.status} IN ('New Lead', 'Discovery & Qualifying', 'Proposal Sent', 'In Negotiation')), 0)`,
                wonLeadsCount: sql<number>`COUNT(${leads.id}) FILTER (WHERE ${leads.status} = 'Closed Won')`,
                lostLeadsCount: sql<number>`COUNT(${leads.id}) FILTER (WHERE ${leads.status} = 'Closed Lost')`,
                activeLeadsCount: sql<number>`COUNT(${leads.id}) FILTER (WHERE ${leads.status} NOT IN ('Closed Won', 'Closed Lost'))`,
                winRate: sql<number>`
                    CASE WHEN COUNT(${leads.id}) = 0 THEN 0
                    ELSE ROUND((COUNT(${leads.id}) FILTER (WHERE ${leads.status} = 'Closed Won')::numeric / COUNT(${leads.id})::numeric) * 100, 2)
                    END
                `,
            }).from(leads).where(eq(leads.isArchived, false)),
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

        const kpi = analytics[0];
        let weightedPipelineValue = 0;
        const now = new Date();
        const staleThresholdMs = 5 * 24 * 60 * 60 * 1000; // 5 days

        let staleDealsCount = 0;

        allLeads.forEach((l) => {
            if (["New Lead", "Discovery & Qualifying", "Proposal Sent", "In Negotiation"].includes(l.status)) {
                if (l.status === "New Lead") {
                    weightedPipelineValue += l.estimatedValue * 0.10;
                } else if (l.status === "Discovery & Qualifying") {
                    weightedPipelineValue += l.estimatedValue * 0.30;
                } else if (l.status === "Proposal Sent") {
                    weightedPipelineValue += l.estimatedValue * 0.60;
                } else if (l.status === "In Negotiation") {
                    weightedPipelineValue += l.estimatedValue * 0.85;
                }

                // Check stale status (>5 days uncontacted)
                const lastActivity = l.lastContactedAt ? new Date(l.lastContactedAt).getTime() : new Date(l.createdAt).getTime();
                if (now.getTime() - lastActivity > staleThresholdMs) {
                    staleDealsCount++;
                }
            }
        });

        // Win/Loss Rate
        const totalClosed = Number(kpi.wonLeadsCount) + Number(kpi.lostLeadsCount);
        const winRatePercentage = Number(kpi.winRate).toFixed(1);

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
            if (["New Lead", "Discovery & Qualifying", "Proposal Sent", "In Negotiation"].includes(l.status)) {
                const lastActivity = l.lastContactedAt ? new Date(l.lastContactedAt) : (l.updatedAt ? new Date(l.updatedAt) : new Date(l.createdAt));
                const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 3600 * 24));
                if (daysInactive >= 5) {
                    actionQueue.push({
                        id: `lead-${l.id}`,
                        type: "stale_lead",
                        title: `Stale Deal: "${l.businessName || l.contactName || "Unnamed Lead"}"`,
                        subtitle: `Status: ${l.status} — No contact for ${daysInactive} days`,
                        urgency: "low",
                        link: `/dashboard/leads`,
                        badgeText: `${daysInactive}d Idle`,
                        createdAt: lastActivity.toISOString(),
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
                pipelineValue: Number(kpi.totalPipelineValue).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                weightedPipelineValue: weightedPipelineValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                rawPipelineValue: Number(kpi.totalPipelineValue),
                winRatePercentage,
                wonLeadsCount: Number(kpi.wonLeadsCount),
                lostLeadsCount: Number(kpi.lostLeadsCount),
                totalClosedCount: totalClosed,
                activeProjectsCount,
                staleDealsCount,
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
            .filter(l => !(["Closed Lost"] as string[]).includes(l.status || ""))
            .reduce((acc, lead) => {
                return acc + lead.estimatedValue;
            }, 0);

        // 3. Chart Data Preparation

        // Pipeline Distribution (6-stage model)
        const pipelineData = [
            { name: "New Lead", value: allLeads.filter(l => l.status === "New Lead").length, fill: "#3b82f6" },
            { name: "Discovery", value: allLeads.filter(l => l.status === "Discovery & Qualifying").length, fill: "#8b5cf6" },
            { name: "Proposal", value: allLeads.filter(l => l.status === "Proposal Sent").length, fill: "#f59e0b" },
            { name: "Negotiation", value: allLeads.filter(l => l.status === "In Negotiation").length, fill: "#06b6d4" },
            { name: "Won", value: allLeads.filter(l => l.status === "Closed Won").length, fill: "#10b981" },
            { name: "Lost", value: allLeads.filter(l => l.status === "Closed Lost").length, fill: "#ef4444" },
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
            const lastActivity = l.lastContactedAt ? new Date(l.lastContactedAt) : (l.updatedAt ? new Date(l.updatedAt) : created);
            const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
            const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 3600 * 24);

            // Lead Aging: How long a lead has been in raw new lead state
            if (l.status === "New Lead") {
                totalAgeDays += daysSinceCreation;
                agedLeadsCount++;
            }

            // Stale Leads: Not in terminal state AND untouched for > 5 days
            if (!(["Closed Won", "Closed Lost"] as string[]).includes(l.status || "") && daysSinceActivity > 5) {
                staleLeadsCount++;
            }

            // Response Rate: Leads moved out of initial new lead stage
            if (l.status !== "New Lead") {
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
        
        await db.transaction(async (tx) => {
            if (!internalRoles.includes(lead.client!.role)) {
                await tx.update(users).set({ role: "client" }).where(eq(users.id, lead.clientId));
                console.log(`[SYS_LOG] 👤 Upgraded existing User account to Client for ${lead.client!.email}`);
            } else {
                console.log(`[SYS_LOG] 🛡️ Protected Agency Staff role: Existing User account kept role '${lead.client!.role}' for ${lead.client!.email}`);
            }

            // 3. Create Operational Project (PM Engine)
            const [newProject] = await tx.insert(agencyProjects).values({
                title: lead.serviceId ? `${lead.businessName || lead.client!.name} Project` : `${lead.businessName || lead.client!.name} Project`,
                description: lead.goals,
                leadId: lead.id,
                status: "Kickoff",
            }).returning({ id: agencyProjects.id, title: agencyProjects.title });
            
            // 3.5 Write to projectStakeholders Junction Table
            await tx.insert(projectStakeholders).values({
                projectId: newProject.id,
                userId: clientUserId
            });
            console.log(`[SYS_LOG] 🚀 Provisioned Agency Project: ${newProject.id} with Stakeholder ${clientUserId}`);

            // 4. Create Default Milestone Scaffolding or Apply Templates
            let templateApplied = false;
            if (lead.serviceId) {
                const template = await tx.query.serviceTemplates.findFirst({
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

                        const [newMs] = await tx.insert(milestones).values({
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
                        await tx.insert(tasks).values(tasksToInsert);
                    }
                    templateApplied = true;
                    console.log(`[SYS_LOG] 🗺️ Generated project milestones from template '${template.name}'.`);
                }
            }

            if (!templateApplied) {
                await tx.insert(milestones).values([
                    { projectId: newProject.id, title: "Discovery", status: "Pending", order: 1 },
                    { projectId: newProject.id, title: "Design", status: "Pending", order: 2 },
                    { projectId: newProject.id, title: "Development", status: "Pending", order: 3 },
                    { projectId: newProject.id, title: "QA & Launch", status: "Pending", order: 4 },
                ]);
                console.log(`[SYS_LOG] 🗺️ Generated default project milestones.`);
            }

            // 5. Update Lead Status
            await tx.update(leads)
                .set({ status: "Closed Won", updatedAt: new Date() })
                .where(eq(leads.id, leadId));
        });

        // 6. Send Client Portal Credentials via Email
        await sendClientWelcomeEmail({
            name: lead.client.name || "Client",
            email: lead.client.email,
            projectName: lead.serviceId ? `${lead.businessName || lead.client.name} Project` : `${lead.businessName || lead.client.name} Project`
        });

        await notifyAllAdmins(`Lead ${lead.businessName || lead.client.name} won! Project provisioned.`, "deal_won", `/dashboard/pm`);

        await logAction("UPDATE", "Lead", `Lead ${lead.id} marked as Won and Project provisioned.`);

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
    newStatus: "New Lead" | "Discovery & Qualifying" | "Proposal Sent" | "In Negotiation" | "Closed Won" | "Closed Lost"
): Promise<{ valid: boolean; error?: string }> {
    if (newStatus === "Proposal Sent" || newStatus === "In Negotiation") {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.leadId, leadId),
        });
        if (!proposal) {
            return { valid: false, error: `Cannot move to "${newStatus}". A proposal/SOW must first be generated.` };
        }
    }

    if (newStatus === "Closed Won") {
        const proposal = await db.query.proposals.findFirst({
            where: and(eq(proposals.leadId, leadId), eq(proposals.status, "Approved")),
        });
        if (!proposal) {
            return { valid: false, error: "Cannot move to Closed Won. This deal requires an approved proposal." };
        }
    }
    
    return { valid: true };
}

export async function updateLeadStatusWithAudit(
    leadId: string,
    newStatus: "New Lead" | "Discovery & Qualifying" | "Proposal Sent" | "In Negotiation" | "Closed Won" | "Closed Lost",
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
        await db.transaction(async (tx) => {
            await tx.update(leads)
                .set({ status: newStatus, updatedAt: new Date() })
                .where(eq(leads.id, leadId));

            const logContent = `Status updated from "${oldStatus}" to "${newStatus}"${reasonNotes ? `: ${reasonNotes}` : ""}`;
            await tx.insert(leadActivityLogs).values({
                leadId,
                authorId: session.user.id || null,
                activityType: "System",
                content: logContent,
            });
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
    newStatus: "New Lead" | "Discovery & Qualifying" | "Proposal Sent" | "In Negotiation" | "Closed Won" | "Closed Lost"
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



