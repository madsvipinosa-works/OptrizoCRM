"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitProjectFeedback } from "@/features/client-portal/feedback-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProjectFeedbackFormProps {
    projectId: string;
    existingFeedback?: {
        rating: number;
        comment: string | null;
        createdAt: Date | string;
    } | null;
}

export function ProjectFeedbackForm({ projectId, existingFeedback }: ProjectFeedbackFormProps) {
    const router = useRouter();
    const [rating, setRating] = useState<number>(existingFeedback?.rating ?? 5);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [comment, setComment] = useState<string>(existingFeedback?.comment ?? "");
    const [isLoading, setIsLoading] = useState(false);

    if (existingFeedback) {
        return (
            <div className="glass-card rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">Your Feedback</h3>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                className={cn(
                                    "w-4 h-4",
                                    star <= existingFeedback.rating
                                        ? "text-amber-400 fill-amber-400"
                                        : "text-muted-foreground/30"
                                )}
                            />
                        ))}
                    </div>
                </div>
                {existingFeedback.comment && (
                    <p className="text-xs text-muted-foreground italic bg-background/50 p-3 rounded-lg border border-border">
                        &quot;{existingFeedback.comment}&quot;
                    </p>
                )}
                <div className="text-[11px] text-muted-foreground">
                    Submitted on {new Date(existingFeedback.createdAt).toLocaleDateString()}
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rating || rating < 1 || rating > 5) {
            toast.error("Please select a rating between 1 and 5 stars.");
            return;
        }

        if (comment.length > 2000) {
            toast.error("Comment cannot exceed 2000 characters.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await submitProjectFeedback(projectId, {
                rating,
                comment: comment.trim() || undefined,
            });

            if (res.success) {
                toast.success(res.message || "Thank you for your feedback!");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to submit feedback.");
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error submitting feedback");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl border border-border p-5 space-y-4">
            <div>
                <h3 className="text-base font-bold text-foreground">Project Experience & Feedback</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    How was your experience working with the team on this project?
                </p>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Rating</Label>
                <div className="flex items-center gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                        const activeVal = hoverRating ?? rating;
                        const isFilled = star <= activeVal;
                        return (
                            <button
                                type="button"
                                key={star}
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(null)}
                                className="p-1 rounded-md hover:bg-muted transition-colors focus:outline-hidden"
                            >
                                <Star
                                    className={cn(
                                        "w-6 h-6 transition-all",
                                        isFilled
                                            ? "text-amber-400 fill-amber-400 scale-110"
                                            : "text-muted-foreground/30 hover:text-muted-foreground/60"
                                    )}
                                />
                            </button>
                        );
                    })}
                    <span className="text-xs font-mono font-semibold ml-2 text-muted-foreground">
                        {hoverRating ?? rating} / 5
                    </span>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="comment" className="text-xs font-semibold">
                        Comments or Testimonial (Optional)
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                        {comment.length}/2000
                    </span>
                </div>
                <Textarea
                    id="comment"
                    placeholder="Share any highlights, feedback on communication, or recommendations..."
                    rows={3}
                    maxLength={2000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />
            </div>

            <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" disabled={isLoading} className="font-semibold">
                    {isLoading ? "Submitting..." : "Submit Feedback"}
                </Button>
            </div>
        </form>
    );
}

