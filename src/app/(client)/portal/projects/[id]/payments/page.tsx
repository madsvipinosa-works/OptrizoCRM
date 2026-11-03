import { auth, hasRole } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getClientProject } from "@/features/client-portal/queries";
import Link from "next/link";
import { CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientPaymentsList, ClientPaymentRecord } from "@/features/payments/components/ClientPaymentsList";

export const dynamic = "force-dynamic";

export default async function ClientProjectPaymentsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect(`/login?callbackUrl=/portal/projects/${id}/payments`);
    }

    if (!hasRole(session, ["client"])) {
        redirect("/dashboard");
    }

    const project = await getClientProject(id, session.user.id);
    if (!project) notFound();

    const paymentRecords: ClientPaymentRecord[] = project.payments.map((p) => ({
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
    }));

    const totalAmount = paymentRecords.reduce((acc, p) => acc + p.amount, 0);
    const paidAmount = paymentRecords
        .filter((p) => p.status === "paid")
        .reduce((acc, p) => acc + p.amount, 0);
    const pendingAmount = totalAmount - paidAmount;
    const currency = paymentRecords[0]?.currency || "PHP";

    return (
        <div className="space-y-6 max-w-5xl mx-auto py-2 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/portal/projects/${project.id}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Payments & Billing
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {project.title} • Milestone Payment Schedule
                    </p>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl border border-border p-4">
                    <div className="text-xs uppercase font-mono text-muted-foreground">Contract Total</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-1">
                        {currency} {totalAmount.toLocaleString()}
                    </div>
                </div>
                <div className="glass-card rounded-xl border border-border p-4">
                    <div className="text-xs uppercase font-mono text-emerald-600 dark:text-emerald-400">Total Paid</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {currency} {paidAmount.toLocaleString()}
                    </div>
                </div>
                <div className="glass-card rounded-xl border border-border p-4">
                    <div className="text-xs uppercase font-mono text-amber-600 dark:text-amber-400">Balance Remaining</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                        {currency} {pendingAmount.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Payments List Table */}
            <ClientPaymentsList payments={paymentRecords} projectId={project.id} />
        </div>
    );
}
