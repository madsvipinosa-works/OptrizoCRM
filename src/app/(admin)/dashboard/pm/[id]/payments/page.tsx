import { db } from "@/db";
import { agencyProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PmPaymentsTable, PaymentItem } from "@/features/payments/components/PmPaymentsTable";

export const dynamic = "force-dynamic";

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
        <div className="space-y-6 max-w-6xl mx-auto py-2">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/pm/${project.id}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-primary" />
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                Payment Schedule & Billing
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {project.title} • {project.lead?.businessName || project.lead?.contactName || "Client"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl border border-border p-4">
                    <div className="text-xs uppercase font-mono text-muted-foreground">Total Contract Value</div>
                    <div className="text-2xl font-bold font-mono text-foreground mt-1">
                        {currency} {totalAmount.toLocaleString()}
                    </div>
                </div>
                <div className="glass-card rounded-xl border border-border p-4">
                    <div className="text-xs uppercase font-mono text-emerald-600 dark:text-emerald-400">Total Collected</div>
                    <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {currency} {paidAmount.toLocaleString()}
                    </div>
                </div>
                <div className="glass-card rounded-xl border border-border p-4">
                    <div className="text-xs uppercase font-mono text-amber-600 dark:text-amber-400">Outstanding / Pending</div>
                    <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                        {currency} {pendingAmount.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Payments Table */}
            <PmPaymentsTable payments={paymentItems} projectId={project.id} />
        </div>
    );
}
