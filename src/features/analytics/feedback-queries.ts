import "server-only";

import { and, count, desc, gte, isNull } from "drizzle-orm";
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
    // Filter and count in SQL: the page must not pull every project and every full feedback row into the function.
    const [rows, [{ completed }]] = await Promise.all([
        db
            .select({
                id: projectFeedback.id,
                createdAt: projectFeedback.createdAt,
                rating: projectFeedback.rating,
                wouldRecommend: projectFeedback.wouldRecommend,
                ratingCommunication: projectFeedback.ratingCommunication,
                ratingQuality: projectFeedback.ratingQuality,
                ratingOnTime: projectFeedback.ratingOnTime,
                ratingValue: projectFeedback.ratingValue,
                ratingPmSupport: projectFeedback.ratingPmSupport,
            })
            .from(projectFeedback)
            .where(gte(projectFeedback.createdAt, from))
            .orderBy(desc(projectFeedback.createdAt)),
        db
            .select({ completed: count() })
            .from(agencyProjects)
            .where(and(isNull(agencyProjects.deletedAt), gte(agencyProjects.completedAt, from))),
    ]);
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
