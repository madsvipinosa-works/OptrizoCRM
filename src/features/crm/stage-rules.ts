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
): Promise<void> {
    const lead = await tx.query.leads.findFirst({
        where: eq(leads.id, leadId),
        columns: { id: true, status: true, proposalRequestedAt: true },
    });

    if (!lead) {
        throw new Error("Lead not found");
    }

    if (lead.status !== "Discovery & Qualifying") {
        throw new Error(`Cannot move to "Proposal Sent". Lead must be in "Discovery & Qualifying", currently in "${lead.status}".`);
    }

    if (!lead.proposalRequestedAt) {
        throw new Error(`Cannot move to "Proposal Sent". Lead has no proposal requested.`);
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
}

