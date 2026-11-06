import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowDown, ArrowUp } from "lucide-react";
import { auth, hasRole } from "@/auth";
import { cn } from "@/lib/utils";
import { buildReport } from "@/features/reports/builders";
import { ReportActions } from "@/features/reports/components/ReportActions";
import { comparePeriod, isReportType, parsePeriod, reportLabel, type CompareMode } from "@/features/reports/catalog";

export const dynamic = "force-dynamic";

const money = (n: number) => `₱${n.toLocaleString("en-PH")}`;

/** A generated report (mockup 111). Totals only, built from live data for the chosen period. */
export default async function ReportView({ searchParams }: { searchParams?: Promise<{ type?: string; period?: string; compare?: string; print?: string }> }) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) redirect("/dashboard");

    const params = await searchParams;
    const period = parsePeriod(params?.period);
    if (!isReportType(params?.type) || !period) redirect("/dashboard/reports");

    const mode = (["previous", "year", "none"].includes(params?.compare ?? "") ? params?.compare : "previous") as CompareMode;
    const against = comparePeriod(period, mode);
    const [doc, before] = await Promise.all([buildReport(params.type, period), against ? buildReport(params.type, against) : null]);

    const title = `${reportLabel(params.type)} report · ${period.label}`;
    const range = `${format(period.from, "MMM d")} – ${format(period.to, period.from.getMonth() === period.to.getMonth() ? "d, yyyy" : "MMM d, yyyy")}`;
    const generatedBy = session?.user?.name ?? "Super Admin";

    // The headline number is compared with the other period.
    let delta: { text: string; direction: "up" | "down" | "flat" } | null = null;
    if (before && against) {
        const now = doc.headline.value;
        const then = before.headline.value;
        const change = then > 0 ? Math.round(((now - then) / then) * 100) : null;
        delta = {
            direction: now > then ? "up" : now < then ? "down" : "flat",
            text: change === null ? `${against.label}: ${doc.headline.money ? money(then) : then}` : `${change >= 0 ? "+" : ""}${change}% vs ${against.label}`,
        };
    }

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4 pb-12 print:max-w-none print:space-y-0 print:pb-0">
            <ReportActions filename={title.replace(/[^\w]+/g, "-").toLowerCase()} title={title} tables={doc.tables} autoPrint={params?.print === "1"} />

            <article className="rounded-xl border border-border bg-card p-6 sm:p-8 print:rounded-none print:border-0 print:p-0">
                <header>
                    <p className="text-sm text-muted-foreground">Optrizo Digital Solutions</p>
                    <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {range}
                        {against ? ` · compared with ${against.label}` : ""} · generated {format(new Date(), "MMM d")} by {generatedBy}
                    </p>
                </header>

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {doc.kpis.map((k, i) => (
                        <div key={k.label} className="rounded-xl border border-border px-4 py-3">
                            <p className="text-sm text-muted-foreground">{k.label}</p>
                            <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums tracking-tight", k.tone === "brand" && "text-brand-deep", k.tone === "warn" && "text-destructive")}>{k.value}</p>
                            {i === 0 && delta ? (
                                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                    {delta.direction === "up" && <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                                    {delta.direction === "down" && <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                                    {delta.text}
                                </p>
                            ) : (
                                k.note && <p className="mt-0.5 text-sm text-muted-foreground">{k.note}</p>
                            )}
                        </div>
                    ))}
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
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {t.total && (
                                    <tr className="font-semibold">
                                        {t.total.map((cell, i) => (
                                            <td key={i} className={cn("py-2.5 text-foreground", i === 0 ? "text-left" : "text-right tabular-nums")}>
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                ))}

                <footer className="mt-8 border-t border-border pt-4 text-sm text-muted-foreground">Totals only. No client names.</footer>
            </article>
        </div>
    );
}
