"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { claimOrAssignLeadPm, createDraftProposalForLead } from "@/features/proposals/actions";
import { toast } from "sonner";
import { FileText, ArrowRight, Loader2, UserCheck, Clock, CheckCircle2 } from "lucide-react";

export interface ProposalQueueItem {
    id: string;
    businessName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    urgency: string | null;
    proposalRequestedAt: Date | string | null;
    assignedPmId: string | null;
    assignedPm?: { id: string; name: string | null; email: string } | null;
    discoveryForm?: {
        goals: string;
        requiredFeatures: string;
        targetTimeline: string;
        budgetRange: string;
        clientType: "local" | "international";
        notes?: string | null;
    } | null;
    proposals?: Array<{
        id: string;
        status: string;
        version?: number | null;
    }>;
}

export function PmProposalQueue({
    items,
    currentUserId,
}: {
    items: ProposalQueueItem[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedId, setSelectedId] = useState<string>(items[0]?.id || "");

    const selectedLead = items.find((i) => i.id === selectedId) || items[0];

    const handleOpenOrDraft = (lead: ProposalQueueItem) => {
        startTransition(async () => {
            // Claim lead if unassigned
            if (!lead.assignedPmId) {
                await claimOrAssignLeadPm(lead.id);
            }

            // Check if active draft proposal exists
            const draftProp = lead.proposals?.find((p) => p.status.toLowerCase() === "draft");
            if (draftProp) {
                router.push(`/dashboard/proposals/builder/${draftProp.id}`);
            } else {
                const res = await createDraftProposalForLead(lead.id);
                if (res.success && res.proposalId) {
                    router.push(`/dashboard/proposals/builder/${res.proposalId}`);
                } else {
                    toast.error(res.message || "Failed to start proposal draft");
                }
            }
        });
    };

    if (items.length === 0) {
        return (
            <Card className="p-8 text-center border-dashed">
                <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <h3 className="font-semibold text-foreground text-base">No pending proposal requests</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    When Sales completes discovery with a client, proposal requests will arrive here with discovery notes attached.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Proposal Requests Queue
                </h2>
                <p className="text-sm text-muted-foreground">
                    Step 9: Every request arrives here with attached discovery notes for technical scoping.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left: Request Cards List */}
                <div className="lg:col-span-5 space-y-3">
                    {items.map((lead) => {
                        const isSelected = lead.id === selectedLead?.id;
                        const hasDraft = lead.proposals?.some((p) => p.status.toLowerCase() === "draft");
                        const hasSent = lead.proposals?.some((p) => p.status.toLowerCase() === "sent");
                        const isAssignedToMe = lead.assignedPmId === currentUserId;

                        return (
                            <button
                                key={lead.id}
                                type="button"
                                onClick={() => setSelectedId(lead.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-all text-sm flex flex-col gap-2 ${
                                    isSelected
                                        ? "bg-card border-primary ring-1 ring-primary shadow-sm"
                                        : "bg-card/60 hover:bg-card border-border hover:border-border/80"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <strong className="text-foreground font-semibold text-base">
                                        {lead.businessName || lead.contactName || "Untitled Client"}
                                    </strong>
                                    {hasDraft ? (
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[11px]">
                                            Draft in progress
                                        </Badge>
                                    ) : hasSent ? (
                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[11px]">
                                            Sent
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[11px]">
                                            New request
                                        </Badge>
                                    )}
                                </div>

                                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>
                                        Requested:{" "}
                                        {lead.proposalRequestedAt
                                            ? format(new Date(lead.proposalRequestedAt), "MMM d, h:mm a")
                                            : "Recently"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                                    <span className="text-muted-foreground">
                                        Client: {lead.contactName || "Representative"}
                                    </span>
                                    {lead.assignedPm ? (
                                        <span className={`font-medium flex items-center gap-1 ${isAssignedToMe ? "text-primary" : "text-muted-foreground"}`}>
                                            <UserCheck className="w-3 h-3" />
                                            {isAssignedToMe ? "Assigned to you" : lead.assignedPm.name || "PM Assigned"}
                                        </span>
                                    ) : (
                                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                            Unassigned
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Right: Attached Discovery Notes & Action */}
                {selectedLead && (
                    <Card className="lg:col-span-7 p-6 border-border bg-card space-y-5">
                        <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    {selectedLead.businessName || "Client Opportunity"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Primary Contact: <span className="text-foreground font-medium">{selectedLead.contactName || "N/A"}</span>
                                    {selectedLead.contactEmail && ` • ${selectedLead.contactEmail}`}
                                    {selectedLead.contactPhone && ` • ${selectedLead.contactPhone}`}
                                </p>
                            </div>
                            <div>
                                {selectedLead.assignedPm ? (
                                    <Badge variant="outline" className="bg-muted text-foreground border-border text-xs py-1">
                                        PM: {selectedLead.assignedPm.name || selectedLead.assignedPm.email}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs py-1">
                                        Unassigned (Opening claims request)
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Discovery Notes Content */}
                        <div className="space-y-4 text-sm">
                            <div>
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                                    Goals &amp; Objectives
                                </span>
                                <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-foreground text-sm whitespace-pre-wrap">
                                    {selectedLead.discoveryForm?.goals || "No goals documented in discovery form."}
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                                    Required Features &amp; Technical Scope
                                </span>
                                <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-foreground text-sm whitespace-pre-wrap">
                                    {selectedLead.discoveryForm?.requiredFeatures || "No specific features recorded."}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Target Timeline</span>
                                    <span className="font-semibold text-foreground text-sm mt-0.5 block">
                                        {selectedLead.discoveryForm?.targetTimeline || "Not specified"}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Confirmed Budget Range</span>
                                    <span className="font-semibold text-foreground text-sm mt-0.5 block">
                                        {selectedLead.discoveryForm?.budgetRange || "To be discussed"}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Client Type</span>
                                    <span className="font-semibold text-foreground text-sm mt-0.5 block capitalize">
                                        {selectedLead.discoveryForm?.clientType || "local"} Client
                                    </span>
                                </div>
                            </div>

                            {selectedLead.discoveryForm?.notes && (
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                                        Discovery Meeting Outcome Notes
                                    </span>
                                    <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-muted-foreground text-xs whitespace-pre-wrap">
                                        {selectedLead.discoveryForm.notes}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action CTA */}
                        <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
                            <div className="text-xs text-muted-foreground">
                                {selectedLead.proposals && selectedLead.proposals.length > 0 ? (
                                    <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Proposal initialized ({selectedLead.proposals.length} version{selectedLead.proposals.length > 1 ? "s" : ""})
                                    </span>
                                ) : (
                                    <span>Opening this request will claim it and initialize the SOW draft.</span>
                                )}
                            </div>

                            <Button
                                onClick={() => handleOpenOrDraft(selectedLead)}
                                disabled={isPending}
                                className="gap-2 font-semibold"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Opening...
                                    </>
                                ) : selectedLead.proposals?.some((p) => p.status.toLowerCase() === "draft") ? (
                                    <>
                                        Continue Editing Draft
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                ) : (
                                    <>
                                        Start Drafting Proposal
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
