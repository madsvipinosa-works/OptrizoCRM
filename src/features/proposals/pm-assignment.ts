import { db } from "@/db";
import { agencyProjects, leads, users } from "@/db/schema";
import { and, eq, isNotNull, isNull, ne, notInArray } from "drizzle-orm";

export interface PickedPm {
    id: string;
    name: string | null;
    /** Open leads + unfinished projects this PM already owns. */
    load: number;
}

/**
 * Least-loaded PM wins. Ties go to the PM whose latest assigned request is oldest (never assigned first),
 * then by id, so equal loads rotate. Pure so it can be tested without a database.
 */
export function rankPms(
    pms: Array<{ id: string; name: string | null }>,
    openLeads: Array<{ assignedPmId: string | null; proposalRequestedAt: Date | null }>,
    openProjects: Array<{ assignedPmId: string | null }>,
    excludeId?: string
): PickedPm | null {
    const ranked = pms
        .filter((pm) => pm.id !== excludeId)
        .map((pm) => {
            const mine = openLeads.filter((l) => l.assignedPmId === pm.id);
            const last = Math.max(0, ...mine.map((l) => l.proposalRequestedAt?.getTime() ?? 0));
            const load = mine.length + openProjects.filter((p) => p.assignedPmId === pm.id).length;
            return { pm, load, last };
        })
        .sort((a, b) => a.load - b.load || a.last - b.last || a.pm.id.localeCompare(b.pm.id));

    const best = ranked[0];
    return best ? { id: best.pm.id, name: best.pm.name, load: best.load } : null;
}

/**
 * Picks the PM for a new proposal request (step 8) or a passed one (step 9).
 * shortcut: counts in JS over every open lead, fine for a handful of PMs; move to a grouped SQL count if PMs reach the hundreds.
 */
export async function pickLeastLoadedPm(excludeId?: string): Promise<PickedPm | null> {
    const [pool, openLeads, openProjects] = await Promise.all([
        db.query.users.findMany({
            where: and(
                eq(users.role, "manager"),
                eq(users.status, "active"),
                eq(users.isActive, true),
                isNull(users.deletedAt)
            ),
            columns: { id: true, name: true },
        }),
        db.query.leads.findMany({
            where: and(
                isNotNull(leads.assignedPmId),
                isNull(leads.archivedAt),
                eq(leads.isArchived, false),
                notInArray(leads.status, ["Closed Won", "Closed Lost"])
            ),
            columns: { assignedPmId: true, proposalRequestedAt: true },
        }),
        db
            .select({ assignedPmId: leads.assignedPmId })
            .from(agencyProjects)
            .innerJoin(leads, eq(agencyProjects.leadId, leads.id))
            .where(and(ne(agencyProjects.status, "Completed"), isNotNull(leads.assignedPmId))),
    ]);

    return rankPms(pool, openLeads, openProjects, excludeId);
}
