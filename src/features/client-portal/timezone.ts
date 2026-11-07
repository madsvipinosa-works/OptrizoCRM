"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isValidTimezone } from "@/lib/datetime";

/** Saves the signed-in client's device timezone, so portal times and emails show in it. Clients only. */
export async function saveMyTimezone(timezone: string): Promise<{ success: boolean }> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "client") return { success: false };
    if (!isValidTimezone(timezone)) return { success: false };

    try {
        await db.update(users).set({ timezone }).where(eq(users.id, session.user.id));
        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: "UPDATE",
            entity: "user",
            details: `Timezone set to ${timezone}`,
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to save timezone:", error);
        return { success: false };
    }
}
