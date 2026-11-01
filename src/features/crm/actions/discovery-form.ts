"use server";

import { db } from "@/db";
import { discoveryForms, leads, meetings, leadActivityLogs, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { createSystemNotification } from "@/features/notifications/send";

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

export async function requestProposal(leadId: string) {
    const authz = await requireRole(["sales"]);
    if (!authz.ok) {
        return { success: false, message: "Only sales can request a proposal" };
    }

    const { session } = authz;
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

        // 1. Set proposalRequestedAt on lead
        await db.update(leads).set({
            proposalRequestedAt: now,
            updatedAt: now,
        }).where(eq(leads.id, leadId));

        // 2. Notify every PM (role: "manager") using existing notification helper in send.ts (User change 5)
        const pmUsers = await db.query.users.findMany({
            where: and(
                eq(users.role, "manager"),
                eq(users.isActive, true)
            ),
        });

        const leadTitle = lead.businessName || lead.contactName || "lead";
        for (const pm of pmUsers) {
            await createSystemNotification(
                pm.id,
                `Proposal requested for ${leadTitle}`,
                "proposal",
                "/dashboard/proposals"
            );
        }

        // 3. Insert System activity log
        await db.insert(leadActivityLogs).values({
            leadId,
            authorId: session.user.id,
            activityType: "System",
            content: "Proposal requested · sent to Project Manager",
        });

        // 4. Write audit row
        await logAction("UPDATE", "Lead", `Proposal requested for lead ${leadTitle}`);

        revalidatePath("/dashboard/leads");
        revalidatePath("/dashboard/proposals");

        return { success: true };
    } catch (err) {
        console.error("Failed to request proposal:", err);
        return { success: false, message: "Failed to request proposal" };
    }
}
