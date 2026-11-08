import { FEEDBACK_AREAS, OVERALL_LABELS, lowestArea, type AreaRatings } from "@/features/client-portal/feedback-areas";

export type SentFeedback = AreaRatings & {
    rating: number;
    wouldRecommend: string | null;
    testimonialAllowed: boolean;
    comment: string | null;
    improvement: string | null;
    createdAt: Date | string;
};

const YES_NO: Record<string, string> = { yes: "Yes", maybe: "Maybe", no: "No" };

function Row({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 text-sm last:border-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold text-foreground">{value}</dd>
        </div>
    );
}

/** What the client sent, and what happens next. Answers are read-only. */
export function FeedbackSent({ feedback }: { feedback: SentFeedback }) {
    const low = lowestArea(feedback);
    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="answers">
                <h2 id="answers" className="mb-2 text-lg font-semibold text-foreground">Your answers</h2>
                <dl>
                    <Row label="Overall satisfaction" value={`${feedback.rating} · ${OVERALL_LABELS[feedback.rating] ?? ""}`} />
                    {FEEDBACK_AREAS.map((a) => {
                        const v = feedback[a.key];
                        return typeof v === "number" ? <Row key={a.key} label={a.label} value={v} /> : null;
                    })}
                    {feedback.wouldRecommend && <Row label="Would recommend" value={YES_NO[feedback.wouldRecommend] ?? feedback.wouldRecommend} />}
                    <Row label="Testimonial permission" value={feedback.testimonialAllowed ? "Yes" : "No"} />
                </dl>
                {feedback.comment && <p className="mt-3 rounded-lg border border-border bg-background/50 p-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">What we did well: </span>{feedback.comment}</p>}
                {feedback.improvement && <p className="mt-2 rounded-lg border border-border bg-background/50 p-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">What to improve: </span>{feedback.improvement}</p>}
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm text-foreground" aria-labelledby="next">
                <h2 id="next" className="text-lg font-semibold">What happens next</h2>
                <p>Your feedback is saved with this project, and your Project Manager and Optrizo management can read it.</p>
                {low && <p>Because you rated <strong>{low.label}</strong> {low.score} or lower, the Project Manager may contact you to learn more.</p>}
                <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground">The survey can be sent once per project. The button on your project now reads &quot;Feedback sent&quot;.</p>
            </section>
        </div>
    );
}
