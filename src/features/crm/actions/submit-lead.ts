"use server";

import { contactFormSchema } from "@/lib/schemas";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { calculateLeadScore } from "@/lib/scoring";
import { sendLeadNotification } from "@/lib/notifications";


export type ContactState = {
    message: string;
    success: boolean;
    errors: Record<string, string[]>;
};

export async function submitContactForm(prevState: ContactState, formData: FormData): Promise<ContactState> {
    // 1. Validate fields using Zod
    const validatedFields = contactFormSchema.safeParse({
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email"),
        subject: formData.get("subject"),
        message: formData.get("message"),
        budget: formData.get("budget"),
        service: formData.get("service"),
    });

    // 2. Return early if validation fails
    if (!validatedFields.success) {
        return {
            message: "Please check your inputs.",
            success: false,
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    // 3. Save to Database
    const { firstName, lastName, email, subject, message, budget, service } = validatedFields.data;
    const name = `${firstName} ${lastName || ""}`.trim();

    // Calculate Score
    const score = calculateLeadScore({ budget, service, message });

    try {
        await db.insert(leads).values({
            name,
            email,
            subject,
            message,
            budget,
            service,
            score,
            source: "Website Form",
        });

        console.log(`[Contact] Lead saved from ${email}`);

        // 4. Send Email Notification (Fire and forget)
        try {
            await sendLeadNotification({
                name,
                email,
                message,
                service: service ?? undefined,
                budget: budget ?? undefined,
                score,
            });
        } catch (emailError) {
            console.error("Failed to send email notif:", emailError);
        }

        // 5. Return success
        return {
            message: "Message sent! We'll get back to you shortly.",
            success: true,
            errors: {},
        };
    } catch (error) {
        console.error("Failed to save contact message:", error);
        return {
            message: "Something went wrong. Please try again later.",
            success: false,
            errors: {},
        };
    }
}
