"use client";

import React, { useState } from "react";
import {
    CheckCircle2,
    FileCheck,
    Loader2,
    Info,
    ExternalLink,
    XCircle,
    Printer,
    CheckSquare,
    AlertCircle,
} from "lucide-react";
import { rejectProposalByClient } from "@/features/proposals/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    ProposalDocumentSheet,
    ProposalDocumentData,
    PricingLineItem,
} from "@/features/proposals/components/ProposalDocumentSheet";
import { AcceptProposalDialog } from "@/features/proposals/components/AcceptProposalDialog";

interface Props {
    proposal: {
        id: string;
        proposalCode?: string | null;
        status: "Draft" | "Sent" | "Approved" | "Rejected";
        fileUrl?: string | null;
        scope?: string | null;
        timeline?: string | null;
        technicalApproach?: string | null;
        terms?: string | null;
        validUntil?: Date | string | null;
        subtotal?: number | null;
        discount?: number | null;
        tax?: number | null;
        total?: number | null;
        acceptedByName?: string | null;
        acceptedByTitle?: string | null;
        acceptedAt?: Date | string | null;
        signatureData?: string | null;
        createdAt: Date | string;
        lead?: {
            businessName?: string | null;
            client?: {
                name: string | null;
                email: string;
            } | null;
        } | null;
    };
    parsedDeliverables: string[];
    parsedPricing: {
        items: PricingLineItem[];
        total: number;
        subtotal?: number;
        discount?: number;
        tax?: number;
    };
    isPreview?: boolean;
}

export function ProposalClientView({
    proposal,
    parsedDeliverables,
    parsedPricing,
    isPreview = false,
}: Props) {
    const router = useRouter();
    const [isRejecting, setIsRejecting] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);

    const isApproved = proposal.status === "Approved";
    const isRejected = proposal.status === "Rejected";

    const grandTotal = proposal.total || parsedPricing.total || 0;

    const handleDownloadPdf = async () => {
        try {
            setIsDownloadingPdf(true);
            toast.info("Generating executive Statement of Work PDF...");
            const res = await fetch(`/api/proposals/${proposal.id}/pdf`);
            if (!res.ok) {
                window.print();
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Statement_of_Work_${proposal.proposalCode || proposal.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Statement of Work PDF downloaded!");
        } catch (e) {
            console.error("PDF download error:", e);
            window.print();
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason for declining.");
            return;
        }
        setIsRejecting(true);
        try {
            const res = await rejectProposalByClient(proposal.id, rejectReason);
            if (res.success) {
                toast.success(res.message);
                setIsRejectDialogOpen(false);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to decline proposal");
            }
        } catch {
            toast.error("A system error occurred.");
        } finally {
            setIsRejecting(false);
        }
    };

    const documentData: ProposalDocumentData = {
        proposalCode: proposal.proposalCode || `OPT-${proposal.id.split("-")[0].toUpperCase()}`,
        businessName: proposal.lead?.businessName || proposal.lead?.client?.name || "Valued Client",
        clientEmail: proposal.lead?.client?.email,
        scope: proposal.scope,
        technicalApproach: proposal.technicalApproach,
        deliverables: parsedDeliverables,
        timeline: proposal.timeline,
        pricingStructure: parsedPricing.items,
        subtotal: proposal.subtotal || parsedPricing.subtotal || grandTotal,
        discount: proposal.discount || parsedPricing.discount || 0,
        tax: proposal.tax || parsedPricing.tax || 0,
        total: grandTotal,
        terms: proposal.terms,
        validUntil: proposal.validUntil,
        status: proposal.status,
        acceptedByName: proposal.acceptedByName,
        acceptedByTitle: proposal.acceptedByTitle,
        acceptedAt: proposal.acceptedAt,
        signatureData: proposal.signatureData,
        createdAt: proposal.createdAt,
    };

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
    });

    return (
        <div className="space-y-8 pb-24">
            {/* Staff Preview Banner */}
            {isPreview && (
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3 text-center text-xs text-sky-400 font-mono no-print flex items-center justify-center gap-2">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                        <strong>Staff Preview Mode:</strong> You are viewing this document with administrative privileges.
                    </span>
                </div>
            )}

            {/* Attached PDF Banner (if upload mode was used) */}
            {proposal.fileUrl && (
                <div className="bg-muted/40 border border-border/80 rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                            <FileCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-foreground">Attached Document Available</h3>
                            <p className="text-xs text-muted-foreground">
                                An external PDF attachment was provided alongside this interactive specification.
                            </p>
                        </div>
                    </div>
                    <a href={proposal.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 w-full md:w-auto">
                        <Button variant="outline" size="sm" className="w-full">
                            <ExternalLink className="h-4 w-4 mr-2" /> View Attached PDF
                        </Button>
                    </a>
                </div>
            )}

            {/* Main Shared Document Sheet */}
            <ProposalDocumentSheet data={documentData} />

            {/* Status Callout (Approved / Rejected) */}
            {isApproved && (
                <div className="max-w-[850px] mx-auto p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2 no-print">
                    <div className="mx-auto h-10 w-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Agreement Executed & Active</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        This proposal has been accepted and digitally executed by{" "}
                        <strong className="text-foreground">{proposal.acceptedByName || "Client"}</strong>. Project onboarding and sprint initialization are underway.
                    </p>
                    <div className="pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={isDownloadingPdf}
                            className="items-center gap-1.5 font-mono text-xs"
                        >
                            {isDownloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Printer className="h-3.5 w-3.5 mr-1" />}
                            Download Signed SOW (PDF)
                        </Button>
                    </div>
                </div>
            )}

            {isRejected && (
                <div className="max-w-[850px] mx-auto p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-2 no-print">
                    <div className="mx-auto h-10 w-10 bg-destructive/20 rounded-full flex items-center justify-center text-destructive">
                        <XCircle className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-destructive">Proposal Declined</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        This proposal was declined. Our agency team has been notified to follow up regarding revisions.
                    </p>
                </div>
            )}

            {/* Floating Action Bar (Pill Container) */}
            {!isApproved && !isRejected && (
                <div className="floating-action-bar fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-background/90 backdrop-blur-md border border-border shadow-2xl rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 sm:gap-6 no-print w-[92%] sm:w-auto max-w-xl">
                    <div className="hidden sm:block text-left">
                        <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
                            Total Investment
                        </div>
                        <div className="text-base font-bold font-mono text-primary leading-tight">
                            {currencyFormatter.format(grandTotal)}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {/* Download PDF Trigger */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={isDownloadingPdf}
                            className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground hidden xs:flex items-center gap-1"
                            title="Download Official SOW PDF"
                        >
                            {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            <span className="hidden md:inline">Download SOW</span>
                        </Button>

                        {/* Decline Dialog Trigger (Only for Client) */}
                        {!isPreview && (
                            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                                    >
                                        Decline
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-card border-border text-foreground">
                                    <DialogHeader>
                                        <DialogTitle>Decline Proposal</DialogTitle>
                                        <DialogDescription className="text-xs text-muted-foreground">
                                            Please share any feedback or requirements you would like us to revise.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-2">
                                        <Textarea
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            placeholder="e.g. Budget adjustments, timeline changes, additional deliverables..."
                                            className="text-sm min-h-[100px]"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" size="sm" onClick={() => setIsRejectDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleReject}
                                            disabled={isRejecting || !rejectReason.trim()}
                                        >
                                            {isRejecting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                                            Submit Decline
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Accept & Sign Button */}
                        {!isPreview ? (
                            <Button
                                size="sm"
                                onClick={() => setIsAcceptDialogOpen(true)}
                                className="h-9 px-4 sm:px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-lg shadow-primary/20 flex items-center gap-1.5"
                            >
                                <CheckSquare className="h-4 w-4" />
                                Accept & Sign
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={() => router.push(`/dashboard/proposals/builder/${proposal.id}`)}
                                className="h-9 px-4 text-xs font-semibold"
                            >
                                Edit in Studio
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Hybrid Digital Acceptance Dialog */}
            <AcceptProposalDialog
                open={isAcceptDialogOpen}
                onOpenChange={setIsAcceptDialogOpen}
                proposalId={proposal.id}
                proposalCode={proposal.proposalCode}
                totalAmount={grandTotal}
                defaultName={proposal.lead?.client?.name || ""}
            />
        </div>
    );
}
