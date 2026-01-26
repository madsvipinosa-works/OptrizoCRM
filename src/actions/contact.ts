"use server";

import { contactFormSchema } from "@/lib/schemas";
import { db } from "@/db";
import { messages } from "@/db/schema";


export type ContactState = {
    errors?: {
        firstName?: string[];
        lastName?: string[];
        email?: string[];
        subject?: string[];
        message?: string[];
    };
    message?: string;
    success?: boolean;
};

export async function submitContactForm(prevState: ContactState, formData: FormData) {
    // 1. Validate fields using Zod
    const validatedFields = contactFormSchema.safeParse({
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email"),
        subject: formData.get("subject"),
        message: formData.get("message"),
    });

    // 2. Return early if validation fails
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing Fields. Failed to send message.",
            success: false,
        };
    }

    // 3. Save to Database
    const { firstName, lastName, email, subject, message } = validatedFields.data;
    const name = `${firstName} ${lastName || ""}`.trim();

    try {
        await db.insert(messages).values({
            name,
            email,
            subject,
            message, // content alias in schema
            read: false,
        });

        console.log(`[Contact] Message saved from ${email}`);

        // 4. Return success
        return {
            message: "Message sent successfully! We'll be in touch soon.",
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
