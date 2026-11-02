"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { requestProposalChanges } from "@/features/proposals/signing";
import { toast } from "sonner";
import { MessageSquarePlus, Loader2 } from "lucide-react";

interface RequestChangesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    proposalId: string;
    proposalCode?: string | null;
    onSuccess?: () => void;
}

const AVAILABLE_TOPICS = [
    { id: "price", label: "Price & Budget" },
    { id: "timeline", label: "Timeline & Delivery Dates" },
    { id: "scope", label: "Scope & Deliverables" },
    { id: "other", label: "Other Adjustments" },
] as const;

export function RequestChangesDialog({
    open,
    onOpenChange,
    proposalId,
    proposalCode,
    onSuccess,
}: RequestChangesDialogProps) {
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [body, setBody] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleTopic = (topicId: string) => {
        setSelectedTopics((prev) =>
            prev.includes(topicId) ? prev.filter((t) => t !== topicId) : [...prev, topicId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim()) {
            toast.error("Please enter your feedback or change request details");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await requestProposalChanges(proposalId, selectedTopics, body.trim());
            if (res.success) {
                toast.success("Change request sent! Your Project Manager will review and reply.");
                setBody("");
                setSelectedTopics([]);
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error(res.message || "Failed to submit change request");
            }
        } catch {
            toast.error("Failed to submit change request");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-full glass-card border-border text-foreground">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <MessageSquarePlus className="h-5 w-5 text-primary" />
                            Request Proposal Changes
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            {proposalCode ? `Proposal #${proposalCode} · ` : ""}
                            Select which areas you would like revised and provide your notes for the Project Manager.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Topics to Revise (optional)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {AVAILABLE_TOPICS.map((topic) => (
                                    <label
                                        key={topic.id}
                                        className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors text-xs select-none"
                                    >
                                        <Checkbox
                                            checked={selectedTopics.includes(topic.id)}
                                            onCheckedChange={() => toggleTopic(topic.id)}
                                        />
                                        <span>{topic.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">
                                Detailed Feedback / Requested Changes <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Describe the changes you would like us to make..."
                                rows={4}
                                required
                                className="text-xs leading-relaxed"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isSubmitting || !body.trim()}
                            className="font-semibold text-xs"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                    Sending Request...
                                </>
                            ) : (
                                "Send Change Request"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
