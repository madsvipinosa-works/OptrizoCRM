"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDiscoveryForm, type DiscoveryFormData } from "@/features/crm/actions/discovery-form";
import { budgetRangeError, digitsOnly, formatBudgetRange, groupDigits, parseBudgetRange } from "@/features/crm/budget-range";
import { toast } from "sonner";
import { Lock } from "lucide-react";

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
    // Budget is two amounts (digits only); saved as one "₱100,000 – ₱500,000" text value.
    const [budgetMin, setBudgetMin] = useState("");
    const [budgetMax, setBudgetMax] = useState("");
    const [legacyBudget, setLegacyBudget] = useState("");
    const [budgetError, setBudgetError] = useState<string | null>(null);
    const [clientType, setClientType] = useState<"local" | "international">("local");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Local clients are quoted in pesos, international clients in US dollars.
    const currency = clientType === "international" ? "USD" : "PHP";
    const sign = currency === "USD" ? "$" : "₱";

    useEffect(() => {
        const parsed = parseBudgetRange(initialData?.budgetRange);
        setGoals(initialData?.goals || "");
        setRequiredFeatures(initialData?.requiredFeatures || "");
        setTargetTimeline(initialData?.targetTimeline || "");
        setBudgetMin(parsed?.min ?? "");
        setBudgetMax(parsed?.max ?? "");
        // A budget typed before the range fields existed is kept visible so nothing is lost.
        setLegacyBudget(parsed ? "" : initialData?.budgetRange || "");
        setBudgetError(null);
        setClientType(initialData?.clientType || "local");
        setNotes(initialData?.notes || "");
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLocked) return;

        const rangeError = budgetRangeError(budgetMin, budgetMax);
        setBudgetError(rangeError);
        if (!goals.trim() || !requiredFeatures.trim() || !targetTimeline.trim() || rangeError) {
            toast.error(rangeError ?? "Please fill in all required discovery fields");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await submitDiscoveryForm({
                leadId,
                goals: goals.trim(),
                requiredFeatures: requiredFeatures.trim(),
                targetTimeline: targetTimeline.trim(),
                budgetRange: formatBudgetRange(budgetMin, budgetMax, currency),
                clientType,
                notes: notes.trim() || undefined,
            });

            if (res.success) {
                toast.success("Discovery form submitted. The proposal request is unlocked.");
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

    const disabled = isLocked || isSubmitting;
    const amountInput = (id: string, label: string, value: string, set: (v: string) => void) => (
        <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {sign}
            </span>
            <Input
                id={id}
                aria-label={label}
                inputMode="numeric"
                autoComplete="off"
                value={groupDigits(value)}
                onChange={(e) => {
                    set(digitsOnly(e.target.value).slice(0, 12));
                    setBudgetError(null);
                }}
                disabled={disabled}
                aria-invalid={budgetError ? true : undefined}
                aria-describedby={budgetError ? "budget-error" : undefined}
                className="h-10 bg-card pl-7 text-sm tabular-nums"
            />
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-xl border-border bg-card text-foreground">
                <DialogHeader className="space-y-1 text-left">
                    <p className="text-sm text-muted-foreground">
                        {businessName || "Opportunity"} · Step 3 of 3
                    </p>
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="text-xl font-semibold tracking-tight">Discovery form</DialogTitle>
                        {isLocked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                <Lock className="size-3" aria-hidden="true" /> Locked
                            </span>
                        )}
                    </div>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Filled in after the meeting. Submitting it unlocks the proposal.
                    </DialogDescription>
                </DialogHeader>

                {isLocked && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                        <Lock className="size-4 shrink-0" aria-hidden="true" />
                        <span>This form is locked because a proposal has already been requested from the Project Manager.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 pt-1" noValidate>
                    <div className="space-y-1.5">
                        <Label htmlFor="df-goals" className="text-sm text-muted-foreground">Client goals *</Label>
                        <Textarea
                            id="df-goals"
                            rows={2}
                            value={goals}
                            onChange={(e) => setGoals(e.target.value)}
                            disabled={disabled}
                            placeholder="e.g. Track deliveries and drivers from one mobile app."
                            required
                            className="bg-card text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="df-features" className="text-sm text-muted-foreground">Required features and deliverables *</Label>
                        <Textarea
                            id="df-features"
                            rows={2}
                            value={requiredFeatures}
                            onChange={(e) => setRequiredFeatures(e.target.value)}
                            disabled={disabled}
                            placeholder="e.g. Driver app, dispatcher dashboard, delivery proof photos."
                            required
                            className="bg-card text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="df-timeline" className="text-sm text-muted-foreground">Target timeline *</Label>
                        <Input
                            id="df-timeline"
                            value={targetTimeline}
                            onChange={(e) => setTargetTimeline(e.target.value)}
                            disabled={disabled}
                            placeholder="e.g. 4 months"
                            required
                            className="h-10 bg-card text-sm"
                        />
                    </div>

                    {/* Client type comes before the budget: it decides pesos or dollars. Mockup 028-6. */}
                    <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground">Client type</Label>
                        <div role="group" aria-label="Client type" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                            {([
                                ["local", "Local (Philippines)"],
                                ["international", "International"],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={clientType === value}
                                    disabled={disabled}
                                    onClick={() => setClientType(value)}
                                    className={`h-8 rounded-md text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] ${
                                        clientType === value ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {clientType === "local"
                                ? "Local: budget in pesos. The first proposal goes out without a price, then a pricing meeting."
                                : "International: budget in US dollars. The price is included from the first version."}
                        </p>
                    </div>

                    <fieldset className="space-y-1.5">
                        <legend className="text-sm text-muted-foreground">Confirmed budget range ({currency}) *</legend>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            {amountInput("df-budget-min", `Budget from, in ${currency}`, budgetMin, setBudgetMin)}
                            <span aria-hidden="true" className="text-sm text-muted-foreground">to</span>
                            {amountInput("df-budget-max", `Budget up to, in ${currency}`, budgetMax, setBudgetMax)}
                        </div>
                        {budgetError ? (
                            <p id="budget-error" role="alert" className="text-sm text-destructive">{budgetError}</p>
                        ) : legacyBudget ? (
                            <p className="text-sm text-muted-foreground">Saved before as “{legacyBudget}”. Enter it as two amounts.</p>
                        ) : null}
                    </fieldset>

                    <div className="space-y-1.5">
                        <Label htmlFor="df-notes" className="text-sm text-muted-foreground">Notes (optional)</Label>
                        <Textarea
                            id="df-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={disabled}
                            placeholder="Additional requirements or context"
                            className="bg-card text-sm"
                        />
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} className="h-10 bg-card active:scale-[0.97]">
                            {isLocked ? "Close" : "Cancel"}
                        </Button>
                        {!isLocked && (
                            <Button type="submit" disabled={isSubmitting} className="h-10 font-semibold active:scale-[0.97]">
                                {isSubmitting ? "Submitting…" : "Submit and unlock proposal"}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
