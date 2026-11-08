"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
    CheckCircle2,
    Circle,
    FileText,
    FileCheck,
    ShieldCheck,
    Award,
    ExternalLink,
    UploadCloud,
    AlertTriangle,
} from "lucide-react";
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

    return (
        <div className="space-y-6">
            {isCompleted ? (
                <div className="rounded-xl border border-brand-deep/30 bg-brand-soft p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-deep flex items-center justify-center shrink-0">
                            <Award className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-semibold text-foreground">Project complete</h2>
                            <p className="text-sm text-muted-foreground">
                                All deliverables handed over, client sign-off recorded, and final payment cleared.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="bg-card rounded-xl border border-border p-3.5 space-y-0.5">
                            <div className="text-xs tabular-nums text-muted-foreground">Completion Date</div>
                            <div className="text-sm font-semibold text-foreground">
                                {data.completedAt ? new Date(data.completedAt).toLocaleDateString() : "N/A"}
                            </div>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-3.5 space-y-0.5">
                            <div className="text-xs tabular-nums text-muted-foreground flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-brand-deep" /> Warranty Period Ends
                            </div>
                            <div className="text-sm font-semibold text-foreground tabular-nums">
                                {data.warrantyEndsAt ? new Date(data.warrantyEndsAt).toLocaleDateString() : "N/A"}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Quality & Completion Gates Checklist */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Handover checklist</h3>
                        <p className="text-sm text-muted-foreground">
                            {gatesDone} of 4 done. The client must accept the handover before you can mark the project complete.
                        </p>
                    </div>
                    {allGatesPassed && !isCompleted ? (
                        <Badge className="bg-brand-soft text-brand-deep dark:text-brand-deep border-brand-deep/30">
                            Ready to complete
                        </Badge>
                    ) : isCompleted ? (
                        <Badge className="bg-brand-soft text-brand-deep dark:text-brand-deep border-brand-deep/30">
                            Completed
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground tabular-nums">
                            {gatesDone} of 4
                        </Badge>
                    )}
                </div>

                <div className="space-y-3 pt-1">
                    {/* Gate 1: Milestones */}
                    <div className="flex items-start justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {data.allMilestonesCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-brand-deep shrink-0 mt-0.5" />
                            ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/60 shrink-0 mt-0.5" aria-label="Not done yet" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    All milestones are complete
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {data.allMilestonesCompleted
                                        ? "All project milestones are fully completed."
                                        : `${data.uncompletedMilestones.length} milestone(s) remaining incomplete.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Gate 2: Final Payment */}
                    <div className="flex items-start justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {data.finalPaymentPaid ? (
                                <CheckCircle2 className="w-5 h-5 text-brand-deep shrink-0 mt-0.5" />
                            ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/60 shrink-0 mt-0.5" aria-label="Not done yet" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    Final payment received
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {data.finalPaymentPaid
                                        ? `Final payment "${data.finalPaymentLabel}" has been confirmed as paid.`
                                        : `"${data.finalPaymentLabel}" is not paid yet (${data.finalPaymentStatus.replace(/_/g, " ")}).`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Gate 3: Handover Documents */}
                    <div className="flex items-start justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {hasHandoverFiles ? (
                                <CheckCircle2 className="w-5 h-5 text-brand-deep shrink-0 mt-0.5" />
                            ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/60 shrink-0 mt-0.5" aria-label="Not done yet" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    Final files uploaded
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {hasHandoverFiles
                                        ? `${data.handoverDocuments.length} handover file(s) uploaded.`
                                        : "At least one handover document must be attached."}
                                </p>
                            </div>
                        </div>
                        {!isCompleted && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs shrink-0"
                                onClick={() => setIsHandoverOpen(true)}
                            >
                                <UploadCloud className="w-3.5 h-3.5 mr-1" /> Add File
                            </Button>
                        )}
                    </div>

                    {/* Gate 4: Client acceptance */}
                    <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {accepted ? (
                                <CheckCircle2 className="w-5 h-5 text-brand-deep shrink-0 mt-0.5" />
                            ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/60 shrink-0 mt-0.5" aria-label="Not done yet" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">Client accepted the handover</div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {accepted
                                        ? `Accepted on ${new Date(data.acceptedAt!).toLocaleDateString()}.`
                                        : data.acceptance === "awaiting"
                                            ? `Requested on ${new Date(data.acceptanceRequestedAt!).toLocaleDateString()}. Waiting for the client.${data.canAssume ? " The wait is over: you can complete with a reason." : ""}`
                                            : data.acceptance === "fixes_requested"
                                                ? `The client asked for fixes: "${data.fixesComment ?? ""}". Make the fixes, add files if needed, then request acceptance again.`
                                                : "Finish the three steps above, then ask the client to review."}
                                </p>
                            </div>
                        </div>
                        {!isCompleted && !accepted && data.acceptance !== "awaiting" && (
                            <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={!baseReady || isLoading} onClick={handleRequestAcceptance}>
                                Request client acceptance
                            </Button>
                        )}
                    </div>

                    {/* Optional: signed paper form kept as supporting evidence */}
                    <div className="flex items-start justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {hasSignOff ? (
                                <CheckCircle2 className="w-5 h-5 text-brand-deep shrink-0 mt-0.5" />
                            ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/60 shrink-0 mt-0.5" aria-label="Not done yet" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    Signed completion form (optional)
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {hasSignOff
                                        ? `Sign-off recorded on ${new Date(data.signedOffAt!).toLocaleDateString()}.`
                                        : "Attach a signed paper form as supporting evidence, if you have one."}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {data.signOffFileUrl && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="h-8 text-xs text-brand-deep"
                                >
                                    <a
                                        href={data.signOffFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" /> View
                                    </a>
                                </Button>
                            )}
                            {!isCompleted && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => setIsSignOffOpen(true)}
                                >
                                    <FileCheck className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> {hasSignOff ? "Update sign-off" : "Record sign-off"}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Handover Documents List */}
                {data.handoverDocuments.length > 0 && (
                    <div className="pt-3 border-t border-border">
                        <h4 className="text-xs tabular-nums text-muted-foreground font-semibold mb-2">
                            Uploaded Handover Files
                        </h4>
                        <div className="space-y-1.5">
                            {data.handoverDocuments.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-brand-deep" />
                                        <span className="font-medium text-foreground">{doc.title}</span>
                                        <span className="text-muted-foreground">({doc.fileName})</span>
                                    </div>
                                    <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-brand-deep hover:underline inline-flex items-center gap-1"
                                    >
                                        Open <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Execution Button */}
                {!isCompleted && (
                    <div className="pt-4 border-t border-border flex justify-end">
                        <Button
                            size="lg"
                            disabled={!allGatesPassed || isLoading}
                            className="font-semibold active:scale-[0.97]"
                            onClick={() => setIsCompleteConfirmOpen(true)}
                        >
                            <Award className="w-4 h-4 mr-2" aria-hidden="true" /> Mark project complete
                        </Button>
                    </div>
                )}
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

