import Link from "next/link";
import { desc, and, eq } from "drizzle-orm";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { generateReport } from "@/features/reports/generate-action";
import { COMPARE_OPTIONS, REPORT_TYPES, isReportType, parsePeriod, periodOptions, reportLabel } from "@/features/reports/catalog";
import { FormSelect } from "@/components/ui/form-select";

export const dynamic = "force-dynamic";

const field =
    "h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function rangeText(from: Date, to: Date) {
    return from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
        ? `${format(from, "MMM d")} – ${format(to, "d")}`
        : `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
}

/** Super Admin reports (mockup 110): pick a type and a period, generate, and open past reports. Totals only. */
export default async function ReportsPage() {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) redirect("/dashboard");

    const periods = periodOptions();
    const rows = await db.query.auditLogs.findMany({
        where: and(eq(auditLogs.entity, "Report"), eq(auditLogs.action, "CREATE")),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 12,
        with: { user: { columns: { name: true } } },
    });

    const generated = rows
        .map((r) => {
            const meta = Object.fromEntries((r.details ?? "").split(";").map((kv) => kv.split("=") as [string, string]));
            const period = parsePeriod(meta.period);
            if (!isReportType(meta.type) || !period) return null;
            return { id: r.id, type: meta.type, compare: meta.compare ?? "previous", period, at: r.createdAt, by: r.user?.name ?? "Someone" };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
                <p className="mt-1 text-sm text-muted-foreground">Pick a report and a period, then generate it. Reports show totals only, are listed here and can be downloaded.</p>
            </div>

            <form action={generateReport} className="rounded-xl border border-border bg-card p-5">
                <fieldset>
                    <legend className="text-lg font-semibold tracking-tight text-foreground">New report</legend>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {REPORT_TYPES.map((t, i) => (
                            <label
                                key={t.id}
                                className="group relative flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 transition-[border-color,background-color] duration-150 hover:bg-muted/50 has-[:checked]:border-brand-deep has-[:checked]:bg-brand-soft/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                            >
                                <input type="radio" name="type" value={t.id} defaultChecked={i === 0} className="peer sr-only" />
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-card peer-checked:border-brand-deep peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-brand-deep"
                                />
                                <span>
                                    <span className="block text-base font-semibold text-foreground">{t.label}</span>
                                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{t.blurb}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="mt-5 flex flex-wrap items-end gap-4">
                    <label className="grid gap-1.5 text-sm font-medium text-foreground">
                        Period
                        <FormSelect name="period" defaultValue={periods[0].items[1]?.value ?? periods[0].items[0].value} className={`${field} min-w-48`} variant="plain">
                            {periods.map((g) => (
                                <optgroup key={g.group} label={g.group}>
                                    {g.items.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </FormSelect>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-foreground">
                        Compare with
                        <FormSelect name="compare" defaultValue="previous" className={`${field} min-w-48`} variant="plain">
                            {COMPARE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </FormSelect>
                    </label>
                    <Button type="submit" className="h-10">
                        Generate report
                    </Button>
                </div>
            </form>

            <section aria-labelledby="generated-heading" className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 id="generated-heading" className="px-5 pb-3 pt-5 text-lg font-semibold tracking-tight text-foreground">
                    Generated reports
                </h2>
                {generated.length === 0 ? (
                    <p className="border-t border-border px-5 py-10 text-sm text-muted-foreground">No reports yet. Generate one above and it is listed here.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-y border-border bg-muted/40 text-left text-muted-foreground">
                                    <th scope="col" className="px-5 py-2.5 font-medium">Report</th>
                                    <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Period</th>
                                    <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Generated</th>
                                    <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">By</th>
                                    <th scope="col" className="px-5 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {generated.map((g) => {
                                    const href = `/dashboard/reports/view?type=${g.type}&period=${encodeURIComponent(g.period.value)}&compare=${g.compare}`;
                                    const name = `${reportLabel(g.type)} · ${g.period.label}`;
                                    return (
                                        <tr key={g.id} className="border-b border-border last:border-b-0">
                                            <td className="px-5 py-3 text-base font-medium text-foreground">{name}</td>
                                            <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell">{rangeText(g.period.from, g.period.to)}</td>
                                            <td className="hidden px-3 py-3 tabular-nums text-muted-foreground md:table-cell">{format(g.at, "MMM d")}</td>
                                            <td className="hidden px-3 py-3 text-muted-foreground md:table-cell">{g.by}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={href}>Open<span className="sr-only"> {name}</span></Link>
                                                    </Button>
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`${href}&print=1`}>PDF<span className="sr-only"> for {name}</span></Link>
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
