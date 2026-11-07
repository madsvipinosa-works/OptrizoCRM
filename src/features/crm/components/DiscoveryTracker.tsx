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
    /** Hide the 3-step progress when the page shows it elsewhere (e.g. in the header). */
    hideSteps?: boolean;
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
    hideSteps = false,
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
            {!hideSteps && (
                <DiscoverySteps hasMeetingScheduled={hasMeetingScheduled} hasMeetingDone={hasMeetingDone} isFormSubmitted={isFormSubmitted} />
            )}

            {/* Step 2 Completed State: Meeting done, prompt to fill discovery form (Mockup 027-5) */}
            {hasMeetingDone && !isFormSubmitted && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">Discovery meeting done</span>
                        <span className="text-xs text-muted-foreground capitalize">
                            {doneMeetingFormat ? doneMeetingFormat.replace("_", " ") : "Video call"}
                            {doneMeetingDate && ` • ${new Date(doneMeetingDate).toLocaleDateString()}`}
                        </span>
                    </div>

                    {doneMeetingNotes && (
                        <div className="bg-muted/40 rounded-lg p-3 text-xs text-foreground space-y-1">
                            <span className="font-semibold text-muted-foreground block text-xs">Meeting Outcome Notes</span>
                            <p>{doneMeetingNotes}</p>
                        </div>
                    )}

                    <div className="rounded-lg bg-primary/[0.08] px-3 py-2 text-sm text-foreground ring-1 ring-inset ring-primary/25">
                        Next: fill in the discovery form to unlock the proposal.
                    </div>

                    <Button
                        onClick={onOpenDiscoveryForm}
                        className="w-full h-10 gap-1.5 font-semibold active:scale-[0.98]"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Fill in discovery form
                    </Button>

                    <div className="pt-2 border-t border-border space-y-1">
                        <Button disabled className="w-full h-10 bg-muted text-muted-foreground cursor-not-allowed">
                            <Lock className="h-3.5 w-3.5 mr-1" />
                            Request proposal (locked)
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                            Meeting done. Submit the discovery form to unlock.
                        </p>
                    </div>
                </div>
            )}

            {/* Step 3 Completed State: Discovery form submitted (Mockups 029-7 & 030-8) */}
            {isFormSubmitted && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            Discovery form submitted
                        </span>
                        {!isProposalRequested && (
                            <button
                                type="button"
                                onClick={onOpenDiscoveryForm}
                                className="text-sm font-medium text-foreground underline underline-offset-4"
                            >
                                Edit form
                            </button>
                        )}
                    </div>

                    {discoveryForm && (
                        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-3 border border-border">
                            <div className="col-span-2">
                                <span className="text-muted-foreground block text-xs">Goals</span>
                                <span className="font-medium text-foreground">{discoveryForm.goals}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-muted-foreground block text-xs">Required features</span>
                                <span className="font-medium text-foreground">{discoveryForm.requiredFeatures}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-xs">Timeline</span>
                                <span className="font-medium text-foreground">{discoveryForm.targetTimeline}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-xs">Budget range</span>
                                <span className="font-medium text-foreground">{discoveryForm.budgetRange}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-muted-foreground block text-xs">Client type</span>
                                <span className="font-semibold text-foreground capitalize">
                                    {discoveryForm.clientType === "local" ? "Local (Philippines)" : "International"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Proposal Requested Banner & Button (Mockup 030-8) */}
                    {isProposalRequested ? (
                        <div className="space-y-2 pt-2 border-t border-border">
                            <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-foreground ring-1 ring-inset ring-success/30">
                                Proposal requested{proposalRequestedAt ? ` on ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(proposalRequestedAt))}` : ""}. Assigned to Project Manager.
                            </div>
                            <Button
                                disabled
                                className="w-full h-10 text-xs font-semibold bg-muted text-muted-foreground cursor-not-allowed"
                            >
                                Proposal requested (waiting for PM)
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                                Waiting for the Project Manager to draft it. You will be notified when it is sent.
                            </p>
                        </div>
                    ) : (
                        <div className="pt-2 border-t border-border">
                            <Button
                                onClick={handleRequestProposal}
                                disabled={isSubmitting}
                                className="w-full h-10 gap-1.5 font-semibold active:scale-[0.98]"
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
                <div className="space-y-1.5">
                    <Button disabled className="w-full h-10 bg-muted text-muted-foreground cursor-not-allowed">
                        <Lock className="h-3.5 w-3.5 mr-1" />
                        Request proposal (locked)
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                        Complete the discovery meeting and form first.
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * The three discovery steps as numbered pills (mockup step 3 header).
 * Done steps turn green with a check; the current step gets a green ring.
 */
export function DiscoverySteps({
    hasMeetingScheduled,
    hasMeetingDone,
    isFormSubmitted,
}: {
    hasMeetingScheduled: boolean;
    hasMeetingDone: boolean;
    isFormSubmitted: boolean;
}) {
    const steps = [
        { label: "Meeting scheduled", done: hasMeetingScheduled, current: !hasMeetingScheduled },
        { label: "Meeting done", done: hasMeetingDone, current: hasMeetingScheduled && !hasMeetingDone },
        { label: "Requirements complete", done: isFormSubmitted, current: hasMeetingDone && !isFormSubmitted },
    ];
    return (
        <ol aria-label="Discovery progress" className="flex flex-wrap items-center gap-2">
            {steps.map((step, index) => (
                <li key={step.label} aria-current={step.current ? "step" : undefined} className="flex items-center gap-1.5">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-300 ${
                            step.done
                                ? "bg-brand-soft text-brand-deep"
                                : step.current
                                ? "bg-card text-foreground ring-1 ring-inset ring-brand-deep/50"
                                : "bg-muted text-muted-foreground"
                        }`}
                    >
                        {step.done ? (
                            <Check className="size-3.5" aria-hidden="true" />
                        ) : (
                            <span className="tabular-nums">{index + 1}.</span>
                        )}
                        {step.label}
                        <span className="sr-only">{step.done ? " (done)" : step.current ? " (current step)" : " (not started)"}</span>
                    </span>
                </li>
            ))}
        </ol>
    );
}
