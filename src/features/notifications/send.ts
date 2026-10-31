import "server-only";

import { db } from "@/db";
import { notifications, users, projectStakeholders, agencyProjects, leads } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

/*
 * Notification helpers for server code only. They live outside any "use server" file so a browser cannot
 * call them to send a notification to someone else.
 */

/**
 * Creates a notification for a specific user
 */
export async function createSystemNotification(userId: string, message: string, type: string, link?: string) {
    try {
        await db.insert(notifications).values({
            userId,
            message,
            type,
            link
        });
    } catch (error) {
        console.error("Failed to create system notification:", error);
    }
}

/**
 * Broadcasts a notification to all admins and editors
 */
export async function notifyAllAdmins(message: string, type: string, link?: string) {
    try {
        const adminUsers = await db.query.users.findMany({
            where: inArray(users.role, ["superadmin", "manager"])
        });

        if (adminUsers.length === 0) return;

        const payloads = adminUsers.map(admin => ({
            userId: admin.id,
            message,
            type,
            link: link || null
        }));

        await db.insert(notifications).values(payloads);
    } catch (error) {
        console.error("Failed to notify admins:", error);
    }
}

/**
 * Notifies all client users associated with a specific project
 */
export async function notifyProjectClients(
    projectId: string,
    message: string,
    type: string,
    link?: string
) {
    try {
        const clientIds = new Set<string>();

        // 1. Check project stakeholders
        const stakeholders = await db.query.projectStakeholders.findMany({
            where: eq(projectStakeholders.projectId, projectId),
            with: { user: true }
        });

        for (const s of stakeholders) {
            if (s.user?.role === "client") {
                clientIds.add(s.userId);
            }
        }

        // 2. Check originating lead's clientId
        const project = await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.id, projectId),
            with: { lead: true }
        });

        if (project?.lead?.clientId) {
            clientIds.add(project.lead.clientId);
        }

        // 3. Fallback: if no explicit "client" role stakeholder, notify non-admin stakeholders (e.g. testing accounts)
        if (clientIds.size === 0 && stakeholders.length > 0) {
            for (const s of stakeholders) {
                if (s.user && !["superadmin", "manager"].includes(s.user.role || "")) {
                    clientIds.add(s.userId);
                }
            }
        }

        for (const clientId of clientIds) {
            await createSystemNotification(clientId, message, type, link || "/portal");
        }
    } catch (error) {
        console.error("Failed to notify project clients:", error);
    }
}

/**
 * Notifies the client associated with a lead/proposal
 */
export async function notifyLeadClient(
    leadId: string,
    message: string,
    type: string,
    link?: string
) {
    try {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId),
            with: { client: true }
        });

        if (lead?.clientId) {
            await createSystemNotification(lead.clientId, message, type, link);
        }
    } catch (error) {
        console.error("Failed to notify lead client:", error);
    }
}
