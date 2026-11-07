"use server";

import { db } from "@/db";
import { meetings, leads, leadActivityLogs, proposals, users } from "@/db/schema";
import { eq, desc, and, gte, lte, or, inArray, isNull } from "drizzle-orm";
import { markDoneBlock } from "@/features/meetings/rules";
import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { createSystemNotification, notifyLeadClient, notifyLeadPms } from "@/features/notifications/send";
import {
    sendMeetingCancelledEmail,
    sendMeetingInviteEmail,
    sendMeetingReminderEmail,
    sendMeetingRescheduledEmail,
} from "@/lib/notifications";
import { meetingFormatLabel, meetingTypeLabel } from "@/lib/email-templates";
import { formatDateTime } from "@/lib/datetime";
import { advanceToDiscoveryIfNew } from "@/features/crm/actions";

export interface MeetingItem {
    id: string;
    leadId: string | null;
    proposalId: string | null;
    projectId: string | null;
    type: "discovery" | "budget_pricing" | "project_review" | "uat";
    format: "video" | "phone" | "in_person" | "on_site";
    startsAt: Date;
    attendees: string[];
    agenda: string | null;
    notes: string | null;
    status: "awaiting_client" | "confirmed" | "reschedule_requested" | "done" | "cancelled";
    reminderSent: boolean;
    clientSuggestedAt: Date | null;
    declineReason: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    lead?: {
        id: string;
        businessName: string | null;
        contactName: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        status: string;
    } | null;
    creator?: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}

/** Date and time for in-app messages, always in Manila time and the same as on screen. */
const formatMeetingWhen = formatDateTime;

type LeadForEmail = {
    businessName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    clientId: string | null;
    otherServiceText: string | null;
    service?: { title: string } | null;
};

/** What the client emails need to know about the lead: names, the service they asked about, account link. */
function leadEmailContext(lead: LeadForEmail) {
    return {
        clientName: lead.contactName || lead.businessName || "",
        businessName: lead.businessName || lead.contactName || "your business",
        serviceName: lead.service?.title || lead.otherServiceText || null,
        hasAccount: !!lead.clientId,
    };
}

/** "the discovery meeting with Santos Logistics", for staff notifications. */
function describeMeeting(type: MeetingItem["type"], lead?: { businessName: string | null; contactName: string | null } | null) {
    const who = lead?.businessName || lead?.contactName;
    return who ? `the ${meetingTypeLabel(type)} with ${who}` : `the ${meetingTypeLabel(type)}`;
}

export async function scheduleDiscoveryMeeting(data: {
    leadId: string;
    format: "video" | "phone" | "in_person" | "on_site";
    startsAt: string | Date;
    /**
     * Optional Project Manager attendee. `undefined` means "use the lead's assigned PM, if any";
     * `null` means "no PM". The PM is never required for a discovery meeting.
     */
    pmId?: string | null;
    agenda?: string;
}) {
    const authz = await requireRole(["sales"]);
    if (!authz.ok) {
        return { success: false, message: "Only sales can schedule discovery meetings" };
    }

    const { session } = authz;
    const meetingDate = new Date(data.startsAt);
    if (isNaN(meetingDate.getTime())) {
        return { success: false, message: "Invalid meeting date and time" };
    }
    if (meetingDate < new Date()) {
        return { success: false, message: "Cannot schedule a meeting in the past" };
    }

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, data.leadId),
        with: { service: true },
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    // Optional PM attendee: must be a Project Manager account. Default is the lead's assigned PM.
    const requestedPmId = data.pmId === undefined ? lead.assignedPmId : data.pmId;
    let pm: { id: string; name: string } | null = null;
    if (requestedPmId) {
        const found = await db.query.users.findFirst({
            where: and(eq(users.id, requestedPmId), eq(users.role, "manager")),
        });
        if (!found) {
            return { success: false, message: "Pick a Project Manager from the list, or leave the PM out." };
        }
        pm = { id: found.id, name: found.name || found.email };
    }

    const attendees = ["Sales (required)", pm ? `${pm.name} (Project Manager, optional)` : "Project Manager (optional)"];

    try {
        const [meeting] = await db.insert(meetings).values({
            leadId: data.leadId,
            type: "discovery",
            format: data.format,
            startsAt: meetingDate,
            attendees,
            agenda: data.agenda || "Learn their goals, the features they need and their timeline.",
            status: "awaiting_client",
            createdBy: session.user.id,
        }).returning();

        // 1. Advance lead to discovery if it is in new_lead stage
        await advanceToDiscoveryIfNew(db, data.leadId, "Discovery meeting scheduled");

        // 2. Log system interaction in lead activity log
        await db.insert(leadActivityLogs).values({
            leadId: data.leadId,
            authorId: session.user.id,
            activityType: "Meeting",
            content: `Discovery meeting scheduled for ${formatDateTime(meetingDate)} (${data.format})`,
        });

        // 3. Write audit log
        await logAction("CREATE", "Meeting", `Scheduled discovery meeting for lead ${lead.businessName || lead.contactName || data.leadId}`);

        const context = leadEmailContext(lead);
        const when = formatMeetingWhen(meetingDate);

        // 4. In-app notification for the client (only when the lead is linked to a client account).
        await notifyLeadClient(
            data.leadId,
            `${session.user.name || "Our sales team"} scheduled a discovery meeting with you about ${context.serviceName || context.businessName} on ${when} (Manila time, ${meetingFormatLabel(data.format).toLowerCase()}). Open Appointments to confirm it or suggest another time.`,
            "meeting",
            "/portal/appointments"
        );

        // 5. In-app notification for the PM who was picked as an attendee.
        if (pm) {
            await createSystemNotification(
                pm.id,
                `${session.user.name || "Sales"} invited you to the discovery meeting with ${context.businessName} on ${when} (Manila time). Open Meetings to see the details.`,
                "meeting",
                "/dashboard/meetings"
            );
        }

        // 6. Email invite (it links to the sign-up form when the client has no portal account yet)
        if (lead.contactEmail) {
            await sendMeetingInviteEmail({
                ...context,
                email: lead.contactEmail,
                meetingType: "discovery",
                format: data.format,
                startsAt: meetingDate,
                agenda: data.agenda || null,
                organizerName: session.user.name || null,
                organizerRole: "sales",
            });
        }

        revalidatePath("/dashboard/meetings");
        revalidatePath("/dashboard/leads");
        revalidatePath("/portal/appointments");

        return { success: true, meetingId: meeting.id };
    } catch (err) {
        console.error("Failed to schedule discovery meeting:", err);
        return { success: false, message: "Failed to schedule meeting" };
    }
}

export async function scheduleBudgetPricingMeeting(data: {
    proposalId: string;
    format: "video" | "phone" | "in_person" | "on_site";
    startsAt: string | Date;
    agenda?: string;
}) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Only managers can schedule budget & pricing meetings" };
    }

    const { session } = authz;
    const meetingDate = new Date(data.startsAt);
    if (isNaN(meetingDate.getTime())) {
        return { success: false, message: "Invalid meeting date and time" };
    }
    if (meetingDate < new Date()) {
        return { success: false, message: "Cannot schedule a meeting in the past" };
    }

    const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, data.proposalId),
        with: { lead: { with: { service: true } } },
    });

    if (!proposal) {
        return { success: false, message: "Proposal not found" };
    }

    if (proposal.status !== "pricing_meeting_requested") {
        return { success: false, message: `Cannot schedule pricing meeting. Proposal is "${proposal.status}", must be "pricing_meeting_requested".` };
    }

    // A Project Manager organizes this meeting (spec: PM is required, Sales is optional). When the lead already
    // has a PM, it must be that PM; when none is assigned yet, the calling PM is the organizer.
    const assignedPmId = proposal.lead?.assignedPmId ?? null;
    if (assignedPmId && assignedPmId !== session.user.id) {
        return { success: false, message: "Only the Project Manager assigned to this lead can schedule its pricing meeting." };
    }

    const defaultAttendees = ["Project Manager (required)", "Client (required)"];
    const defaultAgenda = data.agenda || "Review proposed scope, deliverables, timeline, and discuss budget and pricing options.";

    try {
        const [meeting] = await db.insert(meetings).values({
            leadId: proposal.leadId,
            proposalId: proposal.id,
            type: "budget_pricing",
            format: data.format,
            startsAt: meetingDate,
            attendees: defaultAttendees,
            agenda: defaultAgenda,
            status: "awaiting_client",
            createdBy: session.user.id,
        }).returning();

        if (proposal.leadId) {
            await db.insert(leadActivityLogs).values({
                leadId: proposal.leadId,
                authorId: session.user.id,
                activityType: "Meeting",
                content: `Budget & pricing meeting scheduled for ${formatDateTime(meetingDate)}`,
            });
        }

        if (proposal.lead) {
            const context = leadEmailContext(proposal.lead);

            if (proposal.lead.clientId) {
                await createSystemNotification(
                    proposal.lead.clientId,
                    `${session.user.name || "Your Project Manager"} scheduled the budget and pricing meeting for your proposal on ${formatMeetingWhen(meetingDate)} (Manila time, ${meetingFormatLabel(data.format).toLowerCase()}). Open Appointments to confirm it or suggest another time.`,
                    "meeting",
                    "/portal/appointments"
                );
            }

            if (proposal.lead.contactEmail) {
                await sendMeetingInviteEmail({
                    ...context,
                    email: proposal.lead.contactEmail,
                    meetingType: "budget_pricing",
                    format: data.format,
                    startsAt: meetingDate,
                    agenda: defaultAgenda,
                    organizerName: session.user.name || null,
                    organizerRole: "manager",
                });
            }
        }

        await logAction("CREATE", "Meeting", `Scheduled budget & pricing meeting ${meeting.id} for proposal ${proposal.id}`);

        revalidatePath("/dashboard/meetings");
        revalidatePath("/dashboard/proposals");
        revalidatePath(`/dashboard/proposals/${proposal.id}`);
        revalidatePath("/portal/appointments");

        return { success: true, meetingId: meeting.id };
    } catch (err) {
        console.error("Failed to schedule budget & pricing meeting:", err);
        return { success: false, message: "Failed to schedule meeting" };
    }
}

export async function respondToMeeting(data: {
    meetingId: string;
    response: "confirm" | "suggest_time" | "decline";
    suggestedAt?: string | Date;
    declineReason?: string;
}) {
    const authz = await requireSession();
    if (!authz.ok) {
        return { success: false, message: "Authentication required" };
    }

    const { session } = authz;
    const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, data.meetingId),
        with: {
            lead: true,
        },
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
    }

    if (meeting.status !== "awaiting_client") {
        return { success: false, message: "Meeting is not awaiting client response" };
    }

    // A meeting whose time has passed can no longer be confirmed or moved; the team books a new one.
    if (data.response !== "decline" && meeting.startsAt.getTime() <= Date.now()) {
        return { success: false, message: "This meeting time has already passed. Optrizo will send you a new time." };
    }
    if (data.response === "suggest_time") {
        const suggested = data.suggestedAt ? new Date(data.suggestedAt) : null;
        if (!suggested || Number.isNaN(suggested.getTime()) || suggested.getTime() <= Date.now()) {
            return { success: false, message: "Pick a date and time in the future." };
        }
    }

    // Verify caller is the client linked to this lead (by clientId or email)
    const isOwner =
        (meeting.lead?.clientId && meeting.lead.clientId === session.user.id) ||
        (meeting.lead?.contactEmail && meeting.lead.contactEmail.toLowerCase() === session.user.email.toLowerCase());

    if (!isOwner) {
        return { success: false, message: "You are not authorized to respond to this meeting" };
    }

    const clientLabel = meeting.lead?.contactName || meeting.lead?.businessName || "The client";
    const meetingLabel = describeMeeting(meeting.type, meeting.lead);
    const whenLabel = `${formatMeetingWhen(meeting.startsAt)} (Manila time)`;

    try {
        if (data.response === "confirm") {
            await db.update(meetings).set({
                status: "confirmed",
                updatedAt: new Date(),
            }).where(eq(meetings.id, data.meetingId));

            if (meeting.leadId) {
                await db.insert(leadActivityLogs).values({
                    leadId: meeting.leadId,
                    activityType: "Meeting",
                    content: "Client confirmed the meeting invitation via portal",
                });
            }

            if (meeting.createdBy) {
                await createSystemNotification(
                    meeting.createdBy,
                    `${clientLabel} confirmed ${meetingLabel} on ${whenLabel}.`,
                    "meeting",
                    "/dashboard/meetings"
                );
            }

            await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} confirmed by client`);
        } else if (data.response === "suggest_time") {
            const suggestedDate = data.suggestedAt ? new Date(data.suggestedAt) : null;
            await db.update(meetings).set({
                status: "reschedule_requested",
                clientSuggestedAt: suggestedDate,
                updatedAt: new Date(),
            }).where(eq(meetings.id, data.meetingId));

            if (meeting.leadId) {
                await db.insert(leadActivityLogs).values({
                    leadId: meeting.leadId,
                    activityType: "Meeting",
                    content: `Client requested reschedule${suggestedDate ? ` to ${formatDateTime(suggestedDate)}` : ""}`,
                });
            }

            if (meeting.createdBy) {
                await createSystemNotification(
                    meeting.createdBy,
                    `${clientLabel} asked to move ${meetingLabel} (now ${whenLabel})${suggestedDate ? ` to ${formatMeetingWhen(suggestedDate)}` : ""}. Open Meetings to pick a new time.`,
                    "meeting",
                    "/dashboard/meetings"
                );
            }

            await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} reschedule requested by client`);
        } else if (data.response === "decline") {
            await db.update(meetings).set({
                status: "cancelled",
                declineReason: data.declineReason || "Client declined invitation",
                updatedAt: new Date(),
            }).where(eq(meetings.id, data.meetingId));

            if (meeting.leadId) {
                await db.insert(leadActivityLogs).values({
                    leadId: meeting.leadId,
                    activityType: "Meeting",
                    content: `Client declined meeting invitation: ${data.declineReason || "No reason given"}`,
                });
            }

            if (meeting.type === "budget_pricing" && meeting.leadId) {
                await notifyLeadPms(
                    meeting.leadId,
                    `${clientLabel} declined ${meetingLabel} on ${whenLabel}: ${data.declineReason || "no reason given"}. Log an outside discussion or send a priced proposal.`,
                    "meeting",
                    meeting.proposalId ? `/dashboard/proposals/${meeting.proposalId}` : "/dashboard/meetings"
                );
            } else if (meeting.createdBy) {
                await createSystemNotification(
                    meeting.createdBy,
                    `${clientLabel} declined ${meetingLabel} on ${whenLabel}${data.declineReason ? `: ${data.declineReason}` : ""}. Open Meetings to book another time.`,
                    "meeting",
                    "/dashboard/meetings"
                );
            }

            await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} declined by client`);
        }

        revalidatePath("/portal/appointments");
        revalidatePath("/dashboard/meetings");
        return { success: true };
    } catch (err) {
        console.error("Failed to respond to meeting:", err);
        return { success: false, message: "Failed to record meeting response" };
    }
}

export async function rescheduleMeeting(data: {
    meetingId: string;
    startsAt: string | Date;
}) {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized to reschedule meeting" };
    }

    const newDate = new Date(data.startsAt);
    if (isNaN(newDate.getTime())) {
        return { success: false, message: "Invalid date" };
    }
    if (newDate < new Date()) {
        return { success: false, message: "Cannot reschedule a meeting to a past time" };
    }

    const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, data.meetingId),
        with: {
            lead: { with: { service: true } },
        },
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
    }

    if (meeting.type === "discovery" && authz.session.user.role !== "sales") {
        return { success: false, message: "Only sales can manage discovery meetings" };
    }
    if (meeting.type === "budget_pricing" && authz.session.user.role !== "manager") {
        return { success: false, message: "Only managers can manage budget & pricing meetings" };
    }

    try {
        await db.update(meetings).set({
            startsAt: newDate,
            status: "awaiting_client",
            reminderSent: false,
            clientSuggestedAt: null,
            updatedAt: new Date(),
        }).where(eq(meetings.id, data.meetingId));

        if (meeting.leadId) {
            await db.insert(leadActivityLogs).values({
                leadId: meeting.leadId,
                authorId: authz.session.user.id,
                activityType: "Meeting",
                content: `Meeting rescheduled to ${formatDateTime(newDate)}`,
            });
        }

        await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} rescheduled`);

        if (meeting.lead) {
            const organizerRole = authz.session.user.role === "manager" ? "manager" : "sales";

            if (meeting.leadId) {
                await notifyLeadClient(
                    meeting.leadId,
                    `${authz.session.user.name || "Optrizo"} moved your ${meetingTypeLabel(meeting.type)} to ${formatMeetingWhen(newDate)} (Manila time). Open Appointments to confirm the new time or suggest another one.`,
                    "meeting",
                    "/portal/appointments"
                );
            }

            if (meeting.lead.contactEmail) {
                await sendMeetingRescheduledEmail({
                    ...leadEmailContext(meeting.lead),
                    email: meeting.lead.contactEmail,
                    meetingType: meeting.type,
                    format: meeting.format,
                    startsAt: newDate,
                    organizerName: authz.session.user.name || null,
                    organizerRole,
                });
            }
        }

        revalidatePath("/dashboard/meetings");
        revalidatePath("/portal/appointments");
        return { success: true };
    } catch (err) {
        console.error("Failed to reschedule meeting:", err);
        return { success: false, message: "Failed to reschedule meeting" };
    }
}

export async function cancelMeeting(data: {
    meetingId: string;
    reason?: string;
}) {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized to cancel meeting" };
    }

    const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, data.meetingId),
        with: {
            lead: { with: { service: true } },
        },
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
    }

    if (meeting.type === "discovery" && authz.session.user.role !== "sales") {
        return { success: false, message: "Only sales can manage discovery meetings" };
    }
    if (meeting.type === "budget_pricing" && authz.session.user.role !== "manager") {
        return { success: false, message: "Only managers can manage budget & pricing meetings" };
    }

    try {
        await db.update(meetings).set({
            status: "cancelled",
            declineReason: data.reason || "Cancelled by organizer",
            updatedAt: new Date(),
        }).where(eq(meetings.id, data.meetingId));

        if (meeting.leadId) {
            await db.insert(leadActivityLogs).values({
                leadId: meeting.leadId,
                authorId: authz.session.user.id,
                activityType: "Meeting",
                content: `Meeting cancelled${data.reason ? `: ${data.reason}` : ""}`,
            });
        }

        await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} cancelled by organizer`);

        // The client is told (mockup 047 notes: "Reschedule and Cancel meeting notify the client").
        if (meeting.lead) {
            const organizerRole = authz.session.user.role === "manager" ? "manager" : "sales";

            if (meeting.leadId) {
                await notifyLeadClient(
                    meeting.leadId,
                    `${authz.session.user.name || "Optrizo"} cancelled your ${meetingTypeLabel(meeting.type)} that was set for ${formatMeetingWhen(meeting.startsAt)} (Manila time)${data.reason?.trim() ? `. Reason: ${data.reason.trim()}` : ""}. We will contact you to find a new time.`,
                    "meeting",
                    "/portal/appointments"
                );
            }

            if (meeting.lead.contactEmail) {
                await sendMeetingCancelledEmail({
                    ...leadEmailContext(meeting.lead),
                    email: meeting.lead.contactEmail,
                    meetingType: meeting.type,
                    format: meeting.format,
                    startsAt: meeting.startsAt,
                    organizerName: authz.session.user.name || null,
                    organizerRole,
                    reason: data.reason ?? null,
                });
            }
        }

        revalidatePath("/dashboard/meetings");
        revalidatePath("/portal/appointments");
        return { success: true };
    } catch (err) {
        console.error("Failed to cancel meeting:", err);
        return { success: false, message: "Failed to cancel meeting" };
    }
}

export async function markMeetingDone(data: {
    meetingId: string;
    notes?: string;
}) {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, data.meetingId),
        with: { lead: true },
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
    }

    // Spec: Sales marks `discovery` done; the PM marks `budget_pricing`, `project_review` and `uat` done.
    const userId = authz.session.user.id;
    const ownerRole = meeting.type === "discovery" ? "sales" : "manager";
    if (authz.session.user.role !== ownerRole) {
        return {
            success: false,
            message: ownerRole === "sales"
                ? "Only sales can mark a discovery meeting as done."
                : "Only the Project Manager can mark this meeting as done.",
        };
    }
    if (ownerRole === "manager") {
        // The lead's PM, or the PM who booked the meeting (the organizer), marks it done.
        const assignedPmId = meeting.lead?.assignedPmId ?? null;
        if (assignedPmId && assignedPmId !== userId && meeting.createdBy !== userId) {
            return { success: false, message: "Only the Project Manager assigned to this lead can mark this meeting as done." };
        }
    }

    const blocked = markDoneBlock(meeting);
    if (blocked) {
        return { success: false, message: blocked };
    }

    try {
        await db.update(meetings).set({
            status: "done",
            notes: data.notes || meeting.notes,
            updatedAt: new Date(),
        }).where(eq(meetings.id, data.meetingId));

        // NOTE: Does NOT change lead stage per spec §4
        if (meeting.leadId) {
            await db.insert(leadActivityLogs).values({
                leadId: meeting.leadId,
                authorId: authz.session.user.id,
                activityType: "Meeting",
                content: `${meeting.type === "budget_pricing" ? "Budget & pricing" : "Discovery"} meeting marked as done${data.notes ? ` · Outcome notes: ${data.notes}` : ""}`,
            });
        }

        await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} marked as done`);

        revalidatePath("/dashboard/meetings");
        revalidatePath("/dashboard/leads");
        revalidatePath("/dashboard/proposals");
        if (meeting.proposalId) {
            revalidatePath(`/dashboard/proposals/${meeting.proposalId}`);
        }
        revalidatePath("/portal/appointments");
        return { success: true };
    } catch (err) {
        console.error("Failed to mark meeting as done:", err);
        return { success: false, message: "Failed to complete meeting" };
    }
}

export async function updateMeetingNotes(data: {
    meetingId: string;
    notes: string;
}) {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, data.meetingId),
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
    }

    if (meeting.type === "discovery" && authz.session.user.role !== "sales") {
        return { success: false, message: "Only sales can manage discovery meetings" };
    }
    if (meeting.type === "budget_pricing" && authz.session.user.role !== "manager") {
        return { success: false, message: "Only managers can manage budget & pricing meetings" };
    }

    try {
        await db.update(meetings).set({
            notes: data.notes,
            updatedAt: new Date(),
        }).where(eq(meetings.id, data.meetingId));

        await logAction("UPDATE", "Meeting", `Updated notes for meeting ${data.meetingId}`);
        revalidatePath("/dashboard/meetings");
        return { success: true };
    } catch (err) {
        console.error("Failed to update meeting notes:", err);
        return { success: false, message: "Failed to update notes" };
    }
}

export async function getMeetings(filters?: {
    status?: string;
    leadId?: string;
}): Promise<MeetingItem[]> {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) return [];

    const conditions = [];

    if (filters?.leadId) {
        conditions.push(eq(meetings.leadId, filters.leadId));
    }

    if (filters?.status && filters.status !== "all") {
        if (filters.status === "upcoming") {
            conditions.push(inArray(meetings.status, ["awaiting_client", "confirmed", "reschedule_requested"]));
        } else if (filters.status === "done") {
            conditions.push(eq(meetings.status, "done"));
        } else if (filters.status === "cancelled") {
            conditions.push(eq(meetings.status, "cancelled"));
        }
    }

    const results = await db.query.meetings.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(meetings.startsAt)],
        with: {
            lead: {
                columns: {
                    id: true,
                    businessName: true,
                    contactName: true,
                    contactEmail: true,
                    contactPhone: true,
                    status: true,
                },
            },
            creator: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return results as MeetingItem[];
}

export async function getClientAppointments(): Promise<MeetingItem[]> {
    const authz = await requireSession();
    if (!authz.ok) return [];

    const { session } = authz;
    const clientEmail = session.user.email?.toLowerCase();
    const clientId = session.user.id;

    // Find leads matching this client
    const clientLeads = await db.query.leads.findMany({
        where: or(
            eq(leads.clientId, clientId),
            clientEmail ? eq(leads.contactEmail, clientEmail) : undefined
        ),
        columns: { id: true },
    });

    const leadIds = clientLeads.map((l) => l.id);
    if (leadIds.length === 0) return [];

    const results = await db.query.meetings.findMany({
        where: inArray(meetings.leadId, leadIds),
        orderBy: [desc(meetings.startsAt)],
        with: {
            lead: {
                columns: {
                    id: true,
                    businessName: true,
                    contactName: true,
                    contactEmail: true,
                    contactPhone: true,
                    status: true,
                },
            },
        },
    });

    return results as MeetingItem[];
}

export async function checkAndSendMeetingReminders() {
    try {
        const now = new Date();
        const tomorrowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000); // within the next 36 hours

        const upcoming = await db.query.meetings.findMany({
            where: and(
                inArray(meetings.status, ["awaiting_client", "confirmed"]),
                eq(meetings.reminderSent, false),
                gte(meetings.startsAt, now),
                lte(meetings.startsAt, tomorrowEnd)
            ),
            with: {
                lead: true,
            },
        });

        for (const meeting of upcoming) {
            if (meeting.lead?.contactEmail) {
                await sendMeetingReminderEmail({
                    clientName: meeting.lead.contactName || meeting.lead.businessName || "Client",
                    email: meeting.lead.contactEmail,
                    meetingType: meeting.type === "discovery" ? "Discovery Meeting" : "Appointment",
                    format: meeting.format,
                    startsAt: meeting.startsAt,
                });
            }

            await db.update(meetings).set({
                reminderSent: true,
                updatedAt: new Date(),
            }).where(eq(meetings.id, meeting.id));
        }

        return { processed: upcoming.length };
    } catch (err) {
        console.error("Meeting reminders check error:", err);
        return { processed: 0, error: true };
    }
}


/**
 * Project Managers a Sales user can pick as an optional attendee of a discovery meeting.
 * `defaultPmId` is the lead's assigned PM, when the lead has one.
 */
export async function getManagersForMeeting(leadId?: string): Promise<{
    managers: Array<{ id: string; name: string }>;
    defaultPmId: string | null;
}> {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) return { managers: [], defaultPmId: null };

    const rows = await db.query.users.findMany({
        where: and(eq(users.role, "manager"), eq(users.status, "active"), isNull(users.deletedAt)),
        columns: { id: true, name: true, email: true },
    });
    const managers = rows
        .map((row) => ({ id: row.id, name: row.name || row.email }))
        .sort((a, b) => a.name.localeCompare(b.name));

    let defaultPmId: string | null = null;
    if (leadId) {
        const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId), columns: { assignedPmId: true } });
        defaultPmId = lead?.assignedPmId ?? null;
    }

    return { managers, defaultPmId };
}

export async function getActiveLeadsForMeeting(): Promise<Array<{ id: string; businessName: string | null; contactName: string | null; contactEmail: string | null }>> {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) return [];

    const results = await db.query.leads.findMany({
        where: inArray(leads.status, ["New Lead", "Discovery & Qualifying"]),
        orderBy: [desc(leads.createdAt)],
        columns: {
            id: true,
            businessName: true,
            contactName: true,
            contactEmail: true,
        },
    });

    return results;
}
