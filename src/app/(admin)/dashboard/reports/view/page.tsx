import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { auth, hasRole } from "@/auth";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { generateReport } from "@/features/reports/generate-action";
import { loadReport } from "@/features/reports/load";
import { ReportActions } from "@/features/reports/components/ReportActions";
import { COMPARE_OPTIONS, CUSTOM_PERIOD, REPORT_TYPES, formatCell, kpiChange, periodOptions } from "@/features/reports/catalog";

export const dynamic = "force-dynamic";

const field =
    "h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A generated report (mockup 111). Totals only, built from live data for the chosen period; the filters above it rebuild it. */
export default async function ReportView({ searchParams }: { searchParams?: Promise<{ type?: string; period?: string; compare?: string }> }) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) redirect("/dashboard");

    const params = await searchParams;
    const report = await loadReport(params?.type, params?.period, params?.compare);
    if (!report) redirect("/dashboard/reports");

    const { type, period, mode, against, doc, before, title, range } = report;
    const generatedBy = session?.user?.name ?? "Super Admin";
    const query = `type=${type}&period=${encodeURIComponent(period.value)}&compare=${mode}`;

    // The period list, with this report's own period added when it is older than the list.
    const groups = periodOptions();
    const isCustom = period.kind === "custom";
    const known = isCustom || groups.some((g) => g.items.some((o) => o.value === period.value));
    const periodGroups = known ? groups : [{ group: "This report", items: [{ value: period.value, label: period.label }] }, ...groups];
    const thisMonth = groups[0].items[0];
    const isRunningMonth = period.value === thisMonth.value;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4 pb-12 print:max-w-none print:space-y-0 print:pb-0">
            <ReportActions pdfHref={`/api/reports/export?format=pdf&${query}`} csvHref={`/api/reports/export?format=csv&${query}`} />

            <form action={generateReport} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 print:hidden">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Report
                    <FormSelect name="type" defaultValue={type} className={`${field} min-w-44`} variant="plain">
                        {REPORT_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.label}
                            </option>
                        ))}
                    </FormSelect>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Period
                    <FormSelect name="period" defaultValue={isCustom ? CUSTOM_PERIOD : period.value} className={`${field} min-w-52`} variant="plain">
                        {periodGroups.map((g) => (
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
                    From
                    <input type="date" name="from" defaultValue={isCustom ? period.fromYmd : ""} className={`${field} w-40`} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    To
                    <input type="date" name="to" defaultValue={isCustom ? period.toYmd : ""} className={`${field} w-40`} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Compare with
                    <FormSelect name="compare" defaultValue={mode} className={`${field} min-w-48`} variant="plain">
                        {COMPARE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </FormSelect>
                </label>
                <Button type="submit" className="h-10">
                    Update report
                </Button>
            </form>

            <article className="rounded-xl border border-border bg-card p-6 sm:p-8 print:rounded-none print:border-0 print:p-0">
                <header>
                    <p className="text-sm text-muted-foreground">Optrizo Digital Solutions</p>
                    <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {range}
                        {against ? ` · compared with ${against.label}` : ""} · generated {formatDate(new Date())} by {generatedBy}
                    </p>
                </header>

                {doc.events === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
                        <p className="text-lg font-semibold text-foreground">No activity in {period.label}</p>
                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                            {isRunningMonth
                                ? "Nothing has been recorded for this report yet this month. It fills in as work happens."
                                : "Nothing was recorded for this report in that period. Pick another period above, or look at the running month."}
                        </p>
                        {!isRunningMonth && (
                            <Button asChild variant="outline" className="mt-4 print:hidden">
                                <Link href={`/dashboard/reports/view?type=${type}&period=${encodeURIComponent(thisMonth.value)}&compare=${mode}`}>Show this month</Link>
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {doc.kpis.map((k, i) => {
                                const change = against ? kpiChange(k, before?.kpis[i], against.label) : null;
                                return (
                                    <div key={k.label} className="rounded-xl border border-border px-4 py-3">
                                        <p className="text-sm text-muted-foreground">{k.label}</p>
                                        <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums tracking-tight", k.tone === "brand" && "text-brand-deep", k.tone === "warn" && "text-destructive")}>{k.value}</p>
                                        {k.note && <p className="mt-0.5 text-sm text-muted-foreground">{k.note}</p>}
                                        {change && (
                                            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                                {change.direction === "up" && <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                                                {change.direction === "down" && <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                                                {change.text}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {doc.tables.map((t) => (
                            <section key={t.title} className="mt-8 break-inside-avoid">
                                <h2 className="text-lg font-semibold tracking-tight text-foreground">{t.title}</h2>
                                <table className="mt-2 w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-muted-foreground">
                                            {t.columns.map((c, i) => (
                                                <th key={c} scope="col" className={cn("py-2 font-medium", i === 0 ? "text-left" : "text-right")}>
                                                    {c}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {t.rows.map((r, ri) => (
                                            <tr key={ri} className="border-b border-border">
                                                {r.map((cell, i) => (
                                                    <td key={i} className={cn("py-2.5 text-foreground", i === 0 ? "text-left" : "text-right tabular-nums")}>
                                                        {formatCell(t, i, cell)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {t.total && (
                                            <tr className="font-semibold">
                                                {t.total.map((cell, i) => (
                                                    <td key={i} className={cn("py-2.5 text-foreground", i === 0 ? "text-left" : "text-right tabular-nums")}>
                                                        {formatCell(t, i, cell)}
                                                    </td>
                                                ))}
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </section>
                        ))}
                    </>
                )}

                <footer className="mt-8 border-t border-border pt-4 text-sm text-muted-foreground">Totals only. No client names.</footer>
            </article>
        </div>
    );
}
