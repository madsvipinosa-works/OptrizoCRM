"use server";

import { db } from "@/db";
import { proposals, leads, leadActivityLogs, proposalMessages } from "@/db/schema";
import { eq, and, gt, ne, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { requireRole } from "@/lib/authz";
import { notifyLeadPms, notifyLeadClient, notifyLeadSales } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";
import { moveLeadToNegotiation, moveLeadToClosedWon } from "@/features/crm/stage-rules";
import { provisionProjectFromProposal } from "@/features/crm/provisionLeadProject";
import { isProposalExpired } from "@/features/proposals/utils/expiry";
import { sendSignedProposalEmail } from "@/lib/notifications";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

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
            body,
        });

        try {
            await notifyLeadClient(
                proposal.leadId,
                `Project Manager replied on proposal #${proposal.proposalCode || ""}`,
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
                body: summary,
            });

            await tx.insert(leadActivityLogs).values({
                leadId: proposal.leadId,
                authorId: authz.session.user.id,
                activityType: "outside_discussion",
                content: `Outside discussion logged (${type} on ${heldAtDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}): ${summary}`,
            });
        });

        try {
            await notifyLeadSales(
                proposal.leadId,
                `Outside discussion logged by PM on proposal #${proposal.proposalCode || ""}`,
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
 * Retrieves the negotiation message thread for a proposal.
 */
export async function getProposalMessages(proposalId: string) {
    const session = await auth();
    if (!session?.user?.id) return [];

    return await db.query.proposalMessages.findMany({
        where: eq(proposalMessages.proposalId, proposalId),
        orderBy: (m, { asc }) => [asc(m.createdAt)],
        with: {
            author: {
                columns: { id: true, name: true, role: true, email: true },
            },
        },
    });
}

export interface ProposalSignatureParams {
    proposalId: string;
    signerName: string;
    signatureType: "online" | "paper";
    signatureData?: string | null;
    signedFileUrl?: string | null;
    signedAt?: Date;
    signerIp?: string | null;
    agreedToTerms?: boolean;
    actorRole: "client" | "manager";
    userId: string;
    userEmail?: string | null;
}

/**
 * Shared internal execution engine for both online digital signatures and PM paper uploads.
 * Executes:
 * 1. Strict validation (role, ownership, terms, valid status, priceMode priced, !isProposalExpired).
 * 2. ACID Transaction:
 *    - pg_advisory_xact_lock(hashtext(leadId))
 *    - locks proposal and lead (.for('update'))
 *    - updates proposal status to 'signed' with signature metadata
 *    - moves lead to 'Closed Won' via moveLeadToClosedWon
 *    - provisions agency_project with 5 milestones and payment rows via provisionProjectFromProposal
 * 3. Post-commit:
 *    - notify PMs and Sales
 *    - sends signed copy PDF link email to client
 */
export async function executeProposalSignature(
    params: ProposalSignatureParams
): Promise<{ success: boolean; message?: string; projectId?: string }> {
    const {
        proposalId,
        signerName,
        signatureType,
        signatureData,
        signedFileUrl,
        signedAt = new Date(),
        signerIp = null,
        agreedToTerms,
        actorRole,
        userId,
        userEmail,
    } = params;

    // 1. Parameter Validation
    if (!signerName || !signerName.trim()) {
        return { success: false, message: "Signer name is required" };
    }

    if (signatureType === "online") {
        if (!agreedToTerms) {
            return { success: false, message: "You must agree to the terms and conditions to sign" };
        }
        if (!signatureData || !signatureData.trim()) {
            return { success: false, message: "Signature is required" };
        }
    } else if (signatureType === "paper") {
        if (!signedFileUrl || !signedFileUrl.trim()) {
            return { success: false, message: "Signed document file URL is required for paper signatures" };
        }
    }

    // 2. Fetch proposal with lead and relations
    const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId),
        with: {
            milestones: true,
            paymentScheduleItems: true,
            lead: {
                with: {
                    client: true,
                    assignees: true,
                },
            },
        },
    });

    if (!proposal) {
        return { success: false, message: "Proposal not found" };
    }

    const lead = proposal.lead;
    if (!lead) {
        return { success: false, message: "Proposal has no associated lead" };
    }

    // 3. Authorization check
    if (actorRole === "client") {
        const isOwner =
            userId === lead.clientId ||
            userEmail === lead.client?.email ||
            userEmail === lead.contactEmail;
        if (!isOwner) {
            return { success: false, message: "Forbidden: Only the client owner can execute this proposal" };
        }
    }

    // 4. Precondition checks
    if (proposal.status !== "sent") {
        return {
            success: false,
            message: `Proposal cannot be signed. It is in status "${proposal.status}" (must be "sent").`,
        };
    }

    const totalPrice = Number(proposal.totalPrice ?? proposal.total ?? 0);
    if (proposal.priceMode !== "priced" || totalPrice <= 0) {
        return {
            success: false,
            message: "Proposal cannot be signed without a confirmed price and investment breakdown.",
        };
    }

    if (isProposalExpired(proposal.validUntil)) {
        return {
            success: false,
            message: "Proposal has expired. Please contact your Project Manager for an updated proposal.",
        };
    }

    const higherVersion = await db.query.proposals.findFirst({
        where: and(
            eq(proposals.leadId, lead.id),
            gt(proposals.version, proposal.version),
            ne(proposals.status, "draft")
        ),
    });
    if (higherVersion) {
        return { success: false, message: "A newer revision of this proposal exists. Please review the latest version." };
    }

    let provisionedProjectId: string | undefined;

    try {
        const txResult = await db.transaction(async (tx) => {
            // Advisory lock on lead to prevent race conditions
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lead.id}))`);

            // Lock proposal
            const [lockedProposal] = await tx
                .select()
                .from(proposals)
                .where(eq(proposals.id, proposalId))
                .for("update");

            if (!lockedProposal) {
                return { success: false, message: "Proposal not found during transaction" };
            }

            if (lockedProposal.status !== "sent") {
                return {
                    success: false,
                    message: `Proposal status changed to "${lockedProposal.status}". Only "sent" proposals can be signed.`,
                };
            }

            if (isProposalExpired(lockedProposal.validUntil)) {
                return { success: false, message: "Proposal has expired." };
            }

            // Lock lead
            const [lockedLead] = await tx
                .select()
                .from(leads)
                .where(eq(leads.id, lead.id))
                .for("update");

            if (!lockedLead) {
                return { success: false, message: "Lead not found during transaction" };
            }

            if (lockedLead.status === "Closed Won") {
                return { success: false, message: "Lead is already Closed Won." };
            }

            // Update proposal record
            await tx
                .update(proposals)
                .set({
                    status: "signed",
                    signerName: signerName.trim(),
                    signedAt,
                    signerIp: signatureType === "online" ? signerIp : null,
                    signatureType,
                    signatureData: signatureType === "online" ? signatureData?.trim() : null,
                    signedFileUrl: signatureType === "paper" ? signedFileUrl?.trim() : null,
                    acceptedByName: signerName.trim(),
                    acceptedAt: signedAt,
                    updatedAt: new Date(),
                })
                .where(eq(proposals.id, proposalId));

            // Move lead to Closed Won
            const wonRes = await moveLeadToClosedWon(tx, lockedLead.id, signedAt, totalPrice);
            if (!wonRes.success) {
                throw new Error(wonRes.message || "Failed to move lead to Closed Won");
            }

            // Provision project, 5 default milestones and payment schedule rows
            const provisionRes = await provisionProjectFromProposal(tx, {
                ...lockedProposal,
                milestones: proposal.milestones,
                paymentScheduleItems: proposal.paymentScheduleItems,
            });

            provisionedProjectId = provisionRes.project?.id;
            return { success: true };
        });

        if (!txResult.success) {
            return txResult;
        }

        // Post-commit side effects: notifications and email link
        try {
            const code = proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`;
            const link = `/dashboard/proposals/${proposalId}`;
            const clientMsg = `Client ${signerName.trim()} has executed proposal ${code}. Delivery project initialized.`;
            const salesMsg = `Proposal ${code} for lead "${lead.businessName || lead.contactName}" is Closed Won (${signatureType} signature).`;

            await notifyLeadPms(lead.id, clientMsg, "proposal", link);
            await notifyLeadSales(lead.id, salesMsg, "proposal", link);

            const clientEmail = lead.client?.email || lead.contactEmail;
            if (clientEmail) {
                await sendSignedProposalEmail({
                    clientEmail,
                    clientName: signerName.trim(),
                    proposalCode: code,
                    pdfUrl: `${process.env.NEXTAUTH_URL || ""}/api/proposals/${proposalId}/pdf`,
                });
            }

            await logAction(
                "UPDATE",
                "proposal",
                `Proposal ${proposalId} signed (${signatureType}) by ${signerName.trim()}`
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in executeProposalSignature:", postCommitErr);
        }

        revalidatePath(`/proposal/${proposalId}`);
        revalidatePath(`/dashboard/proposals/${proposalId}`);
        revalidatePath(`/dashboard/leads/${lead.id}`);

        return {
            success: true,
            message: "Proposal signed successfully. Delivery project initialized!",
            projectId: provisionedProjectId,
        };
    } catch (error: unknown) {
        console.error("executeProposalSignature transaction error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to sign proposal",
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
 * Same transactional engine, Closed Won transition, and delivery project provisioning.
 */
export async function recordPaperSignature(
    proposalId: string,
    signedFileUrl: string,
    signedAtDate?: Date | string
): Promise<{ success: boolean; message?: string; projectId?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only Project Managers can record paper signatures" };
    }

    const { session } = authz;
    const date = signedAtDate ? new Date(signedAtDate) : new Date();

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
