"use server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { auth } from "@/auth";
import { desc } from "drizzle-orm";

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

export async function getAuditLogs(page = 1, limit = 50) {
    const session = await auth();
    // Strictly restrict to Admin
    if (!session?.user || session.user.role !== "admin") {
        return { success: false, message: "Unauthorized", logs: [] };
    }

    try {
        const offset = (page - 1) * limit;

        const logs = await db.query.auditLogs.findMany({
            orderBy: [desc(auditLogs.createdAt)],
            limit,
            offset,
            with: {
                user: {
                    columns: {
                        name: true,
                        email: true,
                    }
                }
            }
        });

        // Get total count for pagination
        // Optimized approach for counting tables
        const allLogs = await db.select({ id: auditLogs.id }).from(auditLogs);
        const totalCount = allLogs.length;

        return { 
            success: true, 
            logs,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return { success: false, message: "Database Error", logs: [] };
    }
}
