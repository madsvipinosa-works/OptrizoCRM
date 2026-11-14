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
    pickLeastLoadedPm: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import { createSystemNotification } from "@/features/notifications/send";
import { pickLeastLoadedPm, rankPms } from "@/features/proposals/pm-assignment";
import { passProposalRequest } from "@/features/proposals/actions";
import { requestProposal } from "@/features/crm/actions/discovery-form";
import { ROLES, signInAs } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const pick = pickLeastLoadedPm as unknown as ReturnType<typeof vi.fn>;

const A = { id: "pm-a", name: "Ana" };
const B = { id: "pm-b", name: "Ben" };
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

beforeEach(() => {
    mockDb.resetMocks();
    vi.clearAllMocks();
});

describe("rankPms", () => {
    it("picks the PM with the least open work (leads + projects)", () => {
        const leads = [{ assignedPmId: "pm-a", proposalRequestedAt: day(1) }, { assignedPmId: "pm-a", proposalRequestedAt: day(2) }];
        expect(rankPms([A, B], leads, [{ assignedPmId: "pm-b" }])).toMatchObject({ id: "pm-b", load: 1 });
    });

    it("breaks a tie by the oldest latest assignment, never-assigned first", () => {
        const leads = [{ assignedPmId: "pm-a", proposalRequestedAt: day(5) }, { assignedPmId: "pm-b", proposalRequestedAt: day(3) }];
        expect(rankPms([A, B], leads, [])?.id).toBe("pm-b");
        expect(rankPms([A, B], [{ assignedPmId: "pm-a", proposalRequestedAt: day(1) }], [])?.id).toBe("pm-b");
    });

    it("skips the excluded PM and returns null when nobody is left", () => {
        expect(rankPms([A, B], [], [], "pm-a")?.id).toBe("pm-b");
        expect(rankPms([A], [], [], "pm-a")).toBeNull();
        expect(rankPms([], [], [])).toBeNull();
    });
});

describe("requestProposal assignment", () => {
    function readyLead(overrides: Record<string, unknown> = {}) {
        mockDb.query.leads.findFirst.mockResolvedValue({ id: "lead-1", businessName: "Acme", assignedPmId: null, proposalRequestedAt: null, ...overrides });
        mockDb.query.meetings.findFirst.mockResolvedValue({ id: "m-1" });
        mockDb.query.discoveryForms.findFirst.mockResolvedValue({ id: "f-1" });
        mockDb.query.users.findFirst.mockResolvedValue(null);
    }

    it("assigns the least-loaded PM and notifies only them", async () => {
        signInAs(auth, "sales", "sales-1");
        readyLead();
        pick.mockResolvedValue({ ...B, load: 0 });
        const sets = captureUpdates();

        const res = await requestProposal("lead-1");

        expect(res).toMatchObject({ success: true, assignedPmName: "Ben" });
        expect(sets[0]).toMatchObject({ assignedPmId: "pm-b" });
        expect(createSystemNotification).toHaveBeenCalledTimes(1);
        expect(createSystemNotification).toHaveBeenCalledWith("pm-b", expect.any(String), "proposal", "/dashboard/proposals");
    });

    it("leaves the lead unassigned and notifies every PM when no PM is available", async () => {
        signInAs(auth, "sales", "sales-1");
        readyLead();
        pick.mockResolvedValue(null);
        mockDb.query.users.findMany.mockResolvedValue([{ id: "pm-a" }, { id: "pm-b" }]);
        const sets = captureUpdates();

        const res = await requestProposal("lead-1");

        expect(res).toMatchObject({ success: true, assignedPmName: null });
        expect(sets[0]).not.toHaveProperty("assignedPmId");
        expect(createSystemNotification).toHaveBeenCalledTimes(2);
    });

    it("keeps an active assigned PM without picking again", async () => {
        signInAs(auth, "sales", "sales-1");
        readyLead({ assignedPmId: "pm-a" });
        mockDb.query.users.findFirst.mockResolvedValue(A);
        const sets = captureUpdates();

        await requestProposal("lead-1");

        expect(pick).not.toHaveBeenCalled();
        expect(sets[0]).not.toHaveProperty("assignedPmId");
        expect(createSystemNotification).toHaveBeenCalledWith("pm-a", expect.any(String), "proposal", "/dashboard/proposals");
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
        pick.mockResolvedValue(null);
        const res = await passProposalRequest("lead-1", "busy");
        expect(res).toMatchObject({ success: false, message: "No other Project Manager is available." });
        expect(pick).toHaveBeenCalledWith("pm-a");
        expectNoWrites(mockDb);
    });

    it("reassigns, notifies the new PM and audits the reason", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        pick.mockResolvedValue({ ...B, load: 1 });
        const sets = captureUpdates();

        const res = await passProposalRequest("lead-1", "  On leave next week  ");

        expect(res).toMatchObject({ success: true, assignedPmName: "Ben" });
        expect(sets[0]).toMatchObject({ assignedPmId: "pm-b" });
        expect(createSystemNotification).toHaveBeenCalledWith("pm-b", expect.stringContaining("passed to you"), "proposal", "/dashboard/proposals");
        expect(logAction).toHaveBeenCalledWith("UPDATE", "Lead", expect.stringContaining("Reason: On leave next week"));
    });

    it("does nothing when the lead was already reassigned (double submit)", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(lead());
        pick.mockResolvedValue({ ...B, load: 0 });
        captureUpdates([]);
        const res = await passProposalRequest("lead-1", "busy");
        expect(res.success).toBe(false);
        expect(createSystemNotification).not.toHaveBeenCalled();
    });
});
