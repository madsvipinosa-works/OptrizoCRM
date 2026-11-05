import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
    buildPublishedPageWhere,
    buildPublishedPortfolioBySlugWhere,
    buildPublishedPortfolioWhere,
    buildPublishedServicesWhere,
    buildPublishedServiceBySlugWhere,
    mapPublicPortfolio,
} from "@/features/cms/content/public-queries";
import { canPublishPortfolio } from "@/features/cms/content/schemas";

const dialect = new PgDialect();

describe("Public queries where-builders compilation", () => {
    it("compiles buildPublishedServicesWhere default (showOnServicesPage = true)", () => {
        const where = buildPublishedServicesWhere();
        const compiled = dialect.sqlToQuery(where!);
        expect(compiled.sql).toContain('"service"."status" = $1');
        expect(compiled.sql).toContain('"service"."show_on_services_page" = $2');
        expect(compiled.params).toEqual(["published", true]);
    });

    it("compiles buildPublishedServicesWhere for inquiry (showInInquiry = true)", () => {
        const where = buildPublishedServicesWhere({ forInquiry: true });
        const compiled = dialect.sqlToQuery(where!);
        expect(compiled.sql).toContain('"service"."status" = $1');
        expect(compiled.sql).toContain('"service"."show_in_inquiry" = $2');
        expect(compiled.params).toEqual(["published", true]);
    });

    it("compiles buildPublishedServiceBySlugWhere", () => {
        const where = buildPublishedServiceBySlugWhere("web-dev");
        const compiled = dialect.sqlToQuery(where!);
        expect(compiled.sql).toContain('"service"."status" = $1');
        expect(compiled.sql).toContain('"service"."slug" = $2');
        expect(compiled.params).toEqual(["published", "web-dev"]);
    });

    it("compiles buildPublishedPortfolioWhere", () => {
        const where = buildPublishedPortfolioWhere();
        const compiled = dialect.sqlToQuery(where!);
        expect(compiled.sql).toContain('"case_study"."status" = $1');
        expect(compiled.params).toEqual(["published"]);
    });

    it("compiles buildPublishedPortfolioBySlugWhere", () => {
        const where = buildPublishedPortfolioBySlugWhere("project-alpha");
        const compiled = dialect.sqlToQuery(where!);
        expect(compiled.sql).toContain('"case_study"."status" = $1');
        expect(compiled.sql).toContain('"case_study"."slug" = $2');
        expect(compiled.params).toEqual(["published", "project-alpha"]);
    });

    it("compiles buildPublishedPageWhere", () => {
        const where = buildPublishedPageWhere("home");
        const compiled = dialect.sqlToQuery(where!);
        expect(compiled.sql).toContain('"pages"."status" = $1');
        expect(compiled.sql).toContain('"pages"."slug" = $2');
        expect(compiled.params).toEqual(["published", "home"]);
    });
});

describe("Portfolio consent mapper and publish rules", () => {
    const rawRow = {
        id: "cs-1",
        title: "E-Commerce App",
        slug: "e-commerce-app",
        summary: "Modern commerce",
        description: "Modern commerce description",
        content: "Details",
        serviceId: "svc-1",
        clientName: "Acme Megacorp",
        clientDisplayName: "Global Retailer",
        clientConsent: false,
        coverImage: "/uploads/content/cover.jpg",
        galleryImages: [],
        technologies: ["React", "Stripe"],
        liveUrl: "https://example.com",
        sortOrder: 1,
        publishedAt: new Date(),
    };

    it("hides real clientName when clientConsent is false and does not include clientName in output", () => {
        const mapped = mapPublicPortfolio(rawRow);
        expect(mapped.clientDisplayName).toBe("Global Retailer");
        expect(mapped.clientConsent).toBe(false);
        expect("clientName" in mapped).toBe(false);
    });

    it("defaults to 'Confidential client' when consent is false and display name is empty", () => {
        const mapped = mapPublicPortfolio({ ...rawRow, clientDisplayName: "" });
        expect(mapped.clientDisplayName).toBe("Confidential client");
        expect("clientName" in mapped).toBe(false);
    });

    it("reveals real clientName as clientDisplayName when clientConsent is true", () => {
        const mapped = mapPublicPortfolio({ ...rawRow, clientConsent: true });
        expect(mapped.clientDisplayName).toBe("Acme Megacorp");
        expect(mapped.clientConsent).toBe(true);
        expect("clientName" in mapped).toBe(false);
    });

    it("canPublishPortfolio enforces consent and display name requirements", () => {
        // Consent true, name present -> ok
        expect(canPublishPortfolio({ clientConsent: true, clientName: "Acme", clientDisplayName: "" })).toBe(true);
        // Consent true, name missing -> blocked
        expect(canPublishPortfolio({ clientConsent: true, clientName: "", clientDisplayName: "Acme" })).toBe(false);
        expect(canPublishPortfolio({ clientConsent: true, clientName: null, clientDisplayName: "Acme" })).toBe(false);

        // Consent false, display name present -> ok
        expect(canPublishPortfolio({ clientConsent: false, clientName: "", clientDisplayName: "Fintech Leader" })).toBe(true);
        // Consent false, display name missing -> blocked
        expect(canPublishPortfolio({ clientConsent: false, clientName: "Real Name", clientDisplayName: "" })).toBe(false);
        expect(canPublishPortfolio({ clientConsent: false, clientName: "Real Name", clientDisplayName: null })).toBe(false);
    });
});
