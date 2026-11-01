"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Lock, Send, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { requestProposal, type DiscoveryFormData } from "@/features/crm/actions/discovery-form";
import { toast } from "sonner";

interface DiscoveryTrackerProps {
    leadId: string;
    hasMeetingScheduled: boolean;
    hasMeetingDone: boolean;
    doneMeetingNotes?: string | null;
    doneMeetingDate?: Date | string | null;
    doneMeetingFormat?: string | null;
    isFormSubmitted: boolean;
    discoveryForm?: DiscoveryFormData | null;
    isProposalRequested: boolean;
    proposalRequestedAt?: Date | string | null;
    onOpenDiscoveryForm: () => void;
    onRefresh?: () => void;
}

export function DiscoveryTracker({
    leadId,
    hasMeetingScheduled,
    hasMeetingDone,
    doneMeetingNotes,
    doneMeetingDate,
    doneMeetingFormat,
    isFormSubmitted,
    discoveryForm,
    isProposalRequested,
    proposalRequestedAt,
    onOpenDiscoveryForm,
    onRefresh,
}: DiscoveryTrackerProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRequestProposal = async () => {
        setIsSubmitting(true);
        try {
            const res = await requestProposal(leadId);
            if (res.success) {
                toast.success("Proposal requested! All Project Managers have been notified.");
                onRefresh?.();
            } else {
                toast.error(res.message || "Failed to request proposal");
            }
        } catch {
            toast.error("Error requesting proposal");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Strictly 3-Step Tracker Bar (Mockups 023-3, 024-4, 027-5, 029-7) */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                {/* Step 1: Meeting scheduled */}
                <span
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${
                        hasMeetingScheduled
                            ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-muted text-muted-foreground border border-border"
                    }`}
                >
                    {hasMeetingScheduled && <Check className="h-3.5 w-3.5" />}
                    1. Meeting scheduled
                </span>

                {/* Step 2: Meeting done */}
                <span
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${
                        hasMeetingDone
                            ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30"
                            : hasMeetingScheduled
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-muted text-muted-foreground border border-border"
                    }`}
                >
                    {hasMeetingDone && <Check className="h-3.5 w-3.5" />}
                    2. Meeting done
                </span>

                {/* Step 3: Requirements complete */}
                <span
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${
                        isFormSubmitted
                            ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30"
                            : hasMeetingDone
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-muted text-muted-foreground border border-border"
                    }`}
                >
                    {isFormSubmitted && <Check className="h-3.5 w-3.5" />}
                    3. Requirements complete
                </span>
            </div>

            {/* Step 2 Completed State: Meeting done, prompt to fill discovery form (Mockup 027-5) */}
            {hasMeetingDone && !isFormSubmitted && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">Discovery Meeting Completed</span>
                        <span className="text-xs text-muted-foreground capitalize">
                            {doneMeetingFormat ? doneMeetingFormat.replace("_", " ") : "Video call"}
                            {doneMeetingDate && ` • ${new Date(doneMeetingDate).toLocaleDateString()}`}
                        </span>
                    </div>

                    {doneMeetingNotes && (
                        <div className="bg-muted/40 rounded-lg p-3 text-xs text-foreground space-y-1">
                            <span className="font-semibold text-muted-foreground block text-[11px]">Meeting Outcome Notes</span>
                            <p>{doneMeetingNotes}</p>
                        </div>
                    )}

                    <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-700 dark:text-cyan-300">
                        Next: fill in the discovery form to unlock the proposal.
                    </div>

                    <Button
                        onClick={onOpenDiscoveryForm}
                        className="w-full bg-primary text-black font-semibold hover:bg-primary/90 h-9 text-xs gap-1.5"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Fill in discovery form
                    </Button>

                    <div className="pt-2 border-t border-border space-y-1">
                        <Button disabled className="w-full h-9 text-xs bg-muted text-muted-foreground cursor-not-allowed">
                            <Lock className="h-3.5 w-3.5 mr-1" />
                            Create proposal (locked)
                        </Button>
                        <p className="text-[11px] text-muted-foreground text-center">
                            Meeting done. Submit the discovery form to unlock.
                        </p>
                    </div>
                </div>
            )}

            {/* Step 3 Completed State: Discovery form submitted (Mockups 029-7 & 030-8) */}
            {isFormSubmitted && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Discovery form submitted
                        </span>
                        {!isProposalRequested && (
                            <button
                                type="button"
                                onClick={onOpenDiscoveryForm}
                                className="text-xs text-primary hover:underline font-semibold"
                            >
                                Edit form
                            </button>
                        )}
                    </div>

                    {discoveryForm && (
                        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-3 border border-border">
                            <div className="col-span-2">
                                <span className="text-muted-foreground block text-[11px]">Goals</span>
                                <span className="font-medium text-foreground">{discoveryForm.goals}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-muted-foreground block text-[11px]">Required features</span>
                                <span className="font-medium text-foreground">{discoveryForm.requiredFeatures}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Timeline</span>
                                <span className="font-medium text-foreground">{discoveryForm.targetTimeline}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Budget range</span>
                                <span className="font-medium text-foreground">{discoveryForm.budgetRange}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-muted-foreground block text-[11px]">Client type</span>
                                <span className="font-semibold text-foreground capitalize">
                                    {discoveryForm.clientType === "local" ? "Local (Philippines)" : "International"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Proposal Requested Banner & Button (Mockup 030-8) */}
                    {isProposalRequested ? (
                        <div className="space-y-2 pt-2 border-t border-border">
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
                                Proposal requested{proposalRequestedAt ? ` on ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(proposalRequestedAt))}` : ""}. Assigned to Project Manager.
                            </div>
                            <Button
                                disabled
                                className="w-full h-10 text-xs font-semibold bg-muted text-muted-foreground cursor-not-allowed"
                            >
                                Proposal requested (waiting for PM)
                            </Button>
                            <p className="text-[11px] text-muted-foreground text-center">
                                Waiting for the Project Manager to draft it. You will be notified when it is sent.
                            </p>
                        </div>
                    ) : (
                        <div className="pt-2 border-t border-border">
                            <Button
                                onClick={handleRequestProposal}
                                disabled={isSubmitting}
                                className="w-full h-10 text-xs font-semibold bg-primary text-black hover:bg-primary/90 gap-1.5 shadow-sm"
                            >
                                <Send className="h-3.5 w-3.5" />
                                {isSubmitting ? "Requesting..." : "Request proposal"}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Neither done yet: locked state */}
            {!hasMeetingDone && (
                <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-1">
                    <Button disabled className="w-full h-9 text-xs bg-muted text-muted-foreground cursor-not-allowed">
                        <Lock className="h-3.5 w-3.5 mr-1" />
                        Create proposal (locked)
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center">
                        Complete the discovery meeting and form first.
                    </p>
                </div>
            )}
        </div>
    );
}
