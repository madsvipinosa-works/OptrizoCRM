import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({
    notFound: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    redirect: vi.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
    useRouter: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

import ContentHomePage from "@/app/(admin)/dashboard/cms/page";
import ServicesListPage from "@/app/(admin)/dashboard/services/page";
import NewServicePage from "@/app/(admin)/dashboard/services/new/page";
import EditServicePage from "@/app/(admin)/dashboard/services/[id]/page";
import PortfolioListPage from "@/app/(admin)/dashboard/portfolio/page";
import NewPortfolioPage from "@/app/(admin)/dashboard/portfolio/new/page";
import EditPortfolioPage from "@/app/(admin)/dashboard/portfolio/[id]/page";
import PagesIndexPage from "@/app/(admin)/dashboard/pages/page";
import PageEditorPage from "@/app/(admin)/dashboard/pages/[slug]/page";
import AboutRedirectPage from "@/app/(admin)/dashboard/about/page";

const mockDb = db as unknown as MockDb;

const blockedRoles = ROLES.filter((role) => role !== "content_editor");
const params = { params: Promise.resolve({ id: "row-1" }) };
const pageParams = (slug: string) => ({ params: Promise.resolve({ slug }) });

type Loader = { name: string; run: () => Promise<unknown> };

const loaders: Loader[] = [
    { name: "C1 /dashboard/cms", run: () => ContentHomePage() },
    { name: "C2 /dashboard/services", run: () => ServicesListPage() },
    { name: "C3 /dashboard/services/new", run: () => NewServicePage() },
    { name: "C3 /dashboard/services/[id]", run: () => EditServicePage(params) },
    { name: "C5 /dashboard/portfolio", run: () => PortfolioListPage() },
    { name: "C6 /dashboard/portfolio/new", run: () => NewPortfolioPage() },
    { name: "C6 /dashboard/portfolio/[id]", run: () => EditPortfolioPage(params) },
    { name: "/dashboard/pages", run: () => PagesIndexPage() },
    { name: "C7 /dashboard/pages/home", run: () => PageEditorPage(pageParams("home")) },
    { name: "C8 /dashboard/pages/about", run: () => PageEditorPage(pageParams("about")) },
    { name: "C9 /dashboard/pages/contact", run: () => PageEditorPage(pageParams("contact")) },
    { name: "/dashboard/pages/[invalid slug]", run: () => PageEditorPage(pageParams("settings")) },
    { name: "/dashboard/about (redirect)", run: () => AboutRedirectPage() },
];

beforeEach(() => {
    mockDb.resetMocks();
    signInAs(auth, null);
});

describe("content editor pages: every loader checks the role on the server", () => {
    for (const loader of loaders) {
        describe(loader.name, () => {
            it.each(blockedRoles)("rejects %s with notFound and reads nothing", async (role: Role) => {
                signInAs(auth, role);
                await expect(loader.run()).rejects.toThrow("NEXT_NOT_FOUND");
                expect(mockDb.select).not.toHaveBeenCalled();
                expectNoWrites(mockDb);
            });

            it("rejects a signed-out visitor with notFound and reads nothing", async () => {
                signInAs(auth, null);
                await expect(loader.run()).rejects.toThrow("NEXT_NOT_FOUND");
                expect(mockDb.select).not.toHaveBeenCalled();
                expectNoWrites(mockDb);
            });
        });
    }

    it("lets content_editor through the list and new pages", async () => {
        signInAs(auth, "content_editor");
        const open = loaders.filter((l) => /^C[125] |new$/.test(l.name));
        expect(open).toHaveLength(5);
        for (const loader of open) {
            await expect(loader.run()).resolves.toBeTruthy();
        }
        expectNoWrites(mockDb);
    });

    it("sends content_editor from the pages index and the old about route to the page editor", async () => {
        signInAs(auth, "content_editor");
        await expect(PagesIndexPage()).rejects.toThrow("NEXT_REDIRECT");
        await expect(AboutRedirectPage()).rejects.toThrow("NEXT_REDIRECT");
        expectNoWrites(mockDb);
    });

    it("returns notFound for a slug that is not home, about or contact, before reading anything", async () => {
        signInAs(auth, "content_editor");
        for (const slug of ["settings", "Home", "", "home/../about", "admin"]) {
            await expect(PageEditorPage(pageParams(slug))).rejects.toThrow("NEXT_NOT_FOUND");
        }
        expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("returns notFound when the page row is missing, after the role check passed", async () => {
        signInAs(auth, "content_editor");
        mockDb.setSelectRows([]);
        await expect(PageEditorPage(pageParams("home"))).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mockDb.select).toHaveBeenCalled();
    });

    it("renders the page editor for content_editor when the page exists", async () => {
        signInAs(auth, "content_editor");
        mockDb.setSelectRows([
            {
                // page row
                slug: "home",
                fields: { heading: "Hello" },
                draftFields: null,
                status: "published",
                version: 1,
                publishedAt: null,
                publishedBy: null,
                draftUpdatedAt: null,
                draftUpdatedBy: null,
                // service, portfolio and version rows share this stub
                id: "row-1",
                title: "Row",
                versionNo: 1,
                action: "publish",
                restoredFrom: null,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                authorName: "Editor",
            },
        ]);
        await expect(PageEditorPage(pageParams("home"))).resolves.toBeTruthy();
        expectNoWrites(mockDb);
    });

    it("lets content_editor reach the edit pages, which then 404 on a missing id", async () => {
        signInAs(auth, "content_editor");
        mockDb.setSelectRows([]);
        await expect(EditServicePage(params)).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mockDb.select).toHaveBeenCalled();
        mockDb.select.mockClear();
        await expect(EditPortfolioPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mockDb.select).toHaveBeenCalled();
    });
});

describe("legacy service and case study actions are gone", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/cms/actions.ts"), "utf8");
    const legacy = [
        "createService",
        "updateService",
        "deleteService",
        "toggleServiceFeatured",
        "createCaseStudy",
        "updateCaseStudy",
        "deleteCaseStudy",
        "createProject",
        "updateProject",
        "deleteProject",
    ];

    it.each(legacy)("%s is no longer exported from @/features/cms/actions", (name) => {
        expect(source).not.toMatch(new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${name}\\b`));
    });

    it("keeps the actions other screens still use", () => {
        for (const name of ["getSiteSettings", "updateSiteSettings"]) {
            expect(source).toMatch(new RegExp(`export\\s+async\\s+function\\s+${name}\\b`));
        }
    });

    it("updateHeroSettings is no longer exported", () => {
        expect(source).not.toMatch(/export\s+async\s+function\s+updateHeroSettings\b/);
    });

    it.each([
        "src/features/cms/components/HeroTab.tsx",
        "src/features/cms/components/AboutTab.tsx",
        "src/features/cms/about/components/AboutSettingsForm.tsx",
        "src/features/cms/about/components/ValuesManager.tsx",
        "src/features/cms/team/components/UserAboutToggle.tsx",
        "src/features/cms/about-actions.ts",
    ])("the legacy Hero/About piece %s is deleted", (file) => {
        expect(existsSync(resolve(process.cwd(), file))).toBe(false);
    });

    it("keeps BentoIcon, which the public About page still renders", () => {
        expect(existsSync(resolve(process.cwd(), "src/features/cms/about/components/BentoIcon.tsx"))).toBe(true);
    });

    it.each([
        "ServiceForm",
        "ProjectForm",
        "ServicesTab",
        "PortfolioTab",
        "DeleteServiceButton",
        "DeleteProjectButton",
    ])("the old %s component is deleted", (file) => {
        expect(existsSync(resolve(process.cwd(), `src/features/cms/components/${file}.tsx`))).toBe(false);
    });
});
