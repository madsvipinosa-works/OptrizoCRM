"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface TaskDeleteConfirmModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskTitle?: string;
    onConfirm: () => Promise<void>;
}

export function TaskDeleteConfirmModal({
    open,
    onOpenChange,
    taskTitle,
    onConfirm,
}: TaskDeleteConfirmModalProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        try {
            setIsDeleting(true);
            await onConfirm();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to delete task:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[460px] max-h-[90vh] p-0 flex flex-col bg-zinc-950 border-rose-900/50 text-zinc-100 shadow-2xl rounded-2xl overflow-hidden focus:outline-none">
                <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur z-10 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 uppercase tracking-wider text-[10px]">
                            Admin Authorization Required
                        </Badge>
                    </div>
                    <div>
                        <DialogTitle className="text-lg font-bold text-white tracking-tight break-words [overflow-wrap:anywhere]">
                            Confirm Task Soft-Deletion
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs sm:text-sm mt-1 leading-relaxed break-words [overflow-wrap:anywhere]">
                            Are you sure you want to remove <span className="font-semibold text-zinc-200">&quot;{taskTitle || "this task"}&quot;</span>?
                            This task will be archived and removed from the active delivery board.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <DialogFooter className="shrink-0 p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur flex items-center justify-between gap-2 z-10">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                        className="text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-medium shadow-lg shadow-rose-600/20 gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Deleting...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                <span>Delete Task</span>
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
