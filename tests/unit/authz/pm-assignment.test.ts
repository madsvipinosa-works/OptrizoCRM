import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
    notifyLeadPms: vi.fn(),
    notifyLeadSales: vi.fn(),
    createSystemNotification: vi.fn(),
}));
vi.mock("@/features/proposals/pm-assignment", async () => ({
    ...(await vi.importActual<object>("@/features/proposals/pm-assignment")),
    listPmWorkloads: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import { createSystemNotification, notifyLeadSales } from "@/features/notifications/send";
import { listPmWorkloads, rankPms, resolvePmChoice } from "@/features/proposals/pm-assignment";
import { passProposalRequest } from "@/features/proposals/actions";
import { requestProposal } from "@/features/crm/actions/discovery-form";
import { ROLES, signInAs } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const workloads = listPmWorkloads as unknown as ReturnType<typeof vi.fn>;

const A = { id: "pm-a", name: "Ana" };
const B = { id: "pm-b", name: "Ben" };
/** Ben is recommended (least loaded), Ana second. */
const BOTH = [{ ...B, load: 0 }, { ...A, load: 3 }];
const day = (n: number) => new Date(2026, 10, n);

/** Captures `db.update(...).set(values)`; `.where().returning()` resolves to `rows`. */
function captureUpdates(rows: unknown[] = [{ id: "lead-1" }]) {
    const sets: Record<string, unknown>[] = [];
    mockDb.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
            sets.push(values);
            return { where: () => Object.assign(Promise.resolve([]), { returning: () => Promise.resolve(rows) }) };
        },
    }));
    return sets;
}

/** A lead that has passed the step 8 locks (meeting done, form submitted). */
function readyLead(overrides: Record<string, unknown> = {}) {
    mockDb.query.leads.findFirst.mockResolvedValue({ id: "lead-1", businessName: "Acme", assignedPmId: null, proposalRequestedAt: null, ...overrides });
    mockDb.query.meetings.findFirst.mockResolvedValue({ id: "m-1" });
    mockDb.query.discoveryForms.findFirst.mockResolvedValue({ id: "f-1" });
    mockDb.query.users.findFirst.mockResolvedValue(null);
}

beforeEach(() => {
    mockDb.resetMocks();
    vi.clearAllMocks();
});

describe("rankPms", () => {
    it("orders PMs by open work (leads + projects), least loaded first", () => {
        const leads = [{ assignedPmId: "pm-a", proposalRequestedAt: day(1) }, { assignedPmId: "pm-a", proposalRequestedAt: day(2) }];
        expect(rankPms([A, B], leads, [{ assignedPmId: "pm-b" }])).toEqual([{ ...B, load: 1 }, { ...A, load: 2 }]);
    });

    it("breaks a tie by the oldest latest assignment, never-assigned first", () => {
        const leads = [{ assignedPmId: "pm-a", proposalRequestedAt: day(5) }, { assignedPmId: "pm-b", proposalRequestedAt: day(3) }];
        expect(rankPms([A, B], leads, [])[0].id).toBe("pm-b");
        expect(rankPms([A, B], [{ assignedPmId: "pm-a", proposalRequestedAt: day(1) }], [])[0].id).toBe("pm-b");
    });

    it("skips the excluded PM", () => {
        expect(rankPms([A, B], [], [], "pm-a").map((p) => p.id)).toEqual(["pm-b"]);
        expect(rankPms([A], [], [], "pm-a")).toEqual([]);
    });
});

describe("resolvePmChoice", () => {
    it("takes the recommended PM when nobody is named", () => {
        expect(resolvePmChoice(BOTH)).toMatchObject({ ok: true, pm: { id: "pm-b" }, note: expect.stringContaining("auto-assigned") });
    });

    it("records an override of the recommendation", () => {
        const res = resolvePmChoice(BOTH, "pm-a");
        expect(res.ok && res.note).toBe("assigned to Ana (open work: 3) instead of the recommended Ben (open work: 0)");
    });

    it("rejects an unknown PM and an empty pool", () => {
        expect(resolvePmChoice(BOTH, "pm-x").ok).toBe(false);
        expect(resolvePmChoice([]).ok).toBe(false);
    });
});

describe("requestProposal, automatic", () => {
    beforeEach(() => signInAs(auth, "sales", "sales-1"));

    it("assigns the least-loaded PM and notifies only them", async () => {
        readyLead();
        workloads.mockResolvedValue(BOTH);
        const sets = captureUpdates();

        const res = await requestProposal("lead-1");

        expect(res).toMatchObject({ success: true, assignedPmName: "Ben" });
        expect(sets[0]).toMatchObject({ assignedPmId: "pm-b" });
        expect(createSystemNotification).toHaveBeenCalledTimes(1);
        expect(createSystemNotification).toHaveBeenCalledWith("pm-b", expect.any(String), "proposal", "/dashboard/proposals");
    });

    it("leaves the lead unassigned and notifies every PM when no PM is available", async () => {
        readyLead();
        workloads.mockResolvedValue([]);
        mockDb.query.users.findMany.mockResolvedValue([{ id: "pm-a" }, { id: "pm-b" }]);
        const sets = captureUpdates();

        const res = await requestProposal("lead-1");

        expect(res).toMatchObject({ success: true, assignedPmName: null });
        expect(sets[0]).not.toHaveProperty("assignedPmId");
        expect(createSystemNotification).toHaveBeenCalledTimes(2);
    });

    it("keeps an active assigned PM without ranking again", async () => {
        readyLead({ assignedPmId: "pm-a" });
        mockDb.query.users.findFirst.mockResolvedValue(A);
        const sets = captureUpdates();

        await requestProposal("lead-1");

        expect(workloads).not.toHaveBeenCalled();
        expect(sets[0]).not.toHaveProperty("assignedPmId");
        expect(createSystemNotification).toHaveBeenCalledWith("pm-a", expect.any(String), "proposal", "/dashboard/proposals");
    });
});

describe("requestProposal, PM named by Sales", () => {
    beforeEach(() => {
        signInAs(auth, "sales", "sales-1");
        readyLead();
        workloads.mockResolvedValue(BOTH);
    });

    it("assigns the named PM and audits the override and reason", async () => {
        const sets = captureUpdates();

        const res = await requestProposal("lead-1", { pmId: "pm-a", reason: " Repeat client " });

        expect(res).toMatchObject({ success: true, assignedPmName: "Ana" });
        expect(sets[0]).toMatchObject({ assignedPmId: "pm-a" });
        expect(createSystemNotification).toHaveBeenCalledTimes(1);
        expect(createSystemNotification).toHaveBeenCalledWith("pm-a", expect.any(String), "proposal", "/dashboard/proposals");
        expect(logAction).toHaveBeenCalledWith(
            "UPDATE",
            "Lead",
            expect.stringContaining("instead of the recommended Ben (open work: 0). Reason: Repeat client")
        );
    });

    it.each([undefined, "", "   "])("rejects a named PM without a reason (%j)", async (reason) => {
        const res = await requestProposal("lead-1", { pmId: "pm-a", reason });
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("rejects a PM who is not active", async () => {
        const res = await requestProposal("lead-1", { pmId: "pm-x", reason: "Knows the client" });
        expect(res).toMatchObject({ success: false, message: "That Project Manager is not available." });
        expectNoWrites(mockDb);
    });
});

describe("passProposalRequest", () => {
    const lead = (overrides: Record<string, unknown> = {}) => ({
        id: "lead-1", businessName: "Acme", assignedPmId: "pm-a", proposals: [{ status: "draft" }], ...overrides,
    });

    beforeEach(() => signInAs(auth, "manager", "pm-a"));

    it.each(ROLES.filter((r) => r !== "manager"))("rejects %s", async (role) => {
        signInAs(auth, role);
        const res = await passProposalRequest("lead-1", "busy");
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("rejects an empty reason", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        expect((await passProposalRequest("lead-1", "   ")).success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("rejects a PM who is not the assigned one", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead({ assignedPmId: "pm-b" }));
        expect((await passProposalRequest("lead-1", "busy")).success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("rejects once a version was sent", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead({ proposals: [{ status: "draft" }, { status: "sent" }] }));
        expect((await passProposalRequest("lead-1", "busy")).success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("rejects when no other PM is available", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        workloads.mockResolvedValue([]);
        const res = await passProposalRequest("lead-1", "busy");
        expect(res).toMatchObject({ success: false, message: "No other Project Manager is available." });
        expect(workloads).toHaveBeenCalledWith("pm-a");
        expectNoWrites(mockDb);
    });

    it("rejects a chosen PM who is not available", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        workloads.mockResolvedValue([{ ...B, load: 0 }]);
        expect((await passProposalRequest("lead-1", "busy", "pm-x")).success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("reassigns to the recommended PM, notifies them and Sales, and audits the reason", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        workloads.mockResolvedValue([{ ...B, load: 1 }]);
        const sets = captureUpdates();

        const res = await passProposalRequest("lead-1", "  On leave next week  ");

        expect(res).toMatchObject({ success: true, assignedPmName: "Ben" });
        expect(sets[0]).toMatchObject({ assignedPmId: "pm-b" });
        expect(createSystemNotification).toHaveBeenCalledWith("pm-b", expect.stringContaining("passed you the proposal request"), "proposal", "/dashboard/proposals");
        expect(notifyLeadSales).toHaveBeenCalledWith("lead-1", expect.stringContaining("Reason: On leave next week"), "proposal", "/dashboard/leads");
        expect(logAction).toHaveBeenCalledWith("UPDATE", "Lead", expect.stringContaining("Reason: On leave next week"));
    });

    it("passes to the PM the passer chose", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        workloads.mockResolvedValue([{ ...B, load: 0 }, { id: "pm-c", name: "Cara", load: 4 }]);
        const sets = captureUpdates();

        const res = await passProposalRequest("lead-1", "Cara knows this industry", "pm-c");

        expect(res).toMatchObject({ success: true, assignedPmName: "Cara" });
        expect(sets[0]).toMatchObject({ assignedPmId: "pm-c" });
        expect(logAction).toHaveBeenCalledWith("UPDATE", "Lead", expect.stringContaining("instead of the recommended Ben"));
    });

    it("does nothing when the lead was already reassigned (double submit)", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        workloads.mockResolvedValue([{ ...B, load: 0 }]);
        captureUpdates([]);
        const res = await passProposalRequest("lead-1", "busy");
        expect(res.success).toBe(false);
        expect(createSystemNotification).not.toHaveBeenCalled();
    });
});

describe("who can see why a PM was chosen", () => {
    /** Captures `db.insert(...).values(row)`. */
    function captureInserts() {
        const rows: Record<string, unknown>[] = [];
        mockDb.insert.mockImplementation(() => ({
            values: (row: Record<string, unknown>) => {
                rows.push(row);
                return Promise.resolve();
            },
        }));
        return rows;
    }

    it("puts Sales' reason in the PM's notification and the lead's activity", async () => {
        signInAs(auth, "sales", "maria");
        readyLead();
        workloads.mockResolvedValue(BOTH);
        captureUpdates();
        const rows = captureInserts();

        await requestProposal("lead-1", { pmId: "pm-a", reason: "Repeat client" });

        expect(createSystemNotification).toHaveBeenCalledWith("pm-a", "maria assigned you the proposal for Acme. Reason: Repeat client", "proposal", "/dashboard/proposals");
        expect(rows).toContainEqual(expect.objectContaining({ activityType: "System", content: "Proposal requested · maria assigned it to Ana. Reason: Repeat client" }));
    });

    it("says when the system chose the PM", async () => {
        signInAs(auth, "sales", "maria");
        readyLead();
        workloads.mockResolvedValue(BOTH);
        captureUpdates();
        const rows = captureInserts();

        await requestProposal("lead-1");

        expect(createSystemNotification).toHaveBeenCalledWith("pm-b", expect.stringContaining("assigned automatically"), "proposal", "/dashboard/proposals");
        expect(rows).toContainEqual(expect.objectContaining({ content: "Proposal requested · assigned automatically to Ben (least open work)" }));
    });

    it("puts the passing PM's reason in the next PM's notification and the lead's activity", async () => {
        signInAs(auth, "manager", "pm-a");
        mockDb.query.leads.findFirst.mockResolvedValue({ id: "lead-1", businessName: "Acme", assignedPmId: "pm-a", proposals: [{ status: "draft" }] });
        workloads.mockResolvedValue([{ ...B, load: 0 }]);
        captureUpdates();
        const rows = captureInserts();

        await passProposalRequest("lead-1", "On leave next week");

        expect(createSystemNotification).toHaveBeenCalledWith("pm-b", "pm-a passed you the proposal request for Acme. Reason: On leave next week", "proposal", "/dashboard/proposals");
        expect(rows).toContainEqual(expect.objectContaining({ content: "pm-a passed the proposal request to Ben. Reason: On leave next week" }));
    });
});
