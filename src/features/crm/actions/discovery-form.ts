"use server";

import { db } from "@/db";
import { discoveryForms, leads, meetings, leadActivityLogs, users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { createSystemNotification } from "@/features/notifications/send";
import { listPmWorkloads, resolvePmChoice } from "@/features/proposals/pm-assignment";
import { requestProposalChoiceSchema } from "@/lib/schemas";

export interface DiscoveryFormData {
    id?: string;
    leadId: string;
    goals: string;
    requiredFeatures: string;
    targetTimeline: string;
    budgetRange: string;
    clientType: "local" | "international";
    notes?: string | null;
    submittedAt?: Date | null;
}

export async function submitDiscoveryForm(data: {
    leadId: string;
    goals: string;
    requiredFeatures: string;
    targetTimeline: string;
    budgetRange: string;
    clientType: "local" | "international";
    notes?: string;
}) {
    const authz = await requireRole(["sales"]);
    if (!authz.ok) {
        return { success: false, message: "Only sales can submit the discovery form" };
    }

    const { session } = authz;
    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, data.leadId),
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    // Form is editable until proposal is requested, locked after (User change 2)
    if (lead.proposalRequestedAt) {
        return { success: false, message: "Form is locked because a proposal has already been requested" };
    }

    // Validate that ANY discovery meeting for this lead is marked done (User change 3 & 4)
    const doneMeeting = await db.query.meetings.findFirst({
        where: and(
            eq(meetings.leadId, data.leadId),
            eq(meetings.type, "discovery"),
            eq(meetings.status, "done")
        ),
    });

    if (!doneMeeting) {
        return { success: false, message: "A discovery meeting must be marked as done before submitting the discovery form" };
    }

    try {
        const existingForm = await db.query.discoveryForms.findFirst({
            where: eq(discoveryForms.leadId, data.leadId),
        });

        const now = new Date();

        if (existingForm) {
            await db.update(discoveryForms).set({
                goals: data.goals,
                requiredFeatures: data.requiredFeatures,
                targetTimeline: data.targetTimeline,
                budgetRange: data.budgetRange,
                clientType: data.clientType,
                notes: data.notes || null,
                submittedBy: session.user.id,
                submittedAt: now,
                updatedAt: now,
            }).where(eq(discoveryForms.id, existingForm.id));
        } else {
            await db.insert(discoveryForms).values({
                leadId: data.leadId,
                goals: data.goals,
                requiredFeatures: data.requiredFeatures,
                targetTimeline: data.targetTimeline,
                budgetRange: data.budgetRange,
                clientType: data.clientType,
                notes: data.notes || null,
                submittedBy: session.user.id,
                submittedAt: now,
            });
        }

        // Discovery form is source of truth: copy clientType to lead
        await db.update(leads).set({
            clientType: data.clientType,
            updatedAt: now,
        }).where(eq(leads.id, data.leadId));

        // Insert System activity log
        await db.insert(leadActivityLogs).values({
            leadId: data.leadId,
            authorId: session.user.id,
            activityType: "System",
            content: "Discovery form submitted · proposal unlocked",
        });

        // Write audit row
        await logAction("CREATE", "DiscoveryForm", `Discovery form submitted for lead ${lead.businessName || lead.contactName || data.leadId}`);

        revalidatePath("/dashboard/leads");
        revalidatePath("/dashboard/meetings");

        return { success: true };
    } catch (err) {
        console.error("Failed to submit discovery form:", err);
        return { success: false, message: "Failed to submit discovery form" };
    }
}

export async function getDiscoveryForm(leadId: string): Promise<DiscoveryFormData | null> {
    const form = await db.query.discoveryForms.findFirst({
        where: eq(discoveryForms.leadId, leadId),
    });

    if (!form) return null;

    return {
        id: form.id,
        leadId: form.leadId,
        goals: form.goals,
        requiredFeatures: form.requiredFeatures,
        targetTimeline: form.targetTimeline,
        budgetRange: form.budgetRange,
        clientType: form.clientType,
        notes: form.notes,
        submittedAt: form.submittedAt,
    };
}

/**
 * Step 8. With no `choice` the system keeps the lead's active PM or assigns the least-loaded one.
 * With `choice.pmId` Sales names the PM and must give a reason; both are audited.
 */
export async function requestProposal(leadId: string, choice: { pmId?: string; reason?: string } = {}) {
    const authz = await requireRole(["sales"]);
    if (!authz.ok) {
        return { success: false, message: "Only sales can request a proposal" };
    }

    const { session } = authz;
    const parsedChoice = requestProposalChoiceSchema.safeParse(choice);
    if (!parsedChoice.success) {
        return { success: false, message: parsedChoice.error.issues[0]?.message ?? "Invalid Project Manager choice" };
    }

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    // Idempotent check (User change 2)
    if (lead.proposalRequestedAt) {
        return { success: true, message: "Proposal already requested", alreadyRequested: true };
    }

    // Server-side validation: meeting must be done (User change 3 & 4)
    const doneMeeting = await db.query.meetings.findFirst({
        where: and(
            eq(meetings.leadId, leadId),
            eq(meetings.type, "discovery"),
            eq(meetings.status, "done")
        ),
    });

    if (!doneMeeting) {
        return { success: false, message: "A discovery meeting must be marked done before requesting a proposal" };
    }

    // Server-side validation: discovery form must be submitted (User change 4)
    const form = await db.query.discoveryForms.findFirst({
        where: eq(discoveryForms.leadId, leadId),
    });

    if (!form) {
        return { success: false, message: "Discovery form must be submitted before requesting a proposal" };
    }

    try {
        const now = new Date();

        // 1. Sales' named PM, else the lead's active PM, else the least-loaded active PM.
        let assignedPm: { id: string; name: string | null } | null = null;
        let assignNote = "";
        // How the PM was chosen, in words the PM and the team read (lead activity, the PM's request and notification).
        let how: "named" | "auto" | "kept" = "kept";
        const salesName = session.user.name || "Sales";
        const reason = "reason" in parsedChoice.data ? parsedChoice.data.reason : "";
        if (parsedChoice.data.pmId) {
            const chosen = resolvePmChoice(await listPmWorkloads(), parsedChoice.data.pmId);
            if (!chosen.ok) return { success: false, message: chosen.message };
            assignedPm = chosen.pm;
            how = "named";
            assignNote = ` · Sales ${chosen.note}. Reason: ${reason}`;
        } else {
            assignedPm = lead.assignedPmId
                ? (await db.query.users.findFirst({
                    where: and(
                        eq(users.id, lead.assignedPmId),
                        eq(users.role, "manager"),
                        eq(users.isActive, true),
                        isNull(users.deletedAt)
                    ),
                    columns: { id: true, name: true },
                })) ?? null
                : null;
            if (!assignedPm) {
                const auto = resolvePmChoice(await listPmWorkloads());
                if (auto.ok) {
                    assignedPm = auto.pm;
                    how = "auto";
                    assignNote = ` · ${auto.note}`;
                }
            }
        }
        const changesPm = !!assignedPm && assignedPm.id !== lead.assignedPmId;

        await db.update(leads).set({
            proposalRequestedAt: now,
            updatedAt: now,
            ...(changesPm && assignedPm ? { assignedPmId: assignedPm.id } : {}),
        }).where(eq(leads.id, leadId));

        // 2. Notify the assigned PM only; with no active PM at all, notify every PM (first to open claims it).
        const targetPms: Array<{ id: string }> = assignedPm
            ? [assignedPm]
            : await db.query.users.findMany({
                where: and(
                    eq(users.role, "manager"),
                    eq(users.isActive, true),
                    isNull(users.deletedAt)
                ),
                columns: { id: true },
            });

        const leadTitle = lead.businessName || lead.contactName || "lead";
        const pmLabel = assignedPm?.name || "Project Manager";
        const pmMessage =
            how === "named"
                ? `${salesName} assigned you the proposal for ${leadTitle}. Reason: ${reason}`
                : how === "auto"
                  ? `Proposal requested for ${leadTitle}. You were assigned automatically (least open work).`
                  : `Proposal requested for ${leadTitle}`;
        for (const pm of targetPms) {
            await createSystemNotification(
                pm.id,
                assignedPm ? pmMessage : `Proposal requested for ${leadTitle}`,
                "proposal",
                "/dashboard/proposals"
            );
        }

        // 3. Insert System activity log (the PM's request shows the latest of these as "How it was assigned")
        const assignedText =
            how === "named"
                ? `${salesName} assigned it to ${pmLabel}. Reason: ${reason}`
                : how === "auto"
                  ? `assigned automatically to ${pmLabel} (least open work)`
                  : `assigned to ${pmLabel}`;
        await db.insert(leadActivityLogs).values({
            leadId,
            authorId: session.user.id,
            activityType: "System",
            content: assignedPm ? `Proposal requested · ${assignedText}` : "Proposal requested · sent to Project Manager",
        });

        // 4. Write audit row
        await logAction("UPDATE", "Lead", `Proposal requested for lead ${leadTitle}${assignNote}`);

        revalidatePath("/dashboard/leads");
        revalidatePath("/dashboard/proposals");

        return { success: true, assignedPmName: assignedPm?.name ?? null };
    } catch (err) {
        console.error("Failed to request proposal:", err);
        return { success: false, message: "Failed to request proposal" };
    }
}
