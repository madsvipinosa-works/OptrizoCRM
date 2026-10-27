import { describe, it, expect } from "vitest";
import {
  contactFormSchema,
  intakeFormSchema,
  transitionLeadSchema,
  lossReasonSchema,
  leadUpdateSchema,
  STANDARD_LEAD_SOURCES,
  ProposalLineItemSchema,
  SaveProposalSchema,
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

  describe("leadUpdateSchema & Lead Sources", () => {
    it("should accept updating lead source with standard and custom values", () => {
      expect(STANDARD_LEAD_SOURCES).toContain("LinkedIn / Social Media");
      expect(STANDARD_LEAD_SOURCES).toContain("Other");

      const updateWithStandard = {
        source: "Conference / Networking Event",
        budget: "$15,000",
      };
      const res1 = leadUpdateSchema.safeParse(updateWithStandard);
      expect(res1.success).toBe(true);

      const updateWithCustom = {
        source: "Tech Expo 2026 - Booth 4A",
        estimatedValue: 45000,
      };
      const res2 = leadUpdateSchema.safeParse(updateWithCustom);
      expect(res2.success).toBe(true);
      if (res2.success) {
        expect(res2.data.source).toBe("Tech Expo 2026 - Booth 4A");
      }
    });
  });

  describe("SaveProposalSchema & ProposalLineItemSchema Validation", () => {
    it("should accept valid proposal and line item data", () => {
      const validLineItem = {
        name: "Full-Stack Web Development",
        description: "Next.js + Drizzle ORM implementation",
        quantity: 1,
        unitPrice: 5000,
        total: 5000,
      };
      const lineRes = ProposalLineItemSchema.safeParse(validLineItem);
      expect(lineRes.success).toBe(true);

      const validProposal = {
        proposalCode: "OPT-2026-9999",
        businessName: "Acme Corp",
        scope: "Build a complete web application with authentication and CRM.",
        deliverables: ["Auth System", "CRM Board"],
        pricingStructure: [validLineItem],
        subtotal: 5000,
        discount: 500,
        tax: 250,
        total: 4750,
      };
      const propRes = SaveProposalSchema.safeParse(validProposal);
      expect(propRes.success).toBe(true);
    });

    it("should reject line item with quantity exceeding 9999 or below 1", () => {
      const overQty = {
        name: "Consultation",
        quantity: 10000,
        unitPrice: 100,
      };
      const resOver = ProposalLineItemSchema.safeParse(overQty);
      expect(resOver.success).toBe(false);
      if (!resOver.success) {
        expect(resOver.error.issues[0].message).toContain("cannot exceed 9,999");
      }

      const zeroQty = {
        name: "Consultation",
        quantity: 0,
        unitPrice: 100,
      };
      const resZero = ProposalLineItemSchema.safeParse(zeroQty);
      expect(resZero.success).toBe(false);
    });

    it("should reject negative unit price or price exceeding $10,000,000", () => {
      const negPrice = {
        name: "Service",
        quantity: 1,
        unitPrice: -50,
      };
      const resNeg = ProposalLineItemSchema.safeParse(negPrice);
      expect(resNeg.success).toBe(false);

      const overPrice = {
        name: "Service",
        quantity: 1,
        unitPrice: 15_000_000,
      };
      const resOver = ProposalLineItemSchema.safeParse(overPrice);
      expect(resOver.success).toBe(false);
      if (!resOver.success) {
        expect(resOver.error.issues[0].message).toContain("cannot exceed $10,000,000");
      }
    });

    it("should enforce refinement that discount cannot exceed subtotal", () => {
      const invalidDiscount = {
        proposalCode: "OPT-2026-1234",
        businessName: "Beta LLC",
        pricingStructure: [
          { name: "Design Phase", quantity: 1, unitPrice: 2000, total: 2000 },
        ],
        subtotal: 2000,
        discount: 2500, // Exceeds subtotal $2,000!
        tax: 0,
        total: 0,
      };
      const result = SaveProposalSchema.safeParse(invalidDiscount);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Discount cannot exceed the proposal subtotal");
      }
    });
  });
});
