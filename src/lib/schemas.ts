import { z } from "zod";

export const contactFormSchema = z.object({
    firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
    lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
    email: z.string().email({ message: "Please enter a valid email address." }),
    subject: z.string().min(5, { message: "Subject must be at least 5 characters." }),
    message: z.string().min(10, { message: "Message must be at least 10 characters." }),
    budget: z.string().optional(),
    service: z.string().optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const leadStatusEnum = z.enum(["New", "Contacted", "In Progress", "Completed", "Lost"]);

export const leadUpdateSchema = z.object({
    status: leadStatusEnum.optional(),
    notes: z.string().optional(),
    assignedTo: z.string().nullable().optional(),
    files: z.array(z.string()).optional(),
    nextActionDate: z.coerce.date().nullable().optional(),
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
});

export const postSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    slug: z.string().optional(), // Generated if empty
    content: z.string().optional(),
    coverImage: z.string().optional(),
});

export const projectSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    clientName: z.string().optional(),
    description: z.string().optional(),
    slug: z.string().optional(),
    content: z.string().optional(),
    coverImage: z.string().optional(),
});

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
