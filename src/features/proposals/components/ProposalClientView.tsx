"use client";

import Link from "next/link";
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
    Calendar,
    AlertCircle,
} from "lucide-react";
import { rejectProposalByClient } from "@/features/proposals/actions";
import { requestPricingMeeting } from "@/features/proposals/signing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { orderMilestones } from "@/features/proposals/draft-logic";
import { RequestChangesDialog } from "@/features/proposals/components/RequestChangesDialog";
import { ProposalThread, type ProposalMessageItem } from "@/features/proposals/components/ProposalThread";

interface Props {
    proposal: {
        id: string;
        proposalCode?: string | null;
        version?: number;
        status: "draft" | "sent" | "pricing_meeting_requested" | "changes_requested" | "signed" | "declined" | "replaced";
        priceMode?: "to_be_discussed" | "priced" | null;
        currency?: "PHP" | "USD" | null;
        totalPrice?: number | null;
        needsGoals?: string | { needs?: string; goals?: string } | null;
        milestones?: Array<{
            id?: string | null;
            name?: string | null;
            key?: string;
            title?: string | null;
            description?: string | null;
            sortOrder?: number | null;
            startDate?: string | Date | null;
            endDate?: string | Date | null;
        }> | null;
        paymentScheduleItems?: Array<{
            id?: string;
            label: string;
            percent: number;
            trigger: string;
            sortOrder?: number;
        }> | null;
        fileUrl?: string | null;
        scope?: string | null;
        projectName?: string | null;
        exclusions?: string | null;
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
        contractSettings?: Record<string, unknown> | null;
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
    canEditInStudio?: boolean;
    isCurrent?: boolean;
    isExpired?: boolean;
    whatChanged?: string[];
    messages?: ProposalMessageItem[];
    /** The project created when this proposal was signed, for the View project link. */
    projectId?: string | null;
    settings?: {
        logoUrl?: string | null;
        logoDarkUrl?: string | null;
        faviconUrl?: string | null;
        heroTitle?: string | null;
    } | null;
}

export function ProposalClientView({
    proposal,
    parsedDeliverables,
    parsedPricing,
    isPreview = false,
    canEditInStudio = false,
    isCurrent = true,
    isExpired = false,
    whatChanged = [],
    messages = [],
    projectId = null,
    settings,
}: Props) {
    const router = useRouter();
    const [isRejecting, setIsRejecting] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
    const [isRequestChangesOpen, setIsRequestChangesOpen] = useState(false);
    const [isRequestingPricing, setIsRequestingPricing] = useState(false);

    const isApproved = proposal.status === "signed";
    const isRejected = proposal.status === "declined";

    const grandTotal = proposal.total || parsedPricing.total || 0;

    const handleRequestPricingMeeting = async () => {
        setIsRequestingPricing(true);
        try {
            const res = await requestPricingMeeting(proposal.id);
            if (res.success) {
                toast.success("Pricing meeting requested. Your Project Manager has been notified.");
                router.refresh();
            } else {
                toast.error(res.message || "Failed to request pricing meeting");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to request pricing meeting");
        } finally {
            setIsRequestingPricing(false);
        }
    };

    const handleDownloadPdf = async () => {
        try {
            setIsDownloadingPdf(true);
            toast.info("Generating executive Statement of Work PDF...");
            const res = await fetch(`/api/proposals/${proposal.id}/pdf`);
            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                console.error("PDF generation endpoint returned non-200:", res.status, errText);
                toast.error(`PDF generation failed (${res.status}). Opening print preview as fallback...`);
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
        } catch (e: unknown) {
            console.error("PDF download error:", e);
            toast.error("Could not download PDF. Opening print preview...");
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
        projectName: proposal.projectName,
        exclusions: proposal.exclusions,
        scope: proposal.scope,
        technicalApproach: proposal.technicalApproach,
        deliverables: parsedDeliverables,
        timeline: proposal.timeline,
        pricingStructure: parsedPricing.items,
        subtotal: proposal.subtotal || parsedPricing.subtotal || grandTotal,
        discount: proposal.discount || parsedPricing.discount || 0,
        tax: proposal.tax || parsedPricing.tax || 0,
        total: grandTotal,
        needsGoals: proposal.needsGoals ?? null,
        version: proposal.version ?? 1,
        priceMode: proposal.priceMode,
        currency: proposal.currency,
        totalPrice: proposal.totalPrice ?? null,
        // The 5 default milestones and any the PM added, in order, with this proposal's dates.
        milestones: orderMilestones(proposal.milestones || []).map((m) => ({ ...m, startDate: m.startDate || null, endDate: m.endDate || null })),
        paymentScheduleItems: (proposal.paymentScheduleItems || []).map((p) => ({
            label: p.label,
            percent: p.percent,
            trigger: p.trigger,
        })),
        terms: proposal.terms,
        validUntil: proposal.validUntil,
        status: proposal.status,
        acceptedByName: proposal.acceptedByName,
        acceptedByTitle: proposal.acceptedByTitle,
        acceptedAt: proposal.acceptedAt,
        signatureData: proposal.signatureData,
        createdAt: proposal.createdAt,
        contractSettings: (proposal.contractSettings as ProposalDocumentData["contractSettings"]) || null,
        agencyLogoUrl: settings?.logoUrl || null,
        agencyFaviconUrl: settings?.faviconUrl || null,
    };

    // Show the price in the proposal's own currency (PHP by default); never convert it.
    const currency = proposal.currency ?? "PHP";
    const currencyFormatter = new Intl.NumberFormat(currency === "PHP" ? "en-PH" : "en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
    });

    return (
        <div className="space-y-8 pb-24 w-full min-w-0 print:p-0 print:m-0 print:space-y-0 print:pb-0">
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

            {/* Expired Banner */}
            {isExpired && !isApproved && !isRejected && (
                <div className="max-w-[850px] mx-auto bg-destructive/10 border border-destructive/30 rounded-xl p-4 md:p-5 text-xs text-foreground no-print flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="font-bold text-destructive text-sm">Proposal Expired</h4>
                        <p className="text-muted-foreground">
                            The validity period for this proposal has lapsed. Please reach out to your Project Manager for an updated proposal.
                        </p>
                    </div>
                </div>
            )}

            {/* What Changed Banner for Revised Versions */}
            {whatChanged && whatChanged.length > 0 && (
                <div className="max-w-[850px] mx-auto bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 md:p-5 text-xs text-foreground no-print space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                        <Info className="h-4 w-4 shrink-0" />
                        <span>Updates in this Revised Version (v{proposal.version || 2})</span>
                    </div>
                    <p className="text-muted-foreground">
                        The Project Manager revised this proposal based on discussions. The following sections were updated:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {whatChanged.map((section) => (
                            <Badge key={section} variant="secondary" className="bg-amber-500/20 text-foreground border-amber-500/30 font-medium">
                                {section}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Shared Document Sheet */}
            <ProposalDocumentSheet
                data={documentData}
                agencyName={settings?.heroTitle ? `${settings.heroTitle} Digital Solutions` : "Optrizo Digital Solutions"}
                agencyLogoUrl={settings?.logoUrl || null}
                agencyFaviconUrl={settings?.faviconUrl || null}
            />

            {/* Discussion & Negotiation Thread */}
            {!isPreview && (
                <section aria-labelledby="negotiation-heading" className="no-print mx-auto max-w-[850px] overflow-hidden rounded-xl border border-border bg-card">
                    <ProposalThread
                        proposalId={proposal.id}
                        messages={messages || []}
                        userRole="client"
                    />
                </section>
            )}

            {/* Status Callout (Approved / Rejected) */}
            {isApproved && (
                <div className="no-print mx-auto max-w-[850px] space-y-3 rounded-xl border border-brand-deep/20 bg-brand-soft px-6 py-5 text-center">
                    <div className="mx-auto grid size-10 place-items-center rounded-full bg-card text-brand-deep">
                        <CheckCircle2 className="size-5" aria-hidden="true" />
                    </div>
                    {/* Mockup step 20 */}
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">Thank you. Your project has started.</h3>
                    <p className="mx-auto max-w-md text-sm text-foreground/80">
                        Signed by <strong className="font-semibold text-foreground">{proposal.acceptedByName || "you"}</strong>. Follow milestones, payments and files on
                        your project page.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                        {projectId && (
                            <Button asChild className="font-semibold active:scale-[0.97]">
                                <Link href={`/portal/projects/${projectId}`}>View project</Link>
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="gap-1.5 bg-card active:scale-[0.97]">
                            {isDownloadingPdf ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
                            Download signed proposal (PDF)
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

                        {/* Request Changes Trigger (Only for Client) */}
                        {!isPreview && isCurrent !== false && !isExpired && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsRequestChangesOpen(true)}
                                className="h-9 px-3 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                            >
                                Request Changes
                            </Button>
                        )}

                        {/* Accept & Sign or Request Pricing Meeting Button */}
                        {!isPreview ? (
                            isExpired ? (
                                <Badge
                                    variant="outline"
                                    className="h-9 px-3 text-xs bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1.5 font-semibold"
                                >
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Proposal Expired
                                </Badge>
                            ) : proposal.priceMode === "to_be_discussed" ? (
                                proposal.status === "pricing_meeting_requested" ? (
                                    <Badge
                                        variant="outline"
                                        className="h-9 px-3 text-xs bg-amber-500/10 text-amber-500 border-amber-500/20 flex items-center gap-1.5"
                                    >
                                        <Calendar className="h-3.5 w-3.5" />
                                        Meeting Requested
                                    </Badge>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={handleRequestPricingMeeting}
                                        disabled={isRequestingPricing}
                                        className="h-9 px-4 sm:px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-lg shadow-primary/20 flex items-center gap-1.5"
                                    >
                                        {isRequestingPricing ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Calendar className="h-4 w-4" />
                                        )}
                                        Request Pricing Meeting
                                    </Button>
                                )
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => setIsAcceptDialogOpen(true)}
                                    className="h-9 px-4 sm:px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-lg shadow-primary/20 flex items-center gap-1.5"
                                >
                                    <CheckSquare className="h-4 w-4" />
                                    Accept & Sign
                                </Button>
                            )
                        ) : canEditInStudio ? (
                            <Button
                                size="sm"
                                onClick={() => router.push(`/dashboard/proposals/builder/${proposal.id}`)}
                                className="h-9 px-4 text-xs font-semibold"
                            >
                                Edit in Studio
                            </Button>
                        ) : null}
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
                currency={currency}
                defaultName={proposal.lead?.client?.name || ""}
                contractSettings={proposal.contractSettings}
            />

            {/* Request Changes Dialog */}
            <RequestChangesDialog
                open={isRequestChangesOpen}
                onOpenChange={setIsRequestChangesOpen}
                proposalId={proposal.id}
                onSuccess={() => router.refresh()}
            />
        </div>
    );
}
