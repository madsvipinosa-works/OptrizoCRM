import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { getAdminDashboard } from "@/features/analytics/queries";
import { AttentionAction } from "@/features/analytics/components/AttentionActions";
import { BarRow, Panel, Stat } from "@/features/analytics/components/parts";

const VERB: Record<string, string> = {
    LOGIN: "Signed in",
    CREATE: "Created",
    UPDATE: "Updated",
    DELETE: "Deleted",
    OTHER: "Activity",
};

/**
 * Super Admin home (mockup "Super Admin · Dashboard"). Counts only: accounts, locks, invites,
 * what needs attention, and recent activity with names, roles and record type. No links into records.
 */
export async function AdminDashboard() {
    const data = await getAdminDashboard();
    if (!data) return null;
    const { counts, attention, roleCounts, recent } = data;
    const total = roleCounts.reduce((s, r) => s + r.count, 0);
    const top = Math.max(1, ...roleCounts.map((r) => r.count));

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Accounts and activity across Optrizo. You oversee; you do not work inside sales or projects.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Active accounts" value={counts.active} tone="brand" note={`${counts.staff} staff, ${counts.clients} clients`} />
                <Stat label="Locked now" value={counts.locked} tone={counts.locked > 0 ? "warn" : "ink"} note="Unlocks on its own" />
                <Stat label="Invites waiting" value={counts.invited} note="Not accepted yet" />
                <Stat label="Deactivated" value={counts.deactivated} note="Cannot sign in" />
            </div>

            <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
                <Panel title="Needs attention">
                    {attention.length === 0 ? (
                        <p className="py-6 text-sm text-muted-foreground">Nothing needs you. No locked accounts and no invites waiting.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {attention.map((item) => (
                                <li key={`${item.kind}-${item.userId}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="text-base font-medium text-foreground">
                                            {item.name} {item.kind === "locked" ? "is locked" : "has not accepted the invite"}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {item.kind === "locked"
                                                ? `${item.role} · ${item.failedLogins} failed sign-ins${item.until ? `. Unlocks at ${format(item.until, "h:mm a")}.` : "."}`
                                                : `${item.role} · invite pending`}
                                        </p>
                                    </div>
                                    <AttentionAction kind={item.kind} userId={item.userId} name={item.name} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title="Accounts by role" aside={`${total} accounts`}>
                    {roleCounts.length === 0 ? (
                        <p className="py-6 text-sm text-muted-foreground">No accounts yet.</p>
                    ) : (
                        <div>
                            {roleCounts.map((r) => (
                                <BarRow key={r.role} label={r.label} value={r.count} max={top} display={r.count} />
                            ))}
                        </div>
                    )}
                </Panel>
            </div>

            <Panel
                title="Recent activity"
                aside={
                    <Link href="/dashboard/audit" className="font-medium text-brand-deep outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                        View audit log
                    </Link>
                }
            >
                {recent.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">Nothing has been recorded yet.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {recent.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0">
                                <div className="min-w-0">
                                    <p className="text-base text-foreground">
                                        <span className="font-semibold">{VERB[r.action] ?? "Activity"}</span>
                                        <span className="text-muted-foreground"> · {r.entity}{r.details ? ` · ${r.details}` : ""}</span>
                                    </p>
                                    <p className="text-sm text-muted-foreground">{r.who}</p>
                                </div>
                                <time dateTime={r.at.toISOString()} title={formatDistanceToNowStrict(r.at, { addSuffix: true })} className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                    {format(r.at, "MMM d, h:mm a")}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}
