"use server";

import { db } from "@/db";
import { agencyProjects, milestones, tasks } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
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

        await db.insert(tasks).values({
            projectId,
            milestoneId,
            title,
            description,
            assigneeId: assigneeId || null,
            status: isParentBlocked ? "Blocked" : "Todo",
            isBlockedByClient: isParentBlocked
        });

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task created." };
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
