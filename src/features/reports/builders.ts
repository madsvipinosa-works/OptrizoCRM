import "server-only";

import { eq, isNull } from "drizzle-orm";
import { addDays, differenceInCalendarDays } from "date-fns";
import { db } from "@/db";
import { agencyProjects, auditLogs, leads, milestones, payments, proposals, systemErrorLogs, users } from "@/db/schema";
import { manilaToDate } from "@/lib/datetime";
import { MONTH_SHORT, formatPeso, type Period, type ReportDoc, type ReportKpi, type ReportType } from "./catalog";

/**
 * Report content for Super Admin. Totals only: no client names, no record links (spec §6).
 * A report is built from the live data for its period, so a past period always gives the same document.
 * Periods are Manila calendar months and quarters (see catalog.ts).
 */

const inRange = (d: Date | null | undefined, from: Date, to: Date) => !!d && d >= from && d <= to;
/** How far a "right now" measure should look: the period's end, or today when the period is still running. */
const asOf = (p: Period) => new Date(Math.min(p.to.getTime(), Date.now()));
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "No data");

const count = (label: string, n: number, extra: Partial<ReportKpi> = {}): ReportKpi => ({ label, value: String(n), raw: n, unit: "count", ...extra });
const money = (label: string, n: number, extra: Partial<ReportKpi> = {}): ReportKpi => ({ label, value: formatPeso(n), raw: n, unit: "money", ...extra });
/** A percentage; "No data" (and nothing to compare) when there is nothing to divide by. */
const rate = (label: string, n: number, d: number, extra: Partial<ReportKpi> = {}): ReportKpi => ({
    label,
    value: pct(n, d),
    raw: d > 0 ? Math.round((n / d) * 100) : null,
    unit: "percent",
    ...extra,
});

/** Weeks (Monday to Sunday) inside a period, as "Oct 1 – 7" labels. The first and last week are cut to the period. */
export function weeksOf(period: Period) {
    const DAY = 86_400_000;
    const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
    const out: { label: string; from: Date; to: Date }[] = [];
    let cursor = Date.parse(`${period.fromYmd}T00:00:00Z`);
    const last = Date.parse(`${period.toYmd}T00:00:00Z`);

    while (cursor <= last) {
        const mondayBased = (new Date(cursor).getUTCDay() + 6) % 7;
        const end = Math.min(cursor + (6 - mondayBased) * DAY, last);
        const fromYmd = ymd(cursor);
        const toYmd = ymd(end);
        const [, fm, fd] = fromYmd.split("-").map(Number);
        const [, tm, td] = toYmd.split("-").map(Number);
        out.push({
            label: fromYmd === toYmd ? `${MONTH_SHORT[fm - 1]} ${fd}` : `${MONTH_SHORT[fm - 1]} ${fd} – ${fm === tm ? td : `${MONTH_SHORT[tm - 1]} ${td}`}`,
            from: manilaToDate(fromYmd),
            to: new Date(manilaToDate(toYmd, "23:59").getTime() + 59_999),
        });
        cursor = end + DAY;
    }
    return out;
}

const STAGES = ["New Lead", "Discovery & Qualifying", "Proposal Sent", "In Negotiation", "Closed Won", "Closed Lost"] as const;
const STAGE_LABEL: Record<string, string> = {
    "New Lead": "New lead",
    "Discovery & Qualifying": "Discovery",
    "Proposal Sent": "Proposal sent",
    "In Negotiation": "Negotiation",
    "Closed Won": "Won",
    "Closed Lost": "Lost",
};

async function salesPipeline(p: Period): Promise<ReportDoc> {
    const all = await db.select({ status: leads.status, source: leads.source, createdAt: leads.createdAt, stageChangedAt: leads.stageChangedAt, closedWonAt: leads.closedWonAt }).from(leads);
    const made = all.filter((l) => inRange(l.createdAt, p.from, p.to));
    // Won and lost both count in the period they happened, so the win rate compares like with like.
    const won = all.filter((l) => l.status === "Closed Won" && inRange(l.closedWonAt, p.from, p.to)).length;
    const lost = all.filter((l) => l.status === "Closed Lost" && inRange(l.stageChangedAt ?? l.createdAt, p.from, p.to)).length;
    const open = all.filter((l) => !["Closed Won", "Closed Lost"].includes(l.status) && l.createdAt <= p.to);

    const stageRows = STAGES.map((s) => {
        const group = made.filter((l) => l.status === s);
        const days = group.length ? group.reduce((sum, l) => sum + differenceInCalendarDays(asOf(p), l.stageChangedAt ?? l.createdAt), 0) / group.length : null;
        return [STAGE_LABEL[s], group.length, days === null || s === "Closed Won" || s === "Closed Lost" ? "–" : `${days.toFixed(1)} days`];
    });
    const sources = new Map<string, number>();
    made.forEach((l) => sources.set(l.source || "Unknown", (sources.get(l.source || "Unknown") ?? 0) + 1));

    return {
        events: made.length + won + lost,
        kpis: [
            count("New leads", made.length, { tone: "brand" }),
            count("Open now", open.length, { note: "Created by the period end, still open today" }),
            count("Won", won, { tone: "brand" }),
            rate("Win rate", won, won + lost, { note: `${won} won, ${lost} lost` }),
        ],
        tables: [
            { title: "New leads by stage", columns: ["Stage", "Leads", "Average days in stage"], rows: stageRows, total: ["Total", made.length, ""] },
            { title: "By source", columns: ["Source", "Leads"], rows: [...sources.entries()].sort((a, b) => b[1] - a[1]), total: ["Total", made.length] },
        ],
    };
}

async function proposalsReport(p: Period): Promise<ReportDoc> {
    const all = await db.select({ leadId: proposals.leadId, status: proposals.status, version: proposals.version, sentAt: proposals.sentAt }).from(proposals).where(isNull(proposals.deletedAt));
    const sentVersions = all.filter((x) => inRange(x.sentAt, p.from, p.to));

    // One proposal per client: its newest version sent in the period. A revision is not a new proposal.
    const latest = new Map<string, (typeof sentVersions)[number]>();
    sentVersions.forEach((v, i) => {
        const key = v.leadId ?? `unlinked-${i}`;
        const current = latest.get(key);
        if (!current || v.version > current.version) latest.set(key, v);
    });
    const current = [...latest.values()];
    const signed = current.filter((x) => x.status === "signed").length;
    const declined = current.filter((x) => x.status === "declined").length;
    const waiting = current.filter((x) => ["sent", "pricing_meeting_requested", "changes_requested"].includes(x.status)).length;
    const revisions = sentVersions.filter((x) => x.version > 1).length;
    const statusLabel: Record<string, string> = {
        sent: "Sent, waiting",
        pricing_meeting_requested: "Pricing meeting requested",
        changes_requested: "Changes requested",
        signed: "Signed",
        declined: "Declined",
        replaced: "Replaced by a version sent later",
    };

    return {
        events: sentVersions.length,
        kpis: [
            count("Proposals sent", current.length, { tone: "brand", note: revisions > 0 ? `${revisions} revised version${revisions === 1 ? "" : "s"} sent` : undefined }),
            count("Signed", signed, { tone: "brand" }),
            count("Declined", declined),
            rate("Win rate", signed, signed + declined, { note: `${waiting} still waiting` }),
        ],
        tables: [
            {
                title: "Proposals sent, by their latest status",
                columns: ["Status", "Proposals"],
                rows: Object.keys(statusLabel).map((s) => [statusLabel[s], current.filter((x) => x.status === s).length]).filter((r) => (r[1] as number) > 0),
                total: ["Total", current.length],
            },
            {
                title: "Versions sent",
                columns: ["Kind", "Versions"],
                rows: [["First version", sentVersions.length - revisions], ["Revised (v2 or later)", revisions]],
                total: ["Total", sentVersions.length],
            },
        ],
    };
}

async function projectStatus(p: Period): Promise<ReportDoc> {
    const [ms, projects] = await Promise.all([
        db.select({ status: milestones.status, endDate: milestones.endDate, completedAt: milestones.completedAt }).from(milestones).where(isNull(milestones.deletedAt)),
        db.select({ status: agencyProjects.status, startDate: agencyProjects.startDate, createdAt: agencyProjects.createdAt, completedAt: agencyProjects.completedAt }).from(agencyProjects).where(isNull(agencyProjects.deletedAt)),
    ]);
    const done = ms.filter((m) => m.status === "Completed" && inRange(m.completedAt, p.from, p.to));
    const onTime = done.filter((m) => m.endDate && m.completedAt && m.completedAt <= addDays(m.endDate, 1)).length;
    const delayed = ms.filter((m) => m.status !== "Completed" && m.endDate && m.endDate < asOf(p)).length;
    const finished = projects.filter((x) => x.status === "Completed" && inRange(x.completedAt, p.from, p.to));
    const length = finished.length ? finished.reduce((s, x) => s + differenceInCalendarDays(x.completedAt!, x.startDate ?? x.createdAt) / 30.4, 0) / finished.length : null;
    const active = projects.filter((x) => x.status !== "Completed").length;

    return {
        events: done.length + finished.length,
        kpis: [
            count("Milestones finished", done.length, { tone: "brand" }),
            rate("On time", onTime, done.length, { note: `${onTime} of ${done.length}` }),
            count("Delayed now", delayed, { tone: delayed > 0 ? "warn" : "ink", note: "Open and past their end date" }),
            count("Projects completed", finished.length, { note: length === null ? undefined : `${length.toFixed(1)} months on average` }),
        ],
        tables: [
            {
                title: "Projects by status (today)",
                columns: ["Status", "Projects"],
                rows: ["Kickoff", "In Progress", "In Review", "Completed"].map((s) => [s, projects.filter((x) => x.status === s).length]),
                total: ["Total", projects.length],
            },
            {
                title: "Milestones by status (today)",
                columns: ["Status", "Milestones"],
                rows: ["Pending", "In Progress", "Completed"].map((s) => [s, ms.filter((m) => m.status === s).length]),
                total: ["Total", ms.length],
            },
            { title: "Open work", columns: ["Measure", "Count"], rows: [["Projects not yet completed", active], ["Milestones delayed", delayed]] },
        ],
    };
}

async function paymentsReport(p: Period): Promise<ReportDoc> {
    const all = await db.select({ label: payments.label, percent: payments.percent, amount: payments.amount, currency: payments.currency, status: payments.status, receivedAt: payments.receivedAt, dueDate: payments.dueDate }).from(payments);
    const php = all.filter((x) => x.currency === "PHP");
    const paid = php.filter((x) => x.status === "paid" && inRange(x.receivedAt, p.from, p.to));
    const collected = paid.reduce((s, x) => s + x.amount, 0);
    const overdue = php.filter((x) => x.dueDate && x.dueDate <= asOf(p) && (!x.receivedAt || x.receivedAt > asOf(p)) && x.status !== "not_yet_due");
    // Pesos only. A payment in another currency is not converted, so it is named instead of silently left out.
    const usd = all.filter((x) => x.currency === "USD" && x.status === "paid" && inRange(x.receivedAt, p.from, p.to)).reduce((s, x) => s + x.amount, 0);
    const onTime = paid.filter((x) => !x.dueDate || (x.receivedAt && x.receivedAt <= addDays(x.dueDate, 1))).length;

    const weekRows = weeksOf(p).map((w) => {
        const inWeek = paid.filter((x) => inRange(x.receivedAt, w.from, w.to));
        return [w.label, inWeek.length, inWeek.reduce((s, x) => s + x.amount, 0)];
    });
    const stages = new Map<string, { count: number; amount: number }>();
    paid.forEach((x) => {
        const key = `${x.label} (${x.percent}%)`;
        const cur = stages.get(key) ?? { count: 0, amount: 0 };
        stages.set(key, { count: cur.count + 1, amount: cur.amount + x.amount });
    });

    return {
        events: paid.length,
        kpis: [
            money("Collected", collected, { tone: "brand", note: usd > 0 ? `Pesos only. Another $${usd.toLocaleString("en-US")} was paid in USD` : undefined }),
            count("Payments received", paid.length),
            count("Overdue", overdue.length, { tone: overdue.length > 0 ? "warn" : "ink", note: `${formatPeso(overdue.reduce((s, x) => s + x.amount, 0))} unpaid and past due` }),
            rate("Paid on time", onTime, paid.length, { value: paid.length > 0 ? `${onTime} of ${paid.length}` : "No data", note: pct(onTime, paid.length) }),
        ],
        tables: [
            { title: "By week", columns: ["Week", "Payments", "Amount"], rows: weekRows, total: ["Total", paid.length, collected], moneyColumns: [2] },
            {
                title: "By payment stage",
                columns: ["Payment stage", "Payments", "Amount"],
                rows: [...stages.entries()].map(([k, v]) => [k, v.count, v.amount]),
                total: ["Total", paid.length, collected],
                moneyColumns: [2],
            },
        ],
    };
}

/**
 * Who a sign-in record belongs to. Older records were written before the session existed, so they have no user:
 * those are told apart by the email in their details ("Email login: someone@example.com"), which is only counted, never shown.
 */
export function whoSignedIn(l: { userId: string | null; details?: string | null }): string | null {
    if (l.userId) return l.userId;
    const email = /^Email login:\s*(.+)$/i.exec((l.details ?? "").trim())?.[1];
    return email ? `email:${email.trim().toLowerCase()}` : null;
}

async function systemUsage(p: Period): Promise<ReportDoc> {
    const [logins, errors, accounts] = await Promise.all([
        db.select({ userId: auditLogs.userId, details: auditLogs.details, createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.action, "LOGIN")),
        db.select({ createdAt: systemErrorLogs.createdAt, severity: systemErrorLogs.severity }).from(systemErrorLogs),
        db.select({ status: users.status }).from(users).where(isNull(users.deletedAt)),
    ]);
    const inPeriod = logins.filter((l) => inRange(l.createdAt, p.from, p.to));
    const people = new Set(inPeriod.map(whoSignedIn).filter(Boolean));
    const errs = errors.filter((e) => inRange(e.createdAt, p.from, p.to));
    const active = accounts.filter((a) => a.status === "active").length;

    const weekRows = weeksOf(p).map((w) => {
        const rows = inPeriod.filter((l) => inRange(l.createdAt, w.from, w.to));
        return [w.label, new Set(rows.map(whoSignedIn).filter(Boolean)).size, rows.length, errs.filter((e) => inRange(e.createdAt, w.from, w.to)).length];
    });

    return {
        events: inPeriod.length + errs.length,
        kpis: [
            count("People who signed in", people.size, { tone: "brand", note: active ? `of ${active} active accounts` : undefined }),
            count("Sign-ins", inPeriod.length, { note: "Email and password only; Google sign-ins are not recorded" }),
            count("Errors", errs.length, { tone: errs.length > 0 ? "warn" : "ink" }),
            count("Accounts locked now", accounts.filter((a) => a.status === "locked").length),
        ],
        tables: [
            { title: "By week", columns: ["Week", "People", "Sign-ins", "Errors"], rows: weekRows, total: ["Total", people.size, inPeriod.length, errs.length] },
            {
                title: "Errors by severity",
                columns: ["Severity", "Errors"],
                rows: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => [s[0] + s.slice(1).toLowerCase(), errs.filter((e) => e.severity === s).length]),
                total: ["Total", errs.length],
            },
        ],
    };
}

export async function buildReport(type: ReportType, period: Period): Promise<ReportDoc> {
    switch (type) {
        case "sales_pipeline":
            return salesPipeline(period);
        case "proposals":
            return proposalsReport(period);
        case "project_status":
            return projectStatus(period);
        case "payments":
            return paymentsReport(period);
        case "system_usage":
            return systemUsage(period);
    }
}
