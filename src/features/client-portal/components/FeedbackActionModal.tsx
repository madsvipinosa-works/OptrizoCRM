"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { submitMilestoneFeedback } from "@/features/pm/actions";

interface FeedbackActionModalProps {
    milestoneId: string;
    milestoneTitle: string;
    tasks?: { id: string; title: string; description: string | null; status: string }[];
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
            <DialogContent className="glass-card border-white/10 text-white sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Review Milestone: {milestoneTitle}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Please review the deliverables for this milestone. Are they approved, or do you need revisions?
                        </p>

                        {tasks && tasks.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2 mb-4 max-h-[250px] overflow-y-auto">
                                <h4 className="text-sm font-semibold text-white/80 border-b border-white/10 pb-2 mb-2">Deliverables Completed:</h4>
                                <ul className="space-y-3">
                                    {tasks.map(task => (
                                        <li key={task.id} className="text-sm flex flex-col gap-1">
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${task.status === "Done" ? "text-green-500" : "text-muted-foreground"}`} />
                                                <div className="flex flex-col">
                                                    <span className={`font-medium ${task.status === "Done" ? "text-white" : "text-muted-foreground"}`}>{task.title}</span>
                                                    {task.description && <span className="text-muted-foreground text-xs mt-0.5">{task.description}</span>}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        <div className="flex gap-4">
                            <Button 
                                variant={status === "APPROVED" ? "default" : "outline"} 
                                className={`flex-1 ${status === "APPROVED" ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : "border-white/10 hover:border-green-500/50 hover:text-green-500"}`}
                                onClick={() => setStatus("APPROVED")}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" /> Approve
                            </Button>
                            <Button 
                                variant={status === "REVISION_REQUESTED" ? "default" : "outline"}
                                className={`flex-1 ${status === "REVISION_REQUESTED" ? "bg-red-600 hover:bg-red-700 text-white border-red-600" : "border-white/10 hover:border-red-500/50 hover:text-red-500"}`}
                                onClick={() => setStatus("REVISION_REQUESTED")}
                            >
                                <XCircle className="h-4 w-4 mr-2" /> Request Revision
                            </Button>
                        </div>
                    </div>

                    {(status === "REVISION_REQUESTED" || status === "APPROVED") && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                            <label className="text-sm font-medium">
                                {status === "APPROVED" ? "Additional Comments (Optional)" : "Revision Details (Required)"}
                            </label>
                            <Textarea 
                                placeholder={status === "APPROVED" ? "Looking great, thanks!" : "Please change the following..."}
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
                            className="bg-primary text-black hover:bg-primary/90" 
                            onClick={handleSubmit}
                            disabled={!status || isSubmitting || (status === "REVISION_REQUESTED" && !comment.trim())}
                        >
                            {isSubmitting ? "Submitting..." : "Submit Feedback"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
