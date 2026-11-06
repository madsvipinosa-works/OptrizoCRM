import "server-only";

import { eq, isNull } from "drizzle-orm";
import { addDays, differenceInCalendarDays, endOfDay, format, startOfWeek } from "date-fns";
import { db } from "@/db";
import { agencyProjects, auditLogs, leads, milestones, payments, proposals, systemErrorLogs, users } from "@/db/schema";
import type { Period, ReportDoc, ReportType } from "./catalog";

/**
 * Report content for Super Admin. Totals only: no client names, no record links (spec §6).
 * A report is built from the live data for its period, so a past period always gives the same document.
 */

const inRange = (d: Date | null | undefined, from: Date, to: Date) => !!d && d >= from && d <= to;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "No data");
const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

/** Weeks inside a period, as "Oct 1 – 7" style labels. The first and last week are cut to the period. */
function weeksOf(period: Period) {
    const out: { label: string; from: Date; to: Date }[] = [];
    let cursor = period.from;
    while (cursor <= period.to) {
        const weekEnd = endOfDay(addDays(startOfWeek(cursor, { weekStartsOn: 1 }), 6));
        const to = weekEnd > period.to ? period.to : weekEnd;
        const sameMonth = cursor.getMonth() === to.getMonth();
        out.push({
            label: `${format(cursor, "MMM d")} – ${sameMonth ? format(to, "d") : format(to, "MMM d")}`,
            from: cursor,
            to,
        });
        cursor = addDays(to, 1);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
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
    const won = all.filter((l) => l.status === "Closed Won" && inRange(l.closedWonAt, p.from, p.to)).length;
    const lost = made.filter((l) => l.status === "Closed Lost").length;
    const open = all.filter((l) => !["Closed Won", "Closed Lost"].includes(l.status) && l.createdAt <= p.to);

    const stageRows = STAGES.map((s) => {
        const group = made.filter((l) => l.status === s);
        const days = group.length ? group.reduce((sum, l) => sum + differenceInCalendarDays(p.to, l.stageChangedAt ?? l.createdAt), 0) / group.length : null;
        return [STAGE_LABEL[s], group.length, days === null || s === "Closed Won" || s === "Closed Lost" ? "–" : `${days.toFixed(1)} days`];
    });
    const sources = new Map<string, number>();
    made.forEach((l) => sources.set(l.source || "Unknown", (sources.get(l.source || "Unknown") ?? 0) + 1));

    return {
        headline: { label: "New leads", value: made.length },
        kpis: [
            { label: "New leads", value: String(made.length), tone: "brand" },
            { label: "Open now", value: String(open.length) },
            { label: "Won", value: String(won), tone: "brand" },
            { label: "Win rate", value: pct(won, won + lost), note: `${won} won, ${lost} lost` },
        ],
        tables: [
            { title: "New leads by stage", columns: ["Stage", "Leads", "Average days in stage"], rows: stageRows, total: ["Total", made.length, ""] },
            { title: "By source", columns: ["Source", "Leads"], rows: [...sources.entries()].sort((a, b) => b[1] - a[1]), total: ["Total", made.length] },
        ],
    };
}

async function proposalsReport(p: Period): Promise<ReportDoc> {
    const all = await db.select({ status: proposals.status, version: proposals.version, sentAt: proposals.sentAt, signedAt: proposals.signedAt }).from(proposals).where(isNull(proposals.deletedAt));
    const sent = all.filter((x) => inRange(x.sentAt, p.from, p.to));
    const signed = sent.filter((x) => x.status === "signed").length;
    const declined = sent.filter((x) => x.status === "declined").length;
    const waiting = sent.filter((x) => ["sent", "pricing_meeting_requested", "changes_requested"].includes(x.status)).length;
    const revised = sent.filter((x) => x.version > 1).length;
    const statusLabel: Record<string, string> = { sent: "Sent, waiting", pricing_meeting_requested: "Pricing meeting requested", changes_requested: "Changes requested", signed: "Signed", declined: "Declined", replaced: "Replaced by a newer version" };

    return {
        headline: { label: "Proposals sent", value: sent.length },
        kpis: [
            { label: "Sent", value: String(sent.length), tone: "brand" },
            { label: "Signed", value: String(signed), tone: "brand" },
            { label: "Declined", value: String(declined) },
            { label: "Win rate", value: pct(signed, sent.length), note: `${waiting} still waiting` },
        ],
        tables: [
            {
                title: "Sent in this period, by status",
                columns: ["Status", "Proposals"],
                rows: Object.keys(statusLabel).map((s) => [statusLabel[s], sent.filter((x) => x.status === s).length]).filter((r) => (r[1] as number) > 0),
                total: ["Total", sent.length],
            },
            {
                title: "Versions",
                columns: ["Kind", "Proposals"],
                rows: [["First version", sent.length - revised], ["Revised (v2 or later)", revised]],
                total: ["Total", sent.length],
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
    const delayed = ms.filter((m) => m.status !== "Completed" && m.endDate && m.endDate < p.to).length;
    const finished = projects.filter((x) => x.status === "Completed" && inRange(x.completedAt, p.from, p.to));
    const length = finished.length ? finished.reduce((s, x) => s + differenceInCalendarDays(x.completedAt!, x.startDate ?? x.createdAt) / 30.4, 0) / finished.length : null;
    const active = projects.filter((x) => x.status !== "Completed").length;

    return {
        headline: { label: "Milestones finished", value: done.length },
        kpis: [
            { label: "Milestones finished", value: String(done.length), tone: "brand" },
            { label: "On time", value: pct(onTime, done.length), note: `${onTime} of ${done.length}` },
            { label: "Delayed now", value: String(delayed), tone: delayed > 0 ? "warn" : "ink", note: "Open and past their end date" },
            { label: "Projects completed", value: String(finished.length), note: length === null ? undefined : `${length.toFixed(1)} months on average` },
        ],
        tables: [
            {
                title: "Projects by status",
                columns: ["Status", "Projects"],
                rows: ["Kickoff", "In Progress", "In Review", "Completed"].map((s) => [s, projects.filter((x) => x.status === s).length]),
                total: ["Total", projects.length],
            },
            {
                title: "Milestones by status",
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
    const overdue = php.filter((x) => x.dueDate && x.dueDate <= p.to && (!x.receivedAt || x.receivedAt > p.to) && x.status !== "not_yet_due");
    const onTime = paid.filter((x) => !x.dueDate || (x.receivedAt && x.receivedAt <= addDays(x.dueDate, 1))).length;

    const weekRows = weeksOf(p).map((w) => {
        const inWeek = paid.filter((x) => inRange(x.receivedAt, w.from, w.to));
        return [w.label, inWeek.length, peso(inWeek.reduce((s, x) => s + x.amount, 0))];
    });
    const stages = new Map<string, { count: number; amount: number }>();
    paid.forEach((x) => {
        const key = `${x.label} (${x.percent}%)`;
        const cur = stages.get(key) ?? { count: 0, amount: 0 };
        stages.set(key, { count: cur.count + 1, amount: cur.amount + x.amount });
    });

    return {
        headline: { label: "Collected", value: collected, money: true },
        kpis: [
            { label: "Collected", value: peso(collected), tone: "brand" },
            { label: "Payments received", value: String(paid.length) },
            { label: "Overdue at period end", value: String(overdue.length), tone: overdue.length > 0 ? "warn" : "ink", note: peso(overdue.reduce((s, x) => s + x.amount, 0)) },
            { label: "Paid on time", value: `${onTime} of ${paid.length}`, note: pct(onTime, paid.length) },
        ],
        tables: [
            { title: "By week", columns: ["Week", "Payments", "Amount"], rows: weekRows, total: ["Total", paid.length, peso(collected)] },
            {
                title: "By payment stage",
                columns: ["Payment stage", "Payments", "Amount"],
                rows: [...stages.entries()].map(([k, v]) => [k, v.count, peso(v.amount)]),
                total: ["Total", paid.length, peso(collected)],
            },
        ],
    };
}

async function systemUsage(p: Period): Promise<ReportDoc> {
    const [logins, errors, accounts] = await Promise.all([
        db.select({ userId: auditLogs.userId, createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.action, "LOGIN")),
        db.select({ createdAt: systemErrorLogs.createdAt, severity: systemErrorLogs.severity }).from(systemErrorLogs),
        db.select({ status: users.status }).from(users).where(isNull(users.deletedAt)),
    ]);
    const inPeriod = logins.filter((l) => inRange(l.createdAt, p.from, p.to));
    const people = new Set(inPeriod.map((l) => l.userId).filter(Boolean));
    const errs = errors.filter((e) => inRange(e.createdAt, p.from, p.to));
    const active = accounts.filter((a) => a.status === "active").length;

    const weekRows = weeksOf(p).map((w) => {
        const rows = inPeriod.filter((l) => inRange(l.createdAt, w.from, w.to));
        return [w.label, new Set(rows.map((l) => l.userId).filter(Boolean)).size, rows.length, errs.filter((e) => inRange(e.createdAt, w.from, w.to)).length];
    });

    return {
        headline: { label: "People who signed in", value: people.size },
        kpis: [
            { label: "People who signed in", value: String(people.size), tone: "brand", note: active ? `of ${active} active accounts` : undefined },
            { label: "Sign-ins", value: String(inPeriod.length) },
            { label: "Errors", value: String(errs.length), tone: errs.length > 0 ? "warn" : "ink" },
            { label: "Accounts locked now", value: String(accounts.filter((a) => a.status === "locked").length) },
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
