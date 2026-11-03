import "server-only";

import { db } from "@/db";
import { proposals, leads, payments } from "@/db/schema";
import { eq, and, gt, ne, sql } from "drizzle-orm";
import { notifyLeadPms, notifyLeadSales, notifyProjectClients } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";
import { moveLeadToClosedWon } from "@/features/crm/stage-rules";
import { provisionProjectFromProposal } from "@/features/crm/provisionLeadProject";
import { isProposalExpired } from "@/features/proposals/utils/expiry";
import { sendSignedProposalEmail, sendPaymentDueEmail } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export interface ProposalSignatureParams {
    proposalId: string;
    signerName: string;
    signatureType: "online" | "paper";
    signatureData?: string;
    signerIp?: string | null;
    signedFileUrl?: string | null;
    signedAt?: Date;
    agreedToTerms?: boolean;
    actorRole: "client" | "manager";
    userId: string;
    userEmail?: string | null;
}

/**
 * Shared transaction engine for online client digital signature and PM paper signature recording.
 * Enforces:
 * - Pre-transaction checks: proposal status sent, priceMode priced with totalPrice > 0, unexpired, ownership.
 * - Ownership check: requires userEmail to be non-empty before comparing emails (prevents null === null matches).
 * - Inside transaction: uses the LOCKED proposal row for status, priceMode, totalPrice and validUntil.
 * - Repeats higher non-draft version check inside transaction using tx after locking.
 * - Single ACID transaction locks proposal then lead with FOR UPDATE.
 * - Proposal status -> 'signed', records signer metadata.
 * - Lead status -> 'Closed Won' via moveLeadToClosedWon using locked totalPrice.
 * - Project provisioned with 5 milestones and payment schedule rows via provisionProjectFromProposal.
 * - Post-commit non-blocking notifications & email.
 */
export async function executeProposalSignature(
    params: ProposalSignatureParams
): Promise<{ success: boolean; message?: string; projectId?: string }> {
    const {
        proposalId,
        signerName,
        signatureType,
        signatureData,
        signerIp,
        signedFileUrl,
        signedAt = new Date(),
        agreedToTerms,
        actorRole,
        userId,
        userEmail,
    } = params;

    // 1. Basic Validation
    if (!signerName?.trim()) {
        return { success: false, message: "Signer name is required" };
    }

    if (signatureType === "online") {
        if (!agreedToTerms) {
            return { success: false, message: "You must agree to the terms and conditions before signing" };
        }
        if (!signatureData?.trim()) {
            return { success: false, message: "Signature representation is required" };
        }
    } else if (signatureType === "paper") {
        if (!signedFileUrl?.trim()) {
            return { success: false, message: "Uploaded agreement document URL is required for paper signatures" };
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
    // Strict ownership: require userEmail to be non-empty before comparing emails (no null === null)
    if (actorRole === "client") {
        const trimmedEmail = userEmail?.trim();
        const hasValidUserEmail = Boolean(trimmedEmail && trimmedEmail.length > 0);
        const clientEmail = lead.client?.email?.trim();
        const contactEmail = lead.contactEmail?.trim();
        const isOwner =
            (Boolean(userId) && userId === lead.clientId) ||
            (hasValidUserEmail && Boolean(clientEmail) && trimmedEmail === clientEmail) ||
            (hasValidUserEmail && Boolean(contactEmail) && trimmedEmail === contactEmail);

        if (!isOwner) {
            return { success: false, message: "Forbidden: Only the client owner can execute this proposal" };
        }
    }

    // 4. Precondition checks (pre-flight before opening transaction)
    if (proposal.status !== "sent") {
        return {
            success: false,
            message: `Proposal cannot be signed. It is in status "${proposal.status}" (must be "sent").`,
        };
    }

    const preTotalPrice = Number(proposal.totalPrice ?? proposal.total ?? 0);
    if (proposal.priceMode !== "priced" || preTotalPrice <= 0) {
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

            // 1. Inside transaction: use the LOCKED proposal row for status, priceMode, totalPrice and validUntil
            if (lockedProposal.status !== "sent") {
                return {
                    success: false,
                    message: `Proposal status changed to "${lockedProposal.status}". Only "sent" proposals can be signed.`,
                };
            }

            const lockedTotalPrice = Number(lockedProposal.totalPrice ?? lockedProposal.total ?? 0);
            if (lockedProposal.priceMode !== "priced" || lockedTotalPrice <= 0) {
                return {
                    success: false,
                    message: "Proposal cannot be signed without a confirmed price and investment breakdown.",
                };
            }

            if (isProposalExpired(lockedProposal.validUntil)) {
                return { success: false, message: "Proposal has expired." };
            }

            // 2. Repeat the "newer non-draft version exists" check inside the transaction (using tx) after locking
            const higherVersionTx = await tx.query.proposals.findFirst({
                where: and(
                    eq(proposals.leadId, lead.id),
                    gt(proposals.version, lockedProposal.version),
                    ne(proposals.status, "draft")
                ),
            });
            if (higherVersionTx) {
                return {
                    success: false,
                    message: "A newer revision of this proposal exists. Please review the latest version.",
                };
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

            // Move lead to Closed Won using locked proposal price
            const wonRes = await moveLeadToClosedWon(tx, lockedLead.id, signedAt, lockedTotalPrice);
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

            // On-signing payment notification & email
            if (provisionedProjectId) {
                const onSigningPayment = await db.query.payments.findFirst({
                    where: and(eq(payments.projectId, provisionedProjectId), eq(payments.status, "due")),
                });
                if (onSigningPayment) {
                    await notifyProjectClients(
                        provisionedProjectId,
                        `Payment of ${onSigningPayment.currency} ${(onSigningPayment.amount / 100).toLocaleString()} is now due upon contract signing.`,
                        "payment",
                        `/portal/projects/${provisionedProjectId}/payments`
                    );
                    if (clientEmail) {
                        await sendPaymentDueEmail({
                            clientEmail,
                            clientName: signerName.trim(),
                            projectTitle: lead.businessName || code || "Your Project",
                            amount: (onSigningPayment.amount / 100).toLocaleString(),
                            currency: onSigningPayment.currency,
                            dueDate: onSigningPayment.dueDate,
                            paymentsUrl: `${process.env.NEXTAUTH_URL || ""}/portal/projects/${provisionedProjectId}/payments`,
                        });
                    }
                }
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
