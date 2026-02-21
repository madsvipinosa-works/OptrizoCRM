"use server";

import { db } from "@/db";
import { agencyProjects, milestones, tasks } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
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
