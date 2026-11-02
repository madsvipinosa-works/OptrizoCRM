"use server";

import { db } from "@/db";
import { proposals, leads, leadActivityLogs } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { notifyLeadPms } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";

/**
 * 1. Client requests a pricing meeting.
 * Role: client who owns the lead.
 * Proposal must be status 'sent', latest non-replaced version, priceMode 'to_be_discussed'.
 * Proposal status moves to 'pricing_meeting_requested'. Lead stays 'Proposal Sent'.
 * Notifies assigned PM / managers with link /dashboard/proposals/[id]?book=pricing.
 */
export async function requestPricingMeeting(
    proposalId: string,
    note?: string
): Promise<{ success: boolean; message?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const result = await db.transaction(async (tx) => {
            // Lock proposal then lead
            const [proposal] = await tx
                .select()
                .from(proposals)
                .where(eq(proposals.id, proposalId))
                .for("update");

            if (!proposal) {
                return { success: false, message: "Proposal not found" };
            }

            const [lead] = await tx
                .select()
                .from(leads)
                .where(eq(leads.id, proposal.leadId))
                .for("update");

            if (!lead) {
                return { success: false, message: "Lead not found" };
            }

            // Client ownership verification
            if (session.user.role !== "client" || lead.clientId !== session.user.id) {
                return { success: false, message: "Forbidden: Only the client owner may request a pricing meeting" };
            }

            // Check proposal preconditions
            if (proposal.status !== "sent") {
                return { success: false, message: `Cannot request pricing meeting. Proposal is "${proposal.status}", must be "sent".` };
            }

            if (proposal.priceMode !== "to_be_discussed") {
                return { success: false, message: "Pricing meeting can only be requested for proposals with price to be discussed." };
            }

            // Check if newer version exists
            const newer = await tx.query.proposals.findFirst({
                where: and(
                    eq(proposals.leadId, proposal.leadId),
                    gt(proposals.version, proposal.version)
                ),
            });
            if (newer) {
                return { success: false, message: "A newer revision of this proposal exists." };
            }

            const now = new Date();
            await tx
                .update(proposals)
                .set({
                    status: "pricing_meeting_requested",
                    updatedAt: now,
                })
                .where(eq(proposals.id, proposalId));

            await tx.insert(leadActivityLogs).values({
                leadId: proposal.leadId,
                authorId: session.user.id,
                activityType: "System",
                content: `Client requested pricing meeting${note ? `: ${note}` : ""}`,
            });

            return { success: true, leadId: proposal.leadId };
        });

        if (!result.success) {
            return result;
        }

        // Notifications & Audit log post-commit
        try {
            await notifyLeadPms(
                result.leadId!,
                "Client requested a pricing meeting for proposal",
                "proposal",
                `/dashboard/proposals/${proposalId}?book=pricing`
            );
            await logAction("UPDATE", "proposal", `Requested pricing meeting for proposal ${proposalId}`);
        } catch (postCommitErr) {
            console.error("Post-commit error in requestPricingMeeting:", postCommitErr);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("requestPricingMeeting error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to request pricing meeting",
        };
    }
}
