"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { savePaymentSchedule, updateProposalMilestones } from "@/features/proposals/actions";
import {
    formatDayMonth,
    LIMITS,
    scheduleTotalPercent,
    validateMilestoneDates,
    validateSchedule,
    type MilestoneDraft,
    type ScheduleDraftItem,
} from "@/features/proposals/draft-logic";
import { STANDARD_SECTIONS } from "@/features/proposals/standard-sections";
import { FormSelect } from "@/components/ui/form-select";

// ---------------------------------------------------------------------------
// Needs and goals
// ---------------------------------------------------------------------------

/**
 * The dialogs below keep a working copy in state. They are mounted only while open (see ProposalDraftEditor),
 * so every opening starts from the current saved values.
 */
export function NeedsGoalsDialog({
    open,
    onOpenChange,
    needs,
    goals,
    readOnly,
    onApply,
    onReset,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    needs: string;
    goals: string;
    readOnly: boolean;
    onApply: (value: { needs: string; goals: string }) => void;
    /** Reloads the values from the discovery form. Resolves to null on failure. */
    onReset: () => Promise<{ needs: string; goals: string } | null>;
}) {
    const [draftNeeds, setDraftNeeds] = useState(needs);
    const [draftGoals, setDraftGoals] = useState(goals);
    const [resetting, setResetting] = useState(false);

    const tooLong = draftNeeds.length > LIMITS.needsGoals || draftGoals.length > LIMITS.needsGoals;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Needs and goals</DialogTitle>
                    <DialogDescription>
                        Filled in from the discovery form. Edits here change only this proposal, not the discovery form.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="ng-needs">Client needs (one per line, shown as bullet points)</Label>
                        <Textarea
                            id="ng-needs"
                            rows={5}
                            value={draftNeeds}
                            readOnly={readOnly}
                            onChange={(e) => setDraftNeeds(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ng-goals">Goals (one per line)</Label>
                        <Textarea
                            id="ng-goals"
                            rows={5}
                            value={draftGoals}
                            readOnly={readOnly}
                            onChange={(e) => setDraftGoals(e.target.value)}
                        />
                    </div>
                    {tooLong && (
                        <p role="alert" className="text-xs text-destructive">
                            At most {LIMITS.needsGoals} characters in each box.
                        </p>
                    )}
                </div>
                <DialogFooter className="gap-2 sm:justify-between">
                    {!readOnly ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={resetting}
                            onClick={async () => {
                                setResetting(true);
                                const value = await onReset();
                                setResetting(false);
                                if (value) {
                                    setDraftNeeds(value.needs);
                                    setDraftGoals(value.goals);
                                }
                            }}
                        >
                            {resetting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Reset to discovery form
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {readOnly ? "Close" : "Cancel"}
                        </Button>
                        {!readOnly && (
                            <Button
                                type="button"
                                disabled={tooLong}
                                onClick={() => {
                                    onApply({ needs: draftNeeds, goals: draftGoals });
                                    onOpenChange(false);
                                }}
                            >
                                Save
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Milestone dates
// ---------------------------------------------------------------------------

export function MilestonesDialog({
    open,
    onOpenChange,
    proposalId,
    milestones,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    proposalId: string;
    milestones: MilestoneDraft[];
    onSaved: (next: MilestoneDraft[]) => void;
}) {
    const [draft, setDraft] = useState(milestones);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    const validation = validateMilestoneDates(draft);

    const setDate = (key: string, field: "startDate" | "endDate", value: string) =>
        setDraft((current) => current.map((m) => (m.key === key ? { ...m, [field]: value } : m)));

    async function save() {
        setShowErrors(true);
        if (!validation.ok) return;
        setSaving(true);
        try {
            // Dates only: the 5 milestones, their names and descriptions are fixed for every proposal.
            const res = await updateProposalMilestones(
                proposalId,
                draft.map((m) => ({ name: m.key, startDate: m.startDate, endDate: m.endDate })),
            );
            if (!res.success) {
                toast.error(res.message || "Could not save the milestone dates.");
                return;
            }
            const saved = "milestones" in res && Array.isArray(res.milestones) ? res.milestones : null;
            onSaved(
                saved
                    ? draft.map((m) => {
                          const row = saved.find((s) => s.key === m.key);
                          return { ...m, startDate: row?.startDate ?? m.startDate, endDate: row?.endDate ?? m.endDate };
                      })
                    : draft,
            );
            toast.success("Milestone dates saved.");
            onOpenChange(false);
        } catch {
            toast.error("Could not save the milestone dates.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit milestone dates</DialogTitle>
                    <DialogDescription>
                        Only dates can change. The 5 milestones and their descriptions are the same for every project, and they run in order.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-3 overflow-y-auto py-1">
                    {draft.map((m) => {
                        const error = showErrors ? validation.errors[m.key] : undefined;
                        return (
                            <div key={m.key} className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3.5">
                                <div>
                                    <div className="text-sm font-semibold">{m.title}</div>
                                    <div className="text-xs text-muted-foreground">{m.description}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor={`ms-start-${m.key}`} className="text-xs text-muted-foreground">Start date</Label>
                                        <DatePicker id={`ms-start-${m.key}`} value={m.startDate} onChange={(v) => setDate(m.key, "startDate", v)} min={todayYmd()} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor={`ms-end-${m.key}`} className="text-xs text-muted-foreground">End date</Label>
                                        <DatePicker id={`ms-end-${m.key}`} value={m.endDate} onChange={(v) => setDate(m.key, "endDate", v)} min={m.startDate || todayYmd()} className="h-8 text-xs" />
                                    </div>
                                </div>
                                {error && (
                                    <p role="alert" className="text-xs text-destructive">
                                        {error}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" disabled={saving} onClick={save}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save dates
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Scope of work and timeline (read-only)
// ---------------------------------------------------------------------------

export function ScopeTimelineDialog({
    open,
    onOpenChange,
    milestones,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    milestones: MilestoneDraft[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Scope of work and timeline</DialogTitle>
                    <DialogDescription>
                        Built automatically from the 5 default milestones. To change dates, close this and use Edit dates on the Milestones card.
                    </DialogDescription>
                </DialogHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr>
                                <th className="py-2 pr-3 font-medium">Milestone</th>
                                <th className="py-2 pr-3 font-medium">What is done (standard)</th>
                                <th className="py-2 text-right font-medium">Dates</th>
                            </tr>
                        </thead>
                        <tbody>
                            {milestones.map((m) => (
                                <tr key={m.key} className="border-t border-border align-top">
                                    <td className="py-2.5 pr-3 font-semibold">{m.title}</td>
                                    <td className="py-2.5 pr-3 text-muted-foreground">{m.description}</td>
                                    <td className="whitespace-nowrap py-2.5 text-right tabular-nums">
                                        {m.startDate && m.endDate ? `${formatDayMonth(m.startDate)} – ${formatDayMonth(m.endDate)}` : "Not set"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-muted-foreground">Read only. Milestone names and descriptions are the same for every project.</p>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Standard sections (read-only)
// ---------------------------------------------------------------------------

export function StandardSectionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [activeKey, setActiveKey] = useState<string>(STANDARD_SECTIONS[0].key);
    const active = STANDARD_SECTIONS.find((s) => s.key === activeKey) ?? STANDARD_SECTIONS[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Standard sections</DialogTitle>
                    <DialogDescription>
                        The same text appears in every proposal. The client name and project name are filled in automatically.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                    <nav className="flex gap-1 sm:flex-col" aria-label="Standard sections">
                        {STANDARD_SECTIONS.map((section) => (
                            <button
                                key={section.key}
                                type="button"
                                aria-current={section.key === active.key ? "true" : undefined}
                                onClick={() => setActiveKey(section.key)}
                                className={
                                    section.key === active.key
                                        ? "rounded-md bg-primary/10 px-3 py-2 text-left text-sm font-semibold text-primary"
                                        : "rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                                }
                            >
                                {section.title}
                            </button>
                        ))}
                    </nav>
                    <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-4 text-sm">
                        <h3 className="font-semibold">{active.title}</h3>
                        <ul className="space-y-2">
                            {active.lines.map((line) =>
                                line.startsWith("- ") ? (
                                    <li key={line} className="ml-4 list-disc leading-relaxed">
                                        {line.slice(2)}
                                    </li>
                                ) : (
                                    <li key={line} className="list-none leading-relaxed">
                                        {line}
                                    </li>
                                ),
                            )}
                        </ul>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    To change wording for this client only, use Edit terms on the proposal. Lasting changes are made in the proposal template.
                </p>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Payment schedule
// ---------------------------------------------------------------------------

const TRIGGERS: Array<[value: string, label: string]> = [
    ["on_signing", "On signing"],
    ["requirements", "Requirements done"],
    ["design", "Design done"],
    ["development", "Development done"],
    ["uat_testing", "UAT and testing done"],
    ["handover", "Handover"],
    ["before_completion", "Before completion"],
];

export function ScheduleDialog({
    open,
    onOpenChange,
    proposalId,
    items,
    totalPrice,
    currency,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    proposalId: string;
    items: ScheduleDraftItem[];
    totalPrice: number | null;
    currency: "PHP" | "USD";
    onSaved: (next: ScheduleDraftItem[]) => void;
}) {
    const [draft, setDraft] = useState(items);
    const [saving, setSaving] = useState(false);

    const symbol = currency === "PHP" ? "₱" : "$";
    const total = scheduleTotalPercent(draft);
    const validation = validateSchedule(draft);
    const amountOf = (percent: number) =>
        totalPrice === null ? null : Math.round(totalPrice * ((Number(percent) || 0) / 100));

    const update = (index: number, patch: Partial<ScheduleDraftItem>) =>
        setDraft((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    async function save() {
        if (!validation.ok) return;
        setSaving(true);
        try {
            const res = await savePaymentSchedule(
                proposalId,
                draft.map((item, index) => ({ ...item, label: item.label.trim(), sortOrder: index })),
            );
            if (!res.success) {
                toast.error(res.message || "Could not save the payment schedule.");
                return;
            }
            const saved = "items" in res && Array.isArray(res.items) ? res.items : null;
            onSaved(
                saved
                    ? saved.map((row) => ({
                          id: row.id,
                          label: row.label,
                          percent: Number(row.percent) || 0,
                          trigger: row.trigger,
                          sortOrder: row.sortOrder,
                      }))
                    : draft,
            );
            toast.success("Payment schedule saved.");
            onOpenChange(false);
        } catch {
            toast.error("Could not save the payment schedule.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Payment schedule</DialogTitle>
                    <DialogDescription>
                        {totalPrice !== null
                            ? `Total price ${symbol}${totalPrice.toLocaleString()}. `
                            : "Enter the total price first to see the amounts. "}
                        Set when each payment is due and its share. Amounts are calculated.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[55vh] space-y-2 overflow-y-auto py-1">
                    <div className="grid grid-cols-12 gap-2 border-b border-border/60 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="col-span-4">Payment due</span>
                        <span className="col-span-3">Becomes due</span>
                        <span className="col-span-2 text-right">Percent</span>
                        <span className="col-span-3 text-right">Amount</span>
                    </div>
                    {draft.map((item, index) => {
                        const amount = amountOf(item.percent);
                        return (
                            <div key={index} className="grid grid-cols-12 items-center gap-2">
                                <Input
                                    aria-label={`Payment ${index + 1} name`}
                                    className="col-span-4 h-9"
                                    value={item.label}
                                    onChange={(e) => update(index, { label: e.target.value })}
                                />
                                <FormSelect
                                    aria-label={`Payment ${index + 1} becomes due`} className="col-span-3"
                                    value={item.trigger}
                                    onChange={(e) => update(index, { trigger: e.target.value })}
                                >
                                    {TRIGGERS.map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </FormSelect>
                                <Input
                                    aria-label={`Payment ${index + 1} percent`}
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="col-span-2 h-9 text-right"
                                    value={item.percent}
                                    onChange={(e) => update(index, { percent: Number(e.target.value) })}
                                />
                                <div className="col-span-3 flex items-center justify-end gap-2 text-sm tabular-nums">
                                    <span>{amount === null ? "-" : `${symbol}${amount.toLocaleString()}`}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={draft.length <= 1}
                                        onClick={() => setDraft((current) => current.filter((_, i) => i !== index))}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-center justify-between pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setDraft((current) => [...current, { label: "New payment", percent: 0, trigger: "handover", sortOrder: current.length }])
                            }
                        >
                            + Add payment
                        </Button>
                        <span className={validation.ok ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-destructive"}>
                            Total {total}%{totalPrice !== null ? ` · ${symbol}${totalPrice.toLocaleString()}` : ""}
                        </span>
                    </div>
                    {!validation.ok && (
                        <p role="alert" className="text-xs text-destructive">
                            {validation.message}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" disabled={saving || !validation.ok} onClick={save}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save schedule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export function TermsDialog({
    open,
    onOpenChange,
    terms,
    readOnly,
    onApply,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    terms: string;
    readOnly: boolean;
    onApply: (terms: string) => void;
}) {
    const [draft, setDraft] = useState(terms);

    const tooLong = draft.length > LIMITS.terms;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Terms for this client</DialogTitle>
                    <DialogDescription>
                        Wording written here is used for this proposal only. Leave it empty to keep the standard terms.
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    aria-label="Terms for this client"
                    rows={8}
                    value={draft}
                    readOnly={readOnly}
                    onChange={(e) => setDraft(e.target.value)}
                />
                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Plain text.</span>
                    <span className={tooLong ? "text-destructive" : "text-muted-foreground"}>
                        {draft.length} / {LIMITS.terms}
                    </span>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        {readOnly ? "Close" : "Cancel"}
                    </Button>
                    {!readOnly && (
                        <Button
                            type="button"
                            disabled={tooLong}
                            onClick={() => {
                                onApply(draft);
                                onOpenChange(false);
                            }}
                        >
                            Save
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
