import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agencyProjects } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { FeedbackFollowUp } from "@/features/pm/components/FeedbackFollowUp";
import { FEEDBACK_AREAS, OVERALL_LABELS, lowestArea } from "@/features/client-portal/feedback-areas";
import { formatDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const YES_NO: Record<string, string> = { yes: "Yes", maybe: "Maybe", no: "No" };

/** The client's feedback on a finished project, with the PM's follow-up (step 31). Read-only for the PM. */
export default async function PmFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect(`/login?callbackUrl=/dashboard/pm/${id}/feedback`);
    if (!hasRole(session, ["manager"])) redirect(`/dashboard/pm/${id}`);

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, id),
        columns: { id: true, title: true, status: true, completedAt: true, warrantyEndsAt: true },
        with: { lead: { columns: { contactName: true } }, feedback: true },
    });
    if (!project) notFound();
    const fb = project.feedback[0];

    if (!fb) {
        return (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                <h2 className="mb-1 text-lg font-semibold text-foreground">Client feedback</h2>
                {project.status === "Completed"
                    ? "No feedback yet. The client can send it from their project page."
                    : "The client can send feedback once the project is complete."}
            </div>
        );
    }

    const low = lowestArea(fb);
    const suggestion = low
        ? `${low.label}: ${low.score}, the lowest area below 4. A follow-up is suggested.`
        : null;

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="space-y-4 rounded-xl border border-border bg-card p-5" aria-labelledby="fb">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="fb" className="text-lg font-semibold text-foreground">Client feedback</h2>
                        <p className="text-sm text-muted-foreground">From {project.lead?.contactName || "the client"} · sent {formatDate(fb.createdAt)}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Lock className="size-3.5" aria-hidden="true" /> Read-only</span>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-4 text-sm">
                    <div>
                        <div className="text-muted-foreground">Overall</div>
                        <div className="text-2xl font-semibold tabular-nums text-brand-deep">{fb.rating} / 5</div>
                        <div className="text-muted-foreground">{OVERALL_LABELS[fb.rating]}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Would recommend</div>
                        <div className="text-xl font-semibold text-foreground">{fb.wouldRecommend ? YES_NO[fb.wouldRecommend] : "No answer"}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Testimonial</div>
                        <div className="text-xl font-semibold text-foreground">{fb.testimonialAllowed ? "Allowed" : "Not allowed"}</div>
                    </div>
                </div>

                <dl className="space-y-2.5">
                    {FEEDBACK_AREAS.map((a) => {
                        const v = fb[a.key];
                        if (typeof v !== "number") return null;
                        return (
                            <div key={a.key} className="grid grid-cols-[minmax(0,10rem)_1fr_1.5rem] items-center gap-3 text-sm">
                                <dt className="text-foreground">{a.label}</dt>
                                <dd className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${v} out of 5`}>
                                    <div className={cn("h-full rounded-full", v < 4 ? "bg-stage-negotiation" : "bg-primary")} style={{ width: `${(v / 5) * 100}%` }} />
                                </dd>
                                <span className={cn("text-right font-semibold tabular-nums", v < 4 && "text-stage-negotiation")}>{v}</span>
                            </div>
                        );
                    })}
                </dl>

                <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                        <div className="text-muted-foreground">What we did well</div>
                        <p className="mt-1 text-foreground">{fb.comment ? `"${fb.comment}"` : "No answer"}</p>
                    </div>
                    <div>
                        <div className="text-muted-foreground">What to improve</div>
                        <p className="mt-1 text-foreground">{fb.improvement ? `"${fb.improvement}"` : "No answer"}</p>
                    </div>
                </div>
            </section>

            <div className="space-y-5">
                <FeedbackFollowUp projectId={project.id} initialNote={fb.followupNote ?? ""} reviewedAt={fb.reviewedAt ? fb.reviewedAt.toISOString() : null} suggestion={suggestion} />

                <section className="space-y-3 rounded-xl border border-border bg-card p-5" aria-labelledby="act">
                    <h2 id="act" className="text-lg font-semibold text-foreground">In Activity</h2>
                    <ul className="divide-y divide-border/60 text-sm">
                        <li className="py-2">
                            <span className="font-semibold text-foreground">Client feedback received</span>
                            <span className="text-muted-foreground"> · {fb.rating}/5{low ? ` · lowest: ${low.short} (${low.score})` : ""}</span>
                            <div className="text-muted-foreground">{formatDate(fb.createdAt)} · automatic</div>
                        </li>
                        {project.completedAt && (
                            <li className="py-2">
                                <span className="font-semibold text-foreground">Project marked complete</span>
                                {project.warrantyEndsAt && <span className="text-muted-foreground"> · warranty until {formatDate(project.warrantyEndsAt)}</span>}
                                <div className="text-muted-foreground">{formatDate(project.completedAt)} · Project Manager</div>
                            </li>
                        )}
                    </ul>
                </section>
            </div>
        </div>
    );
}
