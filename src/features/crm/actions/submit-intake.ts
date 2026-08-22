"use server";

import { intakeFormSchema } from "@/lib/schemas";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { auth } from "@/auth";
import { notifyAllAdmins } from "@/features/notifications/actions";
import { parseBudgetToEstimatedValue } from "@/lib/utils";

export type IntakeState = {
    message: string;
    success: boolean;
    errors: Record<string, string[]>;
};

export async function submitIntakeForm(prevState: IntakeState, formData: FormData): Promise<IntakeState> {
    const session = await auth();
    
    if (!session?.user?.id) {
        return {
            message: "You must be logged in to submit an intake form.",
            success: false,
            errors: {},
        };
    }

    const validatedFields = intakeFormSchema.safeParse({
        businessName: formData.get("businessName"),
        industry: formData.get("industry"),
        targetAudience: formData.get("targetAudience"),
        budget: formData.get("budget"),
        timelineExpectation: formData.get("timelineExpectation"),
        goals: formData.get("goals"),
        serviceId: formData.get("serviceId") || undefined,
    });

    if (!validatedFields.success) {
        return {
            message: "Please check your inputs.",
            success: false,
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const estimatedValue = parseBudgetToEstimatedValue(validatedFields.data.budget);
        const { calculateLeadScore } = await import("@/features/crm/utils/leadScoring");
        const { score: leadScore, priority } = calculateLeadScore({
            estimatedValue,
            budget: validatedFields.data.budget,
            timelineExpectation: validatedFields.data.timelineExpectation,
            contactEmail: session.user.email,
            contactPhone: null,
            goals: validatedFields.data.goals,
            serviceId: validatedFields.data.serviceId,
        });

        await db.insert(leads).values({
            clientId: session.user.id,
            businessName: validatedFields.data.businessName,
            contactName: session.user.name || undefined,
            contactEmail: session.user.email || undefined,
            industry: validatedFields.data.industry,
            targetAudience: validatedFields.data.targetAudience,
            budget: validatedFields.data.budget,
            estimatedValue,
            leadScore,
            priority,
            timelineExpectation: validatedFields.data.timelineExpectation,
            goals: validatedFields.data.goals,
            serviceId: validatedFields.data.serviceId,
            status: "New Lead",
            source: "Intake Form",
            lastContactedAt: new Date(),
        });

        await notifyAllAdmins(`New lead intake from ${session.user.name || session.user.email}`, "lead", "/dashboard/leads");

        return {
            message: "Your request has been submitted successfully! We will review it and get back to you.",
            success: true,
            errors: {},
        };
    } catch (error) {
        console.error("Failed to save intake form:", error);
        return {
            message: "Something went wrong. Please try again later.",
            success: false,
            errors: {},
        };
    }
}
