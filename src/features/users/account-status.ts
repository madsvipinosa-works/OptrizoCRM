import "server-only";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type TargetAccountStatus = "locked" | "active" | "deactivated";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ChangeAccountStatusActor {
    id: string;
    role?: string | null;
}

export type ChangeAccountStatusResult =
    | {
          ok: true;
          previousStatus: string;
          targetUser: typeof users.$inferSelect;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Executes an account status transition within an existing database transaction.
 * Enforces self-target guard, last active Super Admin protection, and valid status transition rules.
 */
export async function changeAccountStatus(
    tx: DbTransaction,
    actor: ChangeAccountStatusActor,
    targetId: string,
    to: TargetAccountStatus
): Promise<ChangeAccountStatusResult> {
    // 1. Guard against self-targeting
    if (actor.id === targetId) {
        return { ok: false, error: "You cannot change your own account status." };
    }

    // 2. Lock active superadmin rows to evaluate last active Super Admin guard safely
    const activeSuperadmins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "superadmin"), eq(users.status, "active")))
        .for("update");

    // 3. Lock and load target user row
    const [target] = await tx
        .select()
        .from(users)
        .where(eq(users.id, targetId))
        .for("update");

    if (!target) {
        return { ok: false, error: "User not found." };
    }

    // 4. Protect last active Super Admin
    if (target.role === "superadmin" && target.status === "active" && to !== "active") {
        const remainingActive = activeSuperadmins.filter((sa) => sa.id !== target.id);
        if (remainingActive.length === 0) {
            return { ok: false, error: "Cannot deactivate or lock the last active Super Admin." };
        }
    }

    // 5. Check if already in target status
    if (target.status === to) {
        return { ok: false, error: `Account is already ${to}.` };
    }

    // 6. Validate transition rules
    const from = target.status;
    const isAllowed =
        (from === "active" && to === "locked") ||
        (from === "locked" && to === "active") ||
        ((from === "active" || from === "locked" || from === "invited") && to === "deactivated") ||
        (from === "deactivated" && to === "active");

    if (!isAllowed) {
        return { ok: false, error: `Invalid status transition from '${from}' to '${to}'.` };
    }

    // Deactivated -> Active requires password
    if (from === "deactivated" && to === "active" && !target.password) {
        return { ok: false, error: "Cannot activate a deactivated account without a password." };
    }

    // 7. Mirror rule: isActive=false only for 'deactivated'; true for active and locked.
    // Set status and isActive in a single UPDATE statement.
    const updateData: {
        status: TargetAccountStatus;
        isActive: boolean;
        failedLogins?: number;
        lockedUntil?: Date | null;
    } = {
        status: to,
        isActive: to !== "deactivated",
    };

    if (to === "active") {
        updateData.failedLogins = 0;
        updateData.lockedUntil = null;
    } else if (to === "locked") {
        updateData.lockedUntil = null; // Manual administrative lock
    }

    await tx.update(users).set(updateData).where(eq(users.id, targetId));

    return {
        ok: true,
        previousStatus: target.status,
        targetUser: target,
    };
}
