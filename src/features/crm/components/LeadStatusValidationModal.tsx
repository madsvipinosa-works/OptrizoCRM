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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ShieldAlert, Loader2 } from "lucide-react";

interface LeadStatusValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reasonNotes?: string) => Promise<void> | void;
    leadTitle: string;
    fromStatus: string;
    toStatus: string;
    isSubmitting?: boolean;
}

export function LeadStatusValidationModal({
    isOpen,
    onClose,
    onConfirm,
    leadTitle,
    fromStatus,
    toStatus,
    isSubmitting = false,
}: LeadStatusValidationModalProps) {
    const [notes, setNotes] = useState("");

    const handleConfirm = async () => {
        await onConfirm(notes.trim());
        setNotes("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
            <DialogContent className="max-w-md bg-zinc-950 border-white/10 text-white rounded-xl shadow-2xl">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                        <ShieldAlert className="h-4 w-4" />
                        Stage Transition Audit & Intercept
                    </div>
                    <DialogTitle className="text-xl font-bold">
                        Confirm Pipeline Move
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-xs leading-relaxed">
                        Moving <span className="text-white font-medium">"{leadTitle}"</span> requires staff confirmation to maintain pipeline integrity.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2">
                    {/* Stage Transition Visual */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <Badge variant="secondary" className={getStatusColor(fromStatus)}>
                            {fromStatus}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-zinc-500" />
                        <Badge variant="secondary" className={getStatusColor(toStatus)}>
                            {toStatus}
                        </Badge>
                    </div>

                    {/* Reason / Audit Note Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300">
                            Activity Note / Reason (Optional)
                        </label>
                        <Textarea
                            placeholder="Add brief details about this stage movement (e.g. Sent client agreement, Discovery call completed)..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="bg-black/40 border-white/15 focus:border-primary text-xs placeholder:text-zinc-600 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-zinc-400 hover:text-white hover:bg-white/5"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="bg-primary text-black font-semibold hover:bg-primary/90"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            "Confirm & Mutate Status"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case "New Lead": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
        case "Discovery & Qualifying": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
        case "Proposal Sent": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
        case "In Negotiation": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
        case "Closed Won": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
        case "Closed Lost": return "bg-rose-500/10 text-rose-400 border-rose-500/30";
        default: return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
}
