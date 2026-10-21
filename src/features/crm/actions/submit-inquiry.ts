"use server";

import { contactFormSchema } from "@/lib/schemas";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { headers } from "next/headers";
import { checkRateLimit, formatRetryAfter, getClientIp } from "@/lib/rate-limit";
import { notifyAllAdmins } from "@/features/notifications/actions";
// Removed calculateLeadScore and sendLeadNotification since those apply to true Leads now.

export type ContactFormValues = {
    firstName?: string;
    lastName?: string;
    email?: string;
    subject?: string;
    message?: string;
};

export type ContactState = {
    message: string;
    success: boolean;
    errors: Record<string, string[]>;
    values?: ContactFormValues;
};

export async function submitContactForm(prevState: ContactState, formData: FormData): Promise<ContactState> {
    const rawValues: ContactFormValues = {
        firstName: (formData.get("firstName") as string) || "",
        lastName: (formData.get("lastName") as string) || "",
        email: (formData.get("email") as string) || "",
        subject: (formData.get("subject") as string) || "",
        message: (formData.get("message") as string) || "",
    };

    // 0. Rate Limiting Check against DDoS/Spam bots
    const headersList = await headers();
    const ip = getClientIp(headersList) ?? "unknown-ip";

    const rateLimitResult = await checkRateLimit("contact", ip);
    if (!rateLimitResult.success) {
        console.warn(`[Security] Blocked spam submission from IP: ${ip}`);
        return {
            message: `You have submitted too many requests. Please try again in ${formatRetryAfter(rateLimitResult.retryAfterSeconds)}.`,
            success: false,
            errors: {},
            values: rawValues,
        };
    }

    // 1. Validate fields using Zod
    const validatedFields = contactFormSchema.safeParse(rawValues);

    // 2. Return early if validation fails
    if (!validatedFields.success) {
        return {
            message: "Please check your inputs.",
            success: false,
            errors: validatedFields.error.flatten().fieldErrors,
            values: rawValues,
        };
    }

    // 3. Save to Database
    const { firstName, lastName, email, subject, message } = validatedFields.data;
    const name = `${firstName} ${lastName || ""}`.trim();

    try {
        await db.insert(inquiries).values({
            name,
            email,
            subject,
            message,
            source: "Website Form",
        });

        console.log(`[Contact] Inquiry saved from ${email}`);

        await notifyAllAdmins(`New website inquiry from ${name}`, "system", "/dashboard/inquiries");

        // 5. Return success
        return {
            message: "Message sent! We'll get back to you shortly.",
            success: true,
            errors: {},
            values: undefined,
        };
    } catch (error) {
        console.error("Failed to save contact message:", error);
        return {
            message: "Something went wrong. Please try again later.",
            success: false,
            errors: {},
            values: rawValues,
        };
    }
}
