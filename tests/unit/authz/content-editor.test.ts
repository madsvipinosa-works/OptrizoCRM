import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/db";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

import * as servicesActions from "@/features/cms/content/services.actions";
import * as portfolioActions from "@/features/cms/content/portfolio.actions";
import * as pagesActions from "@/features/cms/content/pages.actions";
import { uploadContentImage } from "@/features/cms/content/image-upload";

const mockDb = db as unknown as MockDb;

const ALLOWED: Role[] = ["content_editor"];
const blockedRoles = ROLES.filter((role) => !ALLOWED.includes(role));

beforeEach(() => {
    mockDb.resetMocks();
    signInAs(auth, null);
});

const serviceCalls: Record<string, () => Promise<unknown>> = {
    createService: () => servicesActions.createService({ title: "Custom Web App", description: "Bespoke web applications." }),
    updateService: () => servicesActions.updateService("svc-1", { title: "Custom Web App", description: "Updated description." }),
    publishService: () => servicesActions.publishService("svc-1"),
    hideService: () => servicesActions.hideService("svc-1"),
    unhideService: () => servicesActions.unhideService("svc-1"),
};

const portfolioCalls: Record<string, () => Promise<unknown>> = {
    createPortfolio: () =>
        portfolioActions.createPortfolio({
            title: "Fintech Dashboard",
            summary: "Next-gen banking dashboard",
            serviceId: "svc-1",
        }),
    updatePortfolio: () =>
        portfolioActions.updatePortfolio("port-1", {
            title: "Fintech Dashboard",
            summary: "Updated summary",
            serviceId: "svc-1",
        }),
    publishPortfolio: () => portfolioActions.publishPortfolio("port-1"),
    hidePortfolio: () => portfolioActions.hidePortfolio("port-1"),
    unhidePortfolio: () => portfolioActions.unhidePortfolio("port-1"),
};

const pageCalls: Record<string, () => Promise<unknown>> = {
    getPageForEdit: () => pagesActions.getPageForEdit("home"),
    saveDraft: () =>
        pagesActions.saveDraft(
            "home",
            {
                heading: "Bespoke Engineering",
                intro: "Scalable enterprise web applications",
                mainImageUrl: "",
                featuredServiceIds: [],
                featuredPortfolioIds: [],
            },
            1,
        ),
    publishPage: () => pagesActions.publishPage("home", 1),
    restoreVersion: () => pagesActions.restoreVersion("home", 1, 1),
    listVersions: () => pagesActions.listVersions("home"),
};

const uploadCalls: Record<string, () => Promise<unknown>> = {
    uploadContentImage: () => {
        const formData = new FormData();
        const fakeFile = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "hero.jpg", { type: "image/jpeg" });
        formData.append("file", fakeFile);
        return uploadContentImage(formData);
    },
};

const allContentCalls = {
    ...serviceCalls,
    ...portfolioCalls,
    ...pageCalls,
    ...uploadCalls,
};

describe("Content Editor authorization: strict role restriction", () => {
    describe.each(Object.entries(allContentCalls))("%s access boundary", (_name, call) => {
        it("rejects an anonymous caller without writing to database", async () => {
            const res = await call();
            expect(res).toMatchObject({ error: "FORBIDDEN" });
            expectNoWrites(mockDb);
        });

        it.each(blockedRoles)("rejects %s without writing to database", async (role) => {
            signInAs(auth, role);
            const res = await call();
            expect(res).toMatchObject({ error: "FORBIDDEN" });
            expectNoWrites(mockDb);
        });
    });

    it("verifies NO delete action exists for services", () => {
        expect((servicesActions as Record<string, unknown>).deleteService).toBeUndefined();
    });

    it("allows content_editor role to invoke actions", async () => {
        signInAs(auth, "content_editor", "editor-1");
        mockDb.setWriteRows([{ id: "svc-1", slug: "custom-web-app" }]);
        // Service select for taken slugs check inside createService
        mockDb.setSelectRows([]);

        const res = await servicesActions.createService({
            title: "Custom Web App",
            description: "Bespoke web applications.",
        });

        expect(res).toMatchObject({ ok: true });
        expect(mockDb.insert).toHaveBeenCalled();
    });
});
