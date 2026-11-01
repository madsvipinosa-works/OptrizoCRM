"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDiscoveryForm, type DiscoveryFormData } from "@/features/crm/actions/discovery-form";
import { toast } from "sonner";
import { FileSpreadsheet, Lock } from "lucide-react";

interface DiscoveryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    businessName?: string | null;
    initialData?: DiscoveryFormData | null;
    isLocked?: boolean;
    onSuccess?: () => void;
}

export function DiscoveryFormModal({
    isOpen,
    onClose,
    leadId,
    businessName,
    initialData,
    isLocked = false,
    onSuccess,
}: DiscoveryFormModalProps) {
    const [goals, setGoals] = useState("");
    const [requiredFeatures, setRequiredFeatures] = useState("");
    const [targetTimeline, setTargetTimeline] = useState("");
    const [budgetRange, setBudgetRange] = useState("");
    const [clientType, setClientType] = useState<"local" | "international">("local");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setGoals(initialData.goals || "");
            setRequiredFeatures(initialData.requiredFeatures || "");
            setTargetTimeline(initialData.targetTimeline || "");
            setBudgetRange(initialData.budgetRange || "");
            setClientType(initialData.clientType || "local");
            setNotes(initialData.notes || "");
        } else {
            setGoals("");
            setRequiredFeatures("");
            setTargetTimeline("");
            setBudgetRange("");
            setClientType("local");
            setNotes("");
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLocked) return;

        if (!goals.trim() || !requiredFeatures.trim() || !targetTimeline.trim() || !budgetRange.trim()) {
            toast.error("Please fill in all required discovery fields");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await submitDiscoveryForm({
                leadId,
                goals: goals.trim(),
                requiredFeatures: requiredFeatures.trim(),
                targetTimeline: targetTimeline.trim(),
                budgetRange: budgetRange.trim(),
                clientType,
                notes: notes.trim() || undefined,
            });

            if (res.success) {
                toast.success("Discovery form submitted! Proposal request unlocked.");
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.message || "Failed to submit discovery form");
            }
        } catch {
            toast.error("Error submitting discovery form");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl bg-card border-border text-foreground">
                <DialogHeader className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">
                        Business: {businessName || "Opportunity"} · Step 3 of 3
                    </div>
                    <DialogTitle className="text-xl font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                            Discovery form
                        </div>
                        {isLocked && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground flex items-center gap-1">
                                <Lock className="h-3 w-3" /> Locked
                            </span>
                        )}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">
                        Filled in after the meeting. Submitting it unlocks the proposal.
                    </p>
                </DialogHeader>

                {isLocked && (
                    <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>This form is locked because a proposal has already been requested from the Project Manager.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Client goals *</Label>
                        <Textarea
                            rows={2}
                            value={goals}
                            onChange={(e) => setGoals(e.target.value)}
                            disabled={isLocked || isSubmitting}
                            placeholder="e.g. Track deliveries and drivers from one mobile app."
                            required
                            className="text-xs bg-muted/40 border-border"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Required features and deliverables *</Label>
                        <Textarea
                            rows={2}
                            value={requiredFeatures}
                            onChange={(e) => setRequiredFeatures(e.target.value)}
                            disabled={isLocked || isSubmitting}
                            placeholder="e.g. Driver app, dispatcher dashboard, delivery proof photos."
                            required
                            className="text-xs bg-muted/40 border-border"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Target timeline *</Label>
                            <Input
                                value={targetTimeline}
                                onChange={(e) => setTargetTimeline(e.target.value)}
                                disabled={isLocked || isSubmitting}
                                placeholder="e.g. 4 months"
                                required
                                className="text-xs h-9 bg-muted/40 border-border"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Confirmed budget range *</Label>
                            <Input
                                value={budgetRange}
                                onChange={(e) => setBudgetRange(e.target.value)}
                                disabled={isLocked || isSubmitting}
                                placeholder="e.g. ₱250,000 – ₱350,000"
                                required
                                className="text-xs h-9 bg-muted/40 border-border"
                            />
                        </div>
                    </div>

                    {/* Client Type Segmented Control (Mockup 028-6) */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Client type</Label>
                        <div className="grid grid-cols-2 rounded-lg border border-border p-1 bg-muted/40 gap-1">
                            <button
                                type="button"
                                disabled={isLocked || isSubmitting}
                                onClick={() => setClientType("local")}
                                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                    clientType === "local"
                                        ? "bg-primary text-black shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Local (Philippines)
                            </button>
                            <button
                                type="button"
                                disabled={isLocked || isSubmitting}
                                onClick={() => setClientType("international")}
                                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                    clientType === "international"
                                        ? "bg-primary text-black shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                International
                            </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {clientType === "local"
                                ? "Local: the first proposal goes out without a price, then a pricing meeting."
                                : "International: price is included from the first version."}
                        </p>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                        <Textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isLocked || isSubmitting}
                            placeholder="Additional requirements or context..."
                            className="text-xs bg-muted/40 border-border"
                        />
                    </div>

                    <DialogFooter className="pt-2 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="text-xs h-9"
                        >
                            {isLocked ? "Close" : "Cancel"}
                        </Button>
                        {!isLocked && (
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="text-xs h-9 bg-primary text-black font-semibold hover:bg-primary/90"
                            >
                                {isSubmitting ? "Submitting..." : "Submit and unlock proposal"}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
