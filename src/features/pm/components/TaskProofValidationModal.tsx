"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Link2, FileText, AlertCircle, Loader2, Edit2, ExternalLink } from "lucide-react";

interface TaskProofValidationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: {
        id: string;
        title: string;
        proofLinks?: { label: string; url: string }[] | null;
        proofNotes?: string | null;
    } | null;
    targetStatus: "In Review" | "Done";
    onConfirm: (proofLinks: { label: string; url: string }[], proofNotes: string) => Promise<void>;
    mode?: "transition" | "edit";
    isViewOnly?: boolean;
}

export function TaskProofValidationModal({
    open,
    onOpenChange,
    task,
    targetStatus,
    onConfirm,
    mode = "transition",
    isViewOnly = false,
}: TaskProofValidationModalProps) {
    const [proofLinks, setProofLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
    const [proofNotes, setProofNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(mode === "transition");

    useEffect(() => {
        if (open && task) {
            setProofLinks(task.proofLinks?.length ? task.proofLinks : [{ label: "", url: "" }]);
            setProofNotes(task.proofNotes || "");
            setError(null);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validLinks = proofLinks
            .filter((l) => l.url.trim() !== "" || l.label.trim() !== "")
            .map((l) => {
                let url = l.url.trim();
                let label = l.label.trim();

                // If user accidentally pasted the URL into the Label field
                if (url === "" && (label.startsWith("http") || label.includes("."))) {
                    url = label;
                    label = "Proof Link";
                }
                
                if (url === "") url = label; // Fallback

                if (!/^https?:\/\//i.test(url)) {
                    url = `https://${url}`;
                }
                return { label: label || "Proof Link", url };
            });

        if (validLinks.length === 0 && !proofNotes.trim()) {
            setError("Please provide at least one Proof URL or completion notes.");
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
            await onConfirm(validLinks, proofNotes.trim());
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit task proof.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px] bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/5 uppercase tracking-wider text-[10px]">
                            Proof of Work Intercept
                        </Badge>
                    </div>
                    <DialogTitle className="text-xl font-bold text-white tracking-tight">
                        {mode === "transition" ? "Submit Work Validation for Move" : isViewOnly ? "View Task Proofs" : (isEditing ? "Edit Task Proofs" : "Task Proofs")}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-sm">
                        {mode === "transition" ? (
                            <>
                                Moving <span className="font-semibold text-zinc-200">&quot;{task?.title}&quot;</span> to{" "}
                                <Badge className={targetStatus === "Done" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}>
                                    {targetStatus}
                                </Badge>{" "}
                                requires proof of implementation.
                            </>
                        ) : (
                            <>
                                {isViewOnly ? "Viewing" : "Reviewing"} proofs for <span className="font-semibold text-zinc-200">&quot;{task?.title}&quot;</span>.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                                Proof Links (Figma, GitHub PR, Vercel Preview)
                            </Label>
                            {!isViewOnly && isEditing && (
                                <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-6 text-[10px] px-2 py-0 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
                                    + Add Link
                                </Button>
                            )}
                            {!isViewOnly && !isEditing && mode === "edit" && (
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-6 text-[10px] px-2 py-0 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 gap-1">
                                    <Edit2 className="w-3 h-3" /> Edit Proofs
                                </Button>
                            )}
                        </div>
                        {proofLinks.map((link, index) => (
                            <div key={index} className="flex gap-2 items-start">
                                {isEditing ? (
                                    <>
                                        <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider pl-1">Label</span>
                                                <Input
                                                    placeholder="e.g. Figma"
                                                    value={link.label}
                                                    onChange={(e) => updateLink(index, "label", e.target.value)}
                                                    className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider pl-1">URL (Link)</span>
                                                <Input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={link.url}
                                                    onChange={(e) => updateLink(index, "url", e.target.value)}
                                                    className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                                                />
                                            </div>
                                        </div>
                                        {proofLinks.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeLink(index)}
                                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 px-2"
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex-1 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 hover:bg-zinc-900 transition-colors">
                                        {link.url ? (
                                            <a
                                                href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col gap-1 group/link"
                                            >
                                                <span className="text-xs font-semibold text-zinc-200 group-hover/link:text-indigo-400 transition-colors">
                                                    {link.label || "Proof Link"}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-zinc-400 group-hover/link:text-indigo-300">
                                                    <ExternalLink className="w-3 h-3" />
                                                    <span className="text-xs truncate">{link.url}</span>
                                                </div>
                                            </a>
                                        ) : (
                                            <span className="text-xs text-zinc-500 italic">Empty link</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="proofNotes" className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            Completion Notes & Key Deliverables
                        </Label>
                        {isEditing ? (
                            <Textarea
                                id="proofNotes"
                                rows={3}
                                placeholder="Detail what was completed, tested, or deployed..."
                                value={proofNotes}
                                onChange={(e) => setProofNotes(e.target.value)}
                                className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-100 placeholder:text-zinc-600 resize-none"
                            />
                        ) : (
                            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-zinc-300 text-sm whitespace-pre-wrap min-h-[4rem]">
                                {proofNotes || <span className="text-zinc-500 italic">No notes provided.</span>}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-3 border-t border-zinc-800/80 flex items-center justify-between sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                        >
                            {mode === "transition" ? "Cancel Drag" : "Close"}
                        </Button>
                        {!isViewOnly && isEditing && (
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20 gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>{mode === "transition" ? "Submit Proof & Move Task" : "Save Changes"}</span>
                                    </>
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
