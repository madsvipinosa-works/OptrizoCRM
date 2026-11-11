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
import { Loader2 } from "lucide-react";
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
                    <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                        Mark lead as lost
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                        Say why <span className="text-foreground font-medium">{leadTitle}</span> will not go ahead. The lead moves to Closed Lost; you can reopen it later with a reason.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2">
                    {/* Mandatory Reason Selector */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Reason <span className="text-destructive" aria-hidden="true">*</span>
                        </label>
                        <Select value={lossReason} onValueChange={(v) => setLossReason(v as LossReason)}>
                            <SelectTrigger className="h-10 text-sm">
                                <SelectValue placeholder="Pick a reason" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                                {LOSS_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value} className="text-sm focus:bg-muted">
                                        <div className="font-medium text-foreground">{r.label}</div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Contextual Notes */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Notes <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <Textarea
                            placeholder="For example: chose another vendor, budget too small, stopped replying."
                            value={lossNotes}
                            onChange={(e) => setLossNotes(e.target.value)}
                            rows={3}
                            className="resize-none text-sm"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 mt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-sm"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!lossReason || isSubmitting}
                        variant="destructive"
                        className="gap-1.5 text-sm font-semibold"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                            </>
                        ) : (
                            "Mark as lost"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
