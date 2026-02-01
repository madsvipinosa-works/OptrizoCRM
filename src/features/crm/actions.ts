"use server";

import { db } from "@/db";
import { leads, leadNotes } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { leadUpdateSchema, type LeadUpdateValues } from "@/lib/schemas";
import { auth } from "@/auth";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
};

export async function updateLead(id: string, data: LeadUpdateValues): Promise<ActionState> {
    // 1. Auth Check (Admin or Editor)
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized: Access required." };
    }

    // 2. Validate Input
    const validated = leadUpdateSchema.safeParse(data);
    if (!validated.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: validated.error.flatten().fieldErrors,
        };
    }

    // 3. Update Database
    try {
        await db.update(leads)
            .set({
                ...validated.data,
                updatedAt: new Date(),
            })
            .where(eq(leads.id, id));

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead updated successfully" };
    } catch (error) {
        console.error("Failed to update lead:", error);
        return { success: false, message: "Database error: Failed to update lead." };
    }
}

export async function addLeadNote(leadId: string, content: string): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    if (!content.trim()) {
        return { success: false, message: "Note cannot be empty" };
    }

    try {
        await db.insert(leadNotes).values({
            leadId,
            authorId: session.user.id!,
            content: content.trim(),
        });

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Note added" };
    } catch (error) {
        console.error("Failed to add note:", error);
        return { success: false, message: "Failed to add note" };
    }
}
