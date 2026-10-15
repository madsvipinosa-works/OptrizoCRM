import { describe, it, expect } from "vitest";
import {
  contactFormSchema,
  intakeFormSchema,
  transitionLeadSchema,
  lossReasonSchema,
} from "@/lib/schemas";

describe("CRM & Client Zod Validation Schemas", () => {
  describe("contactFormSchema", () => {
    it("should accept valid contact submissions", () => {
      const valid = {
        firstName: "Sarah",
        lastName: "Connor",
        email: "sarah@skynet-defense.com",
        subject: "Consulting Inquiry",
        message: "We need an advanced infrastructure audit for our systems.",
      };
      const result = contactFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email formats", () => {
      const invalid = {
        firstName: "Sarah",
        lastName: "Connor",
        email: "not-an-email",
        subject: "Consulting",
        message: "Valid message length exceeding ten characters.",
      };
      const result = contactFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("valid email address");
      }
    });

    it("should enforce minimum length constraints", () => {
      const short = {
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        subject: "Hi",
        message: "Short",
      };
      const result = contactFormSchema.safeParse(short);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.issues.map((i) => i.path[0]);
        expect(fields).toContain("firstName");
        expect(fields).toContain("lastName");
        expect(fields).toContain("subject");
        expect(fields).toContain("message");
      }
    });
  });

  describe("transitionLeadSchema & Business Rules", () => {
    it("should require a lossReason when marking lead as Closed Lost", () => {
      const missingReason = {
        leadId: "lead-123",
        newStatus: "Closed Lost" as const,
      };
      const result = transitionLeadSchema.safeParse(missingReason);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("loss reason is mandatory");
      }
    });

    it("should succeed when Closed Lost has an approved lossReason", () => {
      const validClosedLost = {
        leadId: "lead-123",
        newStatus: "Closed Lost" as const,
        lossReason: "budget_too_low" as const,
        lossNotes: "Client budget was below minimum agency retainer threshold.",
      };
      const result = transitionLeadSchema.safeParse(validClosedLost);
      expect(result.success).toBe(true);
    });

    it("should allow non-lost status transitions without lossReason", () => {
      const validWon = {
        leadId: "lead-123",
        newStatus: "Closed Won" as const,
      };
      const result = transitionLeadSchema.safeParse(validWon);
      expect(result.success).toBe(true);
    });

    it("should reject unrecognized loss reasons", () => {
      const invalidReason = {
        leadId: "lead-123",
        newStatus: "Closed Lost" as const,
        lossReason: "alien_invasion" as any,
      };
      const result = transitionLeadSchema.safeParse(invalidReason);
      expect(result.success).toBe(false);
    });
  });

  describe("intakeFormSchema", () => {
    it("should validate full client onboarding brief", () => {
      const intake = {
        businessName: "Nexus HealthTech",
        industry: "Healthcare SaaS",
        targetAudience: "Private clinics and hospital networks",
        budget: "$25,000 - $50,000",
        timelineExpectation: "2 - 3 Months",
        goals: "Build an end-to-end HIPAA-compliant patient management system.",
      };
      const result = intakeFormSchema.safeParse(intake);
      expect(result.success).toBe(true);
    });

    it("should enforce mandatory description of project goals", () => {
      const missingGoals = {
        businessName: "Nexus HealthTech",
        industry: "Healthcare SaaS",
        targetAudience: "Clinics",
        budget: "$25,000",
        timelineExpectation: "2 Months",
        goals: "Too short",
      };
      const result = intakeFormSchema.safeParse(missingGoals);
      expect(result.success).toBe(false);
    });
  });
});
