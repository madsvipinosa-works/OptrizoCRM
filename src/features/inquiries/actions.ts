"use server";

import { db } from "@/db";
import { inquiries, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const inquiryIdSchema = z.string().trim().min(1).max(128);
const ownerIdSchema = z.string().trim().min(1).max(128).nullable();
const nextActionSchema = z.string().trim().max(500);
const INQUIRY_PATH = "/dashboard/inquiries";

async function authorizeInquiryUpdate() {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return null;
    }
    return session;
}

export async function updateInquiryAssignment(inquiryId: string, ownerId: string | null) {
    const session = await authorizeInquiryUpdate();
    if (!session) return { success: false, message: "Unauthorized" };

    const parsedInquiryId = inquiryIdSchema.safeParse(inquiryId);
    const parsedOwnerId = ownerIdSchema.safeParse(ownerId);
    if (!parsedInquiryId.success || !parsedOwnerId.success) {
        return { success: false, message: "Invalid assignment details" };
    }

    if (parsedOwnerId.data) {
        const owner = await db.query.users.findFirst({
            where: eq(users.id, parsedOwnerId.data),
            columns: { id: true, role: true, isActive: true },
        });
        if (!owner || !owner.isActive || !["superadmin", "sales"].includes(owner.role)) {
            return { success: false, message: "Choose an active sales team member" };
        }
    }

    const [updated] = await db.update(inquiries)
        .set({ ownerId: parsedOwnerId.data })
        .where(eq(inquiries.id, parsedInquiryId.data))
        .returning({ id: inquiries.id });
    if (!updated) return { success: false, message: "Inquiry not found" };

    revalidatePath(INQUIRY_PATH);
    return { success: true };
}

export async function updateInquiryNextAction(inquiryId: string, nextAction: string) {
    const session = await authorizeInquiryUpdate();
    if (!session) return { success: false, message: "Unauthorized" };

    const parsedInquiryId = inquiryIdSchema.safeParse(inquiryId);
    const parsedNextAction = nextActionSchema.safeParse(nextAction);
    if (!parsedInquiryId.success || !parsedNextAction.success) {
        return { success: false, message: "Next action must be 500 characters or fewer" };
    }

    const [updated] = await db.update(inquiries)
        .set({ nextAction: parsedNextAction.data || null })
        .where(eq(inquiries.id, parsedInquiryId.data))
        .returning({ id: inquiries.id });
    if (!updated) return { success: false, message: "Inquiry not found" };

    revalidatePath(INQUIRY_PATH);
    return { success: true };
}

export async function markInquiryRead(inquiryId: string) {
    const session = await authorizeInquiryUpdate();
    if (!session) return { success: false, message: "Unauthorized" };

    const parsedInquiryId = inquiryIdSchema.safeParse(inquiryId);
    if (!parsedInquiryId.success) {
        return { success: false, message: "Invalid inquiry" };
    }

    const [updated] = await db.update(inquiries)
        .set({ status: "Read" })
        .where(and(
            eq(inquiries.id, parsedInquiryId.data),
            eq(inquiries.status, "Unread")
        ))
        .returning({ id: inquiries.id });
    if (!updated) {
        const inquiry = await db.query.inquiries.findFirst({
            where: eq(inquiries.id, parsedInquiryId.data),
            columns: { id: true },
        });
        if (!inquiry) return { success: false, message: "Inquiry not found" };
    }

    revalidatePath(INQUIRY_PATH);
    return { success: true };
}

export async function markInquiryHandled(inquiryId: string, isHandled: boolean) {
    const session = await authorizeInquiryUpdate();
    if (!session) return { success: false, message: "Unauthorized" };

    const parsedInquiryId = inquiryIdSchema.safeParse(inquiryId);
    if (!parsedInquiryId.success || typeof isHandled !== "boolean") {
        return { success: false, message: "Invalid handled status" };
    }

    if (!isHandled) {
        const inquiry = await db.query.inquiries.findFirst({
            where: eq(inquiries.id, parsedInquiryId.data),
            columns: { status: true },
        });
        if (!inquiry) return { success: false, message: "Inquiry not found" };
        if (inquiry.status === "Archived") {
            return { success: false, message: "Converted inquiries cannot be reopened" };
        }
    }

    const [updated] = await db.update(inquiries)
        .set({ isHandled })
        .where(eq(inquiries.id, parsedInquiryId.data))
        .returning({ id: inquiries.id });
    if (!updated) return { success: false, message: "Inquiry not found" };

    revalidatePath(INQUIRY_PATH);
    return { success: true };
}
