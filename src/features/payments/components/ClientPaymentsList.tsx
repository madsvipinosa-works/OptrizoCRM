"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { uploadPaymentProof } from "@/features/payments/actions";
import { CheckCircle2, Clock, AlertCircle, ExternalLink, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface ClientPaymentRecord {
    id: string;
    projectId: string;
    label: string;
    amount: number;
    currency: string;
    status: "not_yet_due" | "due" | "proof_uploaded" | "paid";
    dueDate: Date | string | null;
    receivedAt: Date | string | null;
    method: "bank_transfer" | "gcash" | "cheque" | "cash" | null;
    referenceNo: string | null;
    proofFileUrl: string | null;
    proofUploadedAt: Date | string | null;
    orNumber: string | null;
    confirmedAt: Date | string | null;
}

export function ClientPaymentsList({
    payments,
}: {
    payments: ClientPaymentRecord[];
    projectId?: string;
}) {
    const router = useRouter();
    const [selectedPayment, setSelectedPayment] = useState<ClientPaymentRecord | null>(null);
    const [proofFileUrl, setProofFileUrl] = useState("");
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const openUploadModal = (p: ClientPaymentRecord) => {
        setSelectedPayment(p);
        setProofFileUrl("");
        setIsUploadOpen(true);
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayment) return;

        if (!proofFileUrl.trim()) {
            toast.error("Please upload your receipt or deposit slip first.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await uploadPaymentProof(selectedPayment.id, proofFileUrl.trim());
            if (res.success) {
                toast.success(res.message || "Payment proof uploaded successfully.");
                setIsUploadOpen(false);
                setSelectedPayment(null);
                setProofFileUrl("");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to upload payment proof.");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error uploading payment proof");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Payment Stage</th>
                            <th className="px-4 py-3 font-semibold">Amount</th>
                            <th className="px-4 py-3 font-semibold">Due Date</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Receipt / OR #</th>
                            <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                        {payments.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                    No payment schedule found for this project.
                                </td>
                            </tr>
                        ) : (
                            payments.map((p) => {
                                const isOverdue =
                                    p.dueDate &&
                                    p.status !== "paid" &&
                                    new Date(p.dueDate).getTime() < Date.now();

                                return (
                                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="font-medium text-foreground">{p.label}</div>
                                        </td>
                                        <td className="px-4 py-3.5 font-mono font-medium text-foreground">
                                            {p.currency} {p.amount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs">
                                            {p.dueDate ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span>{new Date(p.dueDate).toLocaleDateString()}</span>
                                                    {isOverdue && (
                                                        <span className="text-destructive font-semibold flex items-center gap-0.5">
                                                            <AlertCircle className="w-3 h-3" /> Overdue
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">Triggered upon milestone</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {p.status === "paid" && (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1 w-fit">
                                                    <CheckCircle2 className="w-3 h-3" /> Paid
                                                </Badge>
                                            )}
                                            {p.status === "proof_uploaded" && (
                                                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 flex items-center gap-1 w-fit">
                                                    <Clock className="w-3 h-3" /> Under Review
                                                </Badge>
                                            )}
                                            {p.status === "due" && (
                                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 w-fit">
                                                    <AlertCircle className="w-3 h-3" /> Payment Due
                                                </Badge>
                                            )}
                                            {p.status === "not_yet_due" && (
                                                <Badge variant="outline" className="text-muted-foreground w-fit">
                                                    Scheduled
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs">
                                            {p.status === "paid" ? (
                                                <div className="space-y-0.5">
                                                    <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                                        OR #{p.orNumber}
                                                    </div>
                                                    <div className="text-muted-foreground text-[11px]">
                                                        {p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString() : ""}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                                            {p.proofFileUrl && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                    className="h-8 text-xs text-primary"
                                                >
                                                    <a
                                                        href={p.proofFileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" /> View Proof
                                                    </a>
                                                </Button>
                                            )}
                                            {p.status === "due" && (
                                                <Button
                                                    size="sm"
                                                    className="h-8 text-xs font-semibold"
                                                    onClick={() => openUploadModal(p)}
                                                >
                                                    <UploadCloud className="w-3.5 h-3.5 mr-1" /> Upload Proof
                                                </Button>
                                            )}
                                            {p.status === "proof_uploaded" && (
                                                <span className="text-xs text-muted-foreground italic">
                                                    Awaiting PM verification
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Upload Payment Proof Modal */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Upload Payment Proof</DialogTitle>
                        <DialogDescription>
                            Submit your bank deposit slip, transaction screenshot, or GCash receipt for &quot;{selectedPayment?.label}&quot;.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUploadSubmit} className="space-y-4 py-2">
                        <FileUpload
                            label="Receipt or proof *"
                            value={proofFileUrl}
                            onChange={setProofFileUrl}
                            projectId={selectedPayment?.projectId}
                            accept="image/*,.pdf"
                            hint="Photo or PDF of your receipt (max 15 MB)"
                            showSuccessToast={false}
                        />

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsUploadOpen(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading || !proofFileUrl}>
                                {isLoading ? "Submitting..." : "Submit Proof"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
