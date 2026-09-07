"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";

interface TaskBlockedReasonModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: {
        id: string;
        title: string;
        blockedReason?: string | null;
    } | null;
    onConfirm: (blockedReason: string) => Promise<void>;
}

export function TaskBlockedReasonModal({
    open,
    onOpenChange,
    task,
    onConfirm,
}: TaskBlockedReasonModalProps) {
    const [blockedReason, setBlockedReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (task) {
            setBlockedReason(task.blockedReason || "");
            setError(null);
        }
    }, [task, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!blockedReason.trim()) {
            setError("Please provide a clear reason why this task is blocked.");
            return;
        }

        try {
            setIsSubmitting(true);
            await onConfirm(blockedReason.trim());
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to block task.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[520px] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl rounded-2xl overflow-hidden focus:outline-none">
                <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur z-10 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 uppercase tracking-wider text-[10px]">
                            Blocker Protocol
                        </Badge>
                    </div>
                    <div>
                        <DialogTitle className="text-lg sm:text-xl font-bold text-white tracking-tight break-words [overflow-wrap:anywhere]">
                            Reason for Blocking Task
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs sm:text-sm mt-1 break-words [overflow-wrap:anywhere]">
                            You are moving <span className="font-semibold text-zinc-200">&quot;{task?.title}&quot;</span> to{" "}
                            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] px-1.5 py-0.5 inline-flex items-center">
                                Blocked
                            </Badge>. Please specify why this task cannot proceed.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4">
                        {error && (
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="break-words [overflow-wrap:anywhere]">{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="blockedReason" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                                Blocker Reason / Dependency Details <span className="text-rose-400">*</span>
                            </Label>
                            <Textarea
                                id="blockedReason"
                                value={blockedReason}
                                onChange={(e) => setBlockedReason(e.target.value)}
                                placeholder="e.g. Waiting for client to provide Stripe API Keys and brand guidelines..."
                                className="bg-zinc-900 border-zinc-800 focus:border-rose-500/50 min-h-[120px] max-h-[220px] resize-y text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 break-words [overflow-wrap:anywhere]"
                            />
                        </div>
                    </div>

                    <div className="shrink-0 p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur flex items-center justify-end gap-3 z-10">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="text-xs sm:text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !blockedReason.trim()}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold px-4 shadow-lg shadow-rose-600/20"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Flag as Blocked"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
