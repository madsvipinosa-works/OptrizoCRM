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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { confirmPayment, rejectPaymentProof } from "@/features/payments/actions";
import { CheckCircle2, Clock, FileText, AlertCircle, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface PaymentItem {
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
    milestoneTitle?: string | null;
}

interface PmPaymentsTableProps {
    payments: PaymentItem[];
    projectId: string;
}

export function PmPaymentsTable({ payments }: PmPaymentsTableProps) {
    const router = useRouter();
    const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Confirm dialog form state
    const [method, setMethod] = useState<"bank_transfer" | "gcash" | "cheque" | "cash">("bank_transfer");
    const [referenceNo, setReferenceNo] = useState("");
    const [bankName, setBankName] = useState("");
    const [chequeNumber, setChequeNumber] = useState("");
    const [orNumber, setOrNumber] = useState("");
    const [receivedAt, setReceivedAt] = useState<string>(() => new Date().toISOString().split("T")[0]);

    // Reject dialog form state
    const [rejectReason, setRejectReason] = useState("");

    const openConfirmModal = (p: PaymentItem) => {
        setSelectedPayment(p);
        setMethod("bank_transfer");
        setReferenceNo("");
        setBankName("");
        setChequeNumber("");
        setOrNumber("");
        setReceivedAt(new Date().toISOString().split("T")[0]);
        setIsConfirmOpen(true);
    };

    const openRejectModal = (p: PaymentItem) => {
        setSelectedPayment(p);
        setRejectReason("");
        setIsRejectOpen(true);
    };

    const handleConfirmSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayment) return;

        if (!orNumber.trim()) {
            toast.error("Official Receipt (OR) number is required.");
            return;
        }

        if (method === "cheque" && (!bankName.trim() || !chequeNumber.trim())) {
            toast.error("Both bank name and cheque number are required for cheque payments.");
            return;
        }

        if ((method === "bank_transfer" || method === "gcash") && !referenceNo.trim()) {
            toast.error(`Reference number is required for ${method === "gcash" ? "GCash" : "bank transfer"} payments.`);
            return;
        }

        setIsLoading(true);
        try {
            const res = await confirmPayment(selectedPayment.id, {
                method,
                referenceNo: referenceNo.trim() || undefined,
                bankName: bankName.trim() || undefined,
                chequeNumber: chequeNumber.trim() || undefined,
                orNumber: orNumber.trim(),
                receivedAt: new Date(receivedAt),
            });

            if (res.success) {
                toast.success(res.message || "Payment confirmed successfully.");
                setIsConfirmOpen(false);
                setSelectedPayment(null);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to confirm payment.");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error confirming payment");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayment) return;

        if (!rejectReason.trim() || rejectReason.trim().length < 3) {
            toast.error("Rejection reason must be at least 3 characters.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await rejectPaymentProof(selectedPayment.id, rejectReason.trim());
            if (res.success) {
                toast.success(res.message || "Proof rejected and payment reverted to due.");
                setIsRejectOpen(false);
                setSelectedPayment(null);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to reject proof.");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error rejecting payment proof");
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
                            <th className="px-4 py-3 font-semibold">Payment / Milestone</th>
                            <th className="px-4 py-3 font-semibold">Amount</th>
                            <th className="px-4 py-3 font-semibold">Due Date</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Reference / OR #</th>
                            <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                        {payments.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                    No payment schedule records found for this project.
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
                                            {p.milestoneTitle && (
                                                <div className="text-xs text-muted-foreground">
                                                    Milestone: {p.milestoneTitle}
                                                </div>
                                            )}
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
                                                <span className="text-muted-foreground">Pending trigger</span>
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
                                                    <FileText className="w-3 h-3" /> Proof Uploaded
                                                </Badge>
                                            )}
                                            {p.status === "due" && (
                                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 w-fit">
                                                    <Clock className="w-3 h-3" /> Due
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
                                                    <div className="font-mono font-semibold text-foreground">
                                                        OR #{p.orNumber}
                                                    </div>
                                                    <div className="text-muted-foreground capitalize">
                                                        {p.method?.replace("_", " ")}
                                                        {p.referenceNo ? ` (${p.referenceNo})` : ""}
                                                    </div>
                                                </div>
                                            ) : p.referenceNo ? (
                                                <span className="text-muted-foreground font-mono">{p.referenceNo}</span>
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
                                                        <ExternalLink className="w-3.5 h-3.5" /> Proof
                                                    </a>
                                                </Button>
                                            )}
                                            {p.status === "proof_uploaded" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
                                                    onClick={() => openRejectModal(p)}
                                                >
                                                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                                </Button>
                                            )}
                                            {(p.status === "due" || p.status === "proof_uploaded") && (
                                                <Button
                                                    size="sm"
                                                    className="h-8 text-xs font-semibold"
                                                    onClick={() => openConfirmModal(p)}
                                                >
                                                    Confirm Payment
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Confirm Payment Modal */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm Payment Receipt</DialogTitle>
                        <DialogDescription>
                            Record verified payment details and official receipt number for &quot;{selectedPayment?.label}&quot;.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConfirmSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="method">Payment Method</Label>
                            <Select
                                value={method}
                                onValueChange={(val) => setMethod(val as typeof method)}
                            >
                                <SelectTrigger id="method">
                                    <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="gcash">GCash</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="cash">Cash</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {method === "cheque" ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="bankName">Bank Name *</Label>
                                    <Input
                                        id="bankName"
                                        placeholder="e.g. BDO, BPI"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="chequeNumber">Cheque Number *</Label>
                                    <Input
                                        id="chequeNumber"
                                        placeholder="e.g. 00012345"
                                        value={chequeNumber}
                                        onChange={(e) => setChequeNumber(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        ) : method === "bank_transfer" || method === "gcash" ? (
                            <div className="space-y-1.5">
                                <Label htmlFor="referenceNo">Transaction Reference No. *</Label>
                                <Input
                                    id="referenceNo"
                                    placeholder="e.g. REF-987654321"
                                    value={referenceNo}
                                    onChange={(e) => setReferenceNo(e.target.value)}
                                    required
                                />
                            </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="orNumber">Official Receipt (OR) # *</Label>
                                <Input
                                    id="orNumber"
                                    placeholder="OR-00100"
                                    value={orNumber}
                                    onChange={(e) => setOrNumber(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="receivedAt">Date Received *</Label>
                                <Input
                                    id="receivedAt"
                                    type="date"
                                    value={receivedAt}
                                    onChange={(e) => setReceivedAt(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsConfirmOpen(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Confirming..." : "Confirm & Issue Receipt"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Reject Proof Modal */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reject Payment Proof</DialogTitle>
                        <DialogDescription>
                            Specify the reason why this payment proof was rejected. The client will be notified.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRejectSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="rejectReason">Rejection Reason *</Label>
                            <Textarea
                                id="rejectReason"
                                placeholder="e.g. Image unreadable, transaction reference does not match statement..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={3}
                                required
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsRejectOpen(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" variant="destructive" disabled={isLoading}>
                                {isLoading ? "Rejecting..." : "Reject Proof"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
