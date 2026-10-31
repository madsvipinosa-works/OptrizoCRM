"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/auth";

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

/**
 * Fetches recent notifications (read and unread) for the current user
 */
export async function getAllNotifications(limit = 20) {
    const session = await auth();
    if (!session?.user?.id) return [];
    
    try {
        const data = await db.query.notifications.findMany({
            where: eq(notifications.userId, session.user.id),
            orderBy: [desc(notifications.createdAt)],
            limit
        });
        return data;
    } catch (error) {
        console.error("Failed to fetch all notifications:", error);
        return [];
    }
}
