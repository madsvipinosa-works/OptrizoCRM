"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
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
                            className={cn(
                                "flex-1 min-w-[120px] sm:min-w-0 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all text-center flex flex-col items-center justify-center gap-1 border",
                                isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                    : isCurrentInProgress
                                    ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20"
                                    : isCompleted
                                    ? "bg-muted/80 text-foreground border-border hover:bg-muted"
                                    : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60"
                            )}
                        >
                            <div className="flex items-center gap-1.5 truncate max-w-full">
                                {isCompleted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                ) : isCurrentInProgress ? (
                                    <Clock className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
                                ) : null}
                                <span className="truncate">{displayName}</span>
                            </div>
                            <span
                                className={cn(
                                    "text-[10px] font-normal tracking-wide",
                                    isSelected
                                        ? "text-primary-foreground/80"
                                        : isCurrentInProgress
                                        ? "text-primary font-medium"
                                        : "text-muted-foreground"
                                )}
                            >
                                {m.status === "In Progress"
                                    ? "In Progress"
                                    : m.status === "Completed"
                                    ? "Completed"
                                    : "Pending"}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* If active milestone is In Progress and has 0 tasks, PM sees Mark Milestone Done */}
            {isManager && activeMilestone && activeMilestone.status === "In Progress" && (activeMilestone.taskCount === 0 || activeMilestone.taskCount === undefined) && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                            <strong>{getDisplayName(activeMilestone.title)}</strong> has 0 tasks. As Project Manager, you can mark it done with a reason.
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100 shrink-0 ml-2"
                        onClick={() => setEmptyDoneModalOpen(true)}
                    >
                        Mark Milestone Done
                    </Button>
                </div>
            )}

            {/* Display doneReason if selected milestone was completed with reason */}
            {activeMilestone && activeMilestone.status === "Completed" && activeMilestone.doneReason && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
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
                        <p className="text-[11px] text-muted-foreground">
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
