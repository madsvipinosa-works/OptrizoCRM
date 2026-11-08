"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { reopenLead } from "@/features/crm/actions";

interface ReopenLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    businessName: string;
    onSuccess?: () => void;
}

export function ReopenLeadModal({
    isOpen,
    onClose,
    leadId,
    businessName,
    onSuccess,
}: ReopenLeadModalProps) {
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = reason.trim();
        if (!trimmed) {
            toast.error("Please provide a reason to reopen this deal.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await reopenLead(leadId, trimmed);
            if (res.success) {
                toast.success("Lead reopened and returned to Discovery & Qualifying.");
                setReason("");
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.message || "Failed to reopen lead.");
            }
        } catch (err) {
            console.error("Failed to reopen lead:", err);
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-brand-deep" />
                        Reopen Lost Deal
                    </DialogTitle>
                    <DialogDescription>
                        Reopen <strong>{businessName}</strong> and return the deal to Discovery & Qualifying.
                        Previous loss reasons will be preserved in deal history.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="reopen-reason" className="text-xs font-semibold">
                            Reason for Reopening <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="reopen-reason"
                            placeholder="e.g. Client secured budget for Q1, revisited timeline and requested a new kickoff call..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                            required
                            className="text-xs resize-none"
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !reason.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Reopening...
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reopen Deal
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
