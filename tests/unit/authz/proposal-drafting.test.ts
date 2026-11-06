import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
    notifyLeadPms: vi.fn(),
    notifyLeadSales: vi.fn(),
    notifyLeadClient: vi.fn(),
    notifyAllSales: vi.fn(),
    createSystemNotification: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { proposalMilestones, proposals } from "@/db/schema";
import { SaveProposalSchema } from "@/lib/schemas";
import {
    createDraftProposalForLead,
    resetProposalNeedsGoals,
    savePaymentSchedule,
    sendProposal,
    updateProposal,
    updateProposalMilestones,
} from "@/features/proposals/actions";
import { ROLES, signInAs } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;

const NON_DRAFT = ["sent", "pricing_meeting_requested", "changes_requested", "signed", "replaced", "declined"] as const;
const nonManagers = ROLES.filter((role) => role !== "manager");

function draftRow(overrides: Record<string, unknown> = {}) {
    return { id: "p-1", leadId: "lead-1", status: "draft", proposalCode: "OPT-2026-0001", lead: { assignedPmId: null }, ...overrides };
}

function setProposal(row: unknown) {
    mockDb.query.proposals.findFirst.mockResolvedValue(row);
}

/** Captures `db.update(...).set(values)` and resolves `.where().returning()` to one proposal row. */
function captureUpdates() {
    const sets: Record<string, unknown>[] = [];
    mockDb.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
            sets.push(values);
            return {
                where: () => Object.assign(Promise.resolve([]), {
                    returning: () => Promise.resolve([{ id: "p-1", leadId: "lead-1", status: "draft" }]),
                }),
            };
        },
    }));
    return sets;
}

const validSchedule = [
    { label: "On signing", percent: 30, trigger: "on_signing" },
    { label: "After design approval", percent: 30, trigger: "design" },
    { label: "On handover", percent: 40, trigger: "handover" },
];

beforeEach(() => {
    mockDb.resetMocks();
    signInAs(auth, "manager", "manager-1");
});

afterEach(() => {
    vi.useRealTimers();
});

describe("SaveProposalSchema", () => {
    it("allows a draft with no line items (empty array)", () => {
        expect(SaveProposalSchema.safeParse({ pricingStructure: [] }).success).toBe(true);
        expect(SaveProposalSchema.safeParse({}).success).toBe(true);
    });

    it("validates exclusions and projectName length", () => {
        expect(SaveProposalSchema.safeParse({ exclusions: "Hosting costs", projectName: "Delivery Tracking App" }).success).toBe(true);
        expect(SaveProposalSchema.safeParse({ exclusions: "x".repeat(2001) }).success).toBe(false);
        expect(SaveProposalSchema.safeParse({ projectName: "x".repeat(121) }).success).toBe(false);
        expect(SaveProposalSchema.safeParse({ projectName: "x".repeat(120) }).success).toBe(true);
    });
});

describe("updateProposal", () => {
    it("saves a draft that has no line items", async () => {
        setProposal(draftRow());
        const sets = captureUpdates();

        const res = await updateProposal("p-1", {
            scope: "Overview",
            pricingStructure: [],
            exclusions: "Hosting costs",
            projectName: "Delivery Tracking App",
        });

        expect(res).toMatchObject({ success: true });
        expect(sets[0]).toMatchObject({ exclusions: "Hosting costs", projectName: "Delivery Tracking App" });
        expect(sets[0]).not.toHaveProperty("status");
    });

    it("rejects an exclusions value that is too long", async () => {
        setProposal(draftRow());
        const res = await updateProposal("p-1", { exclusions: "x".repeat(2001) });
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });
});

describe("draft-only guard on updateProposal, updateProposalMilestones, savePaymentSchedule and resetProposalNeedsGoals", () => {
    const calls: Record<string, () => Promise<{ success: boolean; message?: string }>> = {
        updateProposal: () => updateProposal("p-1", { scope: "x" }),
        updateProposalMilestones: () =>
            updateProposalMilestones("p-1", [{ name: "requirements", startDate: "2026-11-06", endDate: "2026-11-12" }]),
        savePaymentSchedule: () => savePaymentSchedule("p-1", validSchedule),
        resetProposalNeedsGoals: () => resetProposalNeedsGoals("p-1"),
    };

    for (const [name, run] of Object.entries(calls)) {
        describe(name, () => {
            it.each(NON_DRAFT)("rejects a %s proposal and writes nothing", async (status) => {
                setProposal(draftRow({ status }));
                const res = await run();
                expect(res.success).toBe(false);
                expect(res.message).toMatch(/can no longer be edited/);
                expectNoWrites(mockDb);
            });

            it.each(nonManagers)("rejects %s before reading or writing anything", async (role) => {
                signInAs(auth, role);
                const res = await run();
                expect(res.success).toBe(false);
                expect(res.message).toMatch(/Unauthorized/);
                expect(mockDb.query.proposals.findFirst).not.toHaveBeenCalled();
                expectNoWrites(mockDb);
            });

            it("rejects a signed-out caller", async () => {
                signInAs(auth, null);
                const res = await run();
                expect(res.success).toBe(false);
                expectNoWrites(mockDb);
            });

            it("rejects a manager who is not the PM assigned to the lead", async () => {
                setProposal(draftRow({ lead: { assignedPmId: "manager-2" } }));
                const res = await run();
                expect(res.success).toBe(false);
                expect(res.message).toMatch(/assigned to this lead/);
                expectNoWrites(mockDb);
            });

            it("reports a missing proposal", async () => {
                setProposal(undefined);
                const res = await run();
                expect(res).toMatchObject({ success: false, message: "Proposal not found" });
                expectNoWrites(mockDb);
            });
        });
    }

    it("lets the assigned PM and any manager on an unassigned lead edit a draft", async () => {
        captureUpdates();
        setProposal(draftRow({ lead: { assignedPmId: "manager-1" } }));
        expect(await updateProposal("p-1", { scope: "x" })).toMatchObject({ success: true });

        setProposal(draftRow({ lead: { assignedPmId: null } }));
        expect(await updateProposal("p-1", { scope: "y" })).toMatchObject({ success: true });
    });
});

describe("milestone dates and the payment schedule are separate", () => {
    it("updateProposalMilestones writes milestone rows and never touches the payment schedule", async () => {
        setProposal(draftRow());
        const res = await updateProposalMilestones("p-1", [
            { name: "requirements", startDate: "2026-11-06", endDate: "2026-11-12" },
        ]);

        expect(res).toMatchObject({ success: true });
        expect(mockDb.insert).toHaveBeenCalledTimes(1);
        expect(mockDb.delete).not.toHaveBeenCalled(); // savePaymentSchedule deletes and re-inserts items
        expect(mockDb.query.paymentScheduleItems.findMany).not.toHaveBeenCalled();
    });

    it("ignores a milestone that is not one of the 5 defaults", async () => {
        setProposal(draftRow());
        await updateProposalMilestones("p-1", [{ name: "extra_phase", startDate: "2026-11-06", endDate: "2026-11-12" }]);
        expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("the milestone dialog saves dates only and does not call savePaymentSchedule", () => {
        const source = readFileSync(resolve(process.cwd(), "src/features/proposals/components/draft-dialogs.tsx"), "utf8");
        const start = source.indexOf("export function MilestonesDialog");
        const end = source.indexOf("export function ScopeTimelineDialog", start);
        expect(start).toBeGreaterThan(-1);
        const body = source.slice(start, end);
        expect(body).toContain("updateProposalMilestones(");
        expect(body).not.toContain("savePaymentSchedule(");
    });
});

describe("sendProposal surfaces its errors", () => {
    it("returns the milestone date error when the 5 milestones have no dates", async () => {
        mockDb.setSelectRows([{ id: "p-1", leadId: "lead-1", status: "draft", proposalCode: "OPT-1", version: 1, priceMode: "to_be_discussed" }]);
        const res = await sendProposal("p-1");
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/all 5 default milestones must have valid start and end dates/);
    });

    it("returns an error for a proposal that is not a draft", async () => {
        mockDb.setSelectRows([{ id: "p-1", leadId: "lead-1", status: "sent" }]);
        const res = await sendProposal("p-1");
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/Only draft proposals can be sent/);
    });

    it.each(nonManagers)("rejects %s", async (role) => {
        signInAs(auth, role);
        const res = await sendProposal("p-1");
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/Unauthorized/);
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("the editor saves the draft, then calls sendProposal and shows its message", () => {
        const source = readFileSync(resolve(process.cwd(), "src/features/proposals/components/ProposalDraftEditor.tsx"), "utf8");
        const start = source.indexOf("async function handleSend");
        const end = source.indexOf("async function handleCreateVersion", start);
        const body = source.slice(start, end);

        const saveAt = body.indexOf("await saveDraft()");
        const sendAt = body.indexOf("await sendProposal(");
        expect(saveAt).toBeGreaterThan(-1);
        expect(sendAt).toBeGreaterThan(saveAt);
        // The real error from sendProposal is shown, and the page only refreshes after success.
        expect(body).toContain("res.message");
        expect(body.indexOf("router.refresh()")).toBeGreaterThan(sendAt);
    });
});

describe("createDraftProposalForLead seeding", () => {
    it("seeds contiguous milestone dates from today (Manila) and a project name", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-06T04:00:00Z")); // Nov 6, 12:00 in Manila

        mockDb.query.leads.findFirst.mockResolvedValue({
            id: "lead-1",
            status: "Discovery & Qualifying",
            proposalRequestedAt: new Date("2026-11-05T00:00:00Z"),
            clientType: "local",
            businessName: "Santos Logistics",
            serviceId: "svc-1",
            otherServiceText: null,
        });
        mockDb.query.proposals.findMany.mockResolvedValue([]);
        mockDb.query.discoveryForms.findFirst.mockResolvedValue({ requiredFeatures: "Driver app", goals: "Track deliveries" });
        mockDb.query.services.findFirst.mockResolvedValue({ id: "svc-1", title: "Mobile App" });

        const inserts: { table: unknown; values: unknown }[] = [];
        mockDb.insert.mockImplementation((table: unknown) => ({
            values: (values: unknown) => {
                inserts.push({ table, values });
                return Object.assign(Promise.resolve([{ id: "p-1" }]), {
                    returning: () => Promise.resolve([{ id: "p-1" }]),
                });
            },
        }));

        const res = await createDraftProposalForLead("lead-1");
        expect(res).toMatchObject({ success: true, proposalId: "p-1" });

        const proposalInsert = inserts.find((i) => i.table === proposals);
        expect(proposalInsert?.values).toMatchObject({ projectName: "Mobile App for Santos Logistics" });

        const milestoneInsert = inserts.find((i) => i.table === proposalMilestones);
        const rows = milestoneInsert?.values as { name: string; startDate: Date; endDate: Date }[];
        const day = (d: Date) => d.toISOString().slice(0, 10);
        expect(rows.map((r) => [r.name, day(r.startDate), day(r.endDate)])).toEqual([
            ["requirements", "2026-11-06", "2026-11-12"], // 7 days
            ["design", "2026-11-13", "2026-11-26"], // 14 days
            ["development", "2026-11-27", "2027-01-07"], // 42 days
            ["uat_testing", "2027-01-08", "2027-01-21"], // 14 days
            ["handover", "2027-01-22", "2027-01-28"], // 7 days
        ]);
    });

    it("falls back to the visitor's Other text, then a generic label, for the project name", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue({
            id: "lead-1",
            status: "Discovery & Qualifying",
            proposalRequestedAt: new Date(),
            clientType: "local",
            businessName: null,
            serviceId: null,
            otherServiceText: "Drone mapping",
        });
        mockDb.query.proposals.findMany.mockResolvedValue([]);

        const inserts: { table: unknown; values: unknown }[] = [];
        mockDb.insert.mockImplementation((table: unknown) => ({
            values: (values: unknown) => {
                inserts.push({ table, values });
                return Object.assign(Promise.resolve([{ id: "p-1" }]), {
                    returning: () => Promise.resolve([{ id: "p-1" }]),
                });
            },
        }));

        await createDraftProposalForLead("lead-1");
        expect(inserts.find((i) => i.table === proposals)?.values).toMatchObject({ projectName: "Drone mapping" });
    });

    it.each(nonManagers)("rejects %s", async (role) => {
        signInAs(auth, role);
        const res = await createDraftProposalForLead("lead-1");
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });
});
