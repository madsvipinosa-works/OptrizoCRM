import "server-only";
import { leads, leadActivityLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { db } from "@/db";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Stage rule helper: moves a lead from 'Discovery & Qualifying' to 'Proposal Sent'
 * on proposal delivery. Rejects unless the lead is in Discovery with proposalRequestedAt set.
 * Sets status, stageChangedAt, and writes a System activity interaction inside the given transaction.
 */
export async function moveLeadToProposalSent(
    tx: DbTransaction,
    leadId: string
): Promise<{ success: boolean; message?: string }> {
    const lead = await tx.query.leads.findFirst({
        where: eq(leads.id, leadId),
        columns: { id: true, status: true, proposalRequestedAt: true },
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    if (lead.status !== "Discovery & Qualifying") {
        return { success: false, message: `Cannot move to "Proposal Sent". Lead must be in "Discovery & Qualifying", currently in "${lead.status}".` };
    }

    if (!lead.proposalRequestedAt) {
        return { success: false, message: `Cannot move to "Proposal Sent". Lead has no proposal requested.` };
    }

    const now = new Date();
    await tx.update(leads)
        .set({
            status: "Proposal Sent",
            stageChangedAt: now,
            updatedAt: now,
        })
        .where(eq(leads.id, leadId));

    await tx.insert(leadActivityLogs).values({
        leadId,
        authorId: null,
        activityType: "System",
        content: "Stage moved to Proposal Sent on proposal delivery",
    });

    return { success: true };
}

/**
 * Stage rule helper: moves a lead from 'Proposal Sent' to 'In Negotiation'
 * on client change request. Idempotent: if already in 'In Negotiation', succeeds without change.
 */
export async function moveLeadToNegotiation(
    tx: DbTransaction,
    leadId: string
): Promise<{ success: boolean; message?: string }> {
    const lead = await tx.query.leads.findFirst({
        where: eq(leads.id, leadId),
        columns: { id: true, status: true },
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    if (lead.status === "In Negotiation") {
        return { success: true };
    }

    if (lead.status !== "Proposal Sent") {
        return { success: false, message: `Cannot move to "In Negotiation". Lead must be in "Proposal Sent", currently in "${lead.status}".` };
    }

    const now = new Date();
    await tx.update(leads)
        .set({
            status: "In Negotiation",
            stageChangedAt: now,
            updatedAt: now,
        })
        .where(eq(leads.id, leadId));

    await tx.insert(leadActivityLogs).values({
        leadId,
        authorId: null,
        activityType: "System",
        content: "Stage moved to In Negotiation due to proposal change request",
    });

    return { success: true };
}

/**
 * Stage rule helper: moves a lead to 'Closed Won' on proposal signing.
 * Only allowed from 'Proposal Sent' or 'In Negotiation'.
 */
export async function moveLeadToClosedWon(
    tx: DbTransaction,
    leadId: string,
    closedWonAt: Date = new Date(),
    estimatedValue?: number | null
): Promise<{ success: boolean; message?: string }> {
    const lead = await tx.query.leads.findFirst({
        where: eq(leads.id, leadId),
        columns: { id: true, status: true, estimatedValue: true },
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    if (lead.status !== "Proposal Sent" && lead.status !== "In Negotiation") {
        return { success: false, message: `Cannot move to "Closed Won". Lead must be in "Proposal Sent" or "In Negotiation", currently in "${lead.status}".` };
    }

    await tx.update(leads)
        .set({
            status: "Closed Won",
            stageChangedAt: closedWonAt,
            closedWonAt: closedWonAt,
            ...(estimatedValue !== undefined && estimatedValue !== null ? { estimatedValue } : {}),
            updatedAt: closedWonAt,
        })
        .where(eq(leads.id, leadId));

    await tx.insert(leadActivityLogs).values({
        leadId,
        authorId: null,
        activityType: "System",
        content: "Stage moved to Closed Won on proposal signing",
    });

    return { success: true };
}

/**
 * Stage rule helper: moves a lead to 'Closed Lost' on proposal decline.
 * Only allowed from 'Proposal Sent' or 'In Negotiation'.
 */
export async function moveLeadToClosedLost(
    tx: DbTransaction,
    leadId: string,
    lossReason: "budget_too_low" | "competitor_chosen" | "scope_mismatch" | "timing_ghosted" | "internal_cancellation" | "other",
    lossNotes?: string | null
): Promise<{ success: boolean; message?: string }> {
    const lead = await tx.query.leads.findFirst({
        where: eq(leads.id, leadId),
        columns: { id: true, status: true },
    });

    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    if (lead.status !== "Proposal Sent" && lead.status !== "In Negotiation") {
        return { success: false, message: `Cannot move to "Closed Lost". Lead must be in "Proposal Sent" or "In Negotiation", currently in "${lead.status}".` };
    }

    const now = new Date();
    await tx.update(leads)
        .set({
            status: "Closed Lost",
            stageChangedAt: now,
            lossReason,
            lossNotes: lossNotes || null,
            updatedAt: now,
        })
        .where(eq(leads.id, leadId));

    await tx.insert(leadActivityLogs).values({
        leadId,
        authorId: null,
        activityType: "System",
        content: `Stage moved to Closed Lost: ${lossReason}${lossNotes ? ` - ${lossNotes}` : ""}`,
    });

    return { success: true };
}

