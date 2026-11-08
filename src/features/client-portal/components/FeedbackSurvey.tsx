"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitProjectFeedback } from "@/features/client-portal/feedback-actions";
import { FEEDBACK_AREAS, OVERALL_LABELS, type AreaKey } from "@/features/client-portal/feedback-areas";
import { cn } from "@/lib/utils";

const chip = (on: boolean) =>
    cn(
        "rounded-lg border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
    );

/** The client satisfaction survey (step 31): 5 questions, only the overall rating is required. One survey per project. */
export function FeedbackSurvey({ projectId }: { projectId: string }) {
    const router = useRouter();
    const [overall, setOverall] = useState(0);
    const [areas, setAreas] = useState<Partial<Record<AreaKey, number>>>({});
    const [recommend, setRecommend] = useState<"yes" | "maybe" | "no" | null>(null);
    const [well, setWell] = useState("");
    const [improve, setImprove] = useState("");
    const [testimonial, setTestimonial] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!overall) {
            toast.error("Please choose your overall satisfaction.");
            return;
        }
        setBusy(true);
        try {
            const res = await submitProjectFeedback(projectId, {
                rating: overall,
                areas,
                wouldRecommend: recommend ?? undefined,
                comment: well.trim() || undefined,
                improvement: improve.trim() || undefined,
                testimonialAllowed: testimonial && well.trim().length > 0,
            });
            if (res.success) {
                toast.success(res.message || "Thank you for your feedback!");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to send feedback.");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <section className="space-y-3 rounded-xl border border-brand-deep/20 bg-brand-soft/40 p-4" aria-labelledby="q1">
                <h2 id="q1" className="text-base font-semibold text-foreground">
                    1. Overall, how satisfied are you with Optrizo on this project? <span className="text-destructive" aria-hidden="true">*</span>
                </h2>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="q1">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={overall === n} className={chip(overall === n)} onClick={() => setOverall(n)}>
                            {n} · {OVERALL_LABELS[n]}
                        </button>
                    ))}
                </div>
            </section>

            <section className="space-y-2" aria-labelledby="q2">
                <h2 id="q2" className="text-base font-semibold text-foreground">
                    2. Rate each part of the project <span className="text-sm font-normal text-muted-foreground">(1 = poor, 5 = excellent)</span>
                </h2>
                <div className="divide-y divide-border/60">
                    {FEEDBACK_AREAS.map((a) => (
                        <div key={a.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <div>
                                <div className="text-sm font-medium text-foreground">{a.label}</div>
                                {a.hint && <div className="text-xs text-muted-foreground">{a.hint}</div>}
                            </div>
                            <div className="flex gap-1.5" role="radiogroup" aria-label={a.label}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        role="radio"
                                        aria-checked={areas[a.key] === n}
                                        className={cn(chip(areas[a.key] === n), "h-9 w-9 px-0 tabular-nums")}
                                        onClick={() => setAreas((prev) => ({ ...prev, [a.key]: prev[a.key] === n ? undefined : n }))}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-2" aria-labelledby="q3">
                <h2 id="q3" className="text-base font-semibold text-foreground">3. Would you recommend Optrizo to another business?</h2>
                <div className="flex gap-2" role="radiogroup" aria-labelledby="q3">
                    {([["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]] as const).map(([v, label]) => (
                        <button key={v} type="button" role="radio" aria-checked={recommend === v} className={chip(recommend === v)} onClick={() => setRecommend(recommend === v ? null : v)}>
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor="well" className="text-sm font-medium text-foreground">4. What did we do well? <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <Textarea id="well" rows={4} maxLength={2000} value={well} onChange={(e) => setWell(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="improve" className="text-sm font-medium text-foreground">5. What should we improve? <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <Textarea id="improve" rows={4} maxLength={2000} value={improve} onChange={(e) => setImprove(e.target.value)} />
                </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-foreground">
                <input type="checkbox" checked={testimonial} onChange={(e) => setTestimonial(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
                <span>
                    Optrizo may show my answer to question 4 on its website as a testimonial, with my name and business.{" "}
                    <span className="text-muted-foreground">(Optional.)</span>
                </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">One survey per project. Only Optrizo staff see your answers.</p>
                <Button type="submit" disabled={busy || !overall} className="font-semibold">
                    {busy ? "Sending..." : "Send feedback"}
                </Button>
            </div>
        </form>
    );
}
