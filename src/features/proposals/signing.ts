"use server";

import { db } from "@/db";
import { proposals, leads, leadActivityLogs, proposalMessages } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { requireRole } from "@/lib/authz";
import { notifyLeadPms, notifyLeadClient, notifyLeadSales } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";
import { moveLeadToNegotiation } from "@/features/crm/stage-rules";
import { executeProposalSignature } from "@/features/proposals/signing-core";
import { loadProposalNoticeInfo } from "@/features/proposals/notice";
import { headers } from "next/headers";
import { formatDate } from "@/lib/datetime";

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
            const info = await loadProposalNoticeInfo(proposalId);
            await notifyLeadPms(
                result.leadId!,
                `${info.clientName} (${info.businessName}) asked for a pricing meeting about ${info.projectName}. Open the proposal to book it.`,
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

const ALLOWED_CHANGE_TOPICS = new Set(["price", "timeline", "scope", "other"]);

/**
 * 4a. Client requests changes on a proposal.
 * Role: client who owns the lead.
 * Allowed from 'sent' or 'pricing_meeting_requested'.
 * Inserts proposal_message (kind: 'change_request'), updates proposal status to 'changes_requested',
 * and transitions lead from 'Proposal Sent' to 'In Negotiation' via moveLeadToNegotiation.
 * Accepts only topics from price, timeline, scope, other (drop anything else).
 * At least one valid topic or non-empty body required; capped at 2000 chars.
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

    // Accepts only topics from price, timeline, scope, other (drop anything else)
    const validTopics = Array.isArray(topics)
        ? topics.filter((t): t is string => typeof t === "string" && ALLOWED_CHANGE_TOPICS.has(t.trim().toLowerCase()))
        : [];

    // Trim and cap body text at 2000 characters
    const trimmedBody = (typeof body === "string" ? body.trim() : "").slice(0, 2000);

    // At least one valid topic or a non-empty body required
    if (validTopics.length === 0 && !trimmedBody) {
        return {
            success: false,
            message: "Please select at least one topic (price, timeline, scope, other) or provide details for your change request",
        };
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
                topics: validTopics,
                body: trimmedBody,
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
            const info = await loadProposalNoticeInfo(proposalId);
            await notifyLeadPms(
                result.leadId!,
                `${info.clientName} (${info.businessName}) asked for changes to ${info.projectName}: ${validTopics.join(", ")}. Open the proposal to read the request and reply.`,
                "proposal",
                `/dashboard/proposals/${proposalId}`
            );
            await logAction("UPDATE", "proposal", `Client requested changes on proposal ${proposalId}: ${validTopics.join(", ")}`);
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

    const trimmedBody = (typeof body === "string" ? body.trim() : "").slice(0, 2000);
    if (!trimmedBody) {
        return { success: false, message: "Message text cannot be empty" };
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
            body: trimmedBody,
        });

        try {
            const info = await loadProposalNoticeInfo(proposalId);
            await notifyLeadPms(
                proposal.leadId,
                `${info.clientName} (${info.businessName}) sent a message about ${info.projectName}. Open the proposal to reply.`,
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

/**
 * 4c. Project Manager replies to client in the proposal discussion thread.
 * Role: manager.
 * Notifies the client.
 */
export async function replyToClient(
    proposalId: string,
    body: string
): Promise<{ success: boolean; message?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can reply to client messages" };
    }

    const trimmedBody = (typeof body === "string" ? body.trim() : "").slice(0, 2000);
    if (!trimmedBody) {
        return { success: false, message: "Reply text cannot be empty" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, proposalId),
            with: { lead: true },
        });

        if (!proposal || !proposal.leadId) {
            return { success: false, message: "Proposal not found" };
        }

        await db.insert(proposalMessages).values({
            proposalId,
            authorId: authz.session.user.id,
            kind: "reply",
            topics: [],
            body: trimmedBody,
        });

        try {
            const info = await loadProposalNoticeInfo(proposalId);
            await notifyLeadClient(
                proposal.leadId,
                `${authz.session.user.name || info.pmName || "Your Project Manager"} replied about your proposal for ${info.projectName}. Open the proposal to read the reply.`,
                "proposal",
                `/proposal/${proposalId}`
            );
            await logAction("CREATE", "proposal_message", `PM reply on proposal ${proposalId}`);
        } catch (postCommitErr) {
            console.error("Post-commit error in replyToClient:", postCommitErr);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("replyToClient error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to send reply",
        };
    }
}

/**
 * 4d. Project Manager logs an outside discussion (call, email, in_person).
 * Role: manager.
 * Inserts into proposal_message (outside_discussion) AND lead_activity_log (outside_discussion).
 * Notifies the lead's sales rep(s) (or all sales if unassigned).
 */
export async function logOutsideDiscussion(
    proposalId: string,
    type: "call" | "email" | "in_person",
    heldAt: string | Date,
    summary: string
): Promise<{ success: boolean; message?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can log outside discussions" };
    }

    const trimmedSummary = (typeof summary === "string" ? summary.trim() : "").slice(0, 2000);
    if (!trimmedSummary) {
        return { success: false, message: "Discussion summary cannot be empty" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, proposalId),
            with: { lead: true },
        });

        if (!proposal || !proposal.leadId) {
            return { success: false, message: "Proposal not found" };
        }

        const heldAtDate = new Date(heldAt);
        if (isNaN(heldAtDate.getTime())) {
            return { success: false, message: "Invalid discussion date" };
        }

        await db.transaction(async (tx) => {
            await tx.insert(proposalMessages).values({
                proposalId,
                authorId: authz.session.user.id,
                kind: "outside_discussion",
                outsideType: type,
                heldAt: heldAtDate,
                topics: [],
                body: trimmedSummary,
            });

            await tx.insert(leadActivityLogs).values({
                leadId: proposal.leadId,
                authorId: authz.session.user.id,
                activityType: "outside_discussion",
                content: `Outside discussion logged (${type} on ${formatDate(heldAtDate)}): ${trimmedSummary}`,
            });
        });

        try {
            const info = await loadProposalNoticeInfo(proposalId);
            await notifyLeadSales(
                proposal.leadId,
                `${authz.session.user.name || info.pmName || "The Project Manager"} logged an outside discussion with ${info.clientName} (${info.businessName}) about ${info.projectName}. It is copied into the lead's activity log.`,
                "proposal",
                `/dashboard/proposals/${proposalId}`
            );
            await logAction("CREATE", "outside_discussion", `Logged outside discussion for proposal ${proposalId}`);
        } catch (postCommitErr) {
            console.error("Post-commit error in logOutsideDiscussion:", postCommitErr);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("logOutsideDiscussion error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to log outside discussion",
        };
    }
}


/**
 * 6. Client executes digital acceptance and signing for a proposal.
 * Role: client who owns the lead.
 * Preconditions: status sent, latest non-replaced version, priceMode priced with total > 0, unexpired, terms agreed.
 */
export async function signProposal(
    proposalId: string,
    signerName: string,
    signatureData: string,
    agreedToTerms: boolean
): Promise<{ success: boolean; message?: string; projectId?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized: Please sign in to execute this proposal" };
    }

    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const signerIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    return await executeProposalSignature({
        proposalId,
        signerName,
        signatureType: "online",
        signatureData,
        signerIp,
        agreedToTerms,
        actorRole: "client",
        userId: session.user.id,
        userEmail: session.user.email,
    });
}

/**
 * PM uploads a signed paper agreement and marks the proposal signed.
 * Role: manager.
 * Must call requireRole(["manager"]) first.
 * Validates signedAt is a valid date and not in the future.
 */
export async function recordPaperSignature(
    proposalId: string,
    signedFileUrl: string,
    signedAtDate?: Date | string
): Promise<{ success: boolean; message?: string; projectId?: string }> {
    // 1. Must call requireRole(["manager"]) first
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only Project Managers can record paper signatures" };
    }

    // 2. Validate signedAt is a valid date and not in the future
    if (!signedAtDate) {
        return { success: false, message: "Signature date is required" };
    }
    const date = new Date(signedAtDate);
    if (isNaN(date.getTime())) {
        return { success: false, message: "Invalid signature date" };
    }
    if (date.getTime() > Date.now()) {
        return { success: false, message: "Signature date cannot be in the future" };
    }

    const { session } = authz;

    return await executeProposalSignature({
        proposalId,
        signerName: "Client (Paper Signature)",
        signatureType: "paper",
        signedFileUrl,
        signedAt: date,
        actorRole: "manager",
        userId: session.user.id,
        userEmail: session.user.email,
    });
}
