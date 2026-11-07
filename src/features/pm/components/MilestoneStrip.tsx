"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markEmptyMilestoneDone } from "@/features/pm/actions";
import { cn } from "@/lib/utils";

export interface MilestoneItem {
    id: string;
    order: number;
    title: string;
    status: "Pending" | "In Progress" | "Completed";
    doneReason?: string | null;
    taskCount?: number;
}

interface MilestoneStripProps {
    milestones: MilestoneItem[];
    activeMilestoneId: string;
    onSelectMilestone: (milestoneId: string) => void;
    isManager: boolean;
    onMilestoneUpdated?: () => void;
}

const MILESTONE_TITLES: Record<string, string> = {
    requirements: "Requirements",
    design: "Design",
    development: "Development",
    uat_testing: "UAT and testing",
    handover: "Handover",
};

export function MilestoneStrip({
    milestones,
    activeMilestoneId,
    onSelectMilestone,
    isManager,
    onMilestoneUpdated,
}: MilestoneStripProps) {
    const [emptyDoneModalOpen, setEmptyDoneModalOpen] = useState(false);
    const [emptyDoneReason, setEmptyDoneReason] = useState("");
    const [isSubmittingReason, setIsSubmittingReason] = useState(false);

    const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);
    const activeMilestone = sortedMilestones.find((m) => m.id === activeMilestoneId);

    const handleMarkEmptyDone = async () => {
        if (!activeMilestone) return;
        const trimmed = emptyDoneReason.trim();
        if (!trimmed) {
            toast.error("Reason is required to mark an empty milestone done");
            return;
        }

        setIsSubmittingReason(true);
        try {
            const res = await markEmptyMilestoneDone({
                milestoneId: activeMilestone.id,
                reason: trimmed,
            });
            if (res.success) {
                toast.success("Milestone marked as done and advanced");
                setEmptyDoneModalOpen(false);
                setEmptyDoneReason("");
                onMilestoneUpdated?.();
            } else {
                toast.error(res.message || "Failed to mark milestone done");
            }
        } catch (error) {
            console.error("Mark milestone done error:", error);
            toast.error("An error occurred while marking milestone done");
        } finally {
            setIsSubmittingReason(false);
        }
    };

    const getDisplayName = (title: string) => {
        const lower = title.toLowerCase().replace(/\s+/g, "_");
        return MILESTONE_TITLES[lower] || title;
    };

    return (
        <div className="w-full space-y-2">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
                {sortedMilestones.map((m) => {
                    const isSelected = m.id === activeMilestoneId;
                    const isCurrentInProgress = m.status === "In Progress";
                    const isCompleted = m.status === "Completed";
                    const displayName = getDisplayName(m.title);

                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => onSelectMilestone(m.id)}
                            aria-pressed={isSelected}
                            className={cn(
                                "flex-1 min-w-[132px] sm:min-w-0 px-3 py-2 rounded-lg text-sm font-semibold text-center flex flex-col items-center justify-center gap-0.5 border outline-none transition-[color,background-color,border-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
                                isSelected
                                    ? "bg-brand-deep text-white border-brand-deep dark:text-background"
                                    : isCompleted
                                    ? "bg-brand-soft text-brand-deep border-transparent hover:border-brand-deep/30"
                                    : isCurrentInProgress
                                    ? "bg-card text-foreground border-brand-deep/40 hover:bg-muted/50"
                                    : "bg-muted/60 text-muted-foreground border-transparent hover:text-foreground"
                            )}
                        >
                            <span className="flex items-center gap-1.5 leading-tight">
                                {isCompleted && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />}
                                <span>{displayName}</span>
                            </span>
                            <span className={cn("text-xs font-normal", isSelected ? "opacity-80" : "text-muted-foreground", isCompleted && !isSelected && "text-brand-deep/80")}>
                                {isCurrentInProgress ? "In progress" : isCompleted ? "Done" : "Not started"}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* If active milestone is In Progress and has 0 tasks, PM sees Mark Milestone Done */}
            {isManager && activeMilestone && activeMilestone.status === "In Progress" && (activeMilestone.taskCount === 0 || activeMilestone.taskCount === undefined) && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-stage-negotiation/30 bg-stage-negotiation/10 text-stage-negotiation dark:text-stage-negotiation text-xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-stage-negotiation dark:text-stage-negotiation shrink-0" />
                        <span>
                            <strong>{getDisplayName(activeMilestone.title)}</strong> has 0 tasks. As Project Manager, you can mark it done with a reason.
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-stage-negotiation/30 hover:bg-stage-negotiation/20 text-stage-negotiation dark:text-stage-negotiation shrink-0 ml-2"
                        onClick={() => setEmptyDoneModalOpen(true)}
                    >
                        Mark Milestone Done
                    </Button>
                </div>
            )}

            {/* Display doneReason if selected milestone was completed with reason */}
            {activeMilestone && activeMilestone.status === "Completed" && activeMilestone.doneReason && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-brand-deep shrink-0" />
                    <span>
                        Completed reason: <em>&ldquo;{activeMilestone.doneReason}&rdquo;</em>
                    </span>
                </div>
            )}

            {/* Mark Empty Milestone Done Dialog */}
            <Dialog open={emptyDoneModalOpen} onOpenChange={setEmptyDoneModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mark Milestone Done</DialogTitle>
                        <DialogDescription>
                            This milestone currently has no tasks. Per workflow spec, you must provide a reason why this milestone is marked done without tasks.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label htmlFor="done-reason" className="text-xs font-semibold">
                            Reason for completion <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="done-reason"
                            rows={3}
                            placeholder="e.g. Requirements approved in discovery meeting; client provided pre-approved specifications."
                            value={emptyDoneReason}
                            onChange={(e) => setEmptyDoneReason(e.target.value)}
                            maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground">
                            This action will complete the milestone, advance to the next milestone, and write an audit log entry.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setEmptyDoneModalOpen(false)}
                            disabled={isSubmittingReason}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMarkEmptyDone}
                            disabled={isSubmittingReason || !emptyDoneReason.trim()}
                        >
                            {isSubmittingReason ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            Confirm & Advance
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
