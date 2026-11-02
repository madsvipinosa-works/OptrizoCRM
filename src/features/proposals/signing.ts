"use server";

import { db } from "@/db";
import { proposals, leads, leadActivityLogs, proposalMessages } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { notifyLeadPms } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";
import { moveLeadToNegotiation } from "@/features/crm/stage-rules";

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

/**
 * 4a. Client requests changes on a proposal.
 * Role: client who owns the lead.
 * Allowed from 'sent' or 'pricing_meeting_requested'.
 * Inserts proposal_message (kind: 'change_request'), updates proposal status to 'changes_requested',
 * and transitions lead from 'Proposal Sent' to 'In Negotiation' via moveLeadToNegotiation.
 * Notifies PM.
 */
export async function requestProposalChanges(
    proposalId: string,
    topics: string[],
    body: string
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
                return { success: false, message: "Forbidden: Only the client owner may request changes" };
            }

            // Must be sent or pricing_meeting_requested
            if (proposal.status !== "sent" && proposal.status !== "pricing_meeting_requested") {
                return {
                    success: false,
                    message: `Cannot request changes. Proposal is currently "${proposal.status}", must be "sent" or "pricing_meeting_requested".`,
                };
            }

            // 1. Insert proposal message
            await tx.insert(proposalMessages).values({
                proposalId,
                authorId: session.user.id,
                kind: "change_request",
                topics,
                body,
            });

            // 2. Proposal status -> changes_requested
            const now = new Date();
            await tx
                .update(proposals)
                .set({
                    status: "changes_requested",
                    updatedAt: now,
                })
                .where(eq(proposals.id, proposalId));

            // 3. Move lead stage to In Negotiation
            const stageRes = await moveLeadToNegotiation(tx, proposal.leadId);
            if (!stageRes.success) {
                throw new Error(stageRes.message || "Failed to move lead to In Negotiation");
            }

            return { success: true, leadId: proposal.leadId, proposalCode: proposal.proposalCode };
        });

        if (!result.success) {
            return result;
        }

        // Post-commit: notifications & audit log
        try {
            await notifyLeadPms(
                result.leadId!,
                `Client requested changes on proposal #${result.proposalCode || ""}`,
                "proposal",
                `/dashboard/proposals/${proposalId}`
            );
            await logAction("UPDATE", "proposal", `Client requested changes on proposal ${proposalId}: ${topics.join(", ")}`);
        } catch (postCommitErr) {
            console.error("Post-commit error in requestProposalChanges:", postCommitErr);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("requestProposalChanges error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to submit change request",
        };
    }
}

/**
 * 4b. Client sends a message to PM in the proposal discussion thread.
 * Changes no status or stage.
 * Role: client who owns the lead.
 */
export async function sendClientMessage(
    proposalId: string,
    body: string
): Promise<{ success: boolean; message?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, proposalId),
            with: { lead: true },
        });

        if (!proposal || !proposal.lead) {
            return { success: false, message: "Proposal not found" };
        }

        if (session.user.role !== "client" || proposal.lead.clientId !== session.user.id) {
            return { success: false, message: "Forbidden: Only the client owner may send messages" };
        }

        await db.insert(proposalMessages).values({
            proposalId,
            authorId: session.user.id,
            kind: "message",
            topics: [],
            body,
        });

        try {
            await notifyLeadPms(
                proposal.leadId,
                `New message from client on proposal #${proposal.proposalCode || ""}`,
                "proposal",
                `/dashboard/proposals/${proposalId}`
            );
            await logAction("CREATE", "proposal_message", `Client message on proposal ${proposalId}`);
        } catch (postCommitErr) {
            console.error("Post-commit error in sendClientMessage:", postCommitErr);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("sendClientMessage error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to send message",
        };
    }
}
