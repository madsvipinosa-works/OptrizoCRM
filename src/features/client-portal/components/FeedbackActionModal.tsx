"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, MessageSquare, ExternalLink, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { submitMilestoneFeedback } from "@/features/pm/actions";
import confetti from "canvas-confetti";

interface TaskItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    proofLinks?: { label: string; url: string }[] | null;
    proofNotes?: string | null;
}

interface FeedbackActionModalProps {
    milestoneId: string;
    milestoneTitle: string;
    tasks?: TaskItem[];
}

export function FeedbackActionModal({ milestoneId, milestoneTitle, tasks }: FeedbackActionModalProps) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<"APPROVED" | "REVISION_REQUESTED" | null>(null);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!status) return;
        if (status === "REVISION_REQUESTED" && !comment.trim()) {
            toast.error("Please provide details for the revision request.");
            return;
        }

        setIsSubmitting(true);
        const res = await submitMilestoneFeedback(milestoneId, status, comment);
        
        if (res.success) {
            if (status === "APPROVED") {
                try {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                } catch (e) {
                    console.error("Confetti trigger error:", e);
                }
            }
            toast.success("Feedback submitted successfully.");
            setOpen(false);
            setComment("");
            setStatus(null);
        } else {
            toast.error(res.message || "Failed to submit feedback.");
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
                    <MessageSquare className="h-4 w-4 mr-2" /> Review & Action
                </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 text-white sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-primary" /> Review Milestone: {milestoneTitle}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 pt-2">
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Please review the deliverables and proof of work completed by our team for this milestone.
                        </p>

                        {tasks && tasks.length > 0 && (
                            <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3 max-h-[300px] overflow-y-auto override-scrollbar">
                                <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider border-b border-white/10 pb-2 mb-2">
                                    Completed Deliverables & Proof of Work
                                </h4>
                                <ul className="space-y-3.5">
                                    {tasks.map(task => (
                                        <li key={task.id} className="text-sm flex flex-col gap-1.5 p-2.5 rounded-lg bg-white/5 border border-white/5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2.5">
                                                    <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${task.status === "Done" ? "text-green-500" : "text-muted-foreground"}`} />
                                                    <div className="flex flex-col">
                                                        <span className={`font-semibold ${task.status === "Done" ? "text-white" : "text-muted-foreground"}`}>{task.title}</span>
                                                        {task.description && <span className="text-muted-foreground text-xs mt-0.5 leading-snug">{task.description}</span>}
                                                    </div>
                                                </div>

                                                {task.proofLinks && task.proofLinks.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1 justify-end shrink-0">
                                                        {task.proofLinks.map((link, i) => (
                                                            <a 
                                                                key={i}
                                                                href={link.url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline bg-primary/10 border border-primary/20 px-2 py-0.5 rounded transition-colors"
                                                            >
                                                                <span>{link.label || "Proof"}</span>
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {task.proofNotes && (
                                                <div className="mt-1 ml-6 p-2 rounded bg-black/40 border border-white/5 text-xs text-white/80">
                                                    <span className="font-semibold text-primary/90">Proof Notes: </span>
                                                    {task.proofNotes}
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        <div className="flex gap-4 pt-2">
                            <Button 
                                variant={status === "APPROVED" ? "default" : "outline"} 
                                className={`flex-1 ${status === "APPROVED" ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : "border-white/10 hover:border-green-500/50 hover:text-green-500"}`}
                                onClick={() => setStatus("APPROVED")}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" /> Approve Deliverables
                            </Button>
                            <Button 
                                variant={status === "REVISION_REQUESTED" ? "default" : "outline"}
                                className={`flex-1 ${status === "REVISION_REQUESTED" ? "bg-red-600 hover:bg-red-700 text-white border-red-600" : "border-white/10 hover:border-red-500/50 hover:text-red-500"}`}
                                onClick={() => setStatus("REVISION_REQUESTED")}
                            >
                                <XCircle className="h-4 w-4 mr-2" /> Request Revisions
                            </Button>
                        </div>
                    </div>

                    {(status === "REVISION_REQUESTED" || status === "APPROVED") && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                            <label className="text-sm font-medium">
                                {status === "APPROVED" ? "Additional Comments (Optional)" : "Revision Details (Required)"}
                            </label>
                            <Textarea 
                                placeholder={status === "APPROVED" ? "Everything looks great! Ready to move forward." : "Please revise the following items..."}
                                className="bg-black/50 border-white/10 min-h-[100px]"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button 
                            className="bg-primary text-black hover:bg-primary/90 font-bold" 
                            onClick={handleSubmit}
                            disabled={!status || isSubmitting || (status === "REVISION_REQUESTED" && !comment.trim())}
                        >
                            {isSubmitting ? "Submitting..." : "Submit Decision"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
