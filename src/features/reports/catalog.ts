import { manilaToDate } from "@/lib/datetime";

/**
 * The five report types and the period maths. No server code here, so the form, the view and the exports can all import it.
 * Periods are whole calendar months or quarters in Manila time (APP_TZ, UTC+8, no daylight saving), whatever the server's clock says.
 */

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

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

export interface Period {
    value: string;
    label: string;
    from: Date;
    to: Date;
    kind: "month" | "quarter";
    year: number;
    /** Month 1-12, or quarter 1-4. */
    index: number;
    /** First and last day as Manila "YYYY-MM-DD". */
    fromYmd: string;
    toYmd: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const startOfDay = (ymd: string) => manilaToDate(ymd, "00:00");
/** The last millisecond of a Manila day. */
const endOfDay = (ymd: string) => new Date(manilaToDate(ymd, "23:59").getTime() + 59_999);

function build(kind: "month" | "quarter", year: number, index: number): Period {
    const firstMonth = kind === "month" ? index : (index - 1) * 3 + 1;
    const lastMonth = kind === "month" ? index : firstMonth + 2;
    const fromYmd = `${year}-${pad(firstMonth)}-01`;
    const toYmd = `${year}-${pad(lastMonth)}-${pad(lastDayOf(year, lastMonth))}`;
    return {
        value: kind === "month" ? `m:${year}-${index}` : `q:${year}-${index}`,
        label: kind === "month" ? `${MONTH_NAMES[index - 1]} ${year}` : `Q${index} ${year}`,
        from: startOfDay(fromYmd),
        to: endOfDay(toYmd),
        kind,
        year,
        index,
        fromYmd,
        toYmd,
    };
}

/** "m:2026-10" is October 2026; "q:2026-3" is the third quarter of 2026. */
export function parsePeriod(value: string | undefined | null): Period | null {
    const m = /^m:(\d{4})-(\d{1,2})$/.exec(value ?? "");
    if (m) {
        const month = Number(m[2]);
        return month >= 1 && month <= 12 ? build("month", Number(m[1]), month) : null;
    }
    const q = /^q:(\d{4})-([1-4])$/.exec(value ?? "");
    return q ? build("quarter", Number(q[1]), Number(q[2])) : null;
}

/** Today's calendar year and month in Manila. */
export function manilaYearMonth(now = new Date()) {
    const shifted = new Date(now.getTime() + 8 * 3_600_000);
    return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

/** Months and quarters, newest first. The first of each is the running one ("so far"). */
export function periodOptions(now = new Date()): { group: string; items: { value: string; label: string }[] }[] {
    const { year, month } = manilaYearMonth(now);
    const monthIndex = year * 12 + (month - 1);
    const quarterIndex = year * 4 + Math.floor((month - 1) / 3);

    const months = Array.from({ length: 12 }, (_, i) => {
        const at = monthIndex - i;
        const p = build("month", Math.floor(at / 12), (at % 12) + 1);
        return { value: p.value, label: i === 0 ? `${p.label} (so far)` : p.label };
    });
    const quarters = Array.from({ length: 4 }, (_, i) => {
        const at = quarterIndex - i;
        const p = build("quarter", Math.floor(at / 4), (at % 4) + 1);
        return { value: p.value, label: i === 0 ? `${p.label} (so far)` : p.label };
    });
    return [
        { group: "Months", items: months },
        { group: "Quarters", items: quarters },
    ];
}

/** The period to compare against, or null for no comparison. */
export function comparePeriod(period: Period, mode: CompareMode): Period | null {
    if (mode === "none") return null;
    if (mode === "year") return build(period.kind, period.year - 1, period.index);

    const perYear = period.kind === "month" ? 12 : 4;
    const at = period.year * perYear + (period.index - 1) - 1;
    return build(period.kind, Math.floor(at / perYear), (at % perYear) + 1);
}

/** "Nov 1 – 30, 2026" or "Oct 1 – Dec 31, 2026". */
export function periodRangeText(p: Period): string {
    const [, fm, fd] = p.fromYmd.split("-").map(Number);
    const [ty, tm, td] = p.toYmd.split("-").map(Number);
    const to = fm === tm ? `${td}` : `${MONTH_SHORT[tm - 1]} ${td}`;
    return `${MONTH_SHORT[fm - 1]} ${fd} – ${to}, ${ty}`;
}

export type KpiUnit = "count" | "money" | "percent";

export interface ReportKpi {
    label: string;
    /** What is shown on the page. */
    value: string;
    /** The plain number behind `value` (null when there is nothing to measure), used to compare and to export. */
    raw: number | null;
    unit: KpiUnit;
    note?: string;
    tone?: "ink" | "brand" | "warn";
}
export interface ReportTable {
    title: string;
    columns: string[];
    rows: (string | number)[][];
    total?: (string | number)[];
    /** Columns holding pesos as plain numbers: shown as ₱1,000 on the page, exported as 1000. */
    moneyColumns?: number[];
}
export interface ReportDoc {
    kpis: ReportKpi[];
    tables: ReportTable[];
    /** How many things happened in the period. 0 means the report has nothing to show. */
    events: number;
}

export const formatPeso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

export function formatKpiRaw(unit: KpiUnit, raw: number): string {
    return unit === "money" ? formatPeso(raw) : unit === "percent" ? `${raw}%` : String(raw);
}

/** A table cell as shown on the page. */
export function formatCell(table: ReportTable, column: number, cell: string | number): string | number {
    return table.moneyColumns?.includes(column) && typeof cell === "number" ? formatPeso(cell) : cell;
}

/** How one number moved against the other period, in words. Null when nothing is compared. */
export function kpiChange(kpi: ReportKpi, before: ReportKpi | undefined, againstLabel: string): { text: string; direction: "up" | "down" | "flat" } | null {
    if (!before) return null;
    if (before.raw === null) return { text: `No data for ${againstLabel}`, direction: "flat" };
    if (kpi.raw === null) return { text: `${formatKpiRaw(before.unit, before.raw)} in ${againstLabel}`, direction: "flat" };

    const diff = kpi.raw - before.raw;
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    if (diff === 0) return { text: `Same as ${againstLabel}`, direction };
    if (kpi.unit === "percent") return { text: `${diff > 0 ? "+" : ""}${diff} points vs ${againstLabel}`, direction };
    if (before.raw === 0) return { text: `Up from 0 in ${againstLabel}`, direction };
    const change = Math.round((diff / before.raw) * 100);
    return { text: `${change > 0 ? "+" : ""}${change}% vs ${againstLabel}`, direction };
}
