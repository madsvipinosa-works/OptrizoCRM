import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    getBusinessAnalytics,
    getSystemAnalytics,
    type BusinessPeriod,
    type SystemPeriod,
} from "@/features/analytics/queries";
import { PeriodSelect } from "@/features/analytics/components/PeriodSelect";
import { BarRow, ColumnChart, MetricRow, Panel, Stat, peso, thousands } from "@/features/analytics/components/parts";

const BUSINESS_PERIODS = [
    { value: 1, label: "Last month" },
    { value: 3, label: "Last 3 months" },
    { value: 6, label: "Last 6 months" },
    { value: 12, label: "Last 12 months" },
];
const SYSTEM_PERIODS = [
    { value: 7, label: "Last 7 days" },
    { value: 30, label: "Last 30 days" },
    { value: 90, label: "Last 90 days" },
];

const of = (x: { done: number; total: number }) => `${x.done} of ${x.total}`;
const share = (x: { done: number; total: number }) => (x.total > 0 ? `${Math.round((x.done / x.total) * 100)}%` : "No data");

function Tabs({ tab, period }: { tab: "business" | "system"; period: number }) {
    return (
        <div role="group" aria-label="Analytics view" className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
            {(
                [
                    ["business", "Business", 6],
                    ["system", "System", 30],
                ] as const
            ).map(([key, label, defaultPeriod]) => (
                <Link
                    key={key}
                    href={`/dashboard/analytics?tab=${key}${key === tab ? `&period=${period}` : `&period=${defaultPeriod}`}`}
                    aria-current={tab === key ? "page" : undefined}
                    className={cn(
                        "flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                        tab === key ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {label}
                </Link>
            ))}
        </div>
    );
}

function Shell({ tab, period, subtitle, children }: { tab: "business" | "system"; period: number; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                </div>
                <PeriodSelect value={period} tab={tab} options={tab === "business" ? BUSINESS_PERIODS : SYSTEM_PERIODS} />
            </div>
            <Tabs tab={tab} period={period} />
            {children}
        </div>
    );
}

export async function BusinessAnalytics({ months }: { months: BusinessPeriod }) {
    const d = await getBusinessAnalytics(months);
    if (!d) return null;
    const k = d.kpis;
    const vs = `vs previous ${months === 1 ? "month" : `${months} months`}`;
    const dir = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat") as "up" | "down" | "flat";

    return (
        <Shell tab="business" period={months} subtitle={`How the business is doing, ${format(d.from, "MMM d")} to ${format(d.to, "MMM d")}. Live, read-only.`}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat
                    label="New leads"
                    value={k.newLeads.value}
                    tone="brand"
                    delta={{ text: `${k.newLeads.delta >= 0 ? "+" : ""}${k.newLeads.delta} ${vs}`, direction: dir(k.newLeads.delta), good: k.newLeads.delta > 0 ? true : undefined }}
                />
                <Stat
                    label="Lead to signed"
                    value={`${k.leadToSigned.value}%`}
                    tone="brand"
                    delta={{ text: `${k.leadToSigned.delta >= 0 ? "+" : ""}${k.leadToSigned.delta} pts`, direction: dir(k.leadToSigned.delta), good: k.leadToSigned.delta > 0 ? true : undefined }}
                />
                <Stat
                    label="Proposal win rate"
                    value={k.winRate.sent > 0 ? `${Math.round((k.winRate.signed / k.winRate.sent) * 100)}%` : "No data"}
                    tone="brand"
                    note={`${k.winRate.signed} of ${k.winRate.sent} proposals signed`}
                />
                <Stat
                    label="Revenue collected"
                    value={peso(k.revenue.value)}
                    tone="brand"
                    delta={k.revenue.deltaPct === null ? undefined : { text: `${k.revenue.deltaPct >= 0 ? "+" : ""}${k.revenue.deltaPct}% ${vs}`, direction: dir(k.revenue.deltaPct), good: k.revenue.deltaPct > 0 ? true : undefined }}
                    note={k.revenue.deltaPct === null ? "Paid payments in pesos" : undefined}
                />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="New leads per month" aside="* month to date">
                    <ColumnChart label="New leads per month" items={d.buckets.map((b) => ({ label: b.label, value: b.leads, display: String(b.leads), partial: b.partial }))} />
                </Panel>
                <Panel title="Revenue collected per month" aside="pesos, * month to date">
                    <ColumnChart label="Revenue collected per month" tone="brand" items={d.buckets.map((b) => ({ label: b.label, value: b.revenue, display: thousands(b.revenue), partial: b.partial }))} />
                </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Conversion funnel" aside="step rate">
                    <div>
                        {d.funnel.map((f) => (
                            <BarRow key={f.label} label={f.label} value={f.count} max={d.funnel[0].count} display={f.rate === null ? f.count : `${f.count} · ${f.rate}%`} />
                        ))}
                    </div>
                    {d.biggestDrop ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                            Biggest drop: {d.biggestDrop.from.toLowerCase()} to {d.biggestDrop.to.toLowerCase()} ({d.biggestDrop.rate}%).
                        </p>
                    ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No leads in this period yet.</p>
                    )}
                </Panel>

                <Panel title="Where leads wait" aside="average days in stage, open leads">
                    <div>
                        {d.wait.map((w) => (
                            <BarRow
                                key={w.label}
                                label={w.label}
                                value={w.days}
                                max={Math.max(1, ...d.wait.map((x) => x.days))}
                                display={`${w.days} ${w.days === 1 ? "day" : "days"}`}
                                tone={d.slowest && w.label === d.slowest.label && w.days >= 7 ? "bad" : "brand"}
                            />
                        ))}
                    </div>
                    {d.slowest ? (
                        <p className={cn("mt-3 text-sm font-medium", d.slowest.days >= 7 ? "text-destructive" : "text-muted-foreground")}>
                            Slowest step: leads wait {d.slowest.days} days in {d.slowest.label.toLowerCase()}.
                        </p>
                    ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No open leads right now.</p>
                    )}
                </Panel>

                <Panel title="Project delivery" aside={`last ${months === 1 ? "month" : `${months} months`}`}>
                    <dl>
                        <MetricRow
                            label="Milestones finished on time"
                            value={of(d.delivery.onTime)}
                            extra={d.delivery.onTime.total ? share(d.delivery.onTime) : undefined}
                            extraTone="good"
                        />
                        <MetricRow label="Projects completed" value={d.delivery.projectsCompleted} />
                        <MetricRow label="Average project length" value={d.delivery.avgLengthMonths === null ? "No data" : `${d.delivery.avgLengthMonths.toFixed(1)} months`} />
                        <MetricRow label="Revised versions per proposal" value={d.delivery.revisionsPerProposal === null ? "No data" : d.delivery.revisionsPerProposal} />
                        <MetricRow
                            label="Payments paid late"
                            value={of({ done: d.delivery.paidLate.late, total: d.delivery.paidLate.total })}
                            extra={d.delivery.paidLate.total ? share({ done: d.delivery.paidLate.late, total: d.delivery.paidLate.total }) : undefined}
                            extraTone={d.delivery.paidLate.late > 0 ? "bad" : "good"}
                        />
                    </dl>
                </Panel>
            </div>
        </Shell>
    );
}

export async function SystemAnalytics({ days }: { days: SystemPeriod }) {
    const d = await getSystemAnalytics(days);
    if (!d) return null;
    const a = d.adoption;

    return (
        <Shell tab="system" period={days} subtitle="How the system is being used. Live, read-only.">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Active users this week" value={`${d.activeThisWeek.value} of ${d.activeThisWeek.of}`} tone="brand" note={d.activeThisWeek.of ? `${Math.round((d.activeThisWeek.value / d.activeThisWeek.of) * 100)}% of accounts` : undefined} />
                <Stat label="Errors" value={d.errors} tone={d.errors > 0 ? "warn" : "ink"} note={`Server errors, last ${days} days`} />
                <Stat label="Sign-ins" value={d.security.signIns} note={`Last ${days} days`} />
                <Stat label="Accounts locked now" value={d.security.accountsLockedNow} note="Unlock on their own" />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Weekly active users" aside="people who signed in">
                    <ColumnChart label="Weekly active users" items={d.weekly.map((w) => ({ label: w.label, value: w.value, display: String(w.value) }))} />
                </Panel>

                <Panel title="System adoption" aside={`last ${days} days`}>
                    <dl>
                        <MetricRow label="Proposals signed online" value={of(a.proposalsSignedOnline)} extra={a.proposalsSignedOnline.total ? share(a.proposalsSignedOnline) : undefined} extraTone="good" />
                        <MetricRow label="Meetings confirmed or held" value={of(a.meetingsConfirmed)} extra={a.meetingsConfirmed.total ? share(a.meetingsConfirmed) : undefined} extraTone="good" />
                        <MetricRow label="Clients who signed in" value={of(a.clientsUsedPortal)} extra={a.clientsUsedPortal.total ? share(a.clientsUsedPortal) : undefined} extraTone="good" />
                        <MetricRow label="Tasks finished on time" value={a.tasksOnTime.total ? share(a.tasksOnTime) : "No data"} />
                        <MetricRow label="Notifications read" value={a.notificationsRead.total ? share(a.notificationsRead) : "No data"} />
                    </dl>
                </Panel>
            </div>

            <Panel title="Not measured yet">
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    Uptime, average page load, storage used, failed sign-ins and email delivery are not recorded by the system today. They need a monitoring service or new logging, so this page does not show invented numbers for them.
                </p>
            </Panel>
        </Shell>
    );
}
