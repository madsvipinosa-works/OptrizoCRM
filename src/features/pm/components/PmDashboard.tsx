import Link from "next/link";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { startOfMonth } from "date-fns";
import { db } from "@/db";
import { agencyProjects, leads, proposals, tasks } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
    return (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-3xl font-semibold tabular-nums tracking-tight", value ? tone : "text-foreground")}>{value}</p>
        </div>
    );
}

/**
 * PM home page (mockup "Ref · PM: dashboard"): four counts, what needs the PM, project progress
 * and the PM's own report. Read only. "Mine" = the lead's PM is this user, or no PM yet (spec: a
 * hand-off with no assignedPmId goes to every PM).
 */
export async function PmDashboard({ userId }: { userId: string }) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const mine = (pmId: string | null | undefined) => !pmId || pmId === userId;

    const [requestLeads, openProposals, projectRows, reviewTasks, paymentRows] = await Promise.all([
        db.query.leads.findMany({
            where: and(isNotNull(leads.proposalRequestedAt), isNull(leads.archivedAt)),
            columns: { id: true, businessName: true, assignedPmId: true },
            with: { proposals: { where: isNull(proposals.deletedAt), columns: { id: true } } },
        }),
        db.query.proposals.findMany({
            where: and(isNull(proposals.deletedAt), inArray(proposals.status, ["sent", "changes_requested"])),
            columns: { id: true, status: true, projectName: true },
            with: { lead: { columns: { businessName: true, assignedPmId: true } } },
        }),
        db.query.agencyProjects.findMany({
            where: eq(agencyProjects.isArchived, false),
            columns: { id: true, title: true, status: true, progressPercentage: true },
            with: {
                lead: { columns: { assignedPmId: true } },
                tasks: { where: isNull(tasks.deletedAt), columns: { status: true, dueDate: true } },
            },
        }),
        db.query.tasks.findMany({
            where: and(eq(tasks.status, "in_review"), isNull(tasks.deletedAt)),
            columns: { id: true, title: true, projectId: true },
            with: {
                project: { columns: { title: true, isArchived: true }, with: { lead: { columns: { assignedPmId: true } } } },
                assignees: { with: { user: { columns: { name: true } } } },
            },
        }),
        db.query.payments.findMany({
            columns: { amount: true, currency: true, status: true, confirmedAt: true, dueDate: true },
            with: { project: { columns: { isArchived: true }, with: { lead: { columns: { assignedPmId: true } } } } },
        }),
    ]);

    const requests = requestLeads.filter((l) => mine(l.assignedPmId) && l.proposals.length === 0);
    const myProposals = openProposals.filter((p) => mine(p.lead?.assignedPmId));
    const proposalsOut = myProposals.filter((p) => p.status === "sent");
    const changeRequests = myProposals.filter((p) => p.status === "changes_requested");
    const myProjects = projectRows.filter((p) => mine(p.lead?.assignedPmId));
    const active = myProjects.filter((p) => p.status !== "Completed");
    const toReview = reviewTasks.filter((t) => t.project && !t.project.isArchived && mine(t.project.lead?.assignedPmId));
    const myPayments = paymentRows.filter((p) => p.project && !p.project.isArchived && mine(p.project.lead?.assignedPmId));

    // Report totals in pesos only; dollar payments are left out rather than added to pesos.
    const php = myPayments.filter((p) => p.currency === "PHP");
    const collected = php.filter((p) => p.status === "paid" && p.confirmedAt && p.confirmedAt >= monthStart).reduce((s, p) => s + p.amount, 0);
    const stillDue = php.filter((p) => p.status === "due" || p.status === "proof_uploaded").reduce((s, p) => s + p.amount, 0);
    const paymentsOverdue = myPayments.filter((p) => p.status === "due" && p.dueDate && p.dueDate < now).length;
    const overdueByProject = active
        .map((p) => ({ title: p.title, count: p.tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < now).length }))
        .filter((p) => p.count > 0);
    const tasksOverdue = overdueByProject.reduce((s, p) => s + p.count, 0);

    const actions = [
        ...requests.map((l) => ({ key: `r-${l.id}`, title: `Proposal request: ${l.businessName || "New lead"}`, note: "Start drafting the proposal", href: "/dashboard/proposals" })),
        ...toReview.map((t) => ({
            key: `t-${t.id}`,
            title: `Task in review: ${t.title}`,
            note: [t.project?.title, t.assignees[0]?.user?.name].filter(Boolean).join(" · "),
            href: `/dashboard/pm/${t.projectId}`,
        })),
        ...changeRequests.map((p) => ({ key: `c-${p.id}`, title: `Client asked for changes: ${p.lead?.businessName || "Client"}`, note: p.projectName || "Proposal", href: `/dashboard/proposals/${p.id}` })),
    ];

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Proposals and projects at a glance.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Proposal requests" value={requests.length} tone="text-destructive" />
                <Stat label="Proposals out" value={proposalsOut.length} tone="text-brand-deep" />
                <Stat label="Active projects" value={active.length} tone="text-brand-deep" />
                <Stat label="Tasks to review" value={toReview.length} tone="text-stage-negotiation" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section aria-labelledby="pm-action" className="rounded-xl border border-border bg-card p-5">
                    <h2 id="pm-action" className="text-lg font-semibold tracking-tight text-foreground">Needs your action</h2>
                    {actions.length ? (
                        <ul className="mt-2 divide-y divide-border">
                            {actions.slice(0, 6).map((a) => (
                                <li key={a.key} className="flex items-center justify-between gap-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-foreground">{a.title}</p>
                                        {a.note && <p className="truncate text-sm text-muted-foreground">{a.note}</p>}
                                    </div>
                                    <Button asChild variant="outline" size="sm" className="shrink-0 bg-card active:scale-[0.97]">
                                        <Link href={a.href}>
                                            Open<span className="sr-only">: {a.title}</span>
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 text-sm text-muted-foreground">Nothing waiting. New proposal requests, tasks in review and change requests show up here.</p>
                    )}
                </section>

                <section aria-labelledby="pm-progress" className="rounded-xl border border-border bg-card p-5">
                    <h2 id="pm-progress" className="text-lg font-semibold tracking-tight text-foreground">Project progress</h2>
                    {active.length ? (
                        <ul className="mt-3 space-y-3">
                            {active.slice(0, 6).map((p) => {
                                const percent = Math.max(0, Math.min(100, p.progressPercentage ?? 0));
                                return (
                                    <li key={p.id}>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <Link href={`/dashboard/pm/${p.id}`} className="truncate rounded-sm text-foreground outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                                                {p.title}
                                            </Link>
                                            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{percent}%</span>
                                        </div>
                                        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.title} progress`} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div className="h-full rounded-full bg-brand-deep" style={{ width: `${percent}%` }} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No active projects. A project starts when a client signs.</p>
                    )}
                </section>
            </div>

            <section aria-labelledby="pm-report" className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="pm-report" className="text-lg font-semibold tracking-tight text-foreground">My projects report</h2>
                    <p className="text-sm text-muted-foreground">This month · your projects only</p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div>
                        <dt className="text-sm text-muted-foreground">Collected</dt>
                        <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-brand-deep">{peso(collected)}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-muted-foreground">Still due</dt>
                        <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{peso(stillDue)}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-muted-foreground">Payments overdue</dt>
                        <dd className={cn("mt-0.5 text-2xl font-semibold tabular-nums tracking-tight", paymentsOverdue ? "text-destructive" : "text-foreground")}>{paymentsOverdue}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-muted-foreground">Tasks overdue</dt>
                        <dd className={cn("mt-0.5 text-2xl font-semibold tabular-nums tracking-tight", tasksOverdue ? "text-stage-negotiation" : "text-foreground")}>{tasksOverdue}</dd>
                    </div>
                </dl>
                <p className="mt-3 text-sm text-muted-foreground">
                    {overdueByProject.length ? `Overdue tasks: ${overdueByProject.map((p) => p.title).join(", ")}. ` : ""}
                    Company-wide reports are with the Super Admin.
                </p>
            </section>
        </div>
    );
}
