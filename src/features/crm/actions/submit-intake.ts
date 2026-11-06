"use server";

import { intakeFormSchema, publicInquirySchema } from "@/lib/schemas";
import { db } from "@/db";
import { leads, leadActivityLogs, auditLogs } from "@/db/schema";
import { auth } from "@/auth";
import { createSystemNotification, notifyAllSales } from "@/features/notifications/send";
import { sendInquiryConfirmationEmail } from "@/lib/notifications";
import { parseBudgetToEstimatedValue } from "@/lib/utils";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import { getPublishedServices as getPublishedServicesCms } from "@/features/cms/content/public-queries";
import { getBaseUrl } from "@/lib/email-templates";
import { servicePageHref } from "@/lib/service-links";

export type IntakeFormValues = {
    businessName?: string;
    industry?: string;
    targetAudience?: string;
    budget?: string;
    timelineExpectation?: string;
    goals?: string;
    serviceId?: string;
    // Public inquiry fields
    otherServiceText?: string;
    urgency?: string;
    clientName?: string;
    email?: string;
    phone?: string;
    roleInCompany?: string;
    contactPreference?: "Phone call" | "Email" | "Video meeting";
    details?: string;
};

export type IntakeState = {
    message: string;
    success: boolean;
    errors: Record<string, string[]>;
    values?: IntakeFormValues;
    inquiryData?: {
        businessName?: string;
        clientName?: string;
        serviceName?: string;
        /** Slug of the published service they picked. Missing when they chose "Other". */
        serviceSlug?: string | null;
        email?: string;
    };
};

export async function submitIntakeForm(prevState: IntakeState, formData: FormData): Promise<IntakeState> {
    const isPublicInquiry = formData.has("urgency") || formData.has("clientName") || formData.has("roleInCompany");

    const session = await auth();

    // 1. PUBLIC INQUIRY FLOW (from /services - no login required, no IP rate limiting)
    if (isPublicInquiry) {
        const rawPublicValues = {
            serviceId: (formData.get("serviceId") as string) || undefined,
            otherServiceText: (formData.get("otherServiceText") as string) || undefined,
            urgency: (formData.get("urgency") as string) || "",
            businessName: (formData.get("businessName") as string) || "",
            clientName: (formData.get("clientName") as string) || "",
            email: (formData.get("email") as string) || "",
            phone: (formData.get("phone") as string) || undefined,
            industry: (formData.get("industry") as string) || "",
            roleInCompany: (formData.get("roleInCompany") as string) || "",
            contactPreference: (formData.get("contactPreference") as "Phone call" | "Email" | "Video meeting") || undefined,
            details: (formData.get("details") as string) || undefined,
        };

        const validatedInquiry = publicInquirySchema.safeParse(rawPublicValues);
        if (!validatedInquiry.success) {
            return {
                message: "Please check your inputs.",
                success: false,
                errors: validatedInquiry.error.flatten().fieldErrors,
                values: rawPublicValues,
            };
        }

        const data = validatedInquiry.data;

        try {
            // Resolve service title - re-check serviceId against published AND showInInquiry
            let serviceTitle = data.otherServiceText || "Other";
            let validServiceId: string | null = null;
            let serviceSlug: string | null = null;
            if (data.serviceId && data.serviceId !== "other") {
                const inquiryServices = await getPublishedServicesCms({ forInquiry: true });
                const foundService = inquiryServices.find((svc) => svc.id === data.serviceId);
                if (foundService) {
                    serviceTitle = foundService.title;
                    validServiceId = foundService.id;
                    serviceSlug = foundService.slug ?? null;
                } else {
                    // Fall back to "Other" with otherServiceText (do not trust the client)
                    serviceTitle = data.otherServiceText || "Other";
                    validServiceId = null;
                }
            }

            // Create lead with stage 'New Lead' and lastContactedAt: null (sub-status: "No contact yet")
            const [newLead] = await db.insert(leads).values({
                clientId: session?.user?.id || null,
                serviceId: validServiceId,
                businessName: data.businessName,
                contactName: data.clientName,
                contactEmail: data.email,
                contactPhone: data.phone || null,
                industry: data.industry,
                urgency: data.urgency,
                roleInCompany: data.roleInCompany,
                contactPreference: data.contactPreference,
                otherServiceText: data.otherServiceText || null,
                details: data.details || null,
                status: "New Lead",
                source: "Website Form",
                lastContactedAt: null,
            }).returning({ id: leads.id });

            // Create System Activity interaction: "Inquiry received from the website"
            await db.insert(leadActivityLogs).values({
                leadId: newLead.id,
                authorId: null,
                activityType: "System",
                content: "Inquiry received from the website",
            });

            // Notify every sales user
            await notifyAllSales(`New inquiry from ${data.businessName} (${serviceTitle})`, "lead", "/dashboard/leads");

            // Create audit row
            await db.insert(auditLogs).values({
                userId: session?.user?.id || null,
                action: "CREATE",
                entity: "lead",
                details: `Public inquiry received for ${serviceTitle}: ${data.businessName}`,
            });

            // Send confirmation email
            const serviceHref = servicePageHref(serviceSlug);
            await sendInquiryConfirmationEmail({
                clientName: data.clientName,
                email: data.email,
                businessName: data.businessName,
                serviceName: serviceTitle,
                serviceUrl: serviceHref ? `${getBaseUrl()}${serviceHref}` : null,
            });

            return {
                message: "Inquiry submitted successfully!",
                success: true,
                errors: {},
                inquiryData: {
                    businessName: data.businessName,
                    clientName: data.clientName,
                    serviceName: serviceTitle,
                    serviceSlug,
                    email: data.email,
                },
            };
        } catch (error) {
            console.error("Failed to save public inquiry:", error);
            return {
                message: "Something went wrong while submitting your inquiry. Please try again later.",
                success: false,
                errors: {},
                values: rawPublicValues,
            };
        }
    }

    // 2. PORTAL INTAKE FORM (from /portal/request-proposal - requires authenticated client session)
    const rawValues: IntakeFormValues = {
        businessName: (formData.get("businessName") as string) || "",
        industry: (formData.get("industry") as string) || "",
        targetAudience: (formData.get("targetAudience") as string) || "",
        budget: (formData.get("budget") as string) || "",
        timelineExpectation: (formData.get("timelineExpectation") as string) || "",
        goals: (formData.get("goals") as string) || "",
        serviceId: (formData.get("serviceId") as string) || undefined,
    };

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
        let validServiceId: string | null = null;
        let selectedService: { title: string } | null = null;
        if (validatedFields.data.serviceId && validatedFields.data.serviceId !== "other") {
            const inquiryServices = await getPublishedServicesCms({ forInquiry: true });
            const foundService = inquiryServices.find((svc) => svc.id === validatedFields.data.serviceId);
            if (foundService) {
                validServiceId = foundService.id;
                selectedService = { title: foundService.title };
            }
        }

        const [createdLead] = await db.insert(leads).values({
            clientId: session.user.id,
            businessName: validatedFields.data.businessName,
            contactName: session.user.name || undefined,
            contactEmail: session.user.email || undefined,
            industry: validatedFields.data.industry,
            targetAudience: validatedFields.data.targetAudience,
            budget: validatedFields.data.budget,
            estimatedValue,
            timelineExpectation: validatedFields.data.timelineExpectation,
            goals: validatedFields.data.goals,
            serviceId: validServiceId,
            status: "New Lead",
            source: "Client Portal Intake",
            lastContactedAt: null,
        }).returning({ id: leads.id });

        await db.insert(leadActivityLogs).values({
            leadId: createdLead.id,
            authorId: null,
            activityType: "System",
            content: "Inquiry received from the website",
        });

        await notifyAllSales(`New intake from ${session.user.name || session.user.email}`, "lead", "/dashboard/leads");

        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: "CREATE",
            entity: "lead",
            details: `Client portal intake submitted by ${session.user.email}`,
        });

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


export async function getPublishedServices(): Promise<{ id: string; title: string }[]> {
    try {
        const rows = await getPublishedServicesCms({ forInquiry: true });
        return rows.map((s) => ({ id: s.id, title: s.title }));
    } catch {
        return [];
    }
}
