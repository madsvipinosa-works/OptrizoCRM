import { describe, it, expect } from "vitest";
import {
  classifyTaskCategory,
  isGibberishOrNonInformative,
  validateArtifactRelevance,
} from "@/lib/quality-gate-utils";

describe("Quality Gatekeeper: Unit Tests", () => {
  describe("classifyTaskCategory", () => {
    it("should classify engineering tasks correctly", () => {
      expect(
        classifyTaskCategory("Implement OAuth2 Session Management", "Connect next-auth with postgres adapter")
      ).toBe("ENGINEERING");

      expect(
        classifyTaskCategory("Build dynamic lead filter UI component", "React frontend with tailwind")
      ).toBe("ENGINEERING");

      expect(
        classifyTaskCategory("Database Migrations & Schema", "Drizzle schema changes")
      ).toBe("ENGINEERING");
    });

    it("should classify design tasks correctly", () => {
      expect(
        classifyTaskCategory("Design High-Fidelity Figma Mockups", "Component library and wireframes")
      ).toBe("DESIGN");

      expect(
        classifyTaskCategory("Agency Brand Identity & Logo", "Typography, color palette")
      ).toBe("DESIGN");
    });

    it("should classify marketing tasks correctly", () => {
      expect(
        classifyTaskCategory("TikTok Video Campaign", "Publish 3 short-form videos")
      ).toBe("MARKETING_CONTENT");

      expect(
        classifyTaskCategory("Social Media Ad Creatives", "Instagram and Facebook promotional ads")
      ).toBe("MARKETING_CONTENT");
    });
  });

  describe("isGibberishOrNonInformative", () => {
    it("should detect common placeholder and spam text", () => {
      expect(isGibberishOrNonInformative("test")).toBe(true);
      expect(isGibberishOrNonInformative("asdf")).toBe(true);
      expect(isGibberishOrNonInformative("asdasd")).toBe(true);
      expect(isGibberishOrNonInformative("qwerty")).toBe(true);
      expect(isGibberishOrNonInformative("fsdfsdfs")).toBe(true);
      expect(isGibberishOrNonInformative("ghjkl")).toBe(true);
      expect(isGibberishOrNonInformative("ab")).toBe(true);
    });

    it("should allow legitimate, informative task titles", () => {
      expect(isGibberishOrNonInformative("Setup PostgreSQL Migration")).toBe(false);
      expect(isGibberishOrNonInformative("Client Invoicing Workflow")).toBe(false);
      expect(isGibberishOrNonInformative("User Profile Settings Screen")).toBe(false);
    });
  });

  describe("validateArtifactRelevance", () => {
    it("should reject top-level root domains without specific deep paths", () => {
      const result = validateArtifactRelevance(
        "https://github.com",
        "ENGINEERING",
        "Build API endpoint",
        "Express REST endpoints"
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("top-level homepage without an artifact path");
    });

    it("should reject Facebook Reels for an engineering task", () => {
      const result = validateArtifactRelevance(
        "https://www.facebook.com/reel/987654321098765",
        "ENGINEERING",
        "Implement OAuth2 Google Login",
        "Authentication logic"
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("cannot be accepted as a technical or design work deliverable");
    });

    it("should reject YouTube Shorts for an engineering task", () => {
      const result = validateArtifactRelevance(
        "https://youtube.com/shorts/E1tYLwwnCms",
        "ENGINEERING",
        "Implement payment webhook",
        "Stripe webhook handler"
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("YouTube Shorts");
    });

    it("should ACCEPT short-form video when the task is explicitly a marketing campaign", () => {
      const result = validateArtifactRelevance(
        "https://www.tiktok.com/@optrizo/video/71982736481723",
        "MARKETING_CONTENT",
        "Publish TikTok Social Media Reel",
        "Launch promotional video clip on TikTok"
      );
      expect(result.isValid).toBe(true);
      expect(result.status).toBe("PASS");
    });

    it("should accept valid engineering artifacts with deep links", () => {
      const githubPr = validateArtifactRelevance(
        "https://github.com/madsvipinosa-works/OptrizoCRM/pull/42",
        "ENGINEERING",
        "Implement OAuth2 Authentication",
        "NextAuth with PostgreSQL"
      );
      expect(githubPr.isValid).toBe(true);
      expect(githubPr.isSpecificDeepLink).toBe(true);

      const vercelPreview = validateArtifactRelevance(
        "https://optrizo-crm-git-feat-auth-madsvipinosa.vercel.app/dashboard",
        "ENGINEERING",
        "Deploy Staging Preview",
        "Staging preview validation"
      );
      expect(vercelPreview.isValid).toBe(true);
    });

    it("should accept valid design deliverables from Figma", () => {
      const figmaLink = validateArtifactRelevance(
        "https://figma.com/design/AbCdEf12345/Optrizo-Design-System?node-id=1-2",
        "DESIGN",
        "Design Proposal Studio Layout",
        "High-fidelity component mockups"
      );
      expect(figmaLink.isValid).toBe(true);
      expect(figmaLink.isSpecificDeepLink).toBe(true);
    });
  });
});
