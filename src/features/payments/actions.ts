"use server";

import { db } from "@/db";
import { payments, agencyProjects } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth, hasRole } from "@/auth";
import { validateFileUrlForProject } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { notifyLeadPms, notifyProjectClients } from "@/features/notifications/send";

/**
 * Client uploads payment receipt or transfer proof.
 * Sets status to 'proof_uploaded' and notifies the PM.
 */
export async function uploadPaymentProof(
    paymentId: string,
    proofFileUrl: string
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["client"])) {
        return { success: false, error: "Unauthorized: Clients only." };
    }

    if (!paymentId || !proofFileUrl) {
        return { success: false, error: "Payment ID and proof file URL are required." };
    }

    try {
        let projectId = "";
        let leadId: string | null = null;

        const txResult = await db.transaction(async (tx) => {
            // Row lock on payment
            const [payment] = await tx
                .select()
                .from(payments)
                .where(eq(payments.id, paymentId))
                .for("update");

            if (!payment) {
                return { success: false, error: "Payment not found." };
            }

            projectId = payment.projectId;

            // Verify caller is the client for this project
            const project = await tx.query.agencyProjects.findFirst({
                where: eq(agencyProjects.id, payment.projectId),
                columns: { id: true, leadId: true, isArchived: true },
                with: {
                    lead: { columns: { clientId: true } },
                    stakeholders: { columns: { userId: true } },
                },
            });

            if (!project || project.isArchived) {
                return { success: false, error: "Project not found or archived." };
            }

            leadId = project.leadId;

            const isClientOwner =
                project.lead?.clientId === session.user.id ||
                project.stakeholders.some((s) => s.userId === session.user.id);

            if (!isClientOwner) {
                return { success: false, error: "You are not authorized to upload proof for this project." };
            }

            if (payment.status !== "due") {
                return {
                    success: false,
                    error: `Payment proof can only be uploaded when status is 'due' (current: '${payment.status}').`,
                };
            }

            // Validate file URL does not belong to another project
            const fileValidation = await validateFileUrlForProject(payment.projectId, proofFileUrl);
            if (!fileValidation.ok) {
                return { success: false, error: fileValidation.error };
            }

            await tx
                .update(payments)
                .set({
                    status: "proof_uploaded",
                    proofFileUrl: proofFileUrl.trim(),
                    proofUploadedAt: new Date(),
                    proofRejectedReason: null,
                    updatedAt: new Date(),
                })
                .where(eq(payments.id, paymentId));

            return { success: true };
        });

        if (!txResult.success) {
            return txResult;
        }

        // Post-commit side effects
        try {
            if (leadId) {
                await notifyLeadPms(
                    leadId,
                    `Payment proof uploaded for project. Please review and confirm receipt.`,
                    "payment",
                    `/dashboard/pm/${projectId}/payments`
                );
            }
            await logAction(
                "UPDATE",
                "Payment",
                `Payment proof uploaded for payment ${paymentId} on project ${projectId}`,
                session.user.id,
                projectId
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in uploadPaymentProof:", postCommitErr);
        }

        revalidatePath(`/dashboard/pm/${projectId}/payments`);
        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath(`/portal/projects/${projectId}/payments`);
        revalidatePath(`/portal/projects/${projectId}`);
        revalidatePath("/portal");

        return { success: true, message: "Payment proof uploaded successfully." };
    } catch (error: unknown) {
        console.error("uploadPaymentProof error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to upload payment proof.",
        };
    }
}

/**
 * Manager verifies received funds and confirms payment as 'paid'.
 * Records payment method, reference/cheque details, received date, and OR number.
 */
export async function confirmPayment(
    paymentId: string,
    data: {
        method: "bank_transfer" | "gcash" | "cheque" | "cash";
        referenceNo?: string;
        bankName?: string;
        chequeNumber?: string;
        orNumber: string;
        receivedAt: Date | string;
    }
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["manager"])) {
        return { success: false, error: "Unauthorized: Managers only." };
    }

    if (!paymentId || !data) {
        return { success: false, error: "Payment ID and confirmation details are required." };
    }

    const orNumber = (data.orNumber || "").trim();
    if (!orNumber) {
        return { success: false, error: "Official Receipt (OR) number is required." };
    }

    if (!data.receivedAt) {
        return { success: false, error: "Payment received date is required." };
    }

    const receivedDate = new Date(data.receivedAt);
    if (isNaN(receivedDate.getTime())) {
        return { success: false, error: "Invalid payment received date." };
    }

    // Format and validate reference_no per payment method
    let referenceNo: string | null = null;

    if (data.method === "cash") {
        referenceNo = null;
    } else if (data.method === "cheque") {
        const bank = (data.bankName || "").trim();
        const num = (
            data.chequeNumber ||
            (data.referenceNo && data.referenceNo.includes(" - ") ? data.referenceNo.split(" - ")[1] : data.referenceNo) ||
            ""
        ).trim();

        if (!bank || !num) {
            return {
                success: false,
                error: "Cheque payment requires both bank name and cheque number.",
            };
        }
        referenceNo = `${bank} - ${num}`;
    } else if (data.method === "bank_transfer" || data.method === "gcash") {
        const ref = (data.referenceNo || "").trim();
        if (!ref) {
            return {
                success: false,
                error: `Reference number is required for ${data.method === "gcash" ? "GCash" : "bank transfer"} payments.`,
            };
        }
        referenceNo = ref;
    } else {
        return { success: false, error: "Invalid payment method." };
    }

    try {
        let projectId = "";
        let paymentLabel = "";
        let paymentAmount = 0;
        let paymentCurrency = "";

        const txResult = await db.transaction(async (tx) => {
            // Check unique OR number across all existing payments
            const existingOr = await tx.query.payments.findFirst({
                where: and(ne(payments.id, paymentId), eq(payments.orNumber, orNumber)),
                columns: { id: true },
            });
            if (existingOr) {
                return { success: false, error: `OR number "${orNumber}" is already in use by another payment.` };
            }

            const [payment] = await tx
                .select()
                .from(payments)
                .where(eq(payments.id, paymentId))
                .for("update");

            if (!payment) {
                return { success: false, error: "Payment not found." };
            }

            if (payment.status !== "due" && payment.status !== "proof_uploaded") {
                return {
                    success: false,
                    error: `Payment can only be confirmed from 'due' or 'proof_uploaded' (current: '${payment.status}').`,
                };
            }

            projectId = payment.projectId;
            paymentLabel = payment.label;
            paymentAmount = payment.amount;
            paymentCurrency = payment.currency;

            await tx
                .update(payments)
                .set({
                    status: "paid",
                    method: data.method,
                    referenceNo,
                    receivedAt: receivedDate,
                    orNumber,
                    confirmedBy: session.user.id,
                    confirmedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(payments.id, paymentId));

            return { success: true };
        });

        if (!txResult.success) {
            return txResult;
        }

        // Post-commit side effects
        try {
            await notifyProjectClients(
                projectId,
                `Payment of ${paymentCurrency} ${paymentAmount.toLocaleString()} for "${paymentLabel}" has been confirmed (OR #${orNumber}).`,
                "payment",
                `/portal/projects/${projectId}/payments`
            );
            await logAction(
                "UPDATE",
                "Payment",
                `Payment ${paymentId} confirmed as paid (${data.method}, OR #${orNumber})`,
                session.user.id,
                projectId
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in confirmPayment:", postCommitErr);
        }

        revalidatePath(`/dashboard/pm/${projectId}/payments`);
        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath(`/dashboard/pm/${projectId}/complete`);
        revalidatePath(`/portal/projects/${projectId}/payments`);
        revalidatePath(`/portal/projects/${projectId}`);
        revalidatePath("/portal");

        return { success: true, message: "Payment confirmed successfully." };
    } catch (error: unknown) {
        const errObj = error as { code?: string; cause?: { code?: string } } | null;
        const isUniqueViolation = errObj?.code === "23505" || errObj?.cause?.code === "23505";
        if (isUniqueViolation) {
            return {
                success: false,
                error: `OR number "${orNumber}" is already in use by another payment.`,
            };
        }
        console.error("confirmPayment error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to confirm payment.",
        };
    }
}

/**
 * Manager rejects uploaded proof with a reason.
 * Reverts payment status back to 'due' and clears proof fields.
 */
export async function rejectPaymentProof(
    paymentId: string,
    reason: string
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["manager"])) {
        return { success: false, error: "Unauthorized: Managers only." };
    }

    const trimmedReason = (reason || "").trim();
    if (!trimmedReason || trimmedReason.length < 3) {
        return { success: false, error: "Rejection reason must be at least 3 characters." };
    }

    try {
        let projectId = "";
        let paymentLabel = "";

        const txResult = await db.transaction(async (tx) => {
            const [payment] = await tx
                .select()
                .from(payments)
                .where(eq(payments.id, paymentId))
                .for("update");

            if (!payment) {
                return { success: false, error: "Payment not found." };
            }

            if (payment.status !== "proof_uploaded") {
                return {
                    success: false,
                    error: `Payment proof can only be rejected when status is 'proof_uploaded' (current: '${payment.status}').`,
                };
            }

            projectId = payment.projectId;
            paymentLabel = payment.label;

            // Revert status to due, clear proof fields, save rejection reason. Due date is unchanged.
            await tx
                .update(payments)
                .set({
                    status: "due",
                    proofFileUrl: null,
                    proofUploadedAt: null,
                    proofRejectedReason: trimmedReason,
                    updatedAt: new Date(),
                })
                .where(eq(payments.id, paymentId));

            return { success: true };
        });

        if (!txResult.success) {
            return txResult;
        }

        // Post-commit side effects
        try {
            await notifyProjectClients(
                projectId,
                `Payment proof for "${paymentLabel}" was rejected: ${trimmedReason}. Please upload a new proof.`,
                "payment",
                `/portal/projects/${projectId}/payments`
            );
            await logAction(
                "UPDATE",
                "Payment",
                `Payment proof rejected for payment ${paymentId} (Reason: ${trimmedReason})`,
                session.user.id,
                projectId
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in rejectPaymentProof:", postCommitErr);
        }

        revalidatePath(`/dashboard/pm/${projectId}/payments`);
        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath(`/portal/projects/${projectId}/payments`);
        revalidatePath(`/portal/projects/${projectId}`);
        revalidatePath("/portal");

        return { success: true, message: "Payment proof rejected." };
    } catch (error: unknown) {
        console.error("rejectPaymentProof error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to reject payment proof.",
        };
    }
}

