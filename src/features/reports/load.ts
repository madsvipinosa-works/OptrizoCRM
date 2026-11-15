import "server-only";

import { buildReport } from "./builders";
import { comparePeriod, isReportType, parsePeriod, periodRangeText, reportLabel, type CompareMode, type Period, type ReportDoc, type ReportType } from "./catalog";

export interface LoadedReport {
    type: ReportType;
    period: Period;
    mode: CompareMode;
    against: Period | null;
    doc: ReportDoc;
    /** The same report for the compared period, or null when nothing is compared. */
    before: ReportDoc | null;
    title: string;
    range: string;
}

export const parseCompare = (value: string | null | undefined): CompareMode =>
    value === "year" || value === "none" || value === "previous" ? value : "previous";

/** Validates the type and period, then builds the report and the one it is compared with. Null when either is not valid. */
export async function loadReport(type: unknown, periodValue: string | null | undefined, compare: string | null | undefined): Promise<LoadedReport | null> {
    const period = parsePeriod(periodValue);
    if (!isReportType(type) || !period) return null;

    const mode = parseCompare(compare);
    let against = comparePeriod(period, mode);

    // A period that is still running is compared with the same stretch of the other one, not its full length,
    // otherwise half a month would always look worse than a whole one.
    const now = Date.now();
    if (against && now >= period.from.getTime() && now < period.to.getTime()) {
        const sameDays = new Date(Math.min(against.from.getTime() + (now - period.from.getTime()), against.to.getTime()));
        against = { ...against, to: sameDays, label: `${against.label} (same days)` };
    }
    const [doc, before] = await Promise.all([buildReport(type, period), against ? buildReport(type, against) : null]);

    return { type, period, mode, against, doc, before, title: `${reportLabel(type)} report · ${period.label}`, range: periodRangeText(period) };
}
