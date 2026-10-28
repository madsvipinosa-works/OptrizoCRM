"use server";

import { intakeFormSchema } from "@/lib/schemas";
import { db } from "@/db";
import { leads, services } from "@/db/schema";
import { auth } from "@/auth";
import { createSystemNotification, notifyAllAdmins } from "@/features/notifications/actions";
import { parseBudgetToEstimatedValue } from "@/lib/utils";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";

export type IntakeFormValues = {
    businessName?: string;
    industry?: string;
    targetAudience?: string;
    budget?: string;
    timelineExpectation?: string;
    goals?: string;
    serviceId?: string;
};

export type IntakeState = {
    message: string;
    success: boolean;
    errors: Record<string, string[]>;
    values?: IntakeFormValues;
};

export async function submitIntakeForm(prevState: IntakeState, formData: FormData): Promise<IntakeState> {
    const rawValues: IntakeFormValues = {
        businessName: (formData.get("businessName") as string) || "",
        industry: (formData.get("industry") as string) || "",
        targetAudience: (formData.get("targetAudience") as string) || "",
        budget: (formData.get("budget") as string) || "",
        timelineExpectation: (formData.get("timelineExpectation") as string) || "",
        goals: (formData.get("goals") as string) || "",
        serviceId: (formData.get("serviceId") as string) || undefined,
    };

    const session = await auth();
    
    if (!session?.user?.id) {
        return {
            message: "You must be logged in to submit an intake form.",
            success: false,
            errors: {},
            values: rawValues,
        };
    }

    const rateLimit = await checkRateLimit("intake", session.user.id);
    if (!rateLimit.success) {
        return {
            message: `You have submitted too many requests. Please try again in ${formatRetryAfter(rateLimit.retryAfterSeconds)}.`,
            success: false,
            errors: {},
            values: rawValues,
        };
    }

    const validatedFields = intakeFormSchema.safeParse(rawValues);

    if (!validatedFields.success) {
        return {
            message: "Please check your inputs.",
            success: false,
            errors: validatedFields.error.flatten().fieldErrors,
            values: rawValues,
        };
    }

    try {
        const estimatedValue = parseBudgetToEstimatedValue(validatedFields.data.budget);
        const selectedService = validatedFields.data.serviceId
            ? await db.query.services.findFirst({
                where: (service, { eq }) => eq(service.id, validatedFields.data.serviceId!),
                columns: { title: true },
            })
            : null;
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

        const serviceLabel = selectedService?.title || "service";
        await createSystemNotification(
            session.user.id,
            `Your request for ${serviceLabel} has been submitted. View its status in Availed Services.`,
            "service",
            "/portal/services",
        );

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
            values: rawValues,
        };
    }
}
