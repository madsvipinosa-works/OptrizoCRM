import "server-only";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { auth } from "@/auth";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "OTHER";

/**
 * Appends one row to the audit log. Server-only on purpose: it lives outside any "use server" file so a
 * browser cannot call it, and rows can only be written by code that runs after its own permission check.
 */
export async function logAction(
    action: AuditAction,
    entity: string,
    details?: string,
    forcedUserId?: string,
    projectId?: string
) {
    try {
        let userId = forcedUserId;

        // If no user ID provided, attempt to get it from the current session
        if (!userId) {
            const session = await auth();
            if (session?.user?.id) {
                userId = session.user.id;
            }
        }

        await db.insert(auditLogs).values({
            userId: userId || null,
            action,
            entity,
            details,
            ...(projectId !== undefined ? { projectId } : {}),
        });
    } catch {
        // We catch and log errors securely without crashing the main user workflow
        console.error("[System Audit Log Error]: Failed to record transaction");
    }
}
