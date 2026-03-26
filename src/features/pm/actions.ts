"use server";

import { db } from "@/db";
import { agencyProjects, milestones, tasks } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyAllAdmins } from "@/features/notifications/actions";

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
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(agencyProjects)
            .set({ status, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));

        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");
        return { success: true, message: "Project status updated." };
    } catch (error) {
        console.error("Failed to update project status:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateProjectSettings(projectId: string, leadId: string | null, stagingUrls: string[], files: string[]): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(agencyProjects).set({ stagingUrls, updatedAt: new Date() }).where(eq(agencyProjects.id, projectId));

        if (leadId) {
            const { leads } = await import("@/db/schema");
            await db.update(leads).set({ files, updatedAt: new Date() }).where(eq(leads.id, leadId));
        }

        revalidatePath("/dashboard/pm/[id]");
        revalidatePath("/portal");
        return { success: true, message: "Project settings updated." };
    } catch (error) {
        console.error("Failed to update project settings:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Milestone Actions ---
export async function updateMilestoneStatus(milestoneId: string, status: "Pending" | "In Progress" | "Client Approval" | "Completed"): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
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

        revalidatePath("/dashboard/pm/[id]");
        revalidatePath("/portal");
        return { success: true, message: `Milestone moved to ${status}` };
    } catch (error) {
        console.error("Failed to update milestone status:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Task Actions ---
export async function createTask(projectId: string, milestoneId: string, title: string, description?: string, assigneeId?: string): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    if (!title.trim()) return { success: false, message: "Title is required" };

    try {
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
            assigneeId: assigneeId || null,
            status: isParentBlocked ? "Blocked" : "Todo",
            isBlockedByClient: isParentBlocked
        }).returning();

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task created.", task: newTask };
    } catch (error) {
        console.error("Failed to create task:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateTaskStatus(taskId: string, status: "Todo" | "In Progress" | "Blocked" | "Done"): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(tasks)
            .set({ status, isBlockedByClient: status === "Blocked" ? true : false, updatedAt: new Date() })
            .where(eq(tasks.id, taskId));

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task updated." };
    } catch (error) {
        console.error("Failed to update task status:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateTaskDetails(
    taskId: string,
    data: { title?: string; description?: string; assigneeId?: string | null; dueDate?: Date | null }
): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const [updatedTask] = await db.update(tasks)
            .set({
                title: data.title,
                description: data.description,
                assigneeId: data.assigneeId,
                dueDate: data.dueDate,
                updatedAt: new Date()
            })
            .where(eq(tasks.id, taskId))
            .returning();

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task details updated.", task: updatedTask };
    } catch (error) {
        console.error("Failed to update task details:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteTask(taskId: string): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.delete(tasks).where(eq(tasks.id, taskId));
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
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
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

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Milestone created.", milestone: newMilestone };
    } catch (error) {
        console.error("Failed to create milestone:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function editMilestone(milestoneId: string, title: string, order?: number): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const payload: Record<string, unknown> = { title, updatedAt: new Date() };
        if (order) payload.order = order;

        await db.update(milestones).set(payload).where(eq(milestones.id, milestoneId));

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
    if (!session?.user || session.user.role !== "admin") {
        return { success: false, message: "Unauthorized: Only Admins can delete milestones." };
    }

    try {
        // Also delete tasks within this milestone to clean up
        await db.delete(tasks).where(eq(tasks.milestoneId, milestoneId));
        await db.delete(milestones).where(eq(milestones.id, milestoneId));

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
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    if (status === "REVISION_REQUESTED" && (!commentText || !commentText.trim())) {
        return { success: false, message: "Comment is required for revision requests." };
    }

    try {
        const { clientFeedback } = await import("@/db/schema");
        await db.insert(clientFeedback).values({
            milestoneId,
            clientId: session.user.id,
            status,
            commentText: commentText?.trim() || null,
        });

        const milestone = await db.query.milestones.findFirst({ where: eq(milestones.id, milestoneId) });
        
        if (milestone) {
            if (status === "REVISION_REQUESTED") {
                await updateMilestoneStatus(milestoneId, "In Progress");
                await notifyAllAdmins(`${session.user.name} requested a revision for: ${milestone.title}`, "feedback", `/dashboard/pm/${milestone.projectId}`);
            } else if (status === "APPROVED") {
                await updateMilestoneStatus(milestoneId, "Completed");
                await notifyAllAdmins(`${session.user.name} approved milestone: ${milestone.title}`, "feedback", `/dashboard/pm/${milestone.projectId}`);
            }
        }

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
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
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

            // Notify Assignee if they exist
            if (task.assigneeId) {
                await createSystemNotification(
                    task.assigneeId, 
                    `OVERDUE: The task "${task.title}" is past its deadline.`, 
                    "alert", 
                    `/dashboard/pm/${project.id}`
                );
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
