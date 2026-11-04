"use server";

import { z } from "zod";
import { db } from "@/db";
import { tasks, taskAssignees } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { changeAccountStatus, type TargetAccountStatus } from "@/features/users/account-status";
import { notifyAllAdmins } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";
import { eq, and, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const uuidSchema = z.string().uuid();

async function executeStatusChange(
    targetId: string,
    to: TargetAccountStatus,
    actionName: "LOCK" | "UNLOCK" | "DEACTIVATE" | "REACTIVATE"
): Promise<{ success: boolean; message?: string }> {
    // 1. Zod UUID validation
    const parsed = uuidSchema.safeParse(targetId);
    if (!parsed.success) {
        return { success: false, message: "Invalid user ID format." };
    }

    // 2. Strict authorization: requireRole("superadmin") BEFORE any DB read
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok || !authz.session?.user?.id) {
        return { success: false, message: "Unauthorized. Superadmin required." };
    }

    // 3. Database transaction for status change
    const txResult = await db.transaction(async (tx) => {
        return changeAccountStatus(tx, authz.session.user, targetId, to);
    });

    if (!txResult.ok) {
        return { success: false, message: txResult.error };
    }

    // 4. AFTER COMMIT in try/catch: Notifications
    try {
        if (to === "deactivated" && txResult.targetUser.role === "developer") {
            const openTasks = await db
                .select({ id: tasks.id, title: tasks.title })
                .from(tasks)
                .innerJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
                .where(
                    and(
                        eq(taskAssignees.userId, targetId),
                        notInArray(tasks.status, ["done", "backlog"])
                    )
                );

            if (openTasks.length > 0) {
                await notifyAllAdmins(
                    `Developer ${txResult.targetUser.name || txResult.targetUser.email} was deactivated with ${openTasks.length} open task(s). Please reassign.`,
                    "system",
                    "/dashboard/pm"
                );
            }
        }
    } catch (notifError) {
        console.error("Failed to send deactivation notification to managers:", notifError);
    }

    // 5. AFTER COMMIT in try/catch: logAction LAST with actor role in details
    try {
        await logAction(
            "UPDATE",
            "user",
            JSON.stringify({
                action: actionName,
                actorRole: authz.session.user.role,
                targetUserId: targetId,
                previousStatus: txResult.previousStatus,
                newStatus: to,
            }),
            authz.session.user.id
        );
    } catch (auditError) {
        console.error("Failed to record audit log for account status change:", auditError);
    }

    revalidatePath("/dashboard/team");
    return { success: true, message: `Account successfully ${to}.` };
}

export async function lockUser(targetId: string): Promise<{ success: boolean; message?: string }> {
    return executeStatusChange(targetId, "locked", "LOCK");
}

export async function unlockUser(targetId: string): Promise<{ success: boolean; message?: string }> {
    return executeStatusChange(targetId, "active", "UNLOCK");
}

export async function deactivateUser(targetId: string): Promise<{ success: boolean; message?: string }> {
    return executeStatusChange(targetId, "deactivated", "DEACTIVATE");
}

export async function reactivateUser(targetId: string): Promise<{ success: boolean; message?: string }> {
    return executeStatusChange(targetId, "active", "REACTIVATE");
}

