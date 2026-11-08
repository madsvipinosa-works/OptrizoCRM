import { Star } from "lucide-react";

type Feedback = { rating: number; comment: string | null; recommendScore: number | null; improvement: string | null; createdAt: Date | string } | null;

/** The client's feedback after completion. Shown to the project's PM only. */
export function FeedbackCard({ feedback, completed }: { feedback: Feedback; completed: boolean }) {
    return (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Client feedback</h3>
            {!feedback ? (
                <p className="text-sm text-muted-foreground">
                    {completed ? "No feedback yet. The client can leave it from their project page." : "Available after the project is complete."}
                </p>
            ) : (
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-1" aria-label={`Rating ${feedback.rating} out of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={n <= feedback.rating ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-muted-foreground/30"} aria-hidden="true" />
                        ))}
                        <span className="ml-2 tabular-nums text-muted-foreground">{feedback.rating} / 5</span>
                    </div>
                    {feedback.recommendScore !== null && <p className="text-muted-foreground">Would recommend Optrizo: <strong className="text-foreground">{feedback.recommendScore} / 10</strong></p>}
                    {feedback.comment && <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">&quot;{feedback.comment}&quot;</p>}
                    {feedback.improvement && <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground"><span className="font-semibold text-foreground">Could be better: </span>{feedback.improvement}</p>}
                    <p className="text-xs text-muted-foreground">Submitted {new Date(feedback.createdAt).toLocaleDateString()}</p>
                </div>
            )}
        </div>
    );
}
