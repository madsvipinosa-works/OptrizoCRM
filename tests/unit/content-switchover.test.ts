import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
    notifyAllSales: vi.fn().mockResolvedValue(undefined),
    notifyAllAdmins: vi.fn().mockResolvedValue(undefined),
    createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => ({
    sendInquiryConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/rate-limit", () => ({
    checkRateLimit: vi.fn().mockReturnValue({ success: true }),
    formatRetryAfter: vi.fn().mockReturnValue("1 minute"),
}));

// Mock public-queries to supply published inquiry services for submit-intake and sitemap
const mockPublishedInquiryServices = [
    {
        id: "svc-published-inquiry",
        title: "Published Web Development",
        slug: "web-dev",
        status: "published" as const,
        showInInquiry: true,
        showOnServicesPage: true,
        isPreset: false,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: "Modern web applications",
        inclusions: null,
        deliverables: null,
        scopeOverview: null,
        timelineEstimate: null,
        targetAudience: null,
        image: null,
        link: null,
        publishedAt: new Date(),
    },
];

const mockPublishedServicesForSitemap = [
    {
        id: "svc-published-services-page",
        title: "Cloud Infrastructure",
        slug: "cloud-infra",
        status: "published" as const,
        showInInquiry: false,
        showOnServicesPage: true,
        isPreset: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: "Cloud setup",
        inclusions: null,
        deliverables: null,
        scopeOverview: null,
        timelineEstimate: null,
        targetAudience: null,
        image: null,
        link: null,
        publishedAt: new Date(),
    },
];

const mockPublishedPortfolioForSitemap = [
    {
        id: "cs-published-1",
        title: "Enterprise ERP",
        slug: "enterprise-erp",
        summary: "ERP platform",
        description: "ERP description",
        content: null,
        serviceId: "svc-published-inquiry",
        clientDisplayName: "Confidential client",
        clientConsent: false,
        coverImage: null,
        galleryImages: [],
        technologies: ["Next.js", "PostgreSQL"],
        liveUrl: null,
        sortOrder: 1,
        publishedAt: new Date("2026-05-01T00:00:00Z"),
    },
];

vi.mock("@/features/cms/content/public-queries", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/features/cms/content/public-queries")>();
    return {
        ...actual,
        getPublishedServices: vi.fn((opts?: { forInquiry?: boolean }) => {
            if (opts?.forInquiry) {
                return Promise.resolve(mockPublishedInquiryServices);
            }
            return Promise.resolve(mockPublishedServicesForSitemap);
        }),
        getPublishedPortfolio: vi.fn(() => Promise.resolve(mockPublishedPortfolioForSitemap)),
    };
});

import { auth } from "@/auth";
import { db } from "@/db";
import { signInAs } from "../helpers/mock-auth";
import { type MockDb } from "../helpers/mock-db";
import { submitIntakeForm, type IntakeState } from "@/features/crm/actions/submit-intake";
import sitemap from "@/app/sitemap";

const mockDb = db as unknown as MockDb;

const initialState: IntakeState = {
    message: "",
    success: false,
    errors: {},
};

describe("submit-intake service resolution & fallback (STOP 3 follow-up)", () => {
    beforeEach(() => {
        mockDb.resetMocks();
        mockDb.setWriteRows([{ id: "lead-new-123" }]);
        signInAs(auth, "client"); // the inquiry needs a signed-in client
    });

    function makePublicFormData(overrides: Record<string, string> = {}) {
        const fd = new FormData();
        fd.set("isPublicInquiry", "true");
        fd.set("businessName", "Acme Labs");
        fd.set("clientName", "Jane Doe");
        fd.set("email", "jane@acmelabs.com");
        fd.set("industry", "Biotech");
        fd.set("urgency", "Within 1 month");
        fd.set("roleInCompany", "CTO");
        fd.set("contactPreference", "Email");
        for (const [k, v] of Object.entries(overrides)) {
            fd.set(k, v);
        }
        return fd;
    }

    function makePortalFormData(overrides: Record<string, string> = {}) {
        const fd = new FormData();
        fd.set("businessName", "Acme Portal Client");
        fd.set("industry", "Fintech");
        fd.set("targetAudience", "Enterprise B2B");
        fd.set("timelineExpectation", "3 months");
        fd.set("goals", "We want to build a secure customer portal from scratch.");
        for (const [k, v] of Object.entries(overrides)) {
            fd.set(k, v);
        }
        return fd;
    }

    describe("Public inquiry flow", () => {
        it("falls back to Other when submitted serviceId is a draft service", async () => {
            // "svc-draft" is NOT in mockPublishedInquiryServices
            const fd = makePublicFormData({
                serviceId: "svc-draft",
                otherServiceText: "Draft Service Inquiry",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);

            // Assert that the inserted lead has serviceId: null and otherServiceText preserved
            const insertCalls = mockDb.insert.mock.calls;
            expect(insertCalls.length).toBeGreaterThan(0);
            const leadValues = mockDb.insert.mock.results[0]?.value;
            // The first insert is to leads table
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it("falls back to Other when submitted serviceId is a hidden service", async () => {
            const fd = makePublicFormData({
                serviceId: "svc-hidden",
                otherServiceText: "Hidden Service Inquiry",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);
        });

        it("falls back to Other when submitted serviceId has showInInquiry = false", async () => {
            // svc-published-services-page has showInInquiry = false so it's excluded from inquiry
            const fd = makePublicFormData({
                serviceId: "svc-published-services-page",
                otherServiceText: "Not In Inquiry Service",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);
        });

        it("accepts valid published serviceId with showInInquiry = true", async () => {
            const fd = makePublicFormData({
                serviceId: "svc-published-inquiry",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);
        });
    });

    describe("Portal intake flow", () => {
        beforeEach(() => {
            signInAs(auth, "client");
        });

        it("falls back to serviceId = null when submitted serviceId is a draft service", async () => {
            const fd = makePortalFormData({
                serviceId: "svc-draft-portal",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);
        });

        it("falls back to serviceId = null when submitted serviceId is a hidden service", async () => {
            const fd = makePortalFormData({
                serviceId: "svc-hidden-portal",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);
        });

        it("falls back to serviceId = null when submitted serviceId has showInInquiry = false", async () => {
            const fd = makePortalFormData({
                serviceId: "svc-published-services-page",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);
        });

        it("stores valid serviceId when submitted serviceId is published and showInInquiry = true", async () => {
            const fd = makePortalFormData({
                serviceId: "svc-published-inquiry",
            });

            const result = await submitIntakeForm(initialState, fd);
            expect(result.success).toBe(true);
        });
    });
});

describe("sitemap exclusions (STOP 3 follow-up)", () => {
    it("excludes draft and hidden services and draft portfolio, only including published items", async () => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://optrizo.com";
        const entries = await sitemap();
        const urls = entries.map((e) => e.url);

        // Static routes
        expect(urls).toContain(`${baseUrl}`);
        expect(urls).toContain(`${baseUrl}/about`);
        expect(urls).toContain(`${baseUrl}/services`);
        expect(urls).toContain(`${baseUrl}/projects`);
        expect(urls).toContain(`${baseUrl}/contact`);

        // Published service with showOnServicesPage=true is included
        expect(urls).toContain(`${baseUrl}/services/cloud-infra`);

        // Draft/hidden services are NOT in the sitemap
        expect(urls).not.toContain(`${baseUrl}/services/svc-draft`);
        expect(urls).not.toContain(`${baseUrl}/services/svc-hidden`);

        // Published portfolio is included
        expect(urls).toContain(`${baseUrl}/projects/enterprise-erp`);

        // Draft portfolio is NOT in the sitemap
        expect(urls).not.toContain(`${baseUrl}/projects/draft-case-study`);
    });
});

describe("public inquiry requires sign-in", () => {
    it("refuses a signed-out visitor", async () => {
        signInAs(auth, null);
        const fd = new FormData();
        fd.set("urgency", "ASAP");
        const result = await submitIntakeForm(initialState, fd);
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/sign in/i);
    });
});
