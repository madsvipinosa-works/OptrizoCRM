"use server";

import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const staffRoleSchema = z.enum(["sales", "manager", "developer", "content_editor"]);

export async function updateUserRole(userId: string, newRole: string) {
    // 1. Auth Check: requireRole("superadmin") from @/lib/authz
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok || !authz.session?.user?.id) {
        return { success: false, message: "Unauthorized: Only Super Admins can manage roles." };
    }

    if (!userId || typeof userId !== "string") {
        return { success: false, message: "Invalid user ID." };
    }

    // 2. Reject self-target
    if (userId === authz.session.user.id) {
        return { success: false, message: "You cannot change your own role." };
    }

    // 3. Zod whitelist sales|manager|developer|content_editor
    const parsedRole = staffRoleSchema.safeParse(newRole);
    if (!parsedRole.success) {
        return { success: false, message: "Invalid role specified." };
    }

    // 4. Run in a transaction
    const txResult = await db.transaction(async (tx) => {
        const [target] = await tx
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .for("update");

        if (!target) {
            return { ok: false, error: "User not found." };
        }

        // Reject if target is superadmin
        if (target.role === "superadmin") {
            return { ok: false, error: "Cannot modify a Super Admin's role." };
        }

        // Reject if target is a client
        if (target.role === "client") {
            return { ok: false, error: "Cannot change the role of a client account." };
        }

        await tx
            .update(users)
            .set({ role: parsedRole.data })
            .where(eq(users.id, userId));

        return { ok: true, previousRole: target.role };
    });

    if (!txResult.ok) {
        return { success: false, message: txResult.error };
    }

    // 5. logAction last with actorRole in details
    try {
        await logAction(
            "UPDATE",
            "user",
            JSON.stringify({
                action: "UPDATE_ROLE",
                actorRole: authz.session.user.role,
                targetUserId: userId,
                previousRole: txResult.previousRole,
                newRole: parsedRole.data,
            }),
            authz.session.user.id
        );
    } catch (auditErr) {
        console.error("Failed to log role update action:", auditErr);
    }

    revalidatePath("/dashboard/team");
    revalidatePath("/dashboard/leads");
    return { success: true, message: "User role updated." };
}

export async function updateUserJobTitle(userId: string, newTitle: string) {
    // 1. Strict Auth Check
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok || !authz.session?.user?.id) {
        return { success: false, message: "Unauthorized: Only Super Admins can manage job titles." };
    }

    if (!userId || typeof userId !== "string") {
        return { success: false, message: "Invalid user ID." };
    }

    try {
        await db.update(users)
            .set({ jobTitle: newTitle || null })
            .where(eq(users.id, userId));

        revalidatePath("/dashboard/team");
        return { success: true, message: "User job title updated." };
    } catch (error) {
        console.error("Failed to update job title:", error);
        return { success: false, message: "Database error." };
    }
}
