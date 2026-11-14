import { db } from "@/db";
import { agencyProjects, leads, users } from "@/db/schema";
import { and, eq, isNotNull, isNull, ne, notInArray } from "drizzle-orm";

export interface PmWorkload {
    id: string;
    name: string | null;
    /** Open leads + unfinished projects this PM already owns. */
    load: number;
}

/**
 * Active PMs, fairest first: least open work, then the PM whose latest assigned request is oldest
 * (never assigned first), then by id, so equal loads rotate. The first entry is the recommended PM.
 * Pure so it can be tested without a database.
 */
export function rankPms(
    pms: Array<{ id: string; name: string | null }>,
    openLeads: Array<{ assignedPmId: string | null; proposalRequestedAt: Date | null }>,
    openProjects: Array<{ assignedPmId: string | null }>,
    excludeId?: string
): PmWorkload[] {
    return pms
        .filter((pm) => pm.id !== excludeId)
        .map((pm) => {
            const mine = openLeads.filter((l) => l.assignedPmId === pm.id);
            const last = Math.max(0, ...mine.map((l) => l.proposalRequestedAt?.getTime() ?? 0));
            const load = mine.length + openProjects.filter((p) => p.assignedPmId === pm.id).length;
            return { id: pm.id, name: pm.name, load, last };
        })
        .sort((a, b) => a.load - b.load || a.last - b.last || a.id.localeCompare(b.id))
        .map(({ id, name, load }) => ({ id, name, load }));
}

/**
 * Every active PM with their open work, recommended first (steps 8 and 9).
 * shortcut: counts in JS over every open lead, fine for a handful of PMs; move to a grouped SQL count if PMs reach the hundreds.
 */
export async function listPmWorkloads(excludeId?: string): Promise<PmWorkload[]> {
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

/**
 * Resolves the PM for an assignment: the chosen one if given (must be in the list), else the recommended one.
 * Returns the audit note shared by requestProposal and passProposalRequest.
 */
export function resolvePmChoice(
    workloads: PmWorkload[],
    chosenId?: string
): { ok: true; pm: PmWorkload; note: string } | { ok: false; message: string } {
    const recommended = workloads[0];
    if (!recommended) return { ok: false, message: "No other Project Manager is available." };
    if (!chosenId) return { ok: true, pm: recommended, note: `auto-assigned to ${label(recommended)}` };

    const pm = workloads.find((w) => w.id === chosenId);
    if (!pm) return { ok: false, message: "That Project Manager is not available." };
    const note = pm.id === recommended.id
        ? `assigned to ${label(pm)}, the recommended PM`
        : `assigned to ${label(pm)} instead of the recommended ${label(recommended)}`;
    return { ok: true, pm, note };
}

const label = (pm: PmWorkload) => `${pm.name || pm.id} (open work: ${pm.load})`;
