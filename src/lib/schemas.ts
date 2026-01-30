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
});

export type LeadUpdateValues = z.infer<typeof leadUpdateSchema>;
