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
    const against = comparePeriod(period, mode);
    const [doc, before] = await Promise.all([buildReport(type, period), against ? buildReport(type, against) : null]);

    return { type, period, mode, against, doc, before, title: `${reportLabel(type)} report · ${period.label}`, range: periodRangeText(period) };
}
