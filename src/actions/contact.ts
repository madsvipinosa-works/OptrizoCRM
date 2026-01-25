"use server";

import { contactFormSchema } from "@/lib/schemas";


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

    // 3. Simulate Database/Email Operation
    const { firstName, email, subject, message } = validatedFields.data;
    console.log("--- CONTACT FORM SUBMISSION ---");
    console.log(`From: ${firstName} (${email})`);
    console.log(`Subject: ${subject}`);
    console.log(`Message: ${message}`);
    console.log("-------------------------------");

    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Return success
    return {
        message: "Message sent successfully! We'll be in touch soon.",
        success: true,
        errors: {},
    };
}
