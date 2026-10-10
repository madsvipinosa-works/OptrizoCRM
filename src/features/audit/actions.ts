"use server";

import { db } from "@/db";
import { auditLogs, systemErrorLogs, users } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { desc, eq, and, gte, lt, inArray, count, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "OTHER";

export async function logAction(
    action: AuditAction,
    entity: string,
    details?: string,
    forcedUserId?: string
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
        });
    } catch {
        // We catch and log errors securely without crashing the main user workflow
        console.error("[System Audit Log Error]: Failed to record transaction");
    }
}

export type AuditFilters = {
    action?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
};

export async function getAuditLogs(page = 1, limit = 50, filters?: AuditFilters) {
    const session = await auth();
    // Strictly restrict to Admin
    if (!hasRole(session, ["superadmin"])) {
        return { success: false, message: "Unauthorized", logs: [] };
    }

    try {
        // Validate and clamp pagination
        const p = Math.max(1, Math.floor(page));
        const l = Math.min(Math.max(10, Math.floor(limit)), 100);
        const offset = (p - 1) * l;

        const conditions = [];

        // Validate action
        const validActions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "OTHER"];
        if (filters?.action && filters.action !== "ALL") {
            if (validActions.includes(filters.action)) {
                conditions.push(eq(auditLogs.action, filters.action as AuditAction));
            }
        }

        // Validate role (using actual schema roles)
        const validRoles = ["superadmin", "sales", "manager", "developer", "content_editor", "client"];
        if (filters?.role && filters.role !== "ALL") {
            if (validRoles.includes(filters.role)) {
                // Left join behavior achieved cleanly via subquery IN condition
                conditions.push(inArray(
                    auditLogs.userId, 
                    db.select({ id: users.id }).from(users).where(eq(users.role, filters.role as any))
                ));
            }
        }

        if (filters?.startDate) {
            const start = new Date(filters.startDate);
            if (!isNaN(start.getTime())) {
                conditions.push(gte(auditLogs.createdAt, start));
            }
        }

        if (filters?.endDate) {
            // Next-day exclusive bound for intuitive UX mapping
            const end = new Date(filters.endDate);
            if (!isNaN(end.getTime())) {
                end.setDate(end.getDate() + 1);
                conditions.push(lt(auditLogs.createdAt, end));
            }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const logs = await db.query.auditLogs.findMany({
            where: whereClause,
            orderBy: [desc(auditLogs.createdAt)],
            limit: l,
            offset,
            with: {
                user: {
                    columns: {
                        name: true,
                        email: true,
                        role: true, // Included actor's role per review feedback
                    }
                }
            }
        });

        // Get total count matching the exact filter conditions
        const [{ value: totalCount }] = await db
            .select({ value: count() })
            .from(auditLogs)
            .where(whereClause);

        return { 
            success: true, 
            logs,
            pagination: {
                total: totalCount,
                page: p,
                limit: l,
                totalPages: Math.ceil(totalCount / l)
            }
        };
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return { success: false, message: "Database Error", logs: [] };
    }
}

export type SystemErrorFilters = {
    severity?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
};

export async function getSystemErrorLogs(page = 1, limit = 50, filters?: SystemErrorFilters) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) {
        return { success: false, message: "Unauthorized", logs: [] };
    }

    try {
        const p = Math.max(1, Math.floor(page));
        const l = Math.min(Math.max(10, Math.floor(limit)), 100);
        const offset = (p - 1) * l;

        const conditions = [];

        // Validate severity
        const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
        if (filters?.severity && filters.severity !== "ALL") {
            if (validSeverities.includes(filters.severity)) {
                conditions.push(eq(systemErrorLogs.severity, filters.severity as any));
            }
        }

        // Validate status
        if (filters?.status === "UNRESOLVED") {
            conditions.push(eq(systemErrorLogs.isResolved, false));
        } else if (filters?.status === "RESOLVED") {
            conditions.push(eq(systemErrorLogs.isResolved, true));
        }

        // Search in message, errorCode, or source
        if (filters?.search && filters.search.trim()) {
            const term = `%${filters.search.trim()}%`;
            conditions.push(
                or(
                    ilike(systemErrorLogs.message, term),
                    ilike(systemErrorLogs.errorCode, term),
                    ilike(systemErrorLogs.source, term)
                )
            );
        }

        if (filters?.startDate) {
            const start = new Date(filters.startDate);
            if (!isNaN(start.getTime())) {
                conditions.push(gte(systemErrorLogs.createdAt, start));
            }
        }

        if (filters?.endDate) {
            const end = new Date(filters.endDate);
            if (!isNaN(end.getTime())) {
                end.setDate(end.getDate() + 1);
                conditions.push(lt(systemErrorLogs.createdAt, end));
            }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const logs = await db.query.systemErrorLogs.findMany({
            where: whereClause,
            orderBy: [desc(systemErrorLogs.createdAt)],
            limit: l,
            offset,
            with: {
                user: {
                    columns: {
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                resolvedBy: {
                    columns: {
                        name: true,
                        email: true,
                    },
                },
            },
        });

        const [{ value: totalCount }] = await db
            .select({ value: count() })
            .from(systemErrorLogs)
            .where(whereClause);

        return {
            success: true,
            logs,
            pagination: {
                total: totalCount,
                page: p,
                limit: l,
                totalPages: Math.ceil(totalCount / l),
            },
        };
    } catch (error) {
        console.error("Failed to fetch system error logs:", error);
        return { success: false, message: "Database Error", logs: [] };
    }
}

export async function resolveSystemError(errorId: string, resolutionNotes?: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db
            .update(systemErrorLogs)
            .set({
                isResolved: true,
                resolvedAt: new Date(),
                resolvedById: session?.user?.id || null,
                resolutionNotes: resolutionNotes || "Resolved by administrator",
            })
            .where(eq(systemErrorLogs.id, errorId));

        await logAction("UPDATE", "System Error", `Resolved system error ${errorId}`);
        revalidatePath("/dashboard/audit");
        return { success: true, message: "Error marked as resolved" };
    } catch (error) {
        console.error("Failed to resolve system error:", error);
        return { success: false, message: "Failed to resolve error" };
    }
}

export async function reopenSystemError(errorId: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db
            .update(systemErrorLogs)
            .set({
                isResolved: false,
                resolvedAt: null,
                resolvedById: null,
                resolutionNotes: null,
            })
            .where(eq(systemErrorLogs.id, errorId));

        await logAction("UPDATE", "System Error", `Reopened system error ${errorId}`);
        revalidatePath("/dashboard/audit");
        return { success: true, message: "Error reopened" };
    } catch (error) {
        console.error("Failed to reopen system error:", error);
        return { success: false, message: "Failed to reopen error" };
    }
}

export async function getErrorSummaryMetrics() {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) {
        return {
            success: false,
            metrics: { total: 0, unresolved: 0, critical: 0, high: 0 },
        };
    }

    try {
        const [{ value: total }] = await db
            .select({ value: count() })
            .from(systemErrorLogs);

        const [{ value: unresolved }] = await db
            .select({ value: count() })
            .from(systemErrorLogs)
            .where(eq(systemErrorLogs.isResolved, false));

        const [{ value: critical }] = await db
            .select({ value: count() })
            .from(systemErrorLogs)
            .where(
                and(
                    eq(systemErrorLogs.isResolved, false),
                    eq(systemErrorLogs.severity, "CRITICAL")
                )
            );

        const [{ value: high }] = await db
            .select({ value: count() })
            .from(systemErrorLogs)
            .where(
                and(
                    eq(systemErrorLogs.isResolved, false),
                    eq(systemErrorLogs.severity, "HIGH")
                )
            );

        return {
            success: true,
            metrics: { total, unresolved, critical, high },
        };
    } catch (error) {
        console.error("Failed to fetch error summary metrics:", error);
        return {
            success: false,
            metrics: { total: 0, unresolved: 0, critical: 0, high: 0 },
        };
    }
}

export async function reportClientError(data: {
    message: string;
    stack?: string;
    digest?: string;
    source: string;
    path?: string;
}) {
    try {
        const { logSystemError } = await import("./error-logger");
        const logId = await logSystemError(data.message, {
            errorCode: data.digest ? `DIGEST_${data.digest.slice(0, 16)}` : "CLIENT_RENDER_ERROR",
            severity: "HIGH",
            source: data.source,
            context: {
                digest: data.digest,
                stack: data.stack,
                path: data.path,
            },
        });
        return { success: true, logId };
    } catch (e) {
        console.error("Failed to report client error:", e);
        return { success: false };
    }
}
