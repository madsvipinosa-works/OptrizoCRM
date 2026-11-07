import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
    createSystemNotification: vi.fn(),
    notifyLeadClient: vi.fn(),
    notifyLeadPms: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({
    sendMeetingInviteEmail: vi.fn(),
    sendMeetingReminderEmail: vi.fn(),
    sendMeetingRescheduledEmail: vi.fn(),
    sendMeetingCancelledEmail: vi.fn(),
}));
vi.mock("@/features/crm/actions", () => ({ advanceToDiscoveryIfNew: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { logAction } from "@/features/audit/log";
import { createSystemNotification, notifyLeadClient } from "@/features/notifications/send";
import { sendMeetingCancelledEmail, sendMeetingInviteEmail, sendMeetingRescheduledEmail } from "@/lib/notifications";
import {
    cancelMeeting,
    getManagersForMeeting,
    markMeetingDone,
    rescheduleMeeting,
    scheduleBudgetPricingMeeting,
    scheduleDiscoveryMeeting,
} from "@/features/meetings/actions";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;

type MeetingType = "discovery" | "budget_pricing" | "project_review" | "uat";
const TYPES: MeetingType[] = ["discovery", "budget_pricing", "project_review", "uat"];
const OWNER: Record<MeetingType, Role> = {
    discovery: "sales",
    budget_pricing: "manager",
    project_review: "manager",
    uat: "manager",
};

function meetingRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "m-1",
        leadId: "lead-1",
        proposalId: null,
        type: "budget_pricing",
        status: "confirmed",
        // Already started: a meeting can only be marked done after it begins.
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        createdBy: "manager-1",
        notes: null,
        lead: { id: "lead-1", assignedPmId: null },
        ...overrides,
    };
}

function setMeeting(row: unknown) {
    mockDb.query.meetings.findFirst.mockResolvedValue(row);
}

/** Captures what is passed to `db.insert(table).values(...)`, resolving `.returning()` to one meeting row. */
function captureInserts() {
    const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
    mockDb.insert.mockImplementation((table: unknown) => ({
        values: (values: Record<string, unknown>) => {
            inserts.push({ table, values });
            return Object.assign(Promise.resolve([]), {
                returning: () => Promise.resolve([{ id: "m-new" }]),
            });
        },
    }));
    return inserts;
}

const FUTURE = new Date("2099-01-01T02:00:00.000Z"); // Jan 1, 2099, 10:00sAM in Manila

beforeEach(() => {
    mockDb.resetMocks();
    vi.mocked(notifyLeadClient).mockClear();
    vi.mocked(createSystemNotification).mockClear();
    vi.mocked(sendMeetingInviteEmail).mockClear();
    vi.mocked(sendMeetingRescheduledEmail).mockClear();
    vi.mocked(sendMeetingCancelledEmail).mockClear();
    vi.mocked(logAction).mockClear();
    signInAs(auth, "manager", "manager-1");
});

describe("markMeetingDone: who may mark which meeting done", () => {
    for (const type of TYPES) {
        describe(type, () => {
            it(`lets ${OWNER[type]} mark a confirmed meeting done`, async () => {
                signInAs(auth, OWNER[type], `${OWNER[type]}-1`);
                setMeeting(meetingRow({ type }));
                const res = await markMeetingDone({ meetingId: "m-1", notes: "Agreed on scope" });
                expect(res).toMatchObject({ success: true });
                expect(mockDb.update).toHaveBeenCalledTimes(1);
            });

            it.each(ROLES.filter((role) => role !== OWNER[type]))("rejects %s and writes nothing", async (role) => {
                signInAs(auth, role);
                setMeeting(meetingRow({ type }));
                const res = await markMeetingDone({ meetingId: "m-1" });
                expect(res.success).toBe(false);
                expectNoWrites(mockDb);
            });
        });
    }

    it("rejects a signed-out caller", async () => {
        signInAs(auth, null);
        const res = await markMeetingDone({ meetingId: "m-1" });
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("says why Sales cannot mark a PM meeting done, and why the PM cannot mark a discovery meeting done", async () => {
        signInAs(auth, "sales");
        setMeeting(meetingRow({ type: "project_review" }));
        expect(await markMeetingDone({ meetingId: "m-1" })).toMatchObject({
            success: false,
            message: expect.stringMatching(/Project Manager/),
        });

        signInAs(auth, "manager");
        setMeeting(meetingRow({ type: "discovery" }));
        expect(await markMeetingDone({ meetingId: "m-1" })).toMatchObject({
            success: false,
            message: expect.stringMatching(/Only sales/),
        });
    });

    it.each(["awaiting_client", "confirmed"])("accepts a %s meeting", async (status) => {
        setMeeting(meetingRow({ status }));
        expect(await markMeetingDone({ meetingId: "m-1" })).toMatchObject({ success: true });
    });

    it.each([
        ["done", /already marked as done/],
        ["cancelled", /cancelled meeting cannot be marked/],
        ["reschedule_requested", /asked for another time/],
    ])("rejects a %s meeting", async (status, message) => {
        setMeeting(meetingRow({ status }));
        const res = await markMeetingDone({ meetingId: "m-1" });
        expect(res).toMatchObject({ success: false, message: expect.stringMatching(message) });
        expectNoWrites(mockDb);
    });

    it("rejects a meeting that has not started yet", async () => {
        setMeeting(meetingRow({ startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }));
        const res = await markMeetingDone({ meetingId: "m-1" });
        expect(res).toMatchObject({ success: false, message: expect.stringMatching(/not started/) });
        expectNoWrites(mockDb);
    });

    it("reports a missing meeting", async () => {
        setMeeting(undefined);
        expect(await markMeetingDone({ meetingId: "nope" })).toMatchObject({ success: false, message: "Meeting not found" });
        expectNoWrites(mockDb);
    });

    describe("PM ownership", () => {
        it("lets the PM assigned to the lead mark it done", async () => {
            setMeeting(meetingRow({ createdBy: "someone-else", lead: { id: "lead-1", assignedPmId: "manager-1" } }));
            expect(await markMeetingDone({ meetingId: "m-1" })).toMatchObject({ success: true });
        });

        it("lets the PM who booked it mark it done even if the lead has another PM", async () => {
            setMeeting(meetingRow({ createdBy: "manager-1", lead: { id: "lead-1", assignedPmId: "manager-2" } }));
            expect(await markMeetingDone({ meetingId: "m-1" })).toMatchObject({ success: true });
        });

        it("lets any PM mark it done when the lead has no PM yet", async () => {
            setMeeting(meetingRow({ createdBy: "manager-9", lead: { id: "lead-1", assignedPmId: null } }));
            expect(await markMeetingDone({ meetingId: "m-1" })).toMatchObject({ success: true });
        });

        it("rejects a different PM who did not book it", async () => {
            setMeeting(meetingRow({ createdBy: "manager-2", lead: { id: "lead-1", assignedPmId: "manager-2" } }));
            const res = await markMeetingDone({ meetingId: "m-1" });
            expect(res).toMatchObject({ success: false, message: expect.stringMatching(/assigned to this lead/) });
            expectNoWrites(mockDb);
        });
    });

    it("does not change the lead stage and writes an audit row", async () => {
        setMeeting(meetingRow());
        await markMeetingDone({ meetingId: "m-1" });
        expect(logAction).toHaveBeenCalledWith("UPDATE", "Meeting", expect.stringContaining("marked as done"));
    });
});

describe("scheduleBudgetPricingMeeting: a Project Manager is required", () => {
    function proposalRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "p-1",
            leadId: "lead-1",
            status: "pricing_meeting_requested",
            lead: { id: "lead-1", clientId: "client-1", contactEmail: "c@example.com", contactName: "Maria", assignedPmId: null },
            ...overrides,
        };
    }

    const input = { proposalId: "p-1", format: "phone" as const, startsAt: FUTURE };

    it.each(ROLES.filter((role) => role !== "manager"))("rejects %s before reading anything", async (role) => {
        signInAs(auth, role);
        const res = await scheduleBudgetPricingMeeting(input);
        expect(res.success).toBe(false);
        expect(mockDb.query.proposals.findFirst).not.toHaveBeenCalled();
        expectNoWrites(mockDb);
    });

    it("books it with the PM as the required attendee and the PM as the organizer", async () => {
        mockDb.query.proposals.findFirst.mockResolvedValue(proposalRow());
        const inserts = captureInserts();

        const res = await scheduleBudgetPricingMeeting(input);

        expect(res).toMatchObject({ success: true, meetingId: "m-new" });
        const meeting = inserts.find((i) => i.table === meetings)?.values;
        expect(meeting).toMatchObject({ type: "budget_pricing", createdBy: "manager-1", status: "awaiting_client" });
        expect(meeting?.attendees).toEqual(expect.arrayContaining(["Project Manager (required)"]));
    });

    it("lets the lead's own PM book it", async () => {
        mockDb.query.proposals.findFirst.mockResolvedValue(
            proposalRow({ lead: { id: "lead-1", assignedPmId: "manager-1", clientId: null, contactEmail: null } }),
        );
        captureInserts();
        expect(await scheduleBudgetPricingMeeting(input)).toMatchObject({ success: true });
    });

    it("rejects a PM who is not the lead's PM and writes nothing", async () => {
        mockDb.query.proposals.findFirst.mockResolvedValue(
            proposalRow({ lead: { id: "lead-1", assignedPmId: "manager-2", clientId: "client-1" } }),
        );
        const res = await scheduleBudgetPricingMeeting(input);
        expect(res).toMatchObject({ success: false, message: expect.stringMatching(/assigned to this lead/) });
        expectNoWrites(mockDb);
        expect(createSystemNotification).not.toHaveBeenCalled();
        expect(sendMeetingInviteEmail).not.toHaveBeenCalled();
    });

    it("still requires the proposal to be waiting for a pricing meeting", async () => {
        mockDb.query.proposals.findFirst.mockResolvedValue(proposalRow({ status: "sent" }));
        const res = await scheduleBudgetPricingMeeting(input);
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("notifies the client in the app", async () => {
        mockDb.query.proposals.findFirst.mockResolvedValue(proposalRow());
        captureInserts();
        await scheduleBudgetPricingMeeting(input);
        expect(createSystemNotification).toHaveBeenCalledWith(
            "client-1",
            expect.stringMatching(/budget and pricing meeting.*Jan 1, 2099, 10:00\sAM \(Manila time, phone call\).*Open Appointments/),
            "meeting",
            "/portal/appointments",
        );
        expect(sendMeetingInviteEmail).toHaveBeenCalledWith(
            expect.objectContaining({ meetingType: "budget_pricing", format: "phone", organizerRole: "manager" }),
        );
    });
});

describe("scheduleDiscoveryMeeting: the client gets an in-app notification", () => {
    const input = { leadId: "lead-1", format: "video" as const, startsAt: FUTURE };

    beforeEach(() => {
        signInAs(auth, "sales", "sales-1");
    });

    function leadRow(overrides: Record<string, unknown> = {}) {
        return { id: "lead-1", businessName: "Santos Logistics", contactName: "Maria", contactEmail: "maria@example.com", ...overrides };
    }

    it("notifies the lead's client with the meeting type, format, time and a link to the portal", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(leadRow());
        captureInserts();

        const res = await scheduleDiscoveryMeeting(input);

        expect(res).toMatchObject({ success: true, meetingId: "m-new" });
        expect(notifyLeadClient).toHaveBeenCalledTimes(1);
        const [leadId, message, type, link] = vi.mocked(notifyLeadClient).mock.calls[0];
        expect(leadId).toBe("lead-1");
        expect(message).toContain("discovery meeting");
        expect(message).toContain("Santos Logistics"); // names the business
        expect(message).toContain("video call");
        expect(message).toMatch(/Jan 1, 2099, 10:00\sAM \(Manila time/); // Manila time
        expect(message).toContain("confirm it or suggest another time");
        expect(type).toBe("meeting");
        expect(link).toBe("/portal/appointments");
    });

    it("still sends the invite email", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue(leadRow());
        captureInserts();
        await scheduleDiscoveryMeeting(input);
        expect(sendMeetingInviteEmail).toHaveBeenCalledTimes(1);
        expect(sendMeetingInviteEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "maria@example.com",
                meetingType: "discovery",
                format: "video", // the enum value, so on_site and in_person stay different
                businessName: "Santos Logistics",
                hasAccount: false,
                organizerRole: "sales",
            }),
        );
    });

    it.each(ROLES.filter((role) => role !== "sales"))("does not notify anyone when %s tries", async (role) => {
        signInAs(auth, role);
        const res = await scheduleDiscoveryMeeting(input);
        expect(res.success).toBe(false);
        expect(notifyLeadClient).not.toHaveBeenCalled();
        expectNoWrites(mockDb);
    });

    it("does not notify for a missing lead or a past date", async () => {
        signInAs(auth, "sales");
        mockDb.query.leads.findFirst.mockResolvedValue(undefined);
        expect((await scheduleDiscoveryMeeting(input)).success).toBe(false);

        mockDb.query.leads.findFirst.mockResolvedValue(leadRow());
        expect((await scheduleDiscoveryMeeting({ ...input, startsAt: new Date("2000-01-01") })).success).toBe(false);

        expect(notifyLeadClient).not.toHaveBeenCalled();
        expectNoWrites(mockDb);
    });
});

describe("scheduleDiscoveryMeeting: optional Project Manager attendee", () => {
    const input = { leadId: "lead-1", format: "video" as const, startsAt: FUTURE };

    beforeEach(() => {
        signInAs(auth, "sales", "sales-1");
        mockDb.query.leads.findFirst.mockResolvedValue({
            id: "lead-1",
            businessName: "Santos Logistics",
            contactName: "Maria",
            contactEmail: "maria@example.com",
            assignedPmId: null,
        });
    });

    it("adds the picked PM as an attendee and notifies that PM in the app", async () => {
        mockDb.query.users.findFirst.mockResolvedValue({ id: "pm-1", name: "Alex Cruz", email: "alex@example.com", role: "manager" });
        const inserts = captureInserts();

        const res = await scheduleDiscoveryMeeting({ ...input, pmId: "pm-1" });

        expect(res).toMatchObject({ success: true });
        const meeting = inserts.find((i) => i.table === meetings)?.values;
        expect(meeting?.attendees).toEqual(["Sales (required)", "Alex Cruz (Project Manager, optional)"]);
        expect(createSystemNotification).toHaveBeenCalledWith(
            "pm-1",
            expect.stringMatching(/invited you to the discovery meeting with Santos Logistics on Jan 1, 2099, 10:00\sAM \(Manila time\)/),
            "meeting",
            "/dashboard/meetings",
        );
    });

    it("uses the lead's assigned PM when none is chosen", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue({
            id: "lead-1",
            businessName: "Santos Logistics",
            contactName: "Maria",
            contactEmail: null,
            assignedPmId: "pm-2",
        });
        mockDb.query.users.findFirst.mockResolvedValue({ id: "pm-2", name: "Bea Lim", email: "bea@example.com", role: "manager" });
        const inserts = captureInserts();

        await scheduleDiscoveryMeeting(input); // pmId left out

        expect(inserts.find((i) => i.table === meetings)?.values.attendees).toContain("Bea Lim (Project Manager, optional)");
        expect(createSystemNotification).toHaveBeenCalledWith("pm-2", expect.any(String), "meeting", "/dashboard/meetings");
    });

    it("does not require a PM: pmId null means no PM and no PM notification", async () => {
        mockDb.query.leads.findFirst.mockResolvedValue({
            id: "lead-1",
            businessName: "Santos Logistics",
            contactName: "Maria",
            contactEmail: null,
            assignedPmId: "pm-2",
        });
        const inserts = captureInserts();

        const res = await scheduleDiscoveryMeeting({ ...input, pmId: null });

        expect(res).toMatchObject({ success: true });
        expect(inserts.find((i) => i.table === meetings)?.values.attendees).toEqual(["Sales (required)", "Project Manager (optional)"]);
        expect(createSystemNotification).not.toHaveBeenCalled();
    });

    it("rejects a pmId that is not a Project Manager account and writes nothing", async () => {
        mockDb.query.users.findFirst.mockResolvedValue(undefined); // the query filters on role manager
        const res = await scheduleDiscoveryMeeting({ ...input, pmId: "some-sales-user" });
        expect(res).toMatchObject({ success: false, message: expect.stringMatching(/Project Manager/) });
        expectNoWrites(mockDb);
        expect(notifyLeadClient).not.toHaveBeenCalled();
    });
});

describe("getManagersForMeeting", () => {
    it("lists active Project Managers and the lead's assigned PM for sales", async () => {
        signInAs(auth, "sales");
        mockDb.query.users.findMany.mockResolvedValue([
            { id: "pm-2", name: "Bea Lim", email: "bea@example.com" },
            { id: "pm-1", name: null, email: "alex@example.com" },
        ]);
        mockDb.query.leads.findFirst.mockResolvedValue({ assignedPmId: "pm-2" });

        const res = await getManagersForMeeting("lead-1");

        expect(res.defaultPmId).toBe("pm-2");
        expect(res.managers).toEqual([
            { id: "pm-1", name: "alex@example.com" },
            { id: "pm-2", name: "Bea Lim" },
        ]);
    });

    it.each(ROLES.filter((role) => role !== "sales" && role !== "manager"))("returns nothing for %s", async (role) => {
        signInAs(auth, role);
        expect(await getManagersForMeeting("lead-1")).toEqual({ managers: [], defaultPmId: null });
        expect(mockDb.query.users.findMany).not.toHaveBeenCalled();
    });
});

describe("rescheduleMeeting and cancelMeeting tell the client", () => {
    const meeting = (overrides: Record<string, unknown> = {}) => ({
        id: "m-1",
        leadId: "lead-1",
        type: "discovery",
        format: "on_site",
        status: "confirmed",
        startsAt: new Date("2099-02-03T02:00:00.000Z"),
        lead: {
            id: "lead-1",
            businessName: "Santos Logistics",
            contactName: "Maria Santos",
            contactEmail: "maria@example.com",
            clientId: "client-1",
            otherServiceText: null,
            service: { title: "Mobile App" },
        },
        ...overrides,
    });

    beforeEach(() => {
        signInAs(auth, "sales", "sales-1");
    });

    it("reschedule: in-app notification and a rescheduled email with the enum format", async () => {
        setMeeting(meeting());
        const res = await rescheduleMeeting({ meetingId: "m-1", startsAt: FUTURE });

        expect(res).toMatchObject({ success: true });
        expect(notifyLeadClient).toHaveBeenCalledWith(
            "lead-1",
            expect.stringMatching(/moved your discovery meeting to Jan 1, 2099, 10:00\sAM \(Manila time\)/),
            "meeting",
            "/portal/appointments",
        );
        expect(sendMeetingRescheduledEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "maria@example.com",
                meetingType: "discovery",
                format: "on_site",
                startsAt: FUTURE,
                serviceName: "Mobile App",
                hasAccount: true,
                organizerRole: "sales",
            }),
        );
        expect(sendMeetingInviteEmail).not.toHaveBeenCalled();
    });

    it("cancel: in-app notification (with the reason) and a cancelled email", async () => {
        setMeeting(meeting());
        const res = await cancelMeeting({ meetingId: "m-1", reason: "We need to move the kickoff" });

        expect(res).toMatchObject({ success: true });
        expect(notifyLeadClient).toHaveBeenCalledWith(
            "lead-1",
            expect.stringMatching(/cancelled your discovery meeting.*Feb 3, 2099, 10:00\sAM \(Manila time\).*Reason: We need to move the kickoff/),
            "meeting",
            "/portal/appointments",
        );
        expect(sendMeetingCancelledEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "maria@example.com",
                meetingType: "discovery",
                format: "on_site",
                reason: "We need to move the kickoff",
            }),
        );
    });

    it("cancel and reschedule send nothing when the caller does not own the meeting", async () => {
        signInAs(auth, "manager"); // a PM cannot manage a discovery meeting
        setMeeting(meeting());

        expect((await cancelMeeting({ meetingId: "m-1" })).success).toBe(false);
        expect((await rescheduleMeeting({ meetingId: "m-1", startsAt: FUTURE })).success).toBe(false);

        expect(notifyLeadClient).not.toHaveBeenCalled();
        expect(sendMeetingCancelledEmail).not.toHaveBeenCalled();
        expect(sendMeetingRescheduledEmail).not.toHaveBeenCalled();
        expectNoWrites(mockDb);
    });

    it("does not email a lead that has no email address, but still notifies in the app", async () => {
        setMeeting(meeting({ lead: { ...meeting().lead, contactEmail: null } }));
        await cancelMeeting({ meetingId: "m-1" });
        expect(sendMeetingCancelledEmail).not.toHaveBeenCalled();
        expect(notifyLeadClient).toHaveBeenCalledTimes(1);
    });
});
