import { db } from "@/db";
import { ProjectHeader } from "@/features/pm/components/ProjectHeader";
import { agencyProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { PmPaymentsTable, PaymentItem } from "@/features/payments/components/PmPaymentsTable";

export const dynamic = "force-dynamic";


// Show money in the payment's own currency (PHP default), never converted.
const money = (amount: number, currency: string) =>
    currency === "USD" ? `$${amount.toLocaleString("en-US")}` : `₱${amount.toLocaleString("en-PH")}`;

export default async function PmPaymentsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect(`/login?callbackUrl=/dashboard/pm/${id}/payments`);
    }

    if (!hasRole(session, ["manager"])) {
        redirect(`/dashboard/pm/${id}`);
    }

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, id),
        with: {
            lead: true,
            payments: {
                with: {
                    scheduleItem: true,
                },
            },
        },
    });

    if (!project) notFound();

    // Sort payments by scheduleItem sortOrder or createdAt
    const sortedPayments = [...project.payments].sort((a, b) => {
        const orderA = a.scheduleItem?.sortOrder ?? 999;
        const orderB = b.scheduleItem?.sortOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const paymentItems: PaymentItem[] = sortedPayments.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        label: p.label,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        dueDate: p.dueDate,
        receivedAt: p.receivedAt,
        method: p.method,
        referenceNo: p.referenceNo,
        proofFileUrl: p.proofFileUrl,
        proofUploadedAt: p.proofUploadedAt,
        orNumber: p.orNumber,
        confirmedAt: p.confirmedAt,
        milestoneTitle: p.scheduleItem?.label || null,
    }));

    const totalAmount = paymentItems.reduce((acc, p) => acc + p.amount, 0);
    const paidAmount = paymentItems
        .filter((p) => p.status === "paid")
        .reduce((acc, p) => acc + p.amount, 0);
    const pendingAmount = totalAmount - paidAmount;
    const currency = paymentItems[0]?.currency || "PHP";

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <ProjectHeader
                projectId={project.id}
                title={project.title}
                businessName={project.lead?.businessName}
                clientName={project.lead?.contactName}
                current="payments"
            />

            {/* Mockup 29b: what came in against the total, and what is left. */}
            <section aria-label="Payment summary" className="rounded-xl border border-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <p className="text-foreground">
                        Received <span className="text-lg font-semibold tabular-nums">{money(paidAmount, currency)}</span>{" "}
                        <span className="text-muted-foreground">of {money(totalAmount, currency)}</span>
                    </p>
                    <p className="tabular-nums text-muted-foreground">{money(pendingAmount, currency)} left</p>
                </div>
                <div
                    role="progressbar"
                    aria-label="Share of the total received"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={totalAmount ? Math.round((paidAmount / totalAmount) * 100) : 0}
                    className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                >
                    <div className="h-full rounded-full bg-brand-deep" style={{ width: `${totalAmount ? (paidAmount / totalAmount) * 100 : 0}%` }} />
                </div>
            </section>

            {/* Payments Table */}
            <PmPaymentsTable payments={paymentItems} projectId={project.id} />
        </div>
    );
}
