"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    createProposalRevision,
    resetProposalNeedsGoals,
    sendProposal,
    updateProposal,
    type ContractSettings,
} from "@/features/proposals/actions";
import {
    buildSavePayload,
    canCreateRevision,
    getSendProblems,
    getStepper,
    isEditableStatus,
    isStandardTerms,
    LIMITS,
    milestoneRangeSummary,
    readOnlyMessage,
    scheduleSummary,
    validateDraftFields,
    validateSchedule,
    type DraftFields,
    type MilestoneDraft,
    type ScheduleDraftItem,
} from "@/features/proposals/draft-logic";
import {
    MilestonesDialog,
    NeedsGoalsDialog,
    ScheduleDialog,
    ScopeTimelineDialog,
    StandardSectionsDialog,
    TermsDialog,
} from "./draft-dialogs";
import { ProposalDocumentSheet, type PricingLineItem, type ProposalDocumentData } from "./ProposalDocumentSheet";

export type ProposalDraftEditorData = {
    proposalId: string;
    leadId: string;
    status: string;
    version: number;
    proposalCode: string;
    businessName: string;
    clientName: string;
    clientType: "local" | "international" | null;
    fields: DraftFields;
    milestones: MilestoneDraft[];
    schedule: ScheduleDraftItem[];
    /** Today in Manila as YYYY-MM-DD, used to check the "valid until" date. */
    today: string;
    /** Parts of the document the editor no longer edits, kept so the preview shows the same document the client gets. */
    document: {
        deliverables: string[];
        pricingStructure: PricingLineItem[];
        timeline: string | null;
        contractSettings: ContractSettings | null;
        createdAt: string;
        agencyLogoUrl: string | null;
        agencyFaviconUrl: string | null;
    };
};

const cardClass = "space-y-3 rounded-xl border border-border bg-card p-5";
const selectClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

function Counter({ value, max }: { value: string; max: number }) {
    return (
        <span className={value.length > max ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {value.length} / {max}
        </span>
    );
}

export function ProposalDraftEditor({ data }: { data: ProposalDraftEditorData }) {
    const router = useRouter();
    const editable = isEditableStatus(data.status);

    const [fields, setFields] = useState<DraftFields>(data.fields);
    const [savedFields, setSavedFields] = useState<DraftFields>(data.fields);
    const [milestones, setMilestones] = useState<MilestoneDraft[]>(data.milestones);
    const [schedule, setSchedule] = useState<ScheduleDraftItem[]>(data.schedule);

    const [view, setView] = useState<"edit" | "preview">("edit");
    const [dialog, setDialog] = useState<null | "needs" | "milestones" | "scope" | "standard" | "schedule" | "terms" | "send">(null);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [creatingVersion, setCreatingVersion] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    const dirty = JSON.stringify(fields) !== JSON.stringify(savedFields);
    const fieldErrors = useMemo(() => validateDraftFields(fields), [fields]);
    const set = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => setFields((current) => ({ ...current, [key]: value }));

    const stepper = getStepper(data.status, data.version);
    const message = readOnlyMessage(data.status);
    const priced = fields.priceMode === "priced";
    const scheduleCheck = validateSchedule(schedule);
    const sendProblems = getSendProblems({ fields, milestones, schedule, today: data.today });

    // ----- save and send ---------------------------------------------------

    async function saveDraft(): Promise<boolean> {
        if (Object.keys(fieldErrors).length > 0) {
            toast.error(Object.values(fieldErrors)[0]);
            return false;
        }
        setSaving(true);
        try {
            const res = await updateProposal(data.proposalId, buildSavePayload(fields));
            if (!res.success) {
                toast.error(res.message || "Could not save the draft.");
                return false;
            }
            setSavedFields(fields);
            return true;
        } catch {
            toast.error("Could not save the draft.");
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveDraft() {
        if (await saveDraft()) toast.success("Draft saved. The client cannot see it until you send it.");
    }

    async function handleSend() {
        setSendError(null);
        if (sendProblems.length > 0) return;
        setSending(true);
        try {
            if (!(await saveDraft())) {
                setSendError("The draft could not be saved, so it was not sent.");
                return;
            }
            const res = await sendProposal(data.proposalId);
            if (!res.success) {
                setSendError(res.message || "The proposal could not be sent.");
                return;
            }
            toast.success("Proposal sent to the client.");
            setDialog(null);
            setView("edit");
            router.refresh();
        } catch {
            setSendError("The proposal could not be sent. Try again.");
        } finally {
            setSending(false);
        }
    }

    async function handleCreateVersion() {
        setCreatingVersion(true);
        try {
            const res = await createProposalRevision(data.leadId);
            if ("proposalId" in res && res.proposalId) {
                if (res.success) toast.success("New version created. You can edit it now.");
                router.push(`/dashboard/proposals/builder/${res.proposalId}`);
                return;
            }
            toast.error(("message" in res && res.message) || "Could not create a new version.");
        } catch {
            toast.error("Could not create a new version.");
        } finally {
            setCreatingVersion(false);
        }
    }

    async function handleResetNeedsGoals() {
        const res = await resetProposalNeedsGoals(data.proposalId);
        if (res.success && "needsGoals" in res && res.needsGoals) {
            toast.success("Needs and goals reset to the discovery form.");
            const next = { needs: res.needsGoals.needs ?? "", goals: res.needsGoals.goals ?? "" };
            // The reset is saved on the server already, so it is not an unsaved change.
            setFields((current) => ({ ...current, ...next }));
            setSavedFields((current) => ({ ...current, ...next }));
            return next;
        }
        toast.error(("message" in res && res.message) || "Could not reset.");
        return null;
    }

    // ----- preview ---------------------------------------------------------

    const previewData: ProposalDocumentData = {
        proposalCode: data.proposalCode,
        businessName: data.businessName,
        projectName: fields.projectName,
        exclusions: fields.exclusions,
        scope: fields.overview,
        technicalApproach: fields.solution,
        deliverables: data.document.deliverables,
        timeline: data.document.timeline,
        pricingStructure: data.document.pricingStructure,
        subtotal: priced ? (fields.totalPrice ?? 0) : 0,
        total: priced ? (fields.totalPrice ?? 0) : 0,
        discount: 0,
        tax: 0,
        priceMode: fields.priceMode,
        currency: fields.currency,
        totalPrice: priced ? fields.totalPrice : null,
        needsGoals: [
            fields.needs ? `Client Needs:\n${fields.needs}` : "",
            fields.goals ? `Goals:\n${fields.goals}` : "",
        ]
            .filter(Boolean)
            .join("\n\n"),
        milestones: milestones.map((m) => ({
            key: m.key,
            title: m.title,
            description: m.description,
            startDate: m.startDate || null,
            endDate: m.endDate || null,
        })),
        paymentScheduleItems: schedule.map((item) => ({ label: item.label, percent: item.percent, trigger: item.trigger })),
        terms: fields.terms,
        validUntil: fields.validUntil || null,
        status: data.status,
        createdAt: data.document.createdAt,
        contractSettings: data.document.contractSettings,
        agencyLogoUrl: data.document.agencyLogoUrl,
        agencyFaviconUrl: data.document.agencyFaviconUrl,
    };

    const sendDialog = (
        <Dialog
            open={dialog === "send"}
            onOpenChange={(open) => {
                if (!sending) setDialog(open ? "send" : null);
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Send to {data.clientName || "the client"}?</DialogTitle>
                    <DialogDescription>
                        This sends version {data.version} of &quot;{fields.projectName.trim() || "this project"}&quot; to {data.clientName || "the client"} ({data.businessName}) by
                        email and in the client portal. After it is sent, it is locked. Any change needs a new version.
                    </DialogDescription>
                </DialogHeader>

                {sendProblems.length > 0 && (
                    <div role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        <p className="font-medium">Fix this before you send:</p>
                        <ul className="list-disc pl-5">
                            {sendProblems.map((problem) => (
                                <li key={problem}>{problem}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {sendError && (
                    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {sendError}
                    </p>
                )}
                {!priced && (
                    <p className="text-sm text-muted-foreground">
                        This version has no price, so the client cannot sign it. They can ask for a pricing meeting or for changes.
                    </p>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" disabled={sending} onClick={() => setDialog(null)}>
                        Cancel
                    </Button>
                    <Button type="button" disabled={sending || sendProblems.length > 0} onClick={handleSend}>
                        {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send to client
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    if (view === "preview") {
        return (
            <div className="min-h-screen bg-muted/30">
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-semibold">
                            Proposal {data.proposalCode} · v{data.version} · {fields.projectName.trim() || "Untitled project"}
                        </span>
                        <Badge variant="outline">{editable ? "Preview, not sent yet" : "Preview"}</Badge>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setView("edit")}>
                            Back to editing
                        </Button>
                        {editable && (
                            <Button type="button" onClick={() => setDialog("send")}>
                                Send to client
                            </Button>
                        )}
                    </div>
                </div>
                <div className="space-y-4 px-4 py-6">
                    {!priced && (
                        <p className="mx-auto max-w-[850px] rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                            This version has no price and cannot be signed.
                        </p>
                    )}
                    <ProposalDocumentSheet data={previewData} agencyLogoUrl={data.document.agencyLogoUrl} agencyFaviconUrl={data.document.agencyFaviconUrl} />
                </div>
                {sendDialog}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-16">
            <Link href="/dashboard/proposals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to proposals
            </Link>

            {/* 1. Header */}
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">
                        Business name: {data.businessName} · Client name: {data.clientName}
                    </p>
                    <Label htmlFor="project-name" className="sr-only">
                        Project name
                    </Label>
                    <Input
                        id="project-name"
                        value={fields.projectName}
                        disabled={!editable}
                        placeholder="Project name"
                        onChange={(e) => set("projectName", e.target.value)}
                        className="h-auto border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl font-bold shadow-none focus-visible:border-input focus-visible:ring-0 md:text-3xl"
                    />
                    <div className="flex justify-between">
                        {fieldErrors.projectName ? (
                            <p role="alert" className="text-xs text-destructive">{fieldErrors.projectName}</p>
                        ) : (
                            <span />
                        )}
                        <Counter value={fields.projectName} max={LIMITS.projectName} />
                    </div>
                </div>
                <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Proposal progress">
                    {stepper.map((step, index) => (
                        <li key={step.label} className="flex items-center gap-2">
                            <span
                                aria-current={step.state === "current" ? "step" : undefined}
                                className={
                                    step.state === "current"
                                        ? "rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground"
                                        : step.state === "done"
                                          ? "rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800"
                                          : "rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground"
                                }
                            >
                                {step.label}
                            </span>
                            {index < stepper.length - 1 && <span aria-hidden="true">&rarr;</span>}
                        </li>
                    ))}
                </ol>
            </header>

            {/* Read-only mode */}
            {message && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p>{message}</p>
                    {canCreateRevision(data.status) && (
                        <Button type="button" size="sm" disabled={creatingVersion} onClick={handleCreateVersion}>
                            {creatingVersion && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Create new version
                        </Button>
                    )}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                {/* Left column */}
                <div className="space-y-6">
                    {/* 2. Proposal */}
                    <section className={cardClass} aria-labelledby="proposal-card">
                        <h2 id="proposal-card" className="text-lg font-semibold">Proposal</h2>
                        <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between">
                                <Label htmlFor="overview">Project overview</Label>
                                <Counter value={fields.overview} max={LIMITS.overview} />
                            </div>
                            <Textarea id="overview" rows={4} disabled={!editable} value={fields.overview} onChange={(e) => set("overview", e.target.value)} />
                            {fieldErrors.overview && <p role="alert" className="text-xs text-destructive">{fieldErrors.overview}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between">
                                <Label htmlFor="solution">Proposed solution and key features</Label>
                                <Counter value={fields.solution} max={LIMITS.solution} />
                            </div>
                            <Textarea id="solution" rows={4} disabled={!editable} value={fields.solution} onChange={(e) => set("solution", e.target.value)} />
                            {fieldErrors.solution && <p role="alert" className="text-xs text-destructive">{fieldErrors.solution}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between">
                                <Label htmlFor="exclusions">Exclusions</Label>
                                <Counter value={fields.exclusions} max={LIMITS.exclusions} />
                            </div>
                            <Input id="exclusions" disabled={!editable} value={fields.exclusions} onChange={(e) => set("exclusions", e.target.value)} placeholder="What is not included" />
                            {fieldErrors.exclusions && <p role="alert" className="text-xs text-destructive">{fieldErrors.exclusions}</p>}
                        </div>
                    </section>

                    {/* 3. Milestones */}
                    <section className={`${cardClass} flex flex-wrap items-center justify-between gap-3`} aria-labelledby="milestones-card">
                        <div>
                            <h2 id="milestones-card" className="text-lg font-semibold">Milestones</h2>
                            <p className="text-sm text-muted-foreground">{milestoneRangeSummary(milestones)}</p>
                        </div>
                        {editable && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setDialog("milestones")}>
                                Edit dates
                            </Button>
                        )}
                    </section>

                    {/* 4. Other document sections */}
                    <section className={cardClass} aria-labelledby="sections-card">
                        <h2 id="sections-card" className="text-lg font-semibold">Other document sections</h2>
                        <ul className="divide-y divide-border">
                            <li className="flex items-center justify-between gap-3 py-2.5">
                                <div>
                                    <p className="text-sm font-medium">Needs and goals</p>
                                    <p className="text-xs text-muted-foreground">Filled in from the discovery form</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setDialog("needs")}>
                                    {editable ? "Review" : "View"}
                                </Button>
                            </li>
                            <li className="flex items-center justify-between gap-3 py-2.5">
                                <div>
                                    <p className="text-sm font-medium">Scope of work and timeline</p>
                                    <p className="text-xs text-muted-foreground">Built from the milestones above</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setDialog("scope")}>
                                    View
                                </Button>
                            </li>
                            <li className="flex items-center justify-between gap-3 py-2.5">
                                <div>
                                    <p className="text-sm font-medium">About us, how we work, team, terms, next steps</p>
                                    <p className="text-xs text-muted-foreground">Standard text, the same in every proposal</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setDialog("standard")}>
                                    View
                                </Button>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* 5. Price */}
                    <section className={cardClass} aria-labelledby="price-card">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 id="price-card" className="text-lg font-semibold">Price</h2>
                            {data.clientType && (
                                <Badge variant="secondary" className="capitalize">{data.clientType} client</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                                {data.clientType ? "set in the discovery form" : "client type not set yet"}
                            </span>
                        </div>

                        <div role="group" aria-label="Price mode" className="grid grid-cols-2 rounded-lg border border-border bg-muted/30 p-1">
                            <button
                                type="button"
                                disabled={!editable}
                                aria-pressed={priced}
                                onClick={() => set("priceMode", "priced")}
                                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${priced ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Include price
                            </button>
                            <button
                                type="button"
                                disabled={!editable}
                                aria-pressed={!priced}
                                onClick={() => set("priceMode", "to_be_discussed")}
                                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${!priced ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Price to be discussed
                            </button>
                        </div>

                        {priced ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="currency">Currency</Label>
                                        <select
                                            id="currency"
                                            className={selectClass}
                                            disabled={!editable}
                                            value={fields.currency}
                                            onChange={(e) => set("currency", e.target.value as "PHP" | "USD")}
                                        >
                                            <option value="PHP">PHP (&#8369;)</option>
                                            <option value="USD">USD ($)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="total-price">Total price</Label>
                                        <Input
                                            id="total-price"
                                            type="number"
                                            min={0}
                                            step={1}
                                            disabled={!editable}
                                            value={fields.totalPrice === null ? "" : fields.totalPrice}
                                            placeholder="e.g. 300000"
                                            onChange={(e) =>
                                                set("totalPrice", e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))))
                                            }
                                        />
                                    </div>
                                </div>
                                {fieldErrors.totalPrice && <p role="alert" className="text-xs text-destructive">{fieldErrors.totalPrice}</p>}
                                <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-semibold">Payment schedule</p>
                                        <p className="text-xs text-muted-foreground">{scheduleSummary(schedule)}</p>
                                        {!scheduleCheck.ok && (
                                            <p role="alert" className="text-xs text-destructive">{scheduleCheck.message}</p>
                                        )}
                                    </div>
                                    {editable && (
                                        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setDialog("schedule")}>
                                            Edit schedule
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
                                <p>
                                    The client sees &quot;Price to be discussed&quot;. After you meet about budget and pricing, send a new version with the price.
                                </p>
                                <p className="font-semibold">This version has no price and cannot be signed.</p>
                            </div>
                        )}
                    </section>

                    {/* 6. Valid until and terms */}
                    <section className={cardClass} aria-labelledby="validity-card">
                        <h2 id="validity-card" className="sr-only">Validity and terms</h2>
                        <div className="space-y-1.5">
                            <Label htmlFor="valid-until">Valid until</Label>
                            <Input
                                id="valid-until"
                                type="date"
                                disabled={!editable}
                                value={fields.validUntil}
                                onChange={(e) => set("validUntil", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">After this date the client cannot sign this version.</p>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                            <p className="text-sm text-muted-foreground">
                                {isStandardTerms(fields.terms) ? "Standard terms apply" : "Custom terms for this client"}
                            </p>
                            <Button type="button" variant="outline" size="sm" onClick={() => setDialog("terms")}>
                                {editable ? "Edit terms" : "View terms"}
                            </Button>
                        </div>
                        {fieldErrors.terms && <p role="alert" className="text-xs text-destructive">{fieldErrors.terms}</p>}
                    </section>

                    {/* 7. Buttons */}
                    <div className="space-y-2">
                        {editable && (
                            <Button type="button" className="h-11 w-full text-base font-semibold" disabled={saving || sending} onClick={() => { setSendError(null); setDialog("send"); }}>
                                Send to client
                            </Button>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" onClick={() => setView("preview")}>
                                Preview document
                            </Button>
                            {editable && (
                                <Button type="button" variant="outline" disabled={saving || sending || !dirty} onClick={handleSaveDraft}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save draft
                                </Button>
                            )}
                        </div>
                        {editable && dirty && <p className="text-xs text-muted-foreground">You have unsaved changes.</p>}
                    </div>
                </div>
            </div>

            {dialog === "needs" && (
                <NeedsGoalsDialog
                    open
                    onOpenChange={(open) => setDialog(open ? "needs" : null)}
                    needs={fields.needs}
                    goals={fields.goals}
                    readOnly={!editable}
                    onApply={(value) => setFields((current) => ({ ...current, ...value }))}
                    onReset={handleResetNeedsGoals}
                />
            )}
            {dialog === "milestones" && (
                <MilestonesDialog
                    open
                    onOpenChange={(open) => setDialog(open ? "milestones" : null)}
                    proposalId={data.proposalId}
                    milestones={milestones}
                    onSaved={setMilestones}
                />
            )}
            <ScopeTimelineDialog open={dialog === "scope"} onOpenChange={(open) => setDialog(open ? "scope" : null)} milestones={milestones} />
            <StandardSectionsDialog open={dialog === "standard"} onOpenChange={(open) => setDialog(open ? "standard" : null)} />
            {dialog === "schedule" && (
                <ScheduleDialog
                    open
                    onOpenChange={(open) => setDialog(open ? "schedule" : null)}
                    proposalId={data.proposalId}
                    items={schedule}
                    totalPrice={fields.totalPrice}
                    currency={fields.currency}
                    onSaved={setSchedule}
                />
            )}
            {dialog === "terms" && (
                <TermsDialog
                    open
                    onOpenChange={(open) => setDialog(open ? "terms" : null)}
                    terms={fields.terms}
                    readOnly={!editable}
                    onApply={(terms) => set("terms", terms)}
                />
            )}
            {sendDialog}
        </div>
    );
}
