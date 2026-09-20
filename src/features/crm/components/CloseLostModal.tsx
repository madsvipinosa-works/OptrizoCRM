"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertOctagon, Loader2 } from "lucide-react";
import type { LossReason } from "@/lib/schemas";

interface CloseLostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (lossReason: LossReason, lossNotes?: string) => Promise<void> | void;
    leadTitle: string;
    isSubmitting?: boolean;
}

const LOSS_REASONS: { value: LossReason; label: string; description: string }[] = [
    { value: "budget_too_low", label: "Budget Too Low / Pricing Objection", description: "Client's budget does not meet our minimum threshold." },
    { value: "competitor_chosen", label: "Competitor Chosen", description: "Client signed with another vendor or agency." },
    { value: "scope_mismatch", label: "Scope / Technical Mismatch", description: "Project requirements are outside our core capabilities." },
    { value: "timing_ghosted", label: "Timing / Client Ghosted", description: "Unresponsive client or postponed indefinitely." },
    { value: "internal_cancellation", label: "Client Canceled Internally", description: "Client leadership paused or canceled the initiative." },
    { value: "other", label: "Other", description: "Other contextual or miscellaneous reason." },
];

export function CloseLostModal({
    isOpen,
    onClose,
    onConfirm,
    leadTitle,
    isSubmitting = false,
}: CloseLostModalProps) {
    const [lossReason, setLossReason] = useState<LossReason | "">("");
    const [lossNotes, setLossNotes] = useState("");

    const handleConfirm = async () => {
        if (!lossReason) return;
        await onConfirm(lossReason as LossReason, lossNotes.trim() || undefined);
        setLossReason("");
        setLossNotes("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
            <DialogContent className="max-w-md bg-card border-border text-foreground rounded-xl shadow-2xl">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center gap-2 text-rose-500 font-semibold text-sm">
                        <AlertOctagon className="h-4 w-4" />
                        Opportunity Loss Analysis
                    </div>
                    <DialogTitle className="text-xl font-bold text-foreground">
                        Mark as Closed Lost
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        To maintain agency win/loss metrics, please specify why <span className="text-foreground font-medium">"{leadTitle}"</span> was lost.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2">
                    {/* Mandatory Reason Selector */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>Primary Loss Reason <span className="text-rose-500">*</span></span>
                            <span className="text-[10px] text-muted-foreground font-normal font-mono">Mandatory</span>
                        </label>
                        <Select value={lossReason} onValueChange={(v) => setLossReason(v as LossReason)}>
                            <SelectTrigger className="bg-muted/30 border-border text-foreground text-xs h-10">
                                <SelectValue placeholder="Select primary loss reason..." />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                                {LOSS_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value} className="text-xs focus:bg-muted">
                                        <div className="font-medium text-foreground">{r.label}</div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Contextual Notes */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Context & Debrief Notes (Optional)
                        </label>
                        <Textarea
                            placeholder="Add additional insights (e.g. competitor name, specific pricing gap, timeline details)..."
                            value={lossNotes}
                            onChange={(e) => setLossNotes(e.target.value)}
                            rows={3}
                            className="bg-muted/30 border-border text-foreground text-xs resize-none placeholder:text-muted-foreground focus-visible:ring-rose-500/50"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 mt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!lossReason || isSubmitting}
                        className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium gap-1.5"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                            </>
                        ) : (
                            "Confirm Closed Lost"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
