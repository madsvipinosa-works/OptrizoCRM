import { describe, expect, it } from "vitest";
import { publicInquirySchema } from "@/lib/schemas";

const base = {
    serviceId: "svc-1",
    urgency: "Soon",
    businessName: "Reyes Trading",
    clientName: "Ana Reyes",
    email: "ana@example.com",
    industry: "Retail",
    roleInCompany: "Owner",
    contactPreference: "Email" as const,
};

describe("public inquiry phone", () => {
    it.each(["", "+63 917 555 0142", "+63 (917) 555-0142", "+65 8123 4567", "+1 (555) 123-4567"])("accepts %j", (phone) => {
        expect(publicInquirySchema.safeParse({ ...base, phone }).success).toBe(true);
    });

    it.each(["0917 555 0142", "+63 12", "+63 917 555 0142 99999", "+63 abc", "+63 (817) 555-0142", "+63 (917) 555-014"])("rejects %j", (phone) => {
        expect(publicInquirySchema.safeParse({ ...base, phone }).success).toBe(false);
    });
});
