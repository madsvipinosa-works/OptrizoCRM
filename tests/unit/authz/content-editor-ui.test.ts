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

const mockDb = db as unknown as MockDb;

const blockedRoles = ROLES.filter((role) => role !== "content_editor");
const params = { params: Promise.resolve({ id: "row-1" }) };

type Loader = { name: string; run: () => Promise<unknown> };

const loaders: Loader[] = [
    { name: "C1 /dashboard/cms", run: () => ContentHomePage() },
    { name: "C2 /dashboard/services", run: () => ServicesListPage() },
    { name: "C3 /dashboard/services/new", run: () => NewServicePage() },
    { name: "C3 /dashboard/services/[id]", run: () => EditServicePage(params) },
    { name: "C5 /dashboard/portfolio", run: () => PortfolioListPage() },
    { name: "C6 /dashboard/portfolio/new", run: () => NewPortfolioPage() },
    { name: "C6 /dashboard/portfolio/[id]", run: () => EditPortfolioPage(params) },
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
        for (const loader of loaders.filter((l) => l.name !== "C3 /dashboard/services/[id]" && l.name !== "C6 /dashboard/portfolio/[id]")) {
            await expect(loader.run()).resolves.toBeTruthy();
        }
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
        for (const name of ["getSiteSettings", "updateSiteSettings", "updateHeroSettings"]) {
            expect(source).toMatch(new RegExp(`export\\s+async\\s+function\\s+${name}\\b`));
        }
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
