"use server";

import { db } from "@/db";
import { crmTasks, leads, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth, hasRole } from "@/auth";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
};

export async function completeCrmTask(taskId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(crmTasks)
            .set({ 
                status: "Completed", 
                completedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(crmTasks.id, taskId));

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Task completed successfully" };
    } catch (e) {
        console.error("Failed to complete task:", e);
        return { success: false, message: "Database Error" };
    }
}

export async function updateCrmTaskStatus(taskId: string, newStatus: "Pending" | "In Progress" | "Completed" | "Canceled"): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(crmTasks)
            .set({ 
                status: newStatus,
                completedAt: newStatus === "Completed" ? new Date() : null,
                updatedAt: new Date()
            })
            .where(eq(crmTasks.id, taskId));

        revalidatePath("/dashboard/leads");
        return { success: true, message: `Task status updated to ${newStatus}` };
    } catch (e) {
        console.error("Failed to update task status:", e);
        return { success: false, message: "Database Error" };
    }
}

export async function createCrmTask(data: {
    leadId: string;
    assignedTo?: string;
    title: string;
    description?: string;
    taskType?: "Call" | "Email" | "Meeting" | "To-do";
    priority?: "Low" | "Medium" | "High";
    dueDate?: Date;
}): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.insert(crmTasks).values({
            leadId: data.leadId,
            assignedTo: data.assignedTo || null,
            title: data.title,
            description: data.description || null,
            taskType: data.taskType || "To-do",
            priority: data.priority || "Medium",
            status: "Pending",
            dueDate: data.dueDate || null,
        });

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Sales task created successfully" };
    } catch (e) {
        console.error("Failed to create task:", e);
        return { success: false, message: "Database Error" };
    }
}

export async function updateCrmTask(
    taskId: string,
    data: {
        title?: string;
        description?: string;
        taskType?: "Call" | "Email" | "Meeting" | "To-do";
        priority?: "Low" | "Medium" | "High";
        dueDate?: Date;
        assignedTo?: string;
    }
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(crmTasks)
            .set({ 
                ...data,
                updatedAt: new Date()
            })
            .where(eq(crmTasks.id, taskId));

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Sales task updated successfully" };
    } catch (e) {
        console.error("Failed to update task:", e);
        return { success: false, message: "Database Error" };
    }
}
