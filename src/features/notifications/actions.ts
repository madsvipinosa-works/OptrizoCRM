"use server";

import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { auth } from "@/auth";

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
            where: inArray(users.role, ["admin", "editor"])
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
 * Fetches unread notifications for the currently authenticated user
 */
export async function getUnreadNotifications() {
    const session = await auth();
    if (!session?.user?.id) return [];
    
    try {
        const data = await db.query.notifications.findMany({
            where: and(
                eq(notifications.userId, session.user.id),
                eq(notifications.read, false)
            ),
            orderBy: [desc(notifications.createdAt)],
            limit: 20
        });
        return data;
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
    }
}

/**
 * Marks a specific notification as read
 */
export async function markNotificationAsRead(id: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false };
    
    try {
        await db.update(notifications)
            .set({ read: true })
            .where(and(
                eq(notifications.id, id),
                eq(notifications.userId, session.user.id)
            ));
        
        return { success: true };
    } catch (error) {
        console.error("Failed to mark read:", error);
        return { success: false };
    }
}

/**
 * Marks all notifications as read for the current user
 */
export async function markAllNotificationsAsRead() {
    const session = await auth();
    if (!session?.user?.id) return { success: false };
    
    try {
        await db.update(notifications)
            .set({ read: true })
            .where(and(
                eq(notifications.userId, session.user.id),
                eq(notifications.read, false)
            ));
        return { success: true };
    } catch (error) {
        console.error("Failed to mark all read:", error);
        return { success: false };
    }
}
