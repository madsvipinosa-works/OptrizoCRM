import Link from "next/link";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { addDays, endOfWeek, format, formatDistanceToNowStrict, startOfMonth, startOfWeek } from "date-fns";
import { db } from "@/db";
import { leads, meetings } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Days without contact before a lead needs attention (Sales dashboard mockup: "no activity for 3 days"). */
const ATTENTION_DAYS = 3;

const STAGE_LABEL: Record<string, string> = {
    "New Lead": "New lead",
    "Discovery & Qualifying": "Discovery",
    "Proposal Sent": "Proposal sent",
    "In Negotiation": "Negotiation",
};
const OPEN_STAGES = Object.keys(STAGE_LABEL);

const MEETING_TYPE: Record<string, string> = {
    discovery: "Discovery",
    budget_pricing: "Budget and pricing",
    project_review: "Project review",
    uat: "User acceptance",
};
const MEETING_FORMAT: Record<string, string> = {
    video: "video call",
    phone: "phone call",
    in_person: "in person",
    on_site: "on site",
};
const MEETING_STATUS: Record<string, { label: string; tone: "good" | "wait" }> = {
    confirmed: { label: "Confirmed", tone: "good" },
    awaiting_client: { label: "Awaiting client", tone: "wait" },
    reschedule_requested: { label: "Reschedule requested", tone: "wait" },
};

function Stat({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
    return (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-3xl font-semibold tabular-nums tracking-tight", strong ? "text-brand-deep" : "text-foreground")}>{value}</p>
        </div>
    );
}

/**
 * Sales home page (mockup "Ref · Sales: dashboard"): four counts, leads that need attention,
 * upcoming meetings and the sales rep's own pipeline report. Read only.
 */
export async function SalesDashboard({ userId }: { userId: string }) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // The rep's leads: assigned to them, or not yet claimed.
    const visible = (
        await db.query.leads.findMany({
            where: eq(leads.isArchived, false),
            with: { assignees: true },
        })
    ).filter((l) => l.assignees.length === 0 || l.assignees.some((a) => a.userId === userId));

    const open = visible.filter((l) => OPEN_STAGES.includes(l.status));
    const wonThisMonth = visible.filter((l) => l.status === "Closed Won" && l.closedWonAt && l.closedWonAt >= monthStart);
    const newLeads = open.filter((l) => l.status === "New Lead");
    // Asked for a proposal, and the PM has not sent one yet.
    const waitingForPm = open.filter((l) => l.proposalRequestedAt && l.status === "Discovery & Qualifying");

    const staleBefore = addDays(now, -ATTENTION_DAYS).getTime();
    const needsAttention = open
        .map((l) => {
            const last = l.lastContactedAt?.getTime() ?? null;
            if (l.status === "New Lead" && last === null) return { lead: l, reason: "New lead · no interaction yet", since: l.createdAt.getTime() };
            const reference = last ?? l.stageChangedAt?.getTime() ?? l.createdAt.getTime();
            if (reference < staleBefore) {
                return {
                    lead: l,
                    reason: `${STAGE_LABEL[l.status]} · no activity for ${formatDistanceToNowStrict(reference)}`,
                    since: reference,
                };
            }
            return null;
        })
        .filter((x): x is { lead: (typeof open)[number]; reason: string; since: number } => x !== null)
        .sort((a, b) => a.since - b.since)
        .slice(0, 6);

    const visibleIds = visible.map((l) => l.id);
    const weekMeetings = visibleIds.length
        ? await db.query.meetings.findMany({
              where: and(
                  inArray(meetings.leadId, visibleIds),
                  gte(meetings.startsAt, weekStart),
                  lte(meetings.startsAt, weekEnd),
                  ne(meetings.status, "cancelled")
              ),
          })
        : [];
    const upcoming = visibleIds.length
        ? await db.query.meetings.findMany({
              where: and(
                  inArray(meetings.leadId, visibleIds),
                  gte(meetings.startsAt, now),
                  inArray(meetings.status, ["awaiting_client", "confirmed", "reschedule_requested"])
              ),
              orderBy: [asc(meetings.startsAt)],
              limit: 5,
              with: { lead: true },
          })
        : [];

    const byStage = OPEN_STAGES.map((stage) => ({ label: STAGE_LABEL[stage], count: open.filter((l) => l.status === stage).length }));
    const handled = open.length + wonThisMonth.length;
    const winRate = handled > 0 ? Math.round((wonThisMonth.length / handled) * 100) : 0;

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Your leads and meetings at a glance.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="New leads" value={newLeads.length} />
                <Stat label="Meetings this week" value={weekMeetings.length} />
                <Stat label="Waiting for the PM" value={waitingForPm.length} />
                <Stat label="Won this month" value={wonThisMonth.length} strong />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section aria-labelledby="attention-heading" className="rounded-xl border border-border bg-card p-5">
                    <h2 id="attention-heading" className="text-lg font-semibold tracking-tight text-foreground">
                        Needs your attention
                    </h2>
                    {needsAttention.length === 0 ? (
                        <p className="py-8 text-sm text-muted-foreground">Nothing is waiting. Every open lead has had recent contact.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-border">
                            {needsAttention.map(({ lead, reason }) => (
                                <li key={lead.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-base font-medium text-foreground">{lead.businessName || lead.contactName}</p>
                                        <p className="truncate text-sm text-muted-foreground">{reason}</p>
                                    </div>
                                    <Button asChild variant="outline" className="shrink-0">
                                        <Link href={`/dashboard/leads/${lead.id}`}>
                                            Open<span className="sr-only"> {lead.businessName || lead.contactName}</span>
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section aria-labelledby="meetings-heading" className="rounded-xl border border-border bg-card p-5">
                    <h2 id="meetings-heading" className="text-lg font-semibold tracking-tight text-foreground">
                        Upcoming meetings
                    </h2>
                    {upcoming.length === 0 ? (
                        <p className="py-8 text-sm text-muted-foreground">No meetings booked. Open a lead to book a discovery meeting.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-border">
                            {upcoming.map((m) => {
                                const status = MEETING_STATUS[m.status];
                                return (
                                    <li key={m.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-medium text-foreground">
                                                {format(m.startsAt, "MMM d, h:mm a")} · {m.lead?.businessName || m.lead?.contactName || "Lead"}
                                            </p>
                                            <p className="truncate text-sm text-muted-foreground">
                                                {MEETING_TYPE[m.type]} · {MEETING_FORMAT[m.format]}
                                            </p>
                                        </div>
                                        {status && (
                                            <span
                                                className={cn(
                                                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                    status.tone === "good" ? "bg-brand-soft text-brand-deep" : "bg-stage-negotiation/15 text-foreground"
                                                )}
                                            >
                                                {status.label}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>

            <section aria-labelledby="report-heading" className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="report-heading" className="text-lg font-semibold tracking-tight text-foreground">
                        My pipeline report
                    </h2>
                    <p className="text-sm text-muted-foreground">This month · your leads only</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                    {byStage.map((s) => (
                        <div key={s.label}>
                            <dt className="text-sm text-muted-foreground">{s.label}</dt>
                            <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{s.count}</dd>
                        </div>
                    ))}
                    <div>
                        <dt className="text-sm text-muted-foreground">Won this month</dt>
                        <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-brand-deep">{wonThisMonth.length}</dd>
                    </div>
                </dl>
                <p className="mt-4 text-sm text-muted-foreground">
                    {wonThisMonth.length} won out of {handled} lead{handled === 1 ? "" : "s"} handled this month ({winRate}%). Company-wide reports are with the Super Admin.
                </p>
            </section>
        </div>
    );
}
