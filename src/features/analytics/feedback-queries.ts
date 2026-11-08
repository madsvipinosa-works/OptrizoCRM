import "server-only";

import { isNull } from "drizzle-orm";
import { subMonths } from "date-fns";
import { db } from "@/db";
import { agencyProjects, projectFeedback } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { FEEDBACK_AREAS, csatPercent, lowestArea } from "@/features/client-portal/feedback-areas";

export type FeedbackPeriod = 3 | 6 | 12;
export const PAGE_SIZE = 10;

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/**
 * Super Admin view of client feedback: totals and averages only. No client names, no comments,
 * no project names and no links into records (CLAUDE.md: Super Admin monitors only).
 */
export async function getFeedbackSummary(months: FeedbackPeriod, page: number) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) return null;

    const from = subMonths(new Date(), months);
    const [all, projects] = await Promise.all([
        db.select().from(projectFeedback),
        db.select({ completedAt: agencyProjects.completedAt }).from(agencyProjects).where(isNull(agencyProjects.deletedAt)),
    ]);

    const rows = all.filter((f) => f.createdAt >= from).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const completed = projects.filter((p) => p.completedAt && p.completedAt >= from).length;
    const rec = (v: string) => rows.filter((r) => r.wouldRecommend === v).length;

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pageCount);

    return {
        months,
        responses: rows.length,
        completedProjects: completed,
        responseRate: completed > 0 ? Math.min(100, Math.round((rows.length / completed) * 100)) : null,
        csat: csatPercent(rows.map((r) => r.rating)),
        satisfied: rows.filter((r) => r.rating >= 4).length,
        avgOverall: avg(rows.map((r) => r.rating)),
        recommend: { yes: rec("yes"), maybe: rec("maybe"), no: rec("no") },
        areas: FEEDBACK_AREAS.map((a) => ({
            label: a.short,
            avg: avg(rows.map((r) => r[a.key]).filter((v): v is number => typeof v === "number")),
        })),
        table: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((r) => ({
            id: r.id,
            sent: r.createdAt,
            overall: r.rating,
            lowest: lowestArea(r),
        })),
        page: current,
        pageCount,
    };
}
