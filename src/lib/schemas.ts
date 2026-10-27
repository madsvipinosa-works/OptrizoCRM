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

export const STANDARD_LEAD_SOURCES = [
    "Website Form",
    "Client Intake Portal",
    "Referral / Word of Mouth",
    "LinkedIn / Social Media",
    "Cold Outreach (Email/Call)",
    "Conference / Networking Event",
    "Google Search / Organic SEO",
    "Paid Advertising (Meta/Google Ads)",
    "Partner / Agency Network",
    "Existing Client (Upsell)",
    "Inbound Phone / Direct Email",
    "Other",
] as const;

export type StandardLeadSource = (typeof STANDARD_LEAD_SOURCES)[number];

export const leadUpdateSchema = z.object({
    status: leadStatusEnum.optional(),
    businessName: z.string().optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().optional(),
    budget: z.string().optional(),
    estimatedValue: z.number().optional(),
    leadScore: z.number().optional(),
    score: z.number().optional(),
    priority: z.enum(["Hot", "Warm", "Cold"]).optional(),
    qualificationStatus: z.enum(["Lead", "MQL", "SQL"]).optional(),
    goals: z.string().optional(),
    industry: z.string().optional(),
    source: z.string().optional(),
    timelineExpectation: z.string().optional(),
    notes: z.string().optional(),
    assigneeIds: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
    activityType: z.enum(["Call", "Email", "Meeting", "Note"]).optional(),
});

export type LeadUpdateValues = z.infer<typeof leadUpdateSchema>;

// --- CMS Schemas ---

export const siteSettingsSchema = z.object({
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    aboutText: z.string().optional(),
    logoUrl: z.string().optional(),
    logoDarkUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    notificationEmails: z.string().optional(),
    demoVideoUrl: z.string().optional(),
    faqs: z.string().optional(),
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
    slug: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    category: z.string().optional(),
    image: z.string().optional(),
    color: z.string().optional(),
    link: z.string().optional(),
    icon: z.string().optional(),
    order: z.coerce.number().optional().default(0),
    isFeatured: z.preprocess(
        (val) => val === true || val === "true" || val === "on" || val === 1 || val === "1",
        z.boolean()
    ).optional().default(false),
    inclusions: z.preprocess((val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === "string") {
            try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                return val.split("\n").map((s) => s.trim()).filter(Boolean);
            }
        }
        return [];
    }, z.array(z.string())).optional().default([]),
    deliverables: z.preprocess((val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === "string") {
            try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                return val.split("\n").map((s) => s.trim()).filter(Boolean);
            }
        }
        return [];
    }, z.array(z.string())).optional().default([]),
    scopeOverview: z.string().optional(),
    timelineEstimate: z.string().optional().default("2-4 Weeks"),
    targetAudience: z.string().optional(),
});

export type ServiceValues = z.infer<typeof serviceSchema>;

export const testimonialSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    role: z.string().optional(),
    company: z.string().optional(),
    content: z.string().min(1, "Content is required"),
    rating: z.coerce.number().min(1).max(5).default(5),
    image: z.string().optional(),
});

export const ProposalLineItemSchema = z.object({
    name: z.string().trim().min(1, "Line item description is required").max(180, "Item description too long"),
    description: z.string().trim().max(500).optional().nullable(),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(9999, "Quantity cannot exceed 9,999"),
    unitPrice: z.coerce.number().min(0, "Unit price cannot be negative").max(10_000_000, "Unit price cannot exceed $10,000,000"),
    total: z.coerce.number().min(0).max(100_000_000).optional(),
});

export const SaveProposalSchema = z.object({
    proposalCode: z.string().trim().max(50).optional(),
    businessName: z.string().trim().max(150).optional(),
    scope: z.string().trim().max(5000).optional().nullable(),
    technicalApproach: z.string().trim().max(5000).optional().nullable(),
    timeline: z.string().trim().max(100).optional().nullable(),
    deliverables: z.array(z.string().trim().max(250)).optional(),
    pricingStructure: z.array(ProposalLineItemSchema).min(1, "At least one line item is required").optional(),
    subtotal: z.coerce.number().min(0).max(100_000_000).optional(),
    discount: z.coerce.number().min(0, "Discount cannot be negative").max(10_000_000, "Discount exceeds maximum allowed").default(0),
    tax: z.coerce.number().min(0, "Tax cannot be negative").max(10_000_000, "Tax exceeds maximum allowed").default(0),
    total: z.coerce.number().min(0).max(100_000_000).optional(),
    terms: z.string().trim().max(5000).optional().nullable(),
    validUntil: z.any().optional(),
    fileUrl: z.string().nullable().optional(),
    contractSettings: z.record(z.string(), z.any()).optional().nullable(),
}).refine((data) => {
    if (data.pricingStructure && data.pricingStructure.length > 0) {
        const subtotal = data.pricingStructure.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        return (data.discount ?? 0) <= subtotal;
    }
    if (data.subtotal !== undefined) {
        return (data.discount ?? 0) <= data.subtotal;
    }
    return true;
}, {
    message: "Discount cannot exceed the proposal subtotal.",
    path: ["discount"],
});
