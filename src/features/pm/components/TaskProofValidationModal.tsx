"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    ShieldCheck,
    Link2,
    FileText,
    AlertCircle,
    Loader2,
    Edit2,
    ExternalLink,
    Copy,
    Check,
    ClipboardList,
    XCircle,
    Paperclip,
    Plus,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskProofValidationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: {
        id: string;
        title: string;
        description?: string | null;
        status?: string;
        proofLinks?: { label: string; url: string }[] | null;
        proofNotes?: string | null;
    } | null;
    targetStatus: "In Review" | "Done";
    onConfirm: (proofLinks: { label: string; url: string }[], proofNotes: string, files?: string[]) => Promise<void>;
    mode?: "transition" | "edit";
    isViewOnly?: boolean;
    initialTab?: "proofs";
    onRequestChanges?: () => Promise<void>;
}

export function TaskProofValidationModal({
    open,
    onOpenChange,
    task,
    targetStatus,
    onConfirm,
    mode = "transition",
    isViewOnly = false,
    onRequestChanges,
}: TaskProofValidationModalProps) {
    const [proofLinks, setProofLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
    const [proofFiles, setProofFiles] = useState<string[]>([]);
    const [newFileUrl, setNewFileUrl] = useState("");
    const [proofNotes, setProofNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [isRequestingChanges, setIsRequestingChanges] = useState(false);
    const [isEditing, setIsEditing] = useState(mode === "transition");

    useEffect(() => {
        if (open && task) {
            // Split existing proofLinks into files and web links if applicable
            const links = task.proofLinks || [];
            const existingFiles = links.filter((l) => l.label === "File").map((l) => l.url);
            const existingLinks = links.filter((l) => l.label !== "File");

            setProofFiles(existingFiles);
            setProofLinks(existingLinks.length > 0 ? existingLinks : [{ label: "", url: "" }]);
            setProofNotes(task.proofNotes || "");
            setError(null);
            setNewFileUrl("");
            setIsEditing(mode === "transition");
        }
    }, [task, open, mode]);

    const addLink = () => setProofLinks([...proofLinks, { label: "", url: "" }]);
    const removeLink = (index: number) => setProofLinks(proofLinks.filter((_, i) => i !== index));
    const updateLink = (index: number, field: "label" | "url", value: string) => {
        const newLinks = [...proofLinks];
        newLinks[index][field] = value;
        setProofLinks(newLinks);
    };

    const addFile = () => {
        if (!newFileUrl.trim()) return;
        setProofFiles([...proofFiles, newFileUrl.trim()]);
        setNewFileUrl("");
    };

    const removeFile = (index: number) => {
        setProofFiles(proofFiles.filter((_, i) => i !== index));
    };

    const handleCopyUrl = (url: string, index: number) => {
        const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
        navigator.clipboard.writeText(formattedUrl);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validLinks = proofLinks
            .filter((l) => l.url.trim() !== "" || l.label.trim() !== "")
            .map((l) => {
                let url = l.url.trim();
                let label = l.label.trim();

                if (url === "" && (label.startsWith("http") || label.includes("."))) {
                    url = label;
                    label = "Proof Link";
                }

                if (url === "") url = label;

                if (!/^https?:\/\//i.test(url)) {
                    url = `https://${url}`;
                }
                return { label: label || "Proof Link", url };
            });

        const validFiles = proofFiles.filter((f) => f.trim().length > 0);
        if (newFileUrl.trim()) {
            validFiles.push(newFileUrl.trim());
        }

        // Per spec: at least one file or link required for submitTask
        if (validLinks.length === 0 && validFiles.length === 0) {
            setError("At least one file or link is required to submit this task.");
            return;
        }

        for (const link of validLinks) {
            try {
                new URL(link.url);
            } catch {
                setError(`Invalid URL format: ${link.url}`);
                return;
            }
        }

        try {
            setIsSubmitting(true);
            // Combine links and files for backwards compatibility with storage
            const combinedLinks = [
                ...validLinks,
                ...validFiles.map((fileUrl) => ({ label: "File", url: fileUrl })),
            ];
            await onConfirm(combinedLinks, proofNotes.trim(), validFiles);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit task proof.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInsertTemplate = () => {
        const text = `${task?.title || ""} ${task?.description || ""}`.toLowerCase();
        const isDesign = /(figma|design|ui|ux|wireframe|mockup|banner|logo|palette|prototype)/i.test(text);
        const isMarketing = /(marketing|social media|campaign|post|reel|tweet|newsletter|ad|utm)/i.test(text);

        let template = "";
        if (isDesign) {
            template = `• Implementation: Designed components, layout states, and responsive frames.\n• Verification: Reviewed against design tokens, dark mode, and breakpoints.\n• Delivery & Artifacts: Figma frames and prototype specs updated for review.`;
        } else if (isMarketing) {
            template = `• Implementation: Produced copy, creative assets, and campaign distribution.\n• Verification: Verified tracking UTMs, audience parameters, and post schedule.\n• Delivery & Artifacts: Live post and distribution channel links ready for review.`;
        } else {
            template = `• Implementation: Built and configured feature components and logic.\n• Verification: Tested functionality, edge cases, and test suites in staging.\n• Delivery & Artifacts: Code committed with pull request ready for review.`;
        }

        if (proofNotes.trim().length === 0) {
            setProofNotes(template);
        } else {
            setProofNotes((prev) => `${prev.trim()}\n\n${template}`);
        }
    };

    const hasProofLinks = proofLinks.some((l) => l.url.trim().length > 0) || proofFiles.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[680px] md:max-w-[740px] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col bg-card border-border text-foreground rounded-xl overflow-hidden focus:outline-none">
                {/* Pinned Header */}
                <DialogHeader className="shrink-0 p-4 sm:p-6 pb-3 border-b border-border bg-card/95 z-10 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
                                Proof of Work Verification
                            </Badge>
                        </div>
                    </div>

                    <div>
                        <DialogTitle className="text-lg sm:text-xl font-semibold text-foreground tracking-tight break-words [overflow-wrap:anywhere]">
                            {mode === "transition"
                                ? "Submit Work for Review"
                                : isViewOnly
                                ? "Task Proofs & Deliverables"
                                : isEditing
                                ? "Edit Task Proofs"
                                : "Task Proofs"}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-1 break-words [overflow-wrap:anywhere]">
                            {mode === "transition" ? (
                                <>
                                    Moving <span className="font-semibold text-foreground">&quot;{task?.title}&quot;</span> to{" "}
                                    <Badge
                                        className={cn(
                                            "inline-flex items-center text-xs px-1.5 py-0.5",
                                            targetStatus === "Done"
                                                ? "bg-brand-soft text-brand-deep dark:text-brand-deep border-brand-deep/30"
                                                : "bg-stage-negotiation/20 text-stage-negotiation dark:text-stage-negotiation border-stage-negotiation/30"
                                        )}
                                    >
                                        {targetStatus}
                                    </Badge>{" "}
                                    requires at least one file or link.
                                </>
                            ) : (
                                <>
                                    Deliverables and verification links for{" "}
                                    <span className="font-semibold text-foreground">&quot;{task?.title}&quot;</span>.
                                </>
                            )}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Form wrapping scrollable body and pinned footer */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Scrollable Content Body */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4">
                        {error && (
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="break-words [overflow-wrap:anywhere]">{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Files Section */}
                            <div className="space-y-2.5">
                                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                                    Deliverable Files & Attachments
                                </Label>

                                {isEditing && (
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            type="text"
                                            placeholder="File URL or upload path (e.g. /uploads/... or storage link)"
                                            value={newFileUrl}
                                            onChange={(e) => setNewFileUrl(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addFile();
                                                }
                                            }}
                                            className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground h-8 text-xs tabular-nums"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={addFile}
                                            disabled={!newFileUrl.trim()}
                                            className="h-8 text-xs px-3 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> Add File
                                        </Button>
                                    </div>
                                )}

                                {proofFiles.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {proofFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    <a
                                                        href={file.startsWith("http") ? file : `https://${file}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="tabular-nums text-primary underline truncate hover:text-primary/80"
                                                    >
                                                        {file}
                                                    </a>
                                                </div>
                                                {isEditing && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeFile(idx)}
                                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">No files attached.</p>
                                )}
                            </div>

                            {/* Proof Links Section */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Link2 className="w-3.5 h-3.5 text-primary" />
                                        Proof Links (Figma, GitHub PR, Preview URLs)
                                    </Label>
                                    {!isViewOnly && isEditing && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addLink}
                                            className="h-6 text-xs px-2 py-0 border-primary/30 text-primary hover:bg-primary/10"
                                        >
                                            + Add Link
                                        </Button>
                                    )}
                                    {!isViewOnly && !isEditing && mode === "edit" && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsEditing(true)}
                                            className="h-6 text-xs px-2 py-0 border-primary/30 text-primary hover:bg-primary/10 gap-1"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit Proofs
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {proofLinks.map((link, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            {isEditing ? (
                                                <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                                    <div className="w-full sm:w-[130px] shrink-0">
                                                        <Input
                                                            placeholder="Label (e.g. Figma)"
                                                            value={link.label}
                                                            onChange={(e) => updateLink(index, "label", e.target.value)}
                                                            className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <Input
                                                            type="text"
                                                            placeholder="https://..."
                                                            value={link.url}
                                                            onChange={(e) => updateLink(index, "url", e.target.value)}
                                                            className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground h-8 text-xs tabular-nums"
                                                        />
                                                    </div>
                                                    {proofLinks.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeLink(index)}
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs shrink-0 self-end sm:self-auto"
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex-1 min-w-0 p-3 rounded-lg bg-muted/40 border border-border hover:bg-muted/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    {link.url ? (
                                                        <>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-foreground">
                                                                        {link.label || "Proof Link"}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground tabular-nums">
                                                                        #{index + 1}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-primary mt-0.5 min-w-0">
                                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                                    <a
                                                                        href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs tabular-nums underline hover:text-primary/80 truncate break-all block max-w-full"
                                                                    >
                                                                        {link.url}
                                                                    </a>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleCopyUrl(link.url, index)}
                                                                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
                                                                    title="Copy URL"
                                                                >
                                                                    {copiedIndex === index ? (
                                                                        <>
                                                                            <Check className="w-3 h-3 text-brand-deep" />
                                                                            <span className="text-brand-deep">Copied</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Copy className="w-3 h-3" />
                                                                            <span>Copy</span>
                                                                        </>
                                                                    )}
                                                                </Button>
                                                                <a
                                                                    href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-xs font-medium bg-primary/10 text-foreground dark:text-primary hover:bg-primary/20 transition-colors gap-1 border border-primary/20"
                                                                >
                                                                    <span>Open</span>
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">Empty link</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Completion Notes Section */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <Label htmlFor="proofNotes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-primary" />
                                        Completion Notes & Delivery Summary
                                    </Label>
                                    {isEditing && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleInsertTemplate}
                                            className="h-6 text-xs px-2 py-0 border-border bg-background text-foreground hover:bg-muted gap-1"
                                            title="Insert standard checklist template"
                                        >
                                            <ClipboardList className="w-2.5 h-2.5 text-muted-foreground" />
                                            <span>Template</span>
                                        </Button>
                                    )}
                                </div>
                                {isEditing ? (
                                    <Textarea
                                        id="proofNotes"
                                        rows={3}
                                        placeholder="Detail what was completed, tested, or deployed..."
                                        value={proofNotes}
                                        onChange={(e) => setProofNotes(e.target.value)}
                                        className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground min-h-[90px] max-h-[180px] resize-y text-xs sm:text-sm break-words [overflow-wrap:anywhere]"
                                    />
                                ) : (
                                    <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-foreground text-xs sm:text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-[220px] overflow-y-auto leading-relaxed">
                                        {proofNotes || <span className="text-muted-foreground italic">No notes provided.</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pinned Footer */}
                    <DialogFooter className="shrink-0 p-4 sm:p-5 border-t border-border bg-card/95 flex flex-row items-center justify-between sm:justify-between gap-3 z-10">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting || isRequestingChanges}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted text-xs sm:text-sm"
                        >
                            {mode === "transition" ? "Cancel Drag" : "Close"}
                        </Button>

                        {/* Request Changes — only shown when viewing/editing an In Review task */}
                        {mode !== "transition" && task?.status === "In Review" && onRequestChanges && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isSubmitting || isRequestingChanges}
                                onClick={async () => {
                                    if (!confirm(`Send "${task?.title}" back to In Progress with "Changes Requested"?`)) return;
                                    setIsRequestingChanges(true);
                                    try {
                                        await onRequestChanges();
                                        onOpenChange(false);
                                    } catch {
                                        setError("Failed to request changes. Please try again.");
                                    } finally {
                                        setIsRequestingChanges(false);
                                    }
                                }}
                                className="border-destructive/30 text-destructive dark:text-destructive hover:bg-destructive/10 hover:border-destructive/30 gap-1.5 text-xs sm:text-sm font-semibold"
                            >
                                {isRequestingChanges ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Requesting...</span></>
                                ) : (
                                    <><XCircle className="w-3.5 h-3.5" /><span>Request Changes</span></>
                                )}
                            </Button>
                        )}

                        {!isViewOnly && isEditing ? (
                            <Button
                                type="submit"
                                disabled={isSubmitting || isRequestingChanges}
                                className="bg-primary hover:bg-primary/90 text-black font-semibold shadow-xs gap-2 text-xs sm:text-sm"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>
                                            {targetStatus === "In Review"
                                                ? "Submitting Task for Review..."
                                                : "Approving Task..."}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {targetStatus === "In Review" ? (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>Submit for Review</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>{mode === "transition" ? "Approve & Mark Done" : "Save Changes"}</span>
                                            </>
                                        )}
                                    </>
                                )}
                            </Button>
                        ) : (
                            !isViewOnly && mode === "edit" && (
                                <Button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="bg-primary hover:bg-primary/90 text-black font-semibold gap-1.5 text-xs sm:text-sm shadow-xs"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Edit Deliverables</span>
                                </Button>
                            )
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
