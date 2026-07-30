"use server";

import { db } from "@/db";
import { agencyProjects, milestones, tasks, projectStakeholders, taskAssignees, users, type ProjectDocumentItem } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyAllAdmins } from "@/features/notifications/actions";
import { logAction } from "@/features/audit/actions";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
    task?: Record<string, unknown>;
    milestone?: Record<string, unknown>;
};



// --- Project Actions ---
export async function updateProjectStatus(projectId: string, status: "Kickoff" | "In Progress" | "In Review" | "Completed"): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(agencyProjects)
            .set({ status, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));

        await logAction("UPDATE", "Project", `Project ${projectId} status updated to ${status}`);

        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");
        return { success: true, message: "Project status updated." };
    } catch (error) {
        console.error("Failed to update project status:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateProjectSettings(
    projectId: string, 
    stagingUrls: string[],
    documents?: ProjectDocumentItem[]
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const updatePayload: Record<string, unknown> = {
            stagingUrls,
            updatedAt: new Date()
        };

        if (documents !== undefined) {
            updatePayload.documents = documents;
        }

        await db.update(agencyProjects).set(updatePayload).where(eq(agencyProjects.id, projectId));

        await logAction("UPDATE", "Project Resources", `Project ${projectId} resources updated`);

        revalidatePath("/dashboard/pm/[id]");
        revalidatePath("/portal");
        return { success: true, message: "Project resources updated." };
    } catch (error) {
        console.error("Failed to update project settings:", error);
        return { success: false, message: "Database Error" };
    }
}



// --- Milestone Actions ---
export async function updateMilestoneStatus(milestoneId: string, status: "Pending" | "In Progress" | "Client Approval" | "Completed"): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(milestones)
            .set({ status, updatedAt: new Date() })
            .where(eq(milestones.id, milestoneId));

        // DEPENDENCY LOGIC:
        // If a milestone enters "Client Approval", automatically block all of its active tasks.
        if (status === "Client Approval") {
            await db.update(tasks)
                .set({ isBlockedByClient: true, status: "Blocked", updatedAt: new Date() })
                .where(and(
                    eq(tasks.milestoneId, milestoneId),
                    eq(tasks.status, "In Progress") // Only block active tasks
                ));
        } else {
            // If moving out of Client Approval, unblock tasks that were blocked by client
            await db.update(tasks)
                .set({ isBlockedByClient: false, status: "Todo", updatedAt: new Date() })
                .where(and(
                    eq(tasks.milestoneId, milestoneId),
                    eq(tasks.isBlockedByClient, true)
                ));
        }

        await logAction("UPDATE", "Milestone", `Milestone ${milestoneId} moved to ${status}`);

        revalidatePath("/dashboard/pm/[id]");
        revalidatePath("/portal");
        return { success: true, message: `Milestone moved to ${status}` };
    } catch (error) {
        console.error("Failed to update milestone status:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Task Actions ---
export async function createTask(projectId: string, milestoneId: string, title: string, description?: string, assigneeIds?: string[]): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!title.trim()) return { success: false, message: "Title is required" };

    try {
        const cleanAssigneeIds = Array.from(new Set((assigneeIds || []).filter(Boolean)));

        // Check dependency logic on creation
        const parentMilestone = await db.query.milestones.findFirst({
            where: eq(milestones.id, milestoneId)
        });

        const isParentBlocked = parentMilestone?.status === "Client Approval";

        const [newTask] = await db.insert(tasks).values({
            projectId,
            milestoneId,
            title,
            description,
            status: isParentBlocked ? "Blocked" : "Todo",
            isBlockedByClient: isParentBlocked
        }).returning();

        if (cleanAssigneeIds.length > 0) {
            const { taskAssignees } = await import("@/db/schema");
            await db.insert(taskAssignees).values(
                cleanAssigneeIds.map(userId => ({ taskId: newTask.id, userId }))
            );
        }

        await logAction("CREATE", "Task", `Task "${title}" created`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task created.", task: newTask };
    } catch (error) {
        console.error("Failed to create task:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateTaskStatus(taskId: string, status: "Todo" | "In Progress" | "Blocked" | "In Review" | "Done", proofLinks?: { label: string, url: string }[], proofNotes?: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        // Editor can only update tasks that are explicitly assigned to them.
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const oldTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            with: { milestone: { with: { project: { with: { stakeholders: { with: { user: true } } } } } } }
        });

        if (!oldTask) return { success: false, message: "Task not found" };

        if (status === "Done" && oldTask.requiresProof && !hasRole(session, ["superadmin", "manager"])) {
            return { success: false, message: "Only Managers and Superadmins can approve tasks to Done." };
        }

        if (status === "In Review" && oldTask.requiresProof && (!proofLinks || proofLinks.length === 0) && !proofNotes) {
            return { success: false, message: "Proof Links or Notes are required for review." };
        }

        const wasBlocked = oldTask.isBlockedByClient;
        const isNowBlocked = status === "Blocked";

        const updateData: Record<string, unknown> = { status, isBlockedByClient: isNowBlocked, updatedAt: new Date() };
        if (status === "In Review" || status === "Done") {
            if (proofLinks !== undefined) updateData.proofLinks = proofLinks || [];
            if (proofNotes !== undefined) updateData.proofNotes = proofNotes;
        }

        await db.update(tasks)
            .set(updateData)
            .where(eq(tasks.id, taskId));

        if (!wasBlocked && isNowBlocked) {
            const stakeholders = oldTask.milestone?.project?.stakeholders || [];
            const emails = stakeholders.map(s => s.user?.email).filter(Boolean) as string[];
            
            if (emails.length > 0) {
                const { sendTaskBlockedEmail } = await import("@/lib/notifications");
                await sendTaskBlockedEmail(emails, oldTask.milestone?.project?.title || "Your Project", oldTask.title);
            }
        }

        // Status bubbling logic
        if (status === "Done" && oldTask.milestoneId) {
            const { isNull } = await import("drizzle-orm");
            const allTasks = await db.query.tasks.findMany({
                where: and(eq(tasks.milestoneId, oldTask.milestoneId), isNull(tasks.deletedAt))
            });
            
            const allDone = allTasks.every(t => t.id === taskId || t.status === "Done");
            if (allDone) {
                await db.update(milestones).set({ status: "Completed", updatedAt: new Date() }).where(eq(milestones.id, oldTask.milestoneId));
                
                const allMilestones = await db.query.milestones.findMany({
                    where: and(eq(milestones.projectId, oldTask.projectId), isNull(milestones.deletedAt))
                });
                const allMsCompleted = allMilestones.every(m => m.id === oldTask.milestoneId || m.status === "Completed");
                if (allMsCompleted) {
                    await db.update(agencyProjects).set({ status: "Completed", updatedAt: new Date() }).where(eq(agencyProjects.id, oldTask.projectId));
                }
            }
        }

        await logAction("UPDATE", "Task", `Task ${taskId} status updated to ${status}`);

        if (oldTask.projectId) {
            revalidatePath(`/dashboard/pm/${oldTask.projectId}`);
        }
        revalidatePath("/dashboard/pm/[id]", "page");
        return { success: true, message: "Task updated." };
    } catch (error) {
        console.error("Failed to update task status:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function submitTaskProofAndMove(taskId: string, newStatus: "In Review" | "Done", proofLinks?: { label: string; url: string }[], proofNotes?: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const oldTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            with: { milestone: { with: { project: true } } }
        });

        if (!oldTask) return { success: false, message: "Task not found" };

        if (newStatus === "Done" && oldTask.requiresProof && !hasRole(session, ["superadmin", "manager"])) {
            return { success: false, message: "Only Managers and Superadmins can approve tasks to Done." };
        }

        if ((newStatus === "In Review" || newStatus === "Done") && oldTask.requiresProof) {
            if ((!proofLinks || proofLinks.length === 0) && !proofNotes) {
                return { success: false, message: "Proof Links or Notes are required." };
            }
            if (proofLinks && proofLinks.length > 0) {
                for (const link of proofLinks) {
                    try {
                        new URL(link.url);
                    } catch {
                        return { success: false, message: `Invalid Proof URL format: ${link.url}` };
                    }
                }
            }
        }

        const updatedProofLinks = proofLinks !== undefined ? proofLinks : oldTask.proofLinks;
        const updatedProofNotes = proofNotes !== undefined ? proofNotes : oldTask.proofNotes;

        await db.update(tasks)
            .set({ 
                status: newStatus, 
                proofLinks: updatedProofLinks || [],
                proofNotes: updatedProofNotes,
                updatedAt: new Date() 
            })
            .where(eq(tasks.id, taskId));

        if (newStatus === "Done" && oldTask.milestoneId) {
            const { isNull } = await import("drizzle-orm");
            const allTasks = await db.query.tasks.findMany({
                where: and(eq(tasks.milestoneId, oldTask.milestoneId), isNull(tasks.deletedAt))
            });
            
            const allDone = allTasks.every(t => t.id === taskId || t.status === "Done");
            if (allDone) {
                await db.update(milestones).set({ status: "Completed", updatedAt: new Date() }).where(eq(milestones.id, oldTask.milestoneId));
                
                const allMilestones = await db.query.milestones.findMany({
                    where: and(eq(milestones.projectId, oldTask.projectId), isNull(milestones.deletedAt))
                });
                const allMsCompleted = allMilestones.every(m => m.id === oldTask.milestoneId || m.status === "Completed");
                if (allMsCompleted) {
                    await db.update(agencyProjects).set({ status: "Completed", updatedAt: new Date() }).where(eq(agencyProjects.id, oldTask.projectId));
                }
            }
        }

        await logAction("UPDATE", "Task", `Task ${taskId} moved to ${newStatus} with proof`);

        if (oldTask.projectId) {
            revalidatePath(`/dashboard/pm/${oldTask.projectId}`);
        }
        revalidatePath("/dashboard/pm/[id]", "page");
        revalidatePath("/portal");
        return { success: true, message: "Task proof submitted." };
    } catch (error) {
        console.error("Failed to submit task proof:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function submitTaskBlockedReasonAndMove(taskId: string, blockedReason: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!blockedReason.trim()) {
        return { success: false, message: "Blocked reason is required." };
    }

    try {
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const oldTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            with: { milestone: { with: { project: true } } }
        });

        if (!oldTask) return { success: false, message: "Task not found" };

        await db.update(tasks)
            .set({ 
                status: "Blocked", 
                isBlockedByClient: true,
                blockedReason: blockedReason.trim(),
                updatedAt: new Date() 
            })
            .where(eq(tasks.id, taskId));

        // Notify internal team members ONLY (Admins/PMs)
        const allInternalUsers = await db.query.users.findMany({
            where: (users, { inArray }) => inArray(users.role, ["superadmin", "manager", "developer", "content_editor"]),
            columns: { email: true }
        });
        const emails = allInternalUsers.map(u => u.email).filter(Boolean) as string[];
        
        if (emails.length > 0) {
            const { sendTaskBlockedEmail } = await import("@/lib/notifications");
            await sendTaskBlockedEmail(emails, oldTask.milestone?.project?.title || "Your Project", oldTask.title);
        }

        await logAction("UPDATE", "Task", `Task ${taskId} blocked with reason: ${blockedReason.trim()}`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task blocked with reason." };
    } catch (error) {
        console.error("Failed to block task:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateTaskDetails(
    taskId: string,
    data: { title?: string; description?: string; assigneeIds?: string[]; dueDate?: Date | null }
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        // Editor can only update tasks that are explicitly assigned to them.
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const existingTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            columns: { projectId: true },
        });
        if (!existingTask) return { success: false, message: "Task not found" };

        const cleanAssigneeIds = data.assigneeIds !== undefined
            ? Array.from(new Set((data.assigneeIds || []).filter(Boolean)))
            : undefined;

        const [updatedTask] = await db.update(tasks)
            .set({
                title: data.title,
                description: data.description,
                dueDate: data.dueDate,
                updatedAt: new Date()
            })
            .where(eq(tasks.id, taskId))
            .returning();

        if (cleanAssigneeIds !== undefined) {
             const { taskAssignees } = await import("@/db/schema");
             await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
             if (cleanAssigneeIds.length > 0) {
                 await db.insert(taskAssignees).values(
                     cleanAssigneeIds.map(userId => ({ taskId, userId }))
                 );
             }
        }

        await logAction("UPDATE", "Task", `Task ${taskId} details updated`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task details updated.", task: updatedTask };
    } catch (error) {
        console.error("Failed to update task details:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteTask(taskId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(tasks)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(tasks.id, taskId));
        
        await logAction("DELETE", "Task", `Task ${taskId} soft-deleted`);
        
        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task deleted." };
    } catch (error) {
        console.error("Failed to delete task:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Milestone Management ---
export async function createMilestone(projectId: string, title: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const existings = await db.query.milestones.findMany({
            where: eq(milestones.projectId, projectId),
            orderBy: [desc(milestones.order)]
        });
        const newOrder = existings.length > 0 ? existings[0].order + 1 : 1;

        const [newMilestone] = await db.insert(milestones).values({
            projectId,
            title,
            order: newOrder,
            status: "Pending"
        }).returning();

        await logAction("CREATE", "Milestone", `Milestone "${title}" created`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Milestone created.", milestone: newMilestone };
    } catch (error) {
        console.error("Failed to create milestone:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function editMilestone(milestoneId: string, title: string, order?: number): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const payload: Record<string, unknown> = { title, updatedAt: new Date() };
        if (order) payload.order = order;

        await db.update(milestones).set(payload).where(eq(milestones.id, milestoneId));

        await logAction("UPDATE", "Milestone", `Milestone ${milestoneId} updated`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Milestone updated." };
    } catch (error) {
        console.error("Failed to update milestone:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteMilestone(milestoneId: string): Promise<ActionState> {
    const session = await auth();
    // Restrict deletion to admin only
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized: Only Admins can delete milestones." };
    }

    try {
        await db.delete(tasks).where(eq(tasks.milestoneId, milestoneId));
        await db.delete(milestones).where(eq(milestones.id, milestoneId));

        await logAction("DELETE", "Milestone", `Milestone ${milestoneId} deleted`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Milestone deleted." };
    } catch (error) {
        console.error("Failed to delete milestone:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Client Feedback Actions ---
export async function submitMilestoneFeedback(milestoneId: string, status: "APPROVED" | "REVISION_REQUESTED", commentText?: string): Promise<ActionState> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "client") {
        return { success: false, message: "Unauthorized" };
    }

    if (status === "REVISION_REQUESTED" && (!commentText || !commentText.trim())) {
        return { success: false, message: "Comment is required for revision requests." };
    }

    try {
        const { clientFeedback } = await import("@/db/schema");
        const { desc } = await import("drizzle-orm");

        const milestone = await db.query.milestones.findFirst({ where: eq(milestones.id, milestoneId) });
        if (!milestone) return { success: false, message: "Milestone not found" };

        // Ownership: only stakeholders for the milestone's project can submit feedback.
        const stakeholder = await db.query.projectStakeholders.findFirst({
            where: and(
                eq(projectStakeholders.projectId, milestone.projectId),
                eq(projectStakeholders.userId, session.user.id)
            )
        });
        if (!stakeholder) return { success: false, message: "Unauthorized: Feedback ownership mismatch" };

        // Find the latest feedback for version chaining (threading)
        const latestFeedback = await db.query.clientFeedback.findFirst({
            where: eq(clientFeedback.milestoneId, milestoneId),
            orderBy: [desc(clientFeedback.createdAt)]
        });

        await db.insert(clientFeedback).values({
            milestoneId,
            clientId: session.user.id,
            status,
            commentText: commentText?.trim() || null,
            parentFeedbackId: latestFeedback?.id || null, // Create threaded version link
        });

        // UNBLOCK ASSIGNED TASKS THAT ARE BLOCKED BY CLIENT
        await db.update(tasks)
            .set({ isBlockedByClient: false, status: "Todo", updatedAt: new Date() })
            .where(and(eq(tasks.milestoneId, milestoneId), eq(tasks.isBlockedByClient, true)));

        // Client feedback should deterministically drive milestone status.
        const newMilestoneStatus = status === "REVISION_REQUESTED" ? "In Progress" : "Completed";
        await db.update(milestones)
            .set({ status: newMilestoneStatus, updatedAt: new Date() })
            .where(eq(milestones.id, milestoneId));

        if (status === "REVISION_REQUESTED") {
            await notifyAllAdmins(`${session.user.name || "Client"} requested a revision for: ${milestone.title}`, "feedback", `/dashboard/pm/${milestone.projectId}`);
        } else if (status === "APPROVED") {
            await notifyAllAdmins(`${session.user.name || "Client"} approved milestone: ${milestone.title}`, "feedback", `/dashboard/pm/${milestone.projectId}`);
        }

        await logAction("UPDATE", "Milestone Feedback", `Feedback ${status} submitted for Milestone ${milestoneId}`);

        revalidatePath("/portal");
        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Feedback submitted successfully." };
    } catch (error) {
        console.error("Failed to submit feedback:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Deadline Tracking ---
export async function checkAndNotifyOverdueTasks(): Promise<{ success: boolean; found: number }> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, found: 0 };
    }

    try {
        const { lte, ne, isNotNull } = await import("drizzle-orm");
        
        // Find tasks that are:
        // 1. Not Done
        // 2. Have a due date
        // 3. Due date is in the past
        // 4. Have not been notified yet (overdueNotified === false)
        const overdueTasks = await db.query.tasks.findMany({
            where: and(
                ne(tasks.status, "Done"),
                isNotNull(tasks.dueDate),
                lte(tasks.dueDate, new Date()),
                eq(tasks.overdueNotified, false)
            ),
            with: {
                milestone: {
                    with: {
                        project: true
                    }
                },
                assignees: {
                    with: { user: true }
                }
            }
        });

        if (overdueTasks.length === 0) {
            return { success: true, found: 0 };
        }

        const { notifyAllAdmins, createSystemNotification } = await import("@/features/notifications/actions");
        let notifiedCount = 0;

        for (const task of overdueTasks) {
            const project = task.milestone?.project;
            if (!project) continue;

            // Notify Assignees if they exist
            const assignees = task.assignees || [];
            for (const assignee of assignees) {
                if (assignee.userId) {
                    await createSystemNotification(
                        assignee.userId, 
                        `OVERDUE: The task "${task.title}" is past its deadline.`, 
                        "alert", 
                        `/dashboard/pm/${project.id}`
                    );
                }
            }

            // Also notify Admins
            await notifyAllAdmins(
                `Overdue Task: The task "${task.title}" in Project "${project.title}" is overdue.`,
                "alert",
                `/dashboard/pm/${project.id}`
            );

            // Mark as notified
            await db.update(tasks)
                .set({ overdueNotified: true })
                .where(eq(tasks.id, task.id));
                
            notifiedCount++;
        }

        return { success: true, found: notifiedCount };

    } catch (error) {
        console.error("Failed to check overdue tasks:", error);
        return { success: false, found: 0 };
    }
}

export async function archiveProject(projectId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized: Admins only." };
    }

    try {
        await db.update(agencyProjects)
            .set({ isArchived: true, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));

        await logAction("UPDATE", "Project", `Project ${projectId} archived.`);

        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");
        return { success: true, message: "Project securely archived." };
    } catch (error) {
        console.error("Failed to archive project:", error);
        return { success: false, message: "Database Error" };
    }
}
