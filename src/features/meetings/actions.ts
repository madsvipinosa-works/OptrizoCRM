"use server";

import { db } from "@/db";
import { meetings, leads, leadActivityLogs, users } from "@/db/schema";
import { eq, desc, and, gte, lte, or, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { createSystemNotification, notifyAllSales } from "@/features/notifications/send";
import { sendMeetingInviteEmail, sendMeetingReminderEmail } from "@/lib/notifications";
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

export async function scheduleDiscoveryMeeting(data: {
    leadId: string;
    format: "video" | "phone" | "in_person" | "on_site";
    startsAt: string | Date;
    attendees?: string[];
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

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, data.leadId),
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    const defaultAttendees = data.attendees && data.attendees.length > 0
        ? data.attendees
        : ["Sales (required)", "Project Manager (optional)"];

    try {
        const [meeting] = await db.insert(meetings).values({
            leadId: data.leadId,
            type: "discovery",
            format: data.format,
            startsAt: meetingDate,
            attendees: defaultAttendees,
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
            content: `Discovery meeting scheduled for ${meetingDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            })} (${data.format})`,
        });

        // 3. Write audit log
        await logAction("CREATE", "Meeting", `Scheduled discovery meeting for lead ${lead.businessName || lead.contactName || data.leadId}`);

        // 4. Send email invite if contact email exists (with portal account sign-up link, no account creation)
        if (lead.contactEmail) {
            await sendMeetingInviteEmail({
                clientName: lead.contactName || lead.businessName || "Client",
                email: lead.contactEmail,
                meetingType: "Discovery",
                format: data.format === "video" ? "Video call" : data.format === "phone" ? "Phone call" : data.format === "in_person" ? "In person" : "On site",
                startsAt: meetingDate,
                agenda: data.agenda || null,
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

    // Verify caller is the client linked to this lead (by clientId or email)
    const isOwner =
        (meeting.lead?.clientId && meeting.lead.clientId === session.user.id) ||
        (meeting.lead?.contactEmail && meeting.lead.contactEmail.toLowerCase() === session.user.email.toLowerCase());

    if (!isOwner && session.user.role !== "superadmin") {
        return { success: false, message: "You are not authorized to respond to this meeting" };
    }

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
                    `Client confirmed meeting for ${meeting.lead?.businessName || meeting.lead?.contactName || "lead"}`,
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
                    content: `Client requested reschedule${suggestedDate ? ` to ${suggestedDate.toLocaleString()}` : ""}`,
                });
            }

            if (meeting.createdBy) {
                await createSystemNotification(
                    meeting.createdBy,
                    `Client requested a different time for meeting (${meeting.lead?.businessName || "lead"})`,
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

            if (meeting.createdBy) {
                await createSystemNotification(
                    meeting.createdBy,
                    `Client declined meeting invitation for ${meeting.lead?.businessName || "lead"}`,
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

    const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, data.meetingId),
        with: {
            lead: true,
        },
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
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
                content: `Meeting rescheduled to ${newDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                })}`,
            });
        }

        await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} rescheduled`);

        if (meeting.lead?.contactEmail) {
            await sendMeetingInviteEmail({
                clientName: meeting.lead.contactName || meeting.lead.businessName || "Client",
                email: meeting.lead.contactEmail,
                meetingType: meeting.type === "discovery" ? "Discovery" : "Meeting",
                format: meeting.format === "video" ? "Video call" : meeting.format === "phone" ? "Phone call" : "In person",
                startsAt: newDate,
                agenda: meeting.agenda,
            });
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
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
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
    });

    if (!meeting) {
        return { success: false, message: "Meeting not found" };
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
                content: `Discovery meeting marked as done${data.notes ? ` · Outcome notes: ${data.notes}` : ""}`,
            });
        }

        await logAction("UPDATE", "Meeting", `Meeting ${data.meetingId} marked as done`);

        revalidatePath("/dashboard/meetings");
        revalidatePath("/dashboard/leads");
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
                    format: meeting.format === "video" ? "Video call" : meeting.format === "phone" ? "Phone call" : "In person",
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
