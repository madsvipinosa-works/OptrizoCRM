"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateUserRole(userId: string, newRole: "admin" | "editor" | "user" | "client") {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
        return { success: false, message: "Unauthorized: Only admins can manage roles." };
    }

    if (userId === session.user.id) {
        return { success: false, message: "You cannot change your own role." };
    }

    try {
        await db.update(users)
            .set({ role: newRole })
            .where(eq(users.id, userId));

        revalidatePath("/dashboard/team");
        revalidatePath("/dashboard/leads"); // Revalidate leads page too as assignment dropdown changes
        return { success: true, message: "User role updated." };
    } catch (error) {
        console.error("Failed to update role:", error);
        return { success: false, message: "Database error." };
    }
}
