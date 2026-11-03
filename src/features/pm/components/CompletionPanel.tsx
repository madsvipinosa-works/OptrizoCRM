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
import { Label } from "@/components/ui/label";
import { addHandoverFile, recordSignOff, completeProject } from "@/features/pm/completion-actions";
import {
    CheckCircle2,
    XCircle,
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
}

export function CompletionPanel({ data }: { data: CompletionGateData }) {
    const router = useRouter();
    const isCompleted = data.status === "Completed";

    // Modals
    const [isHandoverOpen, setIsHandoverOpen] = useState(false);
    const [isSignOffOpen, setIsSignOffOpen] = useState(false);
    const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Handover form
    const [docTitle, setDocTitle] = useState("");
    const [docFileName, setDocFileName] = useState("");
    const [docFileUrl, setDocFileUrl] = useState("");

    // Sign-off form
    const [signOffUrl, setSignOffUrl] = useState(data.signOffFileUrl || "");
    const [signOffDate, setSignOffDate] = useState<string>(() =>
        data.signedOffAt
            ? new Date(data.signedOffAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    );

    const hasSignOff = Boolean(data.signOffFileUrl && data.signedOffAt);
    const hasHandoverFiles = data.handoverDocuments.length > 0;
    const allGatesPassed =
        data.allMilestonesCompleted &&
        data.finalPaymentPaid &&
        hasHandoverFiles &&
        hasSignOff;

    const handleAddHandoverSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docTitle.trim() || !docFileName.trim() || !docFileUrl.trim()) {
            toast.error("Please fill in all document fields.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await addHandoverFile(data.projectId, {
                title: docTitle.trim(),
                fileName: docFileName.trim(),
                fileUrl: docFileUrl.trim(),
            });

            if (res.success) {
                toast.success(res.message || "Handover document added successfully.");
                setIsHandoverOpen(false);
                setDocTitle("");
                setDocFileName("");
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
            const res = await completeProject(data.projectId);
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
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                            <Award className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-foreground">Project Officially Completed</h2>
                            <p className="text-sm text-muted-foreground">
                                All deliverables handed over, client sign-off recorded, and final payment cleared.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="glass-card rounded-xl border border-border p-3.5 space-y-0.5">
                            <div className="text-xs uppercase font-mono text-muted-foreground">Completion Date</div>
                            <div className="text-sm font-semibold text-foreground">
                                {data.completedAt ? new Date(data.completedAt).toLocaleDateString() : "N/A"}
                            </div>
                        </div>
                        <div className="glass-card rounded-xl border border-border p-3.5 space-y-0.5">
                            <div className="text-xs uppercase font-mono text-muted-foreground flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Warranty Period Ends
                            </div>
                            <div className="text-sm font-semibold text-foreground font-mono">
                                {data.warrantyEndsAt ? new Date(data.warrantyEndsAt).toLocaleDateString() : "N/A"}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Quality & Completion Gates Checklist */}
            <div className="glass-card rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Completion Gates</h3>
                        <p className="text-xs text-muted-foreground">
                            All 4 conditions must be met to close out and complete the project.
                        </p>
                    </div>
                    {allGatesPassed && !isCompleted ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Ready to Complete
                        </Badge>
                    ) : isCompleted ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Completed
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                            Gates Incomplete
                        </Badge>
                    )}
                </div>

                <div className="space-y-3 pt-1">
                    {/* Gate 1: Milestones */}
                    <div className="flex items-start justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {data.allMilestonesCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    Gate 1: All Milestones Completed
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
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    Gate 2: Final Payment Cleared
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {data.finalPaymentPaid
                                        ? `Final payment "${data.finalPaymentLabel}" has been confirmed as paid.`
                                        : `Final payment "${data.finalPaymentLabel}" is currently "${data.finalPaymentStatus}".`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Gate 3: Handover Documents */}
                    <div className="flex items-start justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {hasHandoverFiles ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    Gate 3: Handover Documents Attached
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

                    {/* Gate 4: Formal Sign-off */}
                    <div className="flex items-start justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                        <div className="flex items-start gap-3">
                            {hasSignOff ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    Gate 4: Formal Client Sign-off
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {hasSignOff
                                        ? `Sign-off recorded on ${new Date(data.signedOffAt!).toLocaleDateString()}.`
                                        : "Formal client sign-off document and date must be recorded."}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {data.signOffFileUrl && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="h-8 text-xs text-primary"
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
                                    <FileCheck className="w-3.5 h-3.5 mr-1" /> {hasSignOff ? "Update" : "Record"} Sign-off
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Handover Documents List */}
                {data.handoverDocuments.length > 0 && (
                    <div className="pt-3 border-t border-border">
                        <h4 className="text-xs uppercase font-mono text-muted-foreground font-semibold mb-2">
                            Uploaded Handover Files
                        </h4>
                        <div className="space-y-1.5">
                            {data.handoverDocuments.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-primary" />
                                        <span className="font-medium text-foreground">{doc.title}</span>
                                        <span className="text-muted-foreground">({doc.fileName})</span>
                                    </div>
                                    <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline inline-flex items-center gap-1"
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
                            className="font-semibold shadow-sm"
                            onClick={() => setIsCompleteConfirmOpen(true)}
                        >
                            <Award className="w-4 h-4 mr-2" /> Complete Project & Start Warranty
                        </Button>
                    </div>
                )}
            </div>

            {/* Add Handover File Modal */}
            <Dialog open={isHandoverOpen} onOpenChange={setIsHandoverOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Handover Document</DialogTitle>
                        <DialogDescription>
                            Attach deliverables, design exports, credentials documentation, or manual files for client handover.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddHandoverSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="docTitle">Document Title *</Label>
                            <Input
                                id="docTitle"
                                placeholder="e.g. Design Tokens & Figma Assets"
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="docFileName">File Name *</Label>
                            <Input
                                id="docFileName"
                                placeholder="e.g. optrizo-assets.zip"
                                value={docFileName}
                                onChange={(e) => setDocFileName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="docFileUrl">File URL *</Label>
                            <Input
                                id="docFileUrl"
                                placeholder="/uploads/optrizo-assets.zip"
                                value={docFileUrl}
                                onChange={(e) => setDocFileUrl(e.target.value)}
                                required
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Allowed storage: /api/private-file, /uploads/, or .blob.vercel-storage.com
                            </p>
                        </div>
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
                                {isLoading ? "Adding..." : "Add Document"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Record Sign-Off Modal */}
            <Dialog open={isSignOffOpen} onOpenChange={setIsSignOffOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record Client Sign-Off</DialogTitle>
                        <DialogDescription>
                            Attach the signed certificate of acceptance or sign-off form and record the execution date.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRecordSignOffSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="signOffUrl">Sign-Off Document URL *</Label>
                            <Input
                                id="signOffUrl"
                                placeholder="/uploads/client-acceptance.pdf"
                                value={signOffUrl}
                                onChange={(e) => setSignOffUrl(e.target.value)}
                                required
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Allowed storage: /api/private-file, /uploads/, or .blob.vercel-storage.com
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="signOffDate">Sign-Off Date *</Label>
                            <Input
                                id="signOffDate"
                                type="date"
                                max={new Date().toISOString().split("T")[0]}
                                value={signOffDate}
                                onChange={(e) => setSignOffDate(e.target.value)}
                                required
                            />
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
                                {isLoading ? "Saving..." : "Save Sign-Off"}
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
                            <AlertTriangle className="w-5 h-5 text-amber-500" /> Confirm Project Completion
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to mark &quot;{data.projectTitle}&quot; as Completed?
                        </DialogDescription>
                    </DialogHeader>
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
                            disabled={isLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isLoading ? "Completing..." : "Confirm & Complete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
