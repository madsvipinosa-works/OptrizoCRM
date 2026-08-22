import { z } from "zod";

export const contactFormSchema = z.object({
    firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
    lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
    email: z.string().email({ message: "Please enter a valid email address." }),
    subject: z.string().min(5, { message: "Subject must be at least 5 characters." }),
    message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const intakeFormSchema = z.object({
    businessName: z.string().min(2, { message: "Business name is required." }),
    industry: z.string().min(2, { message: "Industry is required." }),
    targetAudience: z.string().min(2, { message: "Target audience is required." }),
    budget: z.string().min(1, { message: "Budget is required." }),
    timelineExpectation: z.string().min(1, { message: "Timeline is required." }),
    goals: z.string().min(10, { message: "Please describe your project goals." }),
    serviceId: z.string().optional(),
});

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

export const leadStatusEnum = z.enum([
    "New Lead",
    "Discovery & Qualifying",
    "Proposal Sent",
    "In Negotiation",
    "Closed Won",
    "Closed Lost"
]);

export const lossReasonSchema = z.enum([
    "budget_too_low",
    "competitor_chosen",
    "scope_mismatch",
    "timing_ghosted",
    "internal_cancellation",
    "other"
]);

export type LossReason = z.infer<typeof lossReasonSchema>;

export const transitionLeadSchema = z.object({
    leadId: z.string(),
    newStatus: leadStatusEnum,
    lossReason: lossReasonSchema.optional(),
    lossNotes: z.string().max(1000).optional(),
    reasonNotes: z.string().max(500).optional(),
}).refine((data) => {
    if (data.newStatus === "Closed Lost" && !data.lossReason) {
        return false;
    }
    return true;
}, {
    message: "A loss reason is mandatory when marking a lead as Closed Lost.",
    path: ["lossReason"],
});

export type TransitionLeadValues = z.infer<typeof transitionLeadSchema>;

export const logLeadActivitySchema = z.object({
    leadId: z.string(),
    activityType: z.enum(["Call", "Meeting", "Email", "Note"]),
    content: z.string().min(1, "Activity note cannot be empty"),
    nextFollowUpDate: z.string().optional().nullable(),
});

export type LogLeadActivityValues = z.infer<typeof logLeadActivitySchema>;

export const leadUpdateSchema = z.object({
    status: leadStatusEnum.optional(),
    notes: z.string().optional(),
    assigneeIds: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
    score: z.number().optional(),
    priority: z.enum(["Hot", "Warm", "Cold"]).optional(),
    estimatedValue: z.number().optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().optional(),
    activityType: z.enum(["Call", "Email", "Meeting", "Note"]).optional(),
});

export type LeadUpdateValues = z.infer<typeof leadUpdateSchema>;

// --- CMS Schemas ---

export const siteSettingsSchema = z.object({
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    aboutText: z.string().optional(),
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    notificationEmails: z.string().optional(),
    demoVideoUrl: z.string().optional(),
});

export const postSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    slug: z.string().optional(), // Generated if empty
    content: z.string().optional(),
    coverImage: z.string().optional(),
});

export const caseStudySchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    clientName: z.string().optional(),
    description: z.string().optional(),
    slug: z.string().optional(),
    content: z.string().optional(),
    coverImage: z.string().optional(),
});

export const projectSchema = caseStudySchema;
export type CaseStudyValues = z.infer<typeof caseStudySchema>;
export type ProjectValues = CaseStudyValues;

export const serviceSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    icon: z.string().optional(),
});

export const testimonialSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    role: z.string().optional(),
    company: z.string().optional(),
    content: z.string().min(1, "Content is required"),
    rating: z.coerce.number().min(1).max(5).default(5),
    image: z.string().optional(),
});
