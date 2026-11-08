"use server";

import { db } from "@/db";
import { leads, inquiries, users, leadActivityLogs, agencyProjects, leadAssignees, tasks, proposals, passwordResetTokens, crmTasks, discoveryForms, meetings } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, inArray, and, sql, not, isNull, desc } from "drizzle-orm";
import { leadUpdateSchema, transitionLeadSchema, logLeadActivitySchema, type LeadUpdateValues, type TransitionLeadValues, type LogLeadActivityValues } from "@/lib/schemas";

import { getLeadEffectiveValue } from "@/features/crm/utils/dealValue";
import { parseBudgetToEstimatedValue } from "@/lib/utils";
import { sendClientOnboardingEmail } from "@/lib/notifications";
import { auth, hasRole } from "@/auth";
import { requireRoles, requireRole } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { DEFAULT_CRM_PLAYBOOK, type PlaybookTaskTemplate } from "@/config/crm-playbook";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getBaseUrl } from "@/lib/email-templates";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
};

export async function createInquiry(data: { name: string, email: string, source: string, service?: string, budget?: string, notes?: string }): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
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
    // Same fields as the inquiry form (spec step 1), so a lead added by Sales reads like one from the website.
    urgency?: string;
    roleInCompany?: string;
    contactPreference?: string;
    details?: string;
    source?: string;
    assignedRepId?: string | null;
    tasksPlaybook?: PlaybookTaskTemplate[];
}): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const randomPassword = crypto.randomBytes(16).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const result = await db.transaction(async (tx) => {
            // 1. Find or create client user
            let clientUser = await tx.query.users.findFirst({
                where: eq(users.email, data.contactEmail),
            });

            if (!clientUser) {
                const [newUser] = await tx.insert(users).values({
                    email: data.contactEmail,
                    name: data.contactName || data.businessName,
                    password: hashedPassword,
                    role: "client",
                }).returning();
                clientUser = newUser;
            }

            // 2. Parse estimated value and calculate lead score
            const estimatedValue = data.estimatedValue || (data.budget ? parseBudgetToEstimatedValue(data.budget) : 0);
                        const qualificationStatus = "Lead";
            const priority = "Warm";

            // 3. Create lead
            const [newLead] = await tx.insert(leads).values({
                clientId: clientUser.id,
                businessName: data.businessName,
                contactName: data.contactName,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                serviceId: data.serviceId || null,
                budget: data.budget,
                estimatedValue,
                qualificationStatus,
                priority,
                timelineExpectation: data.timelineExpectation,
                goals: data.goals,
                industry: data.industry,
                urgency: data.urgency?.trim().slice(0, 40) || null,
                roleInCompany: data.roleInCompany?.trim().slice(0, 80) || null,
                contactPreference: data.contactPreference?.trim().slice(0, 40) || null,
                details: data.details?.trim().slice(0, 5000) || null,
                status: "New Lead",
                source: data.source || "Manual Entry",
                lastContactedAt: new Date(),
            }).returning();

            // 4. Staff Assignment (Auto Round-Robin vs Explicit Selection)
            let assignedRepId = data.assignedRepId;

            if (!assignedRepId || assignedRepId === "auto") {
                const salesReps = await tx.query.users.findMany({
                    where: eq(users.role, "sales"),
                });

                if (salesReps.length > 0) {
                    const activeCounts = await tx.select({ 
                            repId: leadAssignees.userId, 
                            count: sql<number>`count(${leads.id})` 
                        })
                        .from(leadAssignees)
                        .innerJoin(leads, eq(leadAssignees.leadId, leads.id))
                        .where(and(
                            inArray(leadAssignees.userId, salesReps.map(r => r.id)),
                            not(inArray(leads.status, ["Closed Won", "Closed Lost"]))
                        ))
                        .groupBy(leadAssignees.userId);

                    const repsWithCounts = salesReps.map(rep => {
                        const record = activeCounts.find(c => c.repId === rep.id);
                        return { repId: rep.id, count: record ? Number(record.count) : 0 };
                    });

                    repsWithCounts.sort((a, b) => a.count - b.count);
                    assignedRepId = repsWithCounts[0].repId;
                } else {
                    // No sales reps available: leave lead unassigned
                    assignedRepId = null;
                }
            } else if (assignedRepId === "unassigned") {
                assignedRepId = null;
            }

            if (assignedRepId && assignedRepId !== "auto") {
                const targetUser = await tx.query.users.findFirst({
                    where: eq(users.id, assignedRepId),
                    columns: { role: true }
                });
                
                if (!targetUser || !["sales"].includes(targetUser.role)) {
                    throw new Error("Invalid assignment: Target user must be Sales or Superadmin");
                }

                await tx.insert(leadAssignees).values({
                    leadId: newLead.id,
                    userId: assignedRepId,
                });
            } else {
                assignedRepId = null;
            }

            // 5. Automated Sales Playbook (Task Provisioning)
            const tasksToProvision = data.tasksPlaybook !== undefined
                ? data.tasksPlaybook
                : DEFAULT_CRM_PLAYBOOK.defaultTasks;

            if (tasksToProvision && tasksToProvision.length > 0) {
                const now = new Date();
                await tx.insert(crmTasks).values(
                    tasksToProvision.map((task) => ({
                        leadId: newLead.id,
                        assignedTo: assignedRepId,
                        title: task.title,
                        description: task.description || "Automatically provisioned task.",
                        taskType: task.taskType || "To-do",
                        priority: task.priority || "Medium",
                        status: "Pending" as const,
                        dueDate: new Date(now.getTime() + (task.dueHours || 24) * 60 * 60 * 1000),
                    }))
                );
            }

            // 6. Log initial creation note
            await tx.insert(leadActivityLogs).values({
                leadId: newLead.id,
                authorId: session.user.id || null,
                activityType: "System",
                content: `Lead created with priority ${priority}. Assigned to ${assignedRepId ? "rep" : "unassigned"}.`,
            });
            
            return newLead;
        });

        await logAction("CREATE", "Lead", `Created lead "${data.businessName}" (${result.id})`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: `Lead "${data.businessName}" created successfully` };
    } catch (e) {
        console.error("Failed to create lead:", e);
        return { success: false, message: "Failed to create lead" };
    }
}

export async function convertInquiryToLead(inquiryId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
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

        const priority = "Warm";

        // Create the lead
        const [newLead] = await db.insert(leads).values({
            clientId: clientUser.id,
            businessName: inquiry.name,
            contactName: inquiry.name,
            contactEmail: inquiry.email,
            goals: inquiry.message,
            source: inquiry.source || "Website Form",
            priority,
            status: "New Lead",
            lastContactedAt: new Date(),
        }).returning();

        // Update inquiry status
        await db.update(inquiries)
            .set({ status: "Archived", isHandled: true })
            .where(eq(inquiries.id, inquiryId));

        await logAction("CREATE", "Lead", `Converted inquiry ${inquiryId} to Lead ${newLead.id}`);

        if (isNewUser) {
            const baseUrl = getBaseUrl();
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
    if (!hasRole(session, ["sales"])) {
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
        // Extract non-column fields to prevent SQL errors
        const { assigneeIds, notes, files, activityType, ...otherFields } = validated.data;
                const updateData: Record<string, unknown> = {
            ...otherFields,
            updatedAt: new Date(),
        };

        

        await db.update(leads)
            .set(updateData)
            .where(eq(leads.id, id));

        // If an assignment was made, write to the junction table
        // (Wiping previous assignees for this UI action if it's a 1-to-many overwrite, or just accumulating)
        if (assigneeIds !== undefined) {
            if (assigneeIds && assigneeIds.length > 0) {
                const targetUsers = await db.query.users.findMany({
                    where: inArray(users.id, assigneeIds),
                    columns: { id: true, role: true }
                });
                const validRoles = ["sales"];
                const invalidUsers = targetUsers.filter(u => !validRoles.includes(u.role));
                
                if (invalidUsers.length > 0) {
                    throw new Error("Invalid assignment: All assigned users must be Sales or Superadmin");
                }
            }

            await db.delete(leadAssignees).where(eq(leadAssignees.leadId, id));
            if (assigneeIds && assigneeIds.length > 0) {
                await db.insert(leadAssignees).values(
                    assigneeIds.map(userId => ({ leadId: id, userId }))
                );
            }
        }

        await logAction("UPDATE", "Lead", `Lead ${id} properties updated.`);

        revalidatePath("/dashboard/leads");
        revalidatePath("/dashboard/analytics");
        return { success: true, message: "Lead updated successfully" };
    } catch (error) {
        console.error("Failed to update lead:", error);
        return { success: false, message: "Database error: Failed to update lead." };
    }
}

export async function logLeadActivity(data: LogLeadActivityValues): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
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

            // 2. Auto-advance New Lead to Discovery & Qualifying
            await advanceToDiscoveryIfNew(tx, leadId, `First logged ${activityType.toLowerCase()}`);

            // 3. Update lead's lastContactedAt and nextFollowUpDate
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
    if (!hasRole(session, ["sales"])) {
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

        if (newStatus === "Proposal Sent" || newStatus === "In Negotiation" || newStatus === "Closed Won") {
            return {
                success: false,
                message: `Cannot manually transition lead stage to "${newStatus}". This stage is set automatically by system workflow events.`,
            };
        }

        const validation = await validateLeadTransition(leadId, newStatus);
        if (!validation.valid) {
            return { success: false, message: validation.error };
        }

        const oldStatus = lead.status;
        const now = new Date();

        await db.transaction(async (tx) => {
            const updatePayload: Record<string, unknown> = {
                status: newStatus,
                closedWonAt: oldStatus === "Closed Won" ? null : undefined,
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

    if (!hasRole(session, ["superadmin"])) {
        return null;
    }

    try {
        // Parallel Drizzle Fetching
        const [analytics, allLeads, allProjects, allTasks, allProposals] = await Promise.all([
            db.select({
                wonLeadsCount: sql<number>`COUNT(${leads.id}) FILTER (WHERE ${leads.status} = 'Closed Won')`,
                lostLeadsCount: sql<number>`COUNT(${leads.id}) FILTER (WHERE ${leads.status} = 'Closed Lost')`,
                activeLeadsCount: sql<number>`COUNT(${leads.id}) FILTER (WHERE ${leads.status} NOT IN ('Closed Won', 'Closed Lost'))`,
                winRate: sql<number>`
                    CASE WHEN COUNT(${leads.id}) = 0 THEN 0
                    ELSE ROUND((COUNT(${leads.id}) FILTER (WHERE ${leads.status} = 'Closed Won')::numeric / COUNT(${leads.id})::numeric) * 100, 2)
                    END
                `,
            }).from(leads).where(isNull(leads.archivedAt)),
            db.query.leads.findMany({
                where: isNull(leads.archivedAt),
                with: {
                    proposals: {
                        where: isNull(proposals.deletedAt),
                        orderBy: [desc(proposals.updatedAt)],
                    },
                }
            }),
            db.query.agencyProjects.findMany({
                with: {
                    lead: true,
                }
            }),
            db.query.tasks.findMany({
                where: isNull(tasks.deletedAt),
                with: {
                    project: true,
                }
            }),
            db.query.proposals.findMany({
                where: isNull(proposals.deletedAt),
                with: {
                    lead: true,
                }
            })
        ]);

        const kpi = analytics[0];
        let totalPipelineValue = 0;
        let weightedPipelineValue = 0;
        const now = new Date();

        let staleDealsCount = 0;

        allLeads.forEach((l) => {
            const dealValue = getLeadEffectiveValue(l);

            if (["New Lead", "Discovery & Qualifying", "Proposal Sent", "In Negotiation"].includes(l.status)) {
                totalPipelineValue += dealValue;

                if (l.status === "New Lead") {
                    weightedPipelineValue += dealValue * 0.10;
                } else if (l.status === "Discovery & Qualifying") {
                    weightedPipelineValue += dealValue * 0.30;
                } else if (l.status === "Proposal Sent") {
                    weightedPipelineValue += dealValue * 0.60;
                } else if (l.status === "In Negotiation") {
                    weightedPipelineValue += dealValue * 0.85;
                }

                // Check stale status (>=5 days uncontacted, matching Action Queue & Kanban)
                const lastActivity = l.lastContactedAt
                    ? new Date(l.lastContactedAt)
                    : (l.updatedAt ? new Date(l.updatedAt) : new Date(l.createdAt));
                const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 3600 * 24));
                if (daysInactive >= 5) {
                    staleDealsCount++;
                }
            }
        });

        // Win/Loss Rate: Reconcile closed deal win rate vs overall conversion
        const totalClosed = Number(kpi.wonLeadsCount) + Number(kpi.lostLeadsCount);
        const winRatePercentage = totalClosed > 0 
            ? ((Number(kpi.wonLeadsCount) / totalClosed) * 100).toFixed(1)
            : (allLeads.length > 0 ? ((Number(kpi.wonLeadsCount) / allLeads.length) * 100).toFixed(1) : "0.0");
        const conversionRatePercentage = allLeads.length > 0
            ? ((Number(kpi.wonLeadsCount) / allLeads.length) * 100).toFixed(1)
            : "0.0";

        // Active Projects (exclude archived boolean flag as well as terminal status)
        const activeProjects = allProjects.filter(p => !p.isArchived && !["Completed", "Archived"].includes(p.status));
        const activeProjectsCount = activeProjects.length;

        // Task Completion Velocity (exclude soft-deleted tasks and tasks in archived projects)
        const validTasks = allTasks.filter(t => !t.deletedAt && !t.project?.isArchived);
        const doneTasksCount = validTasks.filter(t => t.status === "done").length;
        const totalTasksCount = validTasks.length;
        const taskCompletionRate = totalTasksCount > 0
            ? ((doneTasksCount / totalTasksCount) * 100).toFixed(1)
            : "0.0";

        // 2. Visualizations Data - Comprehensive Task Distribution
        const taskStatusCounts = {
            to_do: 0,
            in_progress: 0,
            in_review: 0,
            changes_requested: 0,
            done: 0,
            backlog: 0,
        };
        validTasks.forEach(t => {
            if (taskStatusCounts[t.status as keyof typeof taskStatusCounts] !== undefined) {
                taskStatusCounts[t.status as keyof typeof taskStatusCounts]++;
            }
        });

        const taskDonutData = [
            { name: "In Progress", value: taskStatusCounts.in_progress, fill: "#f59e0b" },
            { name: "In Review", value: taskStatusCounts.in_review, fill: "#3b82f6" },
            { name: "Changes Requested", value: taskStatusCounts.changes_requested, fill: "#ec4899" },
            { name: "To Do", value: taskStatusCounts.to_do, fill: "#71717a" },
            { name: "Done", value: taskStatusCounts.done, fill: "#00D639" },
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
                item.value += getLeadEffectiveValue(l);
            }
        });

        const trendData = Array.from(trendMap.values());

        // 3. "Action Required" Triage Queue
        const actionQueue: Array<{
            id: string;
            type: "task_revision" | "pending_proposal" | "stale_lead";
            title: string;
            subtitle: string;
            urgency: "high" | "medium" | "low";
            link: string;
            badgeText: string;
            createdAt: string;
        }> = [];

        // Changes Requested Tasks (High / Red)
        validTasks.forEach(t => {
            if (t.status === "changes_requested") {
                actionQueue.push({
                    id: `task-rev-${t.id}`,
                    type: "task_revision",
                    title: `Revisions Requested: "${t.title}"`,
                    subtitle: `Project: ${t.project?.title || "Unknown"} — Changes requested on deliverable`,
                    urgency: "high",
                    link: `/dashboard/pm/${t.projectId}`,
                    badgeText: "Revisions Needed",
                    createdAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
                });
            }
        });

        // Pending Proposals (Medium / Yellow)
        allProposals.forEach(p => {
            if (p.status === "sent" && !p.deletedAt && !p.lead?.archivedAt) {
                actionQueue.push({
                    id: `prop-${p.id}`,
                    type: "pending_proposal",
                    title: `Proposal Awaiting Client Acceptance`,
                    subtitle: `Lead: ${p.lead?.businessName || "Client"} — Sent on ${new Date(p.updatedAt).toLocaleDateString()}`,
                    urgency: "medium",
                    link: `/dashboard/proposals/${p.id}`,
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
                pipelineValue: totalPipelineValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                weightedPipelineValue: weightedPipelineValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                rawPipelineValue: totalPipelineValue,
                winRatePercentage,
                conversionRatePercentage,
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
            actionQueue: [],
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

    if (!hasRole(session, ["superadmin"])) {
        return null;
    }

    try {
        const allLeads = await db.query.leads.findMany({
            where: isNull(leads.archivedAt),
            with: {
                proposals: {
                    where: isNull(proposals.deletedAt),
                    orderBy: [desc(proposals.updatedAt)],
                },
            }
        });

        // 2. KPI Calculations
        const totalLeads = allLeads.length;
        const wonLeads = allLeads.filter(l => l.status === "Closed Won").length;
        const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

        // Estimate Revenue (sum of effective deal values in pipeline)
        const pipelineValue = allLeads
            .filter(l => ["New Lead", "Discovery & Qualifying", "Proposal Sent", "In Negotiation"].includes(l.status))
            .reduce((acc, lead) => {
                return acc + getLeadEffectiveValue(lead);
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

            // Stale Leads: Not in terminal state AND untouched for >= 5 days
            if (!(["Closed Won", "Closed Lost"] as string[]).includes(l.status || "") && Math.floor(daysSinceActivity) >= 5) {
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

export async function getProjectForLead(leadId: string): Promise<{ id: string | null; title: string; status: string } | null> {
    // Only the PM and Sales see whether a lead has a project (spec §1). Everyone else gets nothing.
    const access = await requireRoles(["manager", "sales"]);
    if (!access.ok) return null;

    const proj = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.leadId, leadId),
        columns: { id: true, title: true, status: true },
    });
    if (!proj) return null;
    if (access.session.user.role === "sales") return { id: null, title: proj.title, status: proj.status };
    return proj;
}

export async function archiveLead(leadId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
        return { success: false, message: "Unauthorized: Only sales can archive leads." };
    }

    try {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId),
        });

        if (!lead) {
            return { success: false, message: "Lead not found" };
        }

        if (lead.status !== "Closed Won" && lead.status !== "Closed Lost") {
            return { success: false, message: "Only closed leads (Closed Won or Closed Lost) can be archived." };
        }

        await db.update(leads)
            .set({ archivedAt: new Date(), updatedAt: new Date() })
            .where(eq(leads.id, leadId));

        await logAction("UPDATE", "Lead", `Lead ${leadId} archived.`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead securely archived." };
    } catch (error) {
        console.error("Failed to archive lead:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function reopenLead(leadId: string, reopenReason: string): Promise<ActionState> {
    const authz = await requireRole(["sales"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only sales can reopen leads." };
    }

    if (!reopenReason || reopenReason.trim().length === 0) {
        return { success: false, message: "A reason is required to reopen a lost lead." };
    }

    const { session } = authz;
    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    if (lead.status !== "Closed Lost") {
        return { success: false, message: "Only Closed Lost leads can be reopened." };
    }

    try {
        const now = new Date();
        // Update stage to Discovery & Qualifying, set stageChangedAt, but KEEP lossReason and lossNotes
        await db.update(leads).set({
            status: "Discovery & Qualifying",
            stageChangedAt: now,
            updatedAt: now,
        }).where(eq(leads.id, leadId));

        // Insert System interaction
        await db.insert(leadActivityLogs).values({
            leadId,
            authorId: session.user.id,
            activityType: "System",
            content: `Lead reopened: ${reopenReason.trim()}`,
        });

        // Write audit row
        await logAction("UPDATE", "Lead", `Lead ${leadId} reopened from Closed Lost: ${reopenReason.trim()}`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead reopened and moved to Discovery & Qualifying." };
    } catch (error) {
        console.error("Failed to reopen lead:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function getLeads() {
    const authz = await requireRole(["sales"]);
    if (!authz.ok) return [];

    return db.query.leads.findMany({
        where: isNull(leads.archivedAt),
        with: {
            client: true,
            assignees: { with: { user: true } },
            proposals: {
                where: isNull(proposals.deletedAt),
                orderBy: [desc(proposals.updatedAt)],
            },
        },
        orderBy: [desc(leads.createdAt)],
    });
}

export async function getPipelineLeads() {
    const authz = await requireRole(["sales"]);
    if (!authz.ok) return [];

    return db.query.leads.findMany({
        where: and(
            isNull(leads.archivedAt),
            not(inArray(leads.status, ["Closed Won", "Closed Lost"]))
        ),
        with: {
            client: true,
            assignees: { with: { user: true } },
            proposals: {
                where: isNull(proposals.deletedAt),
                orderBy: [desc(proposals.updatedAt)],
            },
        },
        orderBy: [desc(leads.createdAt)],
    });
}

export async function unarchiveLead(leadId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
        return { success: false, message: "Unauthorized." };
    }

    try {
        await db.update(leads)
            .set({ isArchived: false, updatedAt: new Date() })
            .where(eq(leads.id, leadId));

        await logAction("UPDATE", "Lead", `Lead ${leadId} restored to active pipeline.`);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead restored to active pipeline." };
    } catch (error) {
        console.error("Failed to unarchive lead:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function getSalesPlaybookConfig() {
    return DEFAULT_CRM_PLAYBOOK;
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
            where: and(eq(proposals.leadId, leadId), eq(proposals.status, "signed")),
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
    if (!hasRole(session, ["sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId)
        });

        if (!lead) return { success: false, message: "Lead not found" };

        const restrictedAutomatedStages = ["Closed Won", "Proposal Sent", "In Negotiation"];
        if (restrictedAutomatedStages.includes(newStatus)) {
            return {
                success: false,
                message: `Cannot manually update lead stage to "${newStatus}". This stage is managed exclusively via automated workflows.`,
            };
        }

        const validation = await validateLeadTransition(leadId, newStatus);
        if (!validation.valid) {
            return { success: false, message: validation.error };
        }

        const oldStatus = lead.status;
        await db.transaction(async (tx) => {
            await tx.update(leads)
                .set({ status: newStatus, closedWonAt: oldStatus === "Closed Won" ? null : undefined, updatedAt: new Date() })
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

/**
 * Shared workflow transition: moves a lead from 'New Lead' to 'Discovery & Qualifying'
 * on the first logged interaction (Call, Meeting, Email, Note) or booked meeting.
 * Writes a System activity interaction and updates stageChangedAt.
 */
export async function advanceToDiscoveryIfNew(
    dbOrTx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
    leadId: string,
    reason: string
): Promise<boolean> {
    const lead = await dbOrTx.query.leads.findFirst({
        where: eq(leads.id, leadId),
        columns: { id: true, status: true },
    });

    if (!lead || lead.status !== "New Lead") {
        return false;
    }

    const now = new Date();
    await dbOrTx.update(leads)
        .set({
            status: "Discovery & Qualifying",
            stageChangedAt: now,
            lastContactedAt: now,
            updatedAt: now,
        })
        .where(eq(leads.id, leadId));

    await dbOrTx.insert(leadActivityLogs).values({
        leadId,
        authorId: null,
        activityType: "System",
        content: `Stage moved to Discovery & Qualifying (${reason})`,
    });

    return true;
}

export async function bulkUpdateLeadStatus(
    leadIds: string[],
    newStatus: "New Lead" | "Discovery & Qualifying" | "Proposal Sent" | "In Negotiation" | "Closed Won" | "Closed Lost"
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!leadIds || leadIds.length === 0) {
        return { success: false, message: "No leads selected" };
    }

    const restrictedAutomatedStages = ["Closed Won", "Proposal Sent", "In Negotiation"];
    if (restrictedAutomatedStages.includes(newStatus)) {
        return {
            success: false,
            message: `Cannot manually bulk update leads to "${newStatus}". This stage is managed exclusively via automated workflows.`,
        };
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

        await db.update(leads)
            .set({ status: newStatus, closedWonAt: null, updatedAt: new Date() })
            .where(inArray(leads.id, validLeadIds));

        const logEntries = validLeadIds.map(id => ({
            leadId: id,
            authorId: session.user.id || null,
            activityType: "System" as const,
            content: `Bulk status update to "${newStatus}"`,
        }));
        await db.insert(leadActivityLogs).values(logEntries);

        await logAction("UPDATE", "Lead", `Bulk status update for ${validLeadIds.length} leads to ${newStatus}`);

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
    if (!hasRole(session, ["sales"])) {
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

export async function getDiscoveryTrackerData(leadId: string) {
    const session = await auth();
    if (!hasRole(session, ["sales"])) {
        return null;
    }

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
        columns: {
            id: true,
            proposalRequestedAt: true,
            clientType: true,
        },
    });

    const discoveryMeetings = await db.query.meetings.findMany({
        where: and(eq(meetings.leadId, leadId), eq(meetings.type, "discovery")),
        columns: {
            id: true,
            status: true,
            startsAt: true,
            format: true,
            notes: true,
        },
    });

    const form = await db.query.discoveryForms.findFirst({
        where: eq(discoveryForms.leadId, leadId),
    });

    const hasMeetingScheduled = discoveryMeetings.length > 0;
    const doneMeeting = discoveryMeetings.find((m) => m.status === "done");
    const hasMeetingDone = !!doneMeeting;
    const isFormSubmitted = !!form?.submittedAt;
    const isProposalRequested = !!lead?.proposalRequestedAt;

    return {
        hasMeetingScheduled,
        hasMeetingDone,
        doneMeetingNotes: doneMeeting?.notes || null,
        doneMeetingDate: doneMeeting?.startsAt || null,
        doneMeetingFormat: doneMeeting?.format || null,
        isFormSubmitted,
        isProposalRequested,
        proposalRequestedAt: lead?.proposalRequestedAt || null,
        discoveryForm: form || null,
        clientType: lead?.clientType || form?.clientType || "local",
    };
}

export async function claimLead(
    input: { leadId: string } | string
): Promise<
    | { ok: true; leadId: string }
    | { ok: false; error: "FORBIDDEN" | "ALREADY_ASSIGNED" | "NOT_FOUND"; message: string }
> {
    const leadId = typeof input === "string" ? input : input?.leadId;
    const session = await auth();
    if (!hasRole(session, ["sales"]) || !session?.user?.id) {
        return { ok: false, error: "FORBIDDEN", message: "Forbidden: caller is not Sales." };
    }

    if (!leadId) {
        return { ok: false, error: "NOT_FOUND", message: "Lead not found." };
    }

    const existingLead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
        with: { assignees: true },
    });

    if (!existingLead) {
        return { ok: false, error: "NOT_FOUND", message: "Lead not found." };
    }

    if (existingLead.assignees && existingLead.assignees.length > 0) {
        return {
            ok: false,
            error: "ALREADY_ASSIGNED",
            message: "Lead already has a Sales owner.",
        };
    }

    const actorName = session.user.name || session.user.email || "Sales";

    await db.transaction(async (tx) => {
        await tx.insert(leadAssignees).values({
            leadId,
            userId: session.user.id,
        });

        await tx.insert(leadActivityLogs).values({
            leadId,
            authorId: session.user.id,
            activityType: "System",
            content: `Lead claimed by ${actorName}.`,
        });
    });

    await logAction(
        "UPDATE",
        "Lead",
        `Lead ${leadId} claimed by ${session.user.id}`,
        session.user.id
    );

    revalidatePath("/dashboard/leads");
    revalidatePath("/dashboard");

    return { ok: true, leadId };
}
