import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { addDays, differenceInCalendarDays, format, startOfMonth, subDays, subMonths } from "date-fns";
import { db } from "@/db";
import {
    agencyProjects,
    auditLogs,
    projectFeedback,
    leads,
    meetings,
    milestones,
    notifications,
    payments,
    proposals,
    systemErrorLogs,
    tasks,
    users,
} from "@/db/schema";
import { auth, hasRole } from "@/auth";

/**
 * Data for the Super Admin dashboard and analytics (mockups 101, 108, 109).
 * Super Admin monitors only: everything here is counts, totals and rates. No client names, no record links.
 */

async function requireSuperAdmin() {
    const session = await auth();
    return hasRole(session, ["superadmin"]);
}

const inRange = (d: Date | null | undefined, from: Date, to: Date) => !!d && d >= from && d <= to;

// ---------------------------------------------------------------- dashboard

export const ROLE_LABEL: Record<string, string> = {
    client: "Client",
    developer: "Developer",
    sales: "Sales",
    content_editor: "Content editor",
    manager: "Project manager",
    superadmin: "Super admin",
};

export async function getAdminDashboard() {
    if (!(await requireSuperAdmin())) return null;

    const all = await db.query.users.findMany({
        where: isNull(users.deletedAt),
        columns: { id: true, name: true, role: true, status: true, failedLogins: true, lockedUntil: true },
    });

    const now = new Date();
    const active = all.filter((u) => u.status === "active");
    const clients = active.filter((u) => u.role === "client").length;
    // A lock past its end time lifts on its own at the next sign-in; count only locks still running.
    const locked = all.filter((u) => u.status === "locked" && (!u.lockedUntil || u.lockedUntil > now));
    const invited = all.filter((u) => u.status === "invited");
    const deactivated = all.filter((u) => u.status === "deactivated");

    const roleCounts = Object.keys(ROLE_LABEL)
        .map((role) => ({ role, label: ROLE_LABEL[role], count: all.filter((u) => u.role === role && u.status !== "deactivated").length }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count);

    const recent = await db.query.auditLogs.findMany({
        orderBy: [desc(auditLogs.createdAt)],
        limit: 5,
        with: { user: { columns: { name: true, role: true } } },
    });

    return {
        counts: {
            active: active.length,
            staff: active.length - clients,
            clients,
            locked: locked.length,
            invited: invited.length,
            deactivated: deactivated.length,
        },
        attention: [
            ...locked.map((u) => ({
                kind: "locked" as const,
                userId: u.id,
                name: u.name || "An account",
                role: ROLE_LABEL[u.role] ?? u.role,
                failedLogins: u.failedLogins,
                until: u.lockedUntil,
            })),
            ...invited.map((u) => ({
                kind: "invited" as const,
                userId: u.id,
                name: u.name || "A new staff member",
                role: ROLE_LABEL[u.role] ?? u.role,
                failedLogins: 0,
                until: null as Date | null,
            })),
        ],
        roleCounts,
        recent: recent.map((r) => ({
            id: r.id,
            action: r.action,
            entity: r.entity,
            details: r.details,
            who: r.user ? `${r.user.name ?? "Someone"}, ${ROLE_LABEL[r.user.role] ?? r.user.role}` : "System",
            at: r.createdAt,
        })),
    };
}

// ----------------------------------------------------------------- business

export type BusinessPeriod = 1 | 3 | 6 | 12;

const OPEN_STAGES = ["New Lead", "Discovery & Qualifying", "Proposal Sent", "In Negotiation"] as const;
const STAGE_LABEL: Record<string, string> = {
    "New Lead": "New lead",
    "Discovery & Qualifying": "Discovery",
    "Proposal Sent": "Proposal sent",
    "In Negotiation": "Negotiation",
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export async function getBusinessAnalytics(months: BusinessPeriod) {
    if (!(await requireSuperAdmin())) return null;

    const now = new Date();
    const start = subMonths(now, months);
    const prevStart = subMonths(start, months);

    const [allLeads, allProposals, allMeetings, allPayments, allMilestones, allProjects, allFeedback] = await Promise.all([
        db.select({ id: leads.id, status: leads.status, createdAt: leads.createdAt, stageChangedAt: leads.stageChangedAt, isArchived: leads.isArchived }).from(leads),
        db.select({ id: proposals.id, leadId: proposals.leadId, status: proposals.status, version: proposals.version, sentAt: proposals.sentAt, signedAt: proposals.signedAt }).from(proposals).where(isNull(proposals.deletedAt)),
        db.select({ leadId: meetings.leadId }).from(meetings).where(eq(meetings.status, "done")),
        db.select({ amount: payments.amount, currency: payments.currency, status: payments.status, receivedAt: payments.receivedAt, dueDate: payments.dueDate }).from(payments),
        db.select({ status: milestones.status, endDate: milestones.endDate, completedAt: milestones.completedAt }).from(milestones).where(isNull(milestones.deletedAt)),
        db.select({ status: agencyProjects.status, startDate: agencyProjects.startDate, createdAt: agencyProjects.createdAt, completedAt: agencyProjects.completedAt }).from(agencyProjects).where(isNull(agencyProjects.deletedAt)),
        // Ratings only: no names, no comments (Super Admin sees totals).
        db.select({ rating: projectFeedback.rating, createdAt: projectFeedback.createdAt }).from(projectFeedback),
    ]);
    const fbIn = allFeedback.filter((f) => inRange(f.createdAt, start, now));
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

    const leadsIn = (from: Date, to: Date) => allLeads.filter((l) => inRange(l.createdAt, from, to));
    const cur = leadsIn(start, now);
    const prev = leadsIn(prevStart, start);

    const signedLeadIds = new Set(allProposals.filter((p) => p.status === "signed").map((p) => p.leadId));
    const proposedLeadIds = new Set(allProposals.filter((p) => p.sentAt).map((p) => p.leadId));
    const heldLeadIds = new Set(allMeetings.map((m) => m.leadId).filter((x): x is string => !!x));
    const isSigned = (l: { id: string; status: string }) => l.status === "Closed Won" || signedLeadIds.has(l.id);

    const toSigned = pct(cur.filter(isSigned).length, cur.length);
    const prevToSigned = pct(prev.filter(isSigned).length, prev.length);

    const sentCur = allProposals.filter((p) => inRange(p.sentAt, start, now));
    const sentPrev = allProposals.filter((p) => inRange(p.sentAt, prevStart, start));
    const winCur = pct(sentCur.filter((p) => p.status === "signed").length, sentCur.length);

    const phpPaid = allPayments.filter((p) => p.status === "paid" && p.currency === "PHP");
    const revenue = (from: Date, to: Date) => phpPaid.filter((p) => inRange(p.receivedAt, from, to)).reduce((s, p) => s + p.amount, 0);
    const revCur = revenue(start, now);
    const revPrev = revenue(prevStart, start);

    // One bar per calendar month. The current month is month to date.
    const barCount = Math.min(Math.max(months, 6), 12);
    const buckets = Array.from({ length: barCount }, (_, i) => {
        const from = startOfMonth(subMonths(now, barCount - 1 - i));
        const to = i === barCount - 1 ? now : new Date(startOfMonth(subMonths(now, barCount - 2 - i)).getTime() - 1);
        return {
            label: format(from, "MMM") + (i === barCount - 1 ? "*" : ""),
            partial: i === barCount - 1,
            leads: leadsIn(from, to).length,
            revenue: revenue(from, to),
        };
    });

    const funnelLeads = cur.length;
    const held = cur.filter((l) => heldLeadIds.has(l.id)).length;
    const proposed = cur.filter((l) => proposedLeadIds.has(l.id)).length;
    const signed = cur.filter(isSigned).length;
    const funnel = [
        { label: "Leads", count: funnelLeads, rate: null as number | null },
        { label: "Meeting held", count: held, rate: pct(held, funnelLeads) },
        { label: "Proposal sent", count: proposed, rate: pct(proposed, held) },
        { label: "Signed", count: signed, rate: pct(signed, proposed) },
    ];
    // Biggest drop = the step with the lowest rate after the first.
    const drop = funnel.slice(1).reduce((worst, s, i) => (funnel[i + 1].rate! < worst.rate ? { rate: funnel[i + 1].rate!, from: funnel[i].label, to: s.label } : worst), { rate: 101, from: "", to: "" });

    const open = allLeads.filter((l) => !l.isArchived && (OPEN_STAGES as readonly string[]).includes(l.status));
    const wait = OPEN_STAGES.map((stage) => {
        const inStage = open.filter((l) => l.status === stage);
        const days = inStage.length ? inStage.reduce((s, l) => s + differenceInCalendarDays(now, l.stageChangedAt ?? l.createdAt), 0) / inStage.length : 0;
        return { label: STAGE_LABEL[stage], days: Math.round(days * 10) / 10, count: inStage.length };
    });
    const slowest = wait.filter((w) => w.count > 0).sort((a, b) => b.days - a.days)[0] ?? null;

    const doneMs = allMilestones.filter((m) => m.status === "Completed" && inRange(m.completedAt, start, now));
    const onTime = doneMs.filter((m) => m.endDate && m.completedAt && m.completedAt <= addDays(m.endDate, 1)).length;
    const doneProjects = allProjects.filter((p) => p.status === "Completed" && inRange(p.completedAt, start, now));
    const lengthMonths = doneProjects.length
        ? doneProjects.reduce((s, p) => s + differenceInCalendarDays(p.completedAt!, p.startDate ?? p.createdAt) / 30.4, 0) / doneProjects.length
        : null;
    const revised = allProposals.filter((p) => p.version > 1 && inRange(p.sentAt, start, now)).length;
    const paidInPeriod = allPayments.filter((p) => p.status === "paid" && inRange(p.receivedAt, start, now));
    const late = paidInPeriod.filter((p) => p.dueDate && p.receivedAt && p.receivedAt > addDays(p.dueDate, 1)).length;

    return {
        months,
        from: start,
        to: now,
        kpis: {
            newLeads: { value: cur.length, delta: cur.length - prev.length },
            leadToSigned: { value: toSigned, delta: toSigned - prevToSigned },
            winRate: { value: winCur, signed: sentCur.filter((p) => p.status === "signed").length, sent: sentCur.length, prevSent: sentPrev.length },
            revenue: { value: revCur, deltaPct: revPrev > 0 ? Math.round(((revCur - revPrev) / revPrev) * 100) : null },
        },
        buckets,
        funnel,
        biggestDrop: funnelLeads > 0 && drop.from ? drop : null,
        wait,
        slowest,
        delivery: {
            onTime: { done: onTime, total: doneMs.length },
            projectsCompleted: doneProjects.length,
            avgLengthMonths: lengthMonths,
            revisionsPerProposal: sentCur.length ? Math.round((revised / sentCur.length) * 10) / 10 : null,
            paidLate: { late, total: paidInPeriod.length },
            feedback: { responses: fbIn.length, avgRating: avg(fbIn.map((f) => f.rating)) },
        },
    };
}

// ------------------------------------------------------------------- system

export type SystemPeriod = 7 | 30 | 90;

export async function getSystemAnalytics(days: SystemPeriod) {
    if (!(await requireSuperAdmin())) return null;

    const now = new Date();
    const start = subDays(now, days);
    const weekStart = subDays(now, 7);

    const [accounts, logins, errors, props, doneTasks, notes, meetingRows] = await Promise.all([
        db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(isNull(users.deletedAt)),
        db.select({ userId: auditLogs.userId, createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.action, "LOGIN")),
        db.select({ createdAt: systemErrorLogs.createdAt }).from(systemErrorLogs),
        db.select({ status: proposals.status, sentAt: proposals.sentAt }).from(proposals).where(isNull(proposals.deletedAt)),
        db.select({ dueDate: tasks.dueDate, completedAt: tasks.completedAt }).from(tasks).where(and(eq(tasks.status, "done"), isNull(tasks.deletedAt))),
        db.select({ read: notifications.read, createdAt: notifications.createdAt }).from(notifications),
        db.select({ status: meetings.status, createdAt: meetings.createdAt }).from(meetings),
    ]);

    const active = accounts.filter((a) => a.status === "active");
    const loginsIn = (from: Date) => logins.filter((l) => l.createdAt >= from);

    // Weekly active users: people who signed in during each of the last 8 weeks.
    const weekly = Array.from({ length: 8 }, (_, i) => {
        const to = subDays(now, (7 - i) * 7 - 0);
        const from = subDays(to, 7);
        const ids = new Set(logins.filter((l) => l.userId && l.createdAt > from && l.createdAt <= (i === 7 ? now : to)).map((l) => l.userId));
        return { label: format(i === 7 ? weekStart : from, "MMM d"), value: ids.size };
    });
    const activeThisWeek = new Set(loginsIn(weekStart).map((l) => l.userId).filter(Boolean)).size;

    const clients = active.filter((a) => a.role === "client");
    const clientIds = new Set(clients.map((c) => c.id));
    const clientsSignedIn = new Set(loginsIn(start).filter((l) => l.userId && clientIds.has(l.userId)).map((l) => l.userId)).size;

    const sent = props.filter((p) => p.sentAt && p.sentAt >= start);
    const signedOnline = sent.filter((p) => p.status === "signed").length;

    const doneInPeriod = doneTasks.filter((t) => t.completedAt && t.completedAt >= start && t.dueDate);
    const onTimeTasks = doneInPeriod.filter((t) => t.completedAt! <= addDays(t.dueDate!, 1)).length;

    const noteRows = notes.filter((n) => n.createdAt >= start);
    const readNotes = noteRows.filter((n) => n.read).length;

    const bookedMeetings = meetingRows.filter((m) => m.createdAt >= start && m.status !== "cancelled").length;
    const confirmedMeetings = meetingRows.filter((m) => m.createdAt >= start && (m.status === "confirmed" || m.status === "done")).length;

    return {
        days,
        activeThisWeek: { value: activeThisWeek, of: active.length },
        errors: errors.filter((e) => e.createdAt >= start).length,
        weekly,
        adoption: {
            proposalsSignedOnline: { done: signedOnline, total: sent.length },
            meetingsConfirmed: { done: confirmedMeetings, total: bookedMeetings },
            clientsUsedPortal: { done: clientsSignedIn, total: clients.length },
            tasksOnTime: { done: onTimeTasks, total: doneInPeriod.length },
            notificationsRead: { done: readNotes, total: noteRows.length },
        },
        security: {
            signIns: loginsIn(start).length,
            accountsLockedNow: accounts.filter((a) => a.status === "locked").length,
        },
    };
}
