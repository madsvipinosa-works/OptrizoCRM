"use server";

import { db } from "@/db";
import { crmTasks, leads, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRoles } from "@/lib/authz";
import { logAction } from "@/features/audit/log";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
    data?: any;
};

const CRM_TASK_ROLES = ["sales"];

const taskIdSchema = z.string().trim().min(1).max(128);
const taskTypeSchema = z.enum(["Call", "Email", "Meeting", "To-do"]);
const prioritySchema = z.enum(["Low", "Medium", "High"]);
const statusSchema = z.enum(["Pending", "In Progress", "Completed", "Canceled"]);

const createCrmTaskSchema = z.object({
    leadId: z.string().trim().min(1).max(128),
    assignedTo: z.string().trim().min(1).max(128).optional(),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(2000).optional(),
    taskType: taskTypeSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: z.coerce.date().optional(),
});

// Only these fields can be changed on an existing task. Anything else the caller sends is dropped,
// so status, completion and the lead link can only change through their own actions.
const updateCrmTaskSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    taskType: taskTypeSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: z.coerce.date().optional(),
    assignedTo: z.string().trim().min(1).max(128).optional(),
});

async function isAssignableUser(userId: string) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, role: true, isActive: true },
    });
    return !!user && user.isActive && CRM_TASK_ROLES.includes(user.role);
}

export async function completeCrmTask(taskId: string): Promise<ActionState> {
    const access = await requireRoles(CRM_TASK_ROLES);
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const parsedId = taskIdSchema.safeParse(taskId);
    if (!parsedId.success) return { success: false, message: "Invalid task" };

    try {
        const [updated] = await db.update(crmTasks)
            .set({
                status: "Completed",
                completedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(crmTasks.id, parsedId.data))
            .returning({ id: crmTasks.id });
        if (!updated) return { success: false, message: "Task not found" };

        await logAction("UPDATE", "CRM Task", `Completed sales task ${updated.id}`, access.session.user.id);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Task completed successfully" };
    } catch (e) {
        console.error("Failed to complete task:", e);
        return { success: false, message: "Database Error" };
    }
}

export async function updateCrmTaskStatus(taskId: string, newStatus: "Pending" | "In Progress" | "Completed" | "Canceled"): Promise<ActionState> {
    const access = await requireRoles(CRM_TASK_ROLES);
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const parsedId = taskIdSchema.safeParse(taskId);
    const parsedStatus = statusSchema.safeParse(newStatus);
    if (!parsedId.success || !parsedStatus.success) {
        return { success: false, message: "Invalid task or status" };
    }

    try {
        const [updated] = await db.update(crmTasks)
            .set({
                status: parsedStatus.data,
                completedAt: parsedStatus.data === "Completed" ? new Date() : null,
                updatedAt: new Date()
            })
            .where(eq(crmTasks.id, parsedId.data))
            .returning({ id: crmTasks.id });
        if (!updated) return { success: false, message: "Task not found" };

        await logAction("UPDATE", "CRM Task", `Sales task ${updated.id} status changed to ${parsedStatus.data}`, access.session.user.id);

        revalidatePath("/dashboard/leads");
        return { success: true, message: `Task status updated to ${parsedStatus.data}` };
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
    const access = await requireRoles(CRM_TASK_ROLES);
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const parsed = createCrmTaskSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, message: "Invalid task details", errors: parsed.error.flatten().fieldErrors };
    }
    const input = parsed.data;

    try {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, input.leadId),
            columns: { id: true },
        });
        if (!lead) return { success: false, message: "Lead not found" };

        if (input.assignedTo && !(await isAssignableUser(input.assignedTo))) {
            return { success: false, message: "Choose an active sales team member" };
        }

        const [newTask] = await db.insert(crmTasks).values({
            leadId: input.leadId,
            assignedTo: input.assignedTo || null,
            title: input.title,
            description: input.description || null,
            taskType: input.taskType || "To-do",
            priority: input.priority || "Medium",
            status: "Pending",
            dueDate: input.dueDate || null,
        }).returning();

        await logAction("CREATE", "CRM Task", `Created sales task ${newTask?.id} for lead ${input.leadId}`, access.session.user.id);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Sales task created successfully", data: newTask };
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
    const access = await requireRoles(CRM_TASK_ROLES);
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const parsedId = taskIdSchema.safeParse(taskId);
    const parsed = updateCrmTaskSchema.safeParse(data);
    if (!parsedId.success || !parsed.success) {
        return { success: false, message: "Invalid task details" };
    }
    const changes = parsed.data;
    if (Object.keys(changes).length === 0) {
        return { success: false, message: "Nothing to update" };
    }

    try {
        if (changes.assignedTo && !(await isAssignableUser(changes.assignedTo))) {
            return { success: false, message: "Choose an active sales team member" };
        }

        const [updated] = await db.update(crmTasks)
            .set({
                ...changes,
                updatedAt: new Date()
            })
            .where(eq(crmTasks.id, parsedId.data))
            .returning({ id: crmTasks.id });
        if (!updated) return { success: false, message: "Task not found" };

        await logAction("UPDATE", "CRM Task", `Updated sales task ${updated.id} (${Object.keys(changes).join(", ")})`, access.session.user.id);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Sales task updated successfully" };
    } catch (e) {
        console.error("Failed to update task:", e);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteCrmTask(taskId: string): Promise<ActionState> {
    const access = await requireRoles(CRM_TASK_ROLES);
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const parsedId = taskIdSchema.safeParse(taskId);
    if (!parsedId.success) return { success: false, message: "Invalid task" };

    try {
        const [deleted] = await db.delete(crmTasks)
            .where(eq(crmTasks.id, parsedId.data))
            .returning({ id: crmTasks.id });
        if (!deleted) return { success: false, message: "Task not found" };

        await logAction("DELETE", "CRM Task", `Deleted sales task ${deleted.id}`, access.session.user.id);

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Sales task deleted successfully" };
    } catch (e) {
        console.error("Failed to delete task:", e);
        return { success: false, message: "Database Error" };
    }
}
