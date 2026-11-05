import "server-only";

import type { db } from "@/db";
import { auditLogs } from "@/db/schema";

/** The transaction object passed to `db.transaction(async (tx) => ...)`. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ContentAuditEntity = "Service" | "Portfolio" | "Page";
export type ContentAuditAction = "PUBLISH" | "HIDE" | "UNHIDE" | "RESTORE" | "CREATE" | "UPDATE";

export type ContentAuditInput = {
    actorId: string;
    actorRole: string;
    entity: ContentAuditEntity;
    /** Service id, case study id, or the page slug. */
    entityId: string;
    action: ContentAuditAction;
    fromStatus: string | null;
    toStatus: string | null;
    /** Ids and numbers only (for example `version`, `restoredFrom`). Never content bodies. */
    extra?: Record<string, string | number | null>;
};

/**
 * Inserts the audit row inside the caller's transaction, so it is committed or rolled back together with
 * the change. (`logAction` swallows errors and runs outside the transaction, so it is not used here.)
 * The `audit_action` enum is unchanged: CREATE for a create, UPDATE for everything else. The precise
 * action is in `details`.
 */
export async function insertContentAudit(tx: Pick<DbTx, "insert">, input: ContentAuditInput): Promise<void> {
    const details = JSON.stringify({
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        ...(input.extra ?? {}),
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorRole: input.actorRole,
    });

    await tx.insert(auditLogs).values({
        userId: input.actorId,
        action: input.action === "CREATE" ? "CREATE" : "UPDATE",
        entity: input.entity,
        details,
    });
}

