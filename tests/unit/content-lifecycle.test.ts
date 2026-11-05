import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/db";
import { signInAs } from "../helpers/mock-auth";
import { type MockDb } from "../helpers/mock-db";

import * as pagesActions from "@/features/cms/content/pages.actions";
import * as portfolioActions from "@/features/cms/content/portfolio.actions";
import * as servicesActions from "@/features/cms/content/services.actions";

const mockDb = db as unknown as MockDb;

function createChainProxy(rows: unknown) {
    const proxy: object = new Proxy(
        {},
        {
            get(_target, prop) {
                if (prop === "then") {
                    return (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
                }
                return () => proxy;
            },
        },
    );
    return proxy;
}

let activeSelectRows: unknown[] = [];

function setSelect(rows: unknown[]) {
    activeSelectRows = rows;
}

function setSelectSequence(sequence: unknown[][]) {
    let call = 0;
    mockDb.select.mockImplementation(() => {
        const rows = sequence[call] ?? [];
        call++;
        return createChainProxy(rows);
    });
}

beforeEach(() => {
    mockDb.resetMocks();
    signInAs(auth, "content_editor", "editor-1");
    activeSelectRows = [];
    mockDb.select.mockImplementation(() => createChainProxy(activeSelectRows));
});

describe("Content lifecycle, versioning, conflict detection, and audit", () => {
    describe("Page restoreVersion", () => {
        it("refuses with CONFLICT when baseVersion does not match current page version", async () => {
            setSelect([{ slug: "home", version: 3, draftFields: null, status: "published" }]);

            const res = await pagesActions.restoreVersion("home", 1, 2);
            expect(res).toEqual({ error: "CONFLICT" });
        });

        it("refuses with DRAFT_EXISTS when unsaved draft exists and discardDraft is not true", async () => {
            setSelect([
                {
                    slug: "home",
                    version: 2,
                    draftFields: { heading: "Unsaved Work" },
                    status: "published",
                },
            ]);

            const res = await pagesActions.restoreVersion("home", 1, 2, false);
            expect(res).toEqual({ error: "DRAFT_EXISTS" });
        });

        it("creates a new version and restores snapshot when discardDraft is true", async () => {
            setSelectSequence([
                [{ slug: "home", version: 2, draftFields: { heading: "Draft" }, status: "published" }],
                [{ id: "v1", pageSlug: "home", versionNo: 1, fields: { heading: "Restored V1" } }],
            ]);

            const res = await pagesActions.restoreVersion("home", 1, 2, true);
            expect(res).toMatchObject({ ok: true, version: 3, restoredFrom: 1 });
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.insert).toHaveBeenCalledTimes(2); // page_version + audit_log
        });
    });

    describe("Page publishPage", () => {
        it("refuses with CONFLICT on baseVersion mismatch", async () => {
            setSelect([{ slug: "home", version: 5, draftFields: null, status: "published" }]);

            const res = await pagesActions.publishPage("home", 4);
            expect(res).toEqual({ error: "CONFLICT" });
        });

        it("refuses with FEATURED_NOT_PUBLISHED when a home featured service is not published", async () => {
            setSelectSequence([
                [
                    {
                        slug: "home",
                        version: 1,
                        draftFields: {
                            heading: "Home",
                            intro: "Intro",
                            mainImageUrl: "",
                            featuredServiceIds: ["svc-1", "svc-2"],
                            featuredPortfolioIds: [],
                        },
                        status: "published",
                    },
                ],
                [{ id: "svc-1" }], // only 1 of 2 is published
            ]);

            const res = await pagesActions.publishPage("home", 1);
            expect(res).toEqual({ error: "FEATURED_NOT_PUBLISHED" });
        });

        it("copies draftFields to fields, increments version, and writes audit record", async () => {
            setSelectSequence([
                [
                    {
                        slug: "about",
                        version: 1,
                        draftFields: { heading: "New Story", story: "Our story" },
                        status: "published",
                    },
                ],
            ]);

            const res = await pagesActions.publishPage("about", 1);
            expect(res).toMatchObject({ ok: true, version: 2 });
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.insert).toHaveBeenCalledTimes(2); // page_version + audit_log
        });
    });

    describe("Portfolio publish rules and service linking", () => {
        it("blocks publish without consent or display name", async () => {
            setSelect([
                {
                    id: "port-1",
                    title: "Project",
                    status: "draft",
                    serviceId: "svc-1",
                    clientConsent: false,
                    clientDisplayName: "",
                },
            ]);

            const res = await portfolioActions.publishPortfolio("port-1");
            expect(res).toEqual({ error: "CONSENT_REQUIRED" });
        });

        it("blocks publish without linked serviceId", async () => {
            setSelect([
                {
                    id: "port-1",
                    title: "Project",
                    status: "draft",
                    serviceId: null,
                    clientConsent: false,
                    clientDisplayName: "Company X",
                },
            ]);

            const res = await portfolioActions.publishPortfolio("port-1");
            expect(res).toEqual({ error: "SERVICE_REQUIRED" });
        });

        it("blocks publish if linked serviceId does not exist in service table", async () => {
            setSelectSequence([
                [
                    {
                        id: "port-1",
                        title: "Project",
                        status: "draft",
                        serviceId: "svc-missing",
                        clientConsent: false,
                        clientDisplayName: "Company X",
                    },
                ],
                [], // service not found
            ]);

            const res = await portfolioActions.publishPortfolio("port-1");
            expect(res).toEqual({ error: "SERVICE_NOT_FOUND" });
        });

        it("publishes portfolio with consent and real client name, linked to service", async () => {
            setSelectSequence([
                [
                    {
                        id: "port-1",
                        title: "Project",
                        status: "draft",
                        serviceId: "svc-1",
                        clientConsent: true,
                        clientName: "Enterprise Client",
                        clientDisplayName: "",
                    },
                ],
                [{ id: "svc-1" }], // service found
                [], // slug collision check
            ]);

            const res = await portfolioActions.publishPortfolio("port-1");
            expect(res).toMatchObject({ ok: true, id: "port-1", status: "published" });
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.insert).toHaveBeenCalled(); // audit_log
        });
    });

    describe("Audit insertion on actions", () => {
        it("writes audit log row in same transaction on createService", async () => {
            setSelect([]); // for taken slugs
            mockDb.setWriteRows([{ id: "svc-1", slug: "custom-dev" }]);

            const res = await servicesActions.createService({
                title: "Custom Dev",
                description: "Engineering platforms",
            });

            expect(res).toMatchObject({ ok: true });
            expect(mockDb.insert).toHaveBeenCalledTimes(2); // service + audit_log
        });
    });
});
