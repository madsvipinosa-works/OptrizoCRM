"use server";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { desc, eq, and, gte, lt, inArray, count } from "drizzle-orm";

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
