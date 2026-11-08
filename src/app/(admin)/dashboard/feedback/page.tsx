import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { getFeedbackSummary, PAGE_SIZE, type FeedbackPeriod } from "@/features/analytics/feedback-queries";
import { formatDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERIODS: FeedbackPeriod[] = [3, 6, 12];

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className={cn("text-3xl font-semibold tabular-nums", tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-brand-deep")}>{value}</div>
            <div className="text-sm text-muted-foreground">{note}</div>
        </div>
    );
}

/** Super Admin: client feedback (CSAT) as totals and averages. Read-only; no names, comments or links into projects. */
export default async function FeedbackAdminPage({ searchParams }: { searchParams?: Promise<{ period?: string; page?: string }> }) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) redirect("/dashboard");

    const sp = await searchParams;
    const months = PERIODS.find((p) => p === Number(sp?.period)) ?? 12;
    const d = await getFeedbackSummary(months, Number(sp?.page) || 1);
    if (!d) redirect("/dashboard");

    const recTotal = d.recommend.yes + d.recommend.maybe + d.recommend.no;

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Client feedback (CSAT)</h1>
                    <p className="text-sm text-muted-foreground">Survey results from completed projects. Read-only totals and averages: no names or comments.</p>
                </div>
                <nav aria-label="Period" className="inline-flex rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                    {PERIODS.map((p) => (
                        <Link
                            key={p}
                            href={`/dashboard/feedback?period=${p}`}
                            aria-current={p === months ? "page" : undefined}
                            className={cn("flex h-8 items-center rounded-md px-3 text-sm font-medium", p === months ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground")}
                        >
                            Last {p} months
                        </Link>
                    ))}
                </nav>
            </header>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="CSAT score" value={d.csat === null ? "No data" : `${d.csat}%`} note={`${d.satisfied} of ${d.responses} answered 4 or 5 overall`} />
                <Stat label="Responses" value={`${d.responses} of ${d.completedProjects}`} note={d.responseRate === null ? "No completed projects" : `${d.responseRate}% of completed projects`} />
                <Stat label="Average overall" value={d.avgOverall === null ? "No data" : `${d.avgOverall} / 5`} note={`last ${months} months`} />
                <Stat label="Would recommend" value={recTotal ? `${Math.round((d.recommend.yes / recTotal) * 100)}%` : "No data"} note={`${d.recommend.yes} Yes · ${d.recommend.maybe} Maybe · ${d.recommend.no} No`} tone="good" />
            </div>

            <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
                <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="areas">
                    <div className="mb-3 flex items-baseline justify-between">
                        <h2 id="areas" className="text-lg font-semibold text-foreground">Average by area</h2>
                        <span className="text-sm text-muted-foreground">1–5 · amber = below 4</span>
                    </div>
                    <dl className="space-y-2.5">
                        {d.areas.map((a) => (
                            <div key={a.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
                                <dt>{a.label}</dt>
                                <dd className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={a.avg === null ? "No data" : `${a.avg} out of 5`}>
                                    {a.avg !== null && <div className={cn("h-full rounded-full", a.avg < 4 ? "bg-stage-negotiation" : "bg-primary")} style={{ width: `${(a.avg / 5) * 100}%` }} />}
                                </dd>
                                <span className={cn("text-right font-semibold tabular-nums", a.avg !== null && a.avg < 4 && "text-stage-negotiation")}>{a.avg ?? "-"}</span>
                            </div>
                        ))}
                    </dl>
                </section>

                <section className="space-y-1.5 rounded-xl border border-border bg-card p-5 text-sm" aria-labelledby="who">
                    <h2 id="who" className="mb-2 text-lg font-semibold text-foreground">Who can see feedback</h2>
                    <p><strong>Super Admin:</strong> totals and averages only (this page).</p>
                    <p><strong>Project Manager:</strong> the full answers on their projects, read-only, plus a follow-up note.</p>
                    <p><strong>Client:</strong> only their own answers.</p>
                    <p><strong>Developers and Sales:</strong> no access yet.</p>
                </section>
            </div>

            <section className="overflow-x-auto rounded-xl border border-border bg-card" aria-labelledby="table">
                <h2 id="table" className="sr-only">Responses</h2>
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-border text-muted-foreground">
                        <tr><th className="px-4 py-3 font-medium">Sent</th><th className="px-4 py-3 font-medium">Overall</th><th className="px-4 py-3 font-medium">Lowest area</th></tr>
                    </thead>
                    <tbody>
                        {d.table.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No responses in this period.</td></tr>}
                        {d.table.map((r) => (
                            <tr key={r.id} className="border-b border-border/60 last:border-0">
                                <td className="px-4 py-3">{formatDate(r.sent)}</td>
                                <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", r.overall >= 4 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-stage-negotiation/15 text-stage-negotiation")}>{r.overall} / 5</span></td>
                                <td className="px-4 py-3 text-muted-foreground">{r.lowest ? `${r.lowest.short} · ${r.lowest.score}` : "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    <span>{d.responses === 0 ? "0 responses" : `${(d.page - 1) * PAGE_SIZE + 1}–${Math.min(d.page * PAGE_SIZE, d.responses)} of ${d.responses} responses · newest first`}</span>
                    <span className="flex gap-2">
                        {d.page > 1 && <Link className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted" href={`/dashboard/feedback?period=${months}&page=${d.page - 1}`}>Previous</Link>}
                        {d.page < d.pageCount && <Link className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted" href={`/dashboard/feedback?period=${months}&page=${d.page + 1}`}>Next</Link>}
                    </span>
                </div>
            </section>
        </div>
    );
}
