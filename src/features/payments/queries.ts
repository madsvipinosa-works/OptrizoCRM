import "server-only";

import { db } from "@/db";
import { payments, agencyProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authorizeProject } from "@/lib/authz";

export interface ClientPaymentDTO {
    id: string;
    label: string;
    percent: number;
    amount: number;
    currency: string;
    status: "not_yet_due" | "due" | "proof_uploaded" | "paid";
    dueDate: Date | null;
    late: boolean;
    becameDueAt: Date | null;
    proofFileUrl: string | null;
    proofUploadedAt: Date | null;
    proofRejectedReason: string | null;
    receivedAt: Date | null;
    method: "bank_transfer" | "gcash" | "cheque" | "cash" | null;
    confirmedAt: Date | null;
}

/**
 * Returns sanitized payments list for client portal view.
 * Enforces ownership check against clientUserId.
 */
export async function getClientPayments(
    projectId: string,
    clientUserId: string
): Promise<{ ok: true; payments: ClientPaymentDTO[]; projectTitle: string } | { ok: false; error: string }> {
    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, projectId),
        columns: { id: true, title: true, isArchived: true, leadId: true },
        with: {
            lead: { columns: { clientId: true } },
            stakeholders: { columns: { userId: true } },
        },
    });

    if (!project || project.isArchived) {
        return { ok: false, error: "Project not found." };
    }

    const isClientOwner =
        project.lead?.clientId === clientUserId ||
        project.stakeholders.some((s) => s.userId === clientUserId);

    if (!isClientOwner) {
        return { ok: false, error: "Unauthorized access to project payments." };
    }

    const paymentRows = await db.query.payments.findMany({
        where: eq(payments.projectId, projectId),
        with: {
            scheduleItem: { columns: { sortOrder: true } },
        },
        orderBy: (p, { asc }) => [asc(p.createdAt)],
    });

    const now = new Date();

    const clientPayments: ClientPaymentDTO[] = paymentRows
        .sort((a, b) => (a.scheduleItem?.sortOrder ?? 0) - (b.scheduleItem?.sortOrder ?? 0))
        .map((p) => ({
            id: p.id,
            label: p.label,
            percent: p.percent,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            dueDate: p.dueDate,
            late: p.status !== "paid" && p.dueDate ? now > new Date(p.dueDate) : false,
            becameDueAt: p.becameDueAt,
            proofFileUrl: p.proofFileUrl,
            proofUploadedAt: p.proofUploadedAt,
            proofRejectedReason: p.proofRejectedReason,
            receivedAt: p.receivedAt,
            method: p.method,
            confirmedAt: p.confirmedAt,
        }));

    return { ok: true, payments: clientPayments, projectTitle: project.title };
}

/**
 * Returns full payment records for PM management table.
 */
export async function getPmPayments(projectId: string) {
    const authResult = await authorizeProject(projectId, "read");
    if (!authResult.ok) {
        return { ok: false, error: "Unauthorized." };
    }

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, projectId),
        columns: { id: true, title: true, status: true },
    });

    if (!project) {
        return { ok: false, error: "Project not found." };
    }

    const paymentRows = await db.query.payments.findMany({
        where: eq(payments.projectId, projectId),
        with: {
            scheduleItem: true,
            confirmedByUser: {
                columns: { id: true, name: true, email: true },
            },
        },
        orderBy: (p, { asc }) => [asc(p.createdAt)],
    });

    const sortedPayments = paymentRows.sort(
        (a, b) => (a.scheduleItem?.sortOrder ?? 0) - (b.scheduleItem?.sortOrder ?? 0)
    );

    return { ok: true, payments: sortedPayments, project };
}
