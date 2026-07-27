"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Link2, FileText, AlertCircle, Loader2 } from "lucide-react";

interface TaskProofValidationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: {
        id: string;
        title: string;
        proofUrl?: string | null;
        proofNotes?: string | null;
    } | null;
    targetStatus: "In Review" | "Done";
    onConfirm: (proofUrl: string, proofNotes: string) => Promise<void>;
}

export function TaskProofValidationModal({
    open,
    onOpenChange,
    task,
    targetStatus,
    onConfirm,
}: TaskProofValidationModalProps) {
    const [proofUrl, setProofUrl] = useState("");
    const [proofNotes, setProofNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (task) {
            setProofUrl(task.proofUrl || "");
            setProofNotes(task.proofNotes || "");
            setError(null);
        }
    }, [task, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!proofUrl.trim() && !proofNotes.trim()) {
            setError("Please provide either a Proof URL or completion notes.");
            return;
        }

        if (proofUrl.trim()) {
            try {
                new URL(proofUrl.trim());
            } catch {
                setError("Please enter a valid URL (e.g., https://github.com/... or https://figma.com/...)");
                return;
            }
        }

        try {
            setIsSubmitting(true);
            await onConfirm(proofUrl.trim(), proofNotes.trim());
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
                        Submit Work Validation for Move
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-sm">
                        Moving <span className="font-semibold text-zinc-200">&quot;{task?.title}&quot;</span> to{" "}
                        <Badge className={targetStatus === "Done" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}>
                            {targetStatus}
                        </Badge>{" "}
                        requires proof of implementation.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="proofUrl" className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                            Proof URL (Figma, GitHub PR, Vercel Preview)
                        </Label>
                        <Input
                            id="proofUrl"
                            type="url"
                            placeholder="https://github.com/org/repo/pull/42 or https://figma.com/..."
                            value={proofUrl}
                            onChange={(e) => setProofUrl(e.target.value)}
                            className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-100 placeholder:text-zinc-600"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="proofNotes" className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            Completion Notes & Key Deliverables
                        </Label>
                        <Textarea
                            id="proofNotes"
                            rows={3}
                            placeholder="Detail what was completed, tested, or deployed..."
                            value={proofNotes}
                            onChange={(e) => setProofNotes(e.target.value)}
                            className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-100 placeholder:text-zinc-600 resize-none"
                        />
                    </div>

                    <DialogFooter className="pt-3 border-t border-zinc-800/80 flex items-center justify-between sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                        >
                            Cancel Drag
                        </Button>
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
                                    <span>Submit Proof & Move Task</span>
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
