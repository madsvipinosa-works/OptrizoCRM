"use client";

import React, { useState } from "react";
import {
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
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
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
    /** The project created from this proposal once it is signed. */
    projectId?: string | null;
    canEditInStudio?: boolean;
    isCurrent?: boolean;
    /** Every version the client was sent, oldest first (drafts never included). */
    versions?: { id: string; version: number; status: string }[];
    isExpired?: boolean;
    whatChanged?: string[];
    messages?: ProposalMessageItem[];
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
    isPreview: staffPreview = false,
    versions = [],
    projectId = null,
    canEditInStudio = false,
    isCurrent = true,
    isExpired = false,
    whatChanged = [],
    messages = [],
    settings,
}: Props) {
    // An older version is shown exactly as it was sent, but nothing on it can be acted on (compare only).
    const isOldVersion = proposal.status === "replaced";
    const isPreview = staffPreview || isOldVersion;
    const currentVersion = versions.length > 0 ? versions[versions.length - 1] : null;
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

    // Signed: the confirmation and the thread come first, so the client does not scroll past the whole document.
    const approvedEl = isApproved && (
                <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 rounded-xl border border-border bg-card p-7 no-print lg:max-w-none">
                    {proposal.acceptedAt && (
                        <span className="self-start rounded-full bg-[var(--brand-soft)] px-3 py-0.5 text-sm font-semibold text-[var(--brand-deep)]">
                            Signed {formatDateTime(proposal.acceptedAt)}
                        </span>
                    )}
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Thank you. Your project has started.</h2>
                    <p className="text-base text-muted-foreground">
                        A copy of the signed proposal was emailed to you. You can follow every milestone from your portal.
                    </p>
                    <Button asChild className="h-12 w-full rounded-lg text-base font-semibold">
                        <Link href={projectId ? `/portal/projects/${projectId}` : "/portal/projects"}>View project progress</Link>
                    </Button>
                    <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="h-10 w-full rounded-lg">
                        {isDownloadingPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Printer className="mr-1 h-4 w-4" />}
                        Download signed proposal (PDF)
                    </Button>
                </div>
            );
    const threadEl = !isPreview && (
                <section aria-labelledby="negotiation-heading" className="no-print mx-auto flex w-full max-w-[850px] flex-col overflow-hidden rounded-xl border border-border bg-card">
                    <ProposalThread
                        proposalId={proposal.id}
                        messages={messages || []}
                        userRole="client"
                    />
                </section>
            );

    return (
        <div className="space-y-8 pb-24 w-full min-w-0 print:p-0 print:m-0 print:space-y-0 print:pb-0">
            {/* Signed: mockup 20, the confirmation the client lands on after signing */}
            {/* Signed: the summary and the messages side by side on wide screens (stacked on phones), same width as the page. */}
            {isApproved && (threadEl ? (
                <div className="no-print mx-auto grid w-full max-w-[1100px] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                    {approvedEl}
                    {threadEl}
                </div>
            ) : approvedEl)}

            {versions.length > 1 && (
                <nav aria-label="Proposal versions" className="no-print mx-auto flex max-w-[850px] flex-wrap items-center gap-1.5 text-sm">
                    <span className="mr-1 text-muted-foreground">Versions</span>
                    {versions.map((v) =>
                        v.id === proposal.id ? (
                            <span key={v.id} aria-current="page" className="rounded-md bg-brand-soft px-2.5 py-1 font-semibold tabular-nums text-brand-deep">
                                v{v.version}
                            </span>
                        ) : (
                            <Link
                                key={v.id}
                                href={`/proposal/${v.id}`}
                                className="rounded-md px-2.5 py-1 font-medium tabular-nums text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                v{v.version}
                            </Link>
                        )
                    )}
                </nav>
            )}

            {isOldVersion && (
                <div className="no-print mx-auto flex max-w-[850px] flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
                    <span>
                        This is an older version (v{proposal.version}), kept so you can compare. It can no longer be signed or changed.
                    </span>
                    {currentVersion && currentVersion.id !== proposal.id && (
                        <Link href={`/proposal/${currentVersion.id}`} className="font-semibold text-brand-deep underline-offset-4 hover:underline">
                            Open the current version (v{currentVersion.version})
                        </Link>
                    )}
                </div>
            )}

            {/* Staff Preview Banner */}
            {staffPreview && (
                <div className="bg-stage-new/10 border border-stage-new/30 rounded-lg p-3 text-center text-xs text-stage-new tabular-nums no-print flex items-center justify-center gap-2">
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
                        <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-brand-deep shrink-0">
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
                        <h4 className="font-semibold text-destructive text-sm">Proposal Expired</h4>
                        <p className="text-muted-foreground">
                            The validity period for this proposal has lapsed. Please reach out to your Project Manager for an updated proposal.
                        </p>
                    </div>
                </div>
            )}

            {/* What Changed Banner for Revised Versions */}
            {whatChanged && whatChanged.length > 0 && (
                <div className="max-w-[850px] mx-auto bg-stage-negotiation/10 border border-stage-negotiation/30 rounded-xl p-4 md:p-5 text-xs text-foreground no-print space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-stage-negotiation">
                        <Info className="h-4 w-4 shrink-0" />
                        <span>Updates in this Revised Version (v{proposal.version || 2})</span>
                    </div>
                    <p className="text-muted-foreground">
                        The Project Manager revised this proposal based on discussions. The following sections were updated:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {whatChanged.map((section) => (
                            <Badge key={section} variant="secondary" className="bg-stage-negotiation/20 text-foreground border-stage-negotiation/30 font-medium">
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

            {/* Discussion & Negotiation Thread: below the document, or right under the confirmation once signed */}
            {!isApproved && threadEl}

            {/* Status Callout (Approved / Rejected) */}
            {isRejected && (
                <div className="max-w-[850px] mx-auto p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-2 no-print">
                    <div className="mx-auto h-10 w-10 bg-destructive/20 rounded-full flex items-center justify-center text-destructive">
                        <XCircle className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-destructive">Proposal Declined</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        This proposal was declined. Our agency team has been notified to follow up regarding revisions.
                    </p>
                </div>
            )}

            {/* Floating Action Bar (Pill Container) */}
            {!isApproved && !isRejected && (
                <div className="floating-action-bar fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-background/90 border border-border rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 sm:gap-6 no-print w-[92%] sm:w-auto max-w-xl">
                    <div className="hidden sm:block text-left">
                        <div className="text-xs tabular-nums text-muted-foreground ">
                            Total Investment
                        </div>
                        <div className="text-base font-semibold tabular-nums text-brand-deep leading-tight">
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
                                <DialogContent className="bg-card border-border text-foreground">
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
                                className="h-9 px-3 text-xs border-stage-negotiation/30 text-stage-negotiation hover:bg-stage-negotiation/10"
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
                                        className="h-9 px-3 text-xs bg-stage-negotiation/10 text-stage-negotiation border-stage-negotiation/30 flex items-center gap-1.5"
                                    >
                                        <Calendar className="h-3.5 w-3.5" />
                                        Meeting Requested
                                    </Badge>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={handleRequestPricingMeeting}
                                        disabled={isRequestingPricing}
                                        className="h-9 px-4 sm:px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-primary/20 flex items-center gap-1.5"
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
                                    className="h-9 px-4 sm:px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-primary/20 flex items-center gap-1.5"
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
