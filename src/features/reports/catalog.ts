import { endOfMonth, endOfQuarter, format, startOfMonth, startOfQuarter, subMonths, subQuarters, subYears } from "date-fns";

/** The five report types and the period maths. No server code here, so the form and the preview can both import it. */

export type ReportType = "sales_pipeline" | "proposals" | "project_status" | "payments" | "system_usage";

export const REPORT_TYPES: { id: ReportType; label: string; blurb: string }[] = [
    { id: "sales_pipeline", label: "Sales pipeline", blurb: "Leads by stage, conversion, time in stage" },
    { id: "proposals", label: "Proposals", blurb: "Sent, signed, declined, win rate" },
    { id: "project_status", label: "Project status", blurb: "Milestones, on-time rate, delays" },
    { id: "payments", label: "Payments", blurb: "Collected, due and overdue" },
    { id: "system_usage", label: "System usage", blurb: "Active users, sign-ins, errors" },
];

export const reportLabel = (type: string) => REPORT_TYPES.find((t) => t.id === type)?.label ?? "Report";
export const isReportType = (v: unknown): v is ReportType => REPORT_TYPES.some((t) => t.id === v);

export type CompareMode = "previous" | "year" | "none";
export const COMPARE_OPTIONS: { value: CompareMode; label: string }[] = [
    { value: "previous", label: "Previous period" },
    { value: "year", label: "Same period last year" },
    { value: "none", label: "No comparison" },
];

export interface Period {
    value: string;
    label: string;
    from: Date;
    to: Date;
    kind: "month" | "quarter";
}

/** "m:2026-10" is October 2026; "q:2026-3" is the third quarter of 2026. */
export function parsePeriod(value: string | undefined | null): Period | null {
    const m = /^m:(\d{4})-(\d{1,2})$/.exec(value ?? "");
    if (m) {
        const base = new Date(Number(m[1]), Number(m[2]) - 1, 1);
        if (Number.isNaN(base.getTime())) return null;
        return { value: value!, label: format(base, "MMMM yyyy"), from: startOfMonth(base), to: endOfMonth(base), kind: "month" };
    }
    const q = /^q:(\d{4})-([1-4])$/.exec(value ?? "");
    if (q) {
        const base = new Date(Number(q[1]), (Number(q[2]) - 1) * 3, 1);
        return { value: value!, label: `Q${q[2]} ${q[1]}`, from: startOfQuarter(base), to: endOfQuarter(base), kind: "quarter" };
    }
    return null;
}

export function periodOptions(now = new Date()): { group: string; items: { value: string; label: string }[] }[] {
    const months = Array.from({ length: 12 }, (_, i) => {
        const d = subMonths(now, i);
        return { value: `m:${format(d, "yyyy")}-${d.getMonth() + 1}`, label: format(d, "MMMM yyyy") };
    });
    const quarters = Array.from({ length: 4 }, (_, i) => {
        const d = subQuarters(now, i);
        const q = Math.floor(d.getMonth() / 3) + 1;
        return { value: `q:${format(d, "yyyy")}-${q}`, label: `Q${q} ${format(d, "yyyy")}` };
    });
    return [
        { group: "Months", items: months },
        { group: "Quarters", items: quarters },
    ];
}

/** The period to compare against, or null for no comparison. */
export function comparePeriod(period: Period, mode: CompareMode): Period | null {
    if (mode === "none") return null;
    const shift = (d: Date) => (mode === "year" ? subYears(d, 1) : period.kind === "month" ? subMonths(d, 1) : subQuarters(d, 1));
    const from = shift(period.from);
    const value = period.kind === "month" ? `m:${format(from, "yyyy")}-${from.getMonth() + 1}` : `q:${format(from, "yyyy")}-${Math.floor(from.getMonth() / 3) + 1}`;
    return parsePeriod(value);
}

export interface ReportKpi {
    label: string;
    value: string;
    note?: string;
    tone?: "ink" | "brand" | "warn";
}
export interface ReportTable {
    title: string;
    columns: string[];
    rows: (string | number)[][];
    total?: (string | number)[];
}
export interface ReportDoc {
    kpis: ReportKpi[];
    tables: ReportTable[];
    /** The one number the comparison is about, and how to print it. */
    headline: { label: string; value: number; money?: boolean };
}
