"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/ui/file-upload";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { Label } from "@/components/ui/label";
import { addHandoverFile, recordSignOff, completeProject, requestClientAcceptance } from "@/features/pm/completion-actions";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, FileText, UploadCloud, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface HandoverDoc {
    id: string;
    title: string;
    fileName: string;
    fileUrl: string;
    createdAt: Date | string;
}

export interface CompletionGateData {
    projectId: string;
    projectTitle: string;
    status: string;
    completedAt: Date | string | null;
    warrantyEndsAt: Date | string | null;
    signOffFileUrl: string | null;
    signedOffAt: Date | string | null;
    allMilestonesCompleted: boolean;
    uncompletedMilestones: { id: string; title: string; status: string }[];
    finalPaymentPaid: boolean;
    finalPaymentLabel: string;
    finalPaymentStatus: string;
    handoverDocuments: HandoverDoc[];
    acceptance: "not_requested" | "awaiting" | "fixes_requested" | "accepted";
    acceptanceRequestedAt: Date | string | null;
    acceptedAt: Date | string | null;
    acceptanceAssumed: boolean;
    fixesComment: string | null;
    /** True once the client has had the full wait without answering (computed on the server). */
    canAssume: boolean;
}

const FILE_ACCEPT = ".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp";

/** Upload a file, or paste a Google Docs / Drive link. Reports one value: the file path or the link. */
function FileOrLinkField({ value, onChange, projectId, label }: { value: string; onChange: (v: string) => void; projectId: string; label: string }) {
    const [mode, setMode] = useState<"upload" | "link">(/^https:\/\/(docs|drive)\.google\.com\//.test(value) ? "link" : "upload");
    return (
        <div className="space-y-2">
            <div className="flex gap-2" role="group" aria-label={`${label} source`}>
                {(["upload", "link"] as const).map((m) => (
                    <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} onClick={() => { setMode(m); onChange(""); }}>
                        {m === "upload" ? "Upload file" : "Google Docs / Drive link"}
                    </Button>
                ))}
            </div>
            {mode === "upload" ? (
                <FileUpload label={label} value={value} onChange={onChange} projectId={projectId} accept={FILE_ACCEPT} hint="PDF, Word, ZIP or image (MAX. 15MB)" />
            ) : (
                <div className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input type="url" inputMode="url" placeholder="https://docs.google.com/... or https://drive.google.com/..." value={value} onChange={(e) => onChange(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Set sharing so the client can open it. Only docs.google.com and drive.google.com links are accepted.</p>
                </div>
            )}
        </div>
    );
}

export function CompletionPanel({ data }: { data: CompletionGateData }) {
    const router = useRouter();
    const isCompleted = data.status === "Completed";

    // Modals
    const [isHandoverOpen, setIsHandoverOpen] = useState(false);
    const [isSignOffOpen, setIsSignOffOpen] = useState(false);
    const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [assumedReason, setAssumedReason] = useState("");

    // Handover form
    const [docTitle, setDocTitle] = useState("");
    const [docFileUrl, setDocFileUrl] = useState("");

    // Sign-off form
    const [signOffUrl, setSignOffUrl] = useState(data.signOffFileUrl || "");
    const [signOffDate, setSignOffDate] = useState<string>(() =>
        data.signedOffAt
            ? new Date(data.signedOffAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    );

    const fileNameFrom = (url: string, fallback: string) => {
        try {
            return decodeURIComponent(new URL(url, "http://x").pathname.split("/").pop() || "") || fallback.trim();
        } catch {
            return fallback.trim();
        }
    };

    const hasSignOff = Boolean(data.signOffFileUrl && data.signedOffAt);
    const hasHandoverFiles = data.handoverDocuments.length > 0;
    const baseReady = data.allMilestonesCompleted && data.finalPaymentPaid && hasHandoverFiles;
    const accepted = data.acceptance === "accepted";
    const gatesDone = [data.allMilestonesCompleted, data.finalPaymentPaid, hasHandoverFiles, accepted].filter(Boolean).length;
    // Complete after the client accepts, or after the wait with a reason (assumed acceptance).
    const allGatesPassed = baseReady && (accepted || data.canAssume);

    const handleRequestAcceptance = async () => {
        setIsLoading(true);
        try {
            const res = await requestClientAcceptance(data.projectId);
            if (res.success) {
                toast.success(res.message || "Acceptance requested.");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to request acceptance.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddHandoverSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docTitle.trim() || !docFileUrl.trim()) {
            toast.error("Add a title and upload a file or paste a link.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await addHandoverFile(data.projectId, {
                title: docTitle.trim(),
                fileName: fileNameFrom(docFileUrl, docTitle),
                fileUrl: docFileUrl.trim(),
            });

            if (res.success) {
                toast.success(res.message || "Handover document added successfully.");
                setIsHandoverOpen(false);
                setDocTitle("");
                setDocFileUrl("");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to add handover document.");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error adding handover file");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecordSignOffSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signOffUrl.trim()) {
            toast.error("Sign-off document URL is required.");
            return;
        }

        if (new Date(signOffDate) > new Date()) {
            toast.error("Sign-off date cannot be in the future.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await recordSignOff(data.projectId, {
                signOffFileUrl: signOffUrl.trim(),
                signedOffAt: new Date(signOffDate),
            });

            if (res.success) {
                toast.success(res.message || "Client sign-off recorded successfully.");
                setIsSignOffOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to record sign-off.");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error recording sign-off");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecuteCompletion = async () => {
        setIsLoading(true);
        try {
            const res = await completeProject(data.projectId, accepted ? undefined : { assumedReason });
            if (res.success) {
                toast.success(res.message || "Project marked as Completed!");
                setIsCompleteConfirmOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to complete project.");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error completing project");
        } finally {
            setIsLoading(false);
        }
    };

    const fmt = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Not set");
    const warrantyDaysLeft = data.warrantyEndsAt ? Math.max(0, Math.ceil((new Date(data.warrantyEndsAt).getTime() - new Date().getTime()) / 86_400_000)) : null;

    const files = (
        <ul className="space-y-2">
            {data.handoverDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">Added {fmt(doc.createdAt)}</p>
                    </div>
                    <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md text-sm font-semibold text-brand-deep outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Open
                    </a>
                </li>
            ))}
        </ul>
    );

    // ---- After completion: what is true now, and where to go next.
    if (isCompleted) {
        return (
            <>
                <section aria-labelledby="done-heading" className="space-y-5 rounded-xl border border-border bg-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 id="done-heading" className="text-xl font-semibold tracking-tight text-foreground">Project complete</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Completed on {fmt(data.completedAt)}. The 3-month warranty is running.</p>
                        </div>
                        <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-deep">Completed</span>
                    </div>

                    <dl className="grid grid-cols-1 gap-4 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-muted-foreground">Warranty ends</dt>
                            <dd className="mt-1 text-base font-medium tabular-nums text-foreground">
                                {fmt(data.warrantyEndsAt)}
                                {warrantyDaysLeft !== null && <span className="ml-1.5 text-sm font-normal text-muted-foreground">({warrantyDaysLeft} days left)</span>}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Client acceptance</dt>
                            <dd className="mt-1 text-base font-medium text-foreground">
                                {data.acceptanceAssumed ? "Assumed (no answer in 14 days)" : data.acceptedAt ? `Accepted ${fmt(data.acceptedAt)}` : "Recorded"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Handover files</dt>
                            <dd className="mt-1 text-base font-medium tabular-nums text-foreground">{data.handoverDocuments.length}</dd>
                        </div>
                    </dl>

                    {data.handoverDocuments.length > 0 && files}

                    <div className="space-y-3 border-t border-border pt-5">
                        <h3 className="text-base font-semibold text-foreground">What happens now</h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            <li>The client got an email and a portal notice, and can download the handover files.</li>
                            <li>The client is asked for feedback (1 to 5 with a comment) in their portal.</li>
                            <li>Fixes found before {fmt(data.warrantyEndsAt)} are covered by the warranty.</li>
                        </ul>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Button asChild className="h-10 font-semibold active:scale-[0.97]">
                                <Link href="/dashboard/pm">Back to projects</Link>
                            </Button>
                            <Button asChild variant="outline" className="h-10 bg-card active:scale-[0.97]">
                                <Link href={`/dashboard/pm/${data.projectId}`}>Open the board</Link>
                            </Button>
                            <Button asChild variant="outline" className="h-10 bg-card active:scale-[0.97]">
                                <Link href={`/dashboard/pm/${data.projectId}/activity`}>See activity</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    const steps: { done: boolean; title: string; detail: string; action?: React.ReactNode }[] = [
        {
            done: data.allMilestonesCompleted,
            title: "All milestones are complete",
            detail: data.allMilestonesCompleted ? "Every milestone is done." : `${data.uncompletedMilestones.length} still open.`,
        },
        {
            done: data.finalPaymentPaid,
            title: "Final payment received",
            detail: data.finalPaymentPaid ? `"${data.finalPaymentLabel}" is paid.` : `"${data.finalPaymentLabel}" is not paid yet (${data.finalPaymentStatus.replace(/_/g, " ")}).`,
        },
        {
            done: hasHandoverFiles,
            title: "Final files uploaded",
            detail: hasHandoverFiles ? `${data.handoverDocuments.length} file${data.handoverDocuments.length === 1 ? "" : "s"} in the handover pack.` : "Add at least one file to the handover pack.",
        },
        {
            done: accepted,
            title: "Client accepted the handover",
            detail: accepted
                ? `Accepted ${fmt(data.acceptedAt)}.`
                : data.acceptance === "awaiting"
                    ? `Asked ${fmt(data.acceptanceRequestedAt)}. Waiting for the client.`
                    : data.acceptance === "fixes_requested"
                        ? "The client asked for fixes (see the handover pack)."
                        : "Ask the client once the steps above are done.",
        },
        {
            done: hasSignOff,
            title: "Signed completion form (optional)",
            detail: hasSignOff ? `Recorded ${fmt(data.signedOffAt)}.` : "Supporting evidence, if you have a signed paper form.",
            action: (
                <div className="flex shrink-0 items-center gap-2">
                    {data.signOffFileUrl && (
                        <a href={data.signOffFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-deep hover:underline">
                            View
                        </a>
                    )}
                    <Button size="sm" variant="outline" className="h-8 bg-card active:scale-[0.97]" onClick={() => setIsSignOffOpen(true)}>
                        {hasSignOff ? "Update" : "Record sign-off"}
                    </Button>
                </div>
            ),
        },
    ];

    // ---- Before completion (mockup 30): checklist on the left, handover pack on the right.
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                <section aria-labelledby="checklist-heading" className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 id="checklist-heading" className="text-lg font-semibold tracking-tight text-foreground">Handover checklist</h2>
                        <span className="text-sm tabular-nums text-muted-foreground">{gatesDone} of 4 done</span>
                    </div>
                    <ul className="mt-4 space-y-4">
                        {steps.map((st) => (
                            <li key={st.title} className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    {st.done ? (
                                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-deep" aria-label="Done" />
                                    ) : (
                                        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" aria-label="Not done yet" />
                                    )}
                                    <div>
                                        <p className="text-base text-foreground">{st.title}</p>
                                        <p className="text-sm text-muted-foreground">{st.detail}</p>
                                    </div>
                                </div>
                                {st.action}
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="pack-heading" className="space-y-4 rounded-xl border border-border bg-card p-5">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 id="pack-heading" className="text-lg font-semibold tracking-tight text-foreground">Handover pack</h2>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-card active:scale-[0.97]" onClick={() => setIsHandoverOpen(true)}>
                            <UploadCloud className="size-4" aria-hidden="true" /> Add file
                        </Button>
                    </div>

                    {hasHandoverFiles ? files : <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">No files yet. Add the final files or a Google Drive link.</p>}

                    {data.acceptance === "fixes_requested" && (
                        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-foreground">
                            <span className="font-semibold text-destructive">The client asked for fixes:</span> {data.fixesComment}
                            <p className="mt-1 text-muted-foreground">Make the fixes, add files if needed, then ask the client again.</p>
                        </div>
                    )}
                    {data.acceptance === "awaiting" && (
                        <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                            Waiting for the client since {fmt(data.acceptanceRequestedAt)}. They got an email and a portal notice.
                            {data.canAssume && " It has been 14 days: you can complete with a reason."}
                        </p>
                    )}

                    <div className="space-y-2 border-t border-border pt-4">
                        {!accepted && data.acceptance !== "awaiting" && (
                            <>
                                <Button className="h-11 w-full text-base font-semibold active:scale-[0.97]" disabled={!baseReady || isLoading} onClick={handleRequestAcceptance}>
                                    {data.acceptance === "fixes_requested" ? "Ask the client again" : "Request client acceptance"}
                                </Button>
                                {!baseReady && <p className="text-center text-sm text-muted-foreground">Finish the milestones, final payment and files first.</p>}
                            </>
                        )}
                        <p className="text-sm text-muted-foreground">Marking complete starts the 3-month warranty and tells the client.</p>
                        <Button
                            variant={accepted || data.canAssume ? "default" : "outline"}
                            className="h-11 w-full text-base font-semibold active:scale-[0.97]"
                            disabled={!allGatesPassed || isLoading}
                            onClick={() => setIsCompleteConfirmOpen(true)}
                        >
                            Mark project complete
                        </Button>
                    </div>
                </section>
            </div>

            {/* Add Handover File Modal */}
            <Dialog open={isHandoverOpen} onOpenChange={setIsHandoverOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add handover file</DialogTitle>
                        <DialogDescription>
                            Attach deliverables, design exports, credentials documentation, or manual files for client handover.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddHandoverSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="docTitle">File title *</Label>
                            <Input
                                id="docTitle"
                                placeholder="e.g. Design Tokens & Figma Assets"
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                required
                            />
                        </div>
                        <FileOrLinkField label="File *" value={docFileUrl} onChange={setDocFileUrl} projectId={data.projectId} />
                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsHandoverOpen(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Adding..." : "Add file"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Record Sign-Off Modal */}
            <Dialog open={isSignOffOpen} onOpenChange={setIsSignOffOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record completion sign-off</DialogTitle>
                        <DialogDescription>
                            Attach the signed certificate of acceptance or sign-off form and record the execution date.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRecordSignOffSubmit} className="space-y-4 py-2">
                        <FileOrLinkField label="Signed sign-off file *" value={signOffUrl} onChange={setSignOffUrl} projectId={data.projectId} />
                        <div className="space-y-1.5">
                            <Label htmlFor="signOffDate">Date signed *</Label>
                            <DatePicker id="signOffDate" max={todayYmd()} value={signOffDate} onChange={setSignOffDate} required />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsSignOffOpen(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Saving..." : "Save sign-off"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Completion Modal */}
            <Dialog open={isCompleteConfirmOpen} onOpenChange={setIsCompleteConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-stage-negotiation" aria-hidden="true" /> Mark project complete?
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to mark &quot;{data.projectTitle}&quot; as Completed?
                        </DialogDescription>
                    </DialogHeader>
                    {!accepted && (
                        <div className="space-y-1.5 py-1">
                            <Label htmlFor="assumedReason">Why complete without the client&apos;s answer? *</Label>
                            <Textarea id="assumedReason" value={assumedReason} onChange={(e) => setAssumedReason(e.target.value)} placeholder="e.g. Called twice and emailed, no reply." />
                            <p className="text-xs text-muted-foreground">Recorded as assumed acceptance in the audit log.</p>
                        </div>
                    )}
                    <div className="text-xs text-muted-foreground space-y-2 py-2">
                        <p>This action will:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Set project status to Completed.</li>
                            <li>Start the 3-month warranty period immediately.</li>
                            <li>Send completion email and portal notification to the client.</li>
                            <li>Unlock client handover files and feedback submission in the portal.</li>
                        </ul>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCompleteConfirmOpen(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleExecuteCompletion}
                            disabled={isLoading || (!accepted && !assumedReason.trim())}
                            className="bg-brand-deep hover:bg-brand-deep text-white"
                        >
                            {isLoading ? "Completing..." : "Confirm & Complete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

