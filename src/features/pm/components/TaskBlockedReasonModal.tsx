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
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 uppercase tracking-wider text-[10px]">
                            Blocker Protocol
                        </Badge>
                    </div>
                    <DialogTitle className="text-xl font-bold text-white tracking-tight">
                        Reason for Blocking Task
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-sm">
                        You are moving <span className="font-semibold text-zinc-200">&quot;{task?.title}&quot;</span> to{" "}
                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">
                            Blocked
                        </Badge>. Please specify why this task cannot proceed.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="blockedReason" className="text-xs font-semibold text-zinc-300">
                            Blocker Reason / Dependency Details <span className="text-rose-400">*</span>
                        </Label>
                        <Textarea
                            id="blockedReason"
                            value={blockedReason}
                            onChange={(e) => setBlockedReason(e.target.value)}
                            placeholder="e.g. Waiting for client to provide Stripe API Keys and brand guidelines..."
                            className="bg-zinc-900 border-zinc-800 focus:border-rose-500/50 min-h-[110px] text-xs text-zinc-100 placeholder:text-zinc-500"
                        />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-900">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !blockedReason.trim()}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4"
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
