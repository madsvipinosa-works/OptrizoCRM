import "server-only";

import type { Session } from "next-auth";
import { and, eq, isNull } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { agencyProjects, leads, projectStakeholders, taskAssignees, tasks } from "@/db/schema";

/**
 * Shared access checks for server actions and route handlers (spec §1).
 *
 * Every check returns a result instead of throwing, so each caller can keep its own failure shape
 * (an ActionState, an empty list, a 401/403 response). A project that does not exist and a project
 * the caller may not see both come back as FORBIDDEN, so IDs cannot be probed.
 */

export type AuthedSession = Session & {
    user: { id: string; role: string; email: string; name: string };
};

export type AuthzFailure = { ok: false; reason: "UNAUTHENTICATED" | "FORBIDDEN" };
export type AuthzSuccess = { ok: true; session: AuthedSession };
export type AuthzResult = AuthzSuccess | AuthzFailure;

const FORBIDDEN: AuthzFailure = { ok: false, reason: "FORBIDDEN" };

export function roleOf(session: Session | null): string | undefined {
    return (session?.user as { role?: string } | undefined)?.role;
}

export async function requireSession(): Promise<AuthzResult> {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, reason: "UNAUTHENTICATED" };
    return { ok: true, session: session as AuthedSession };
}

export async function requireRoles(roles: string[]): Promise<AuthzResult> {
    const result = await requireSession();
    if (!result.ok) return result;
    return hasRole(result.session, roles) ? result : FORBIDDEN;
}

async function isStakeholderOrLeadClient(projectId: string, userId: string): Promise<boolean> {
    const stakeholder = await db.query.projectStakeholders.findFirst({
        where: and(eq(projectStakeholders.projectId, projectId), eq(projectStakeholders.userId, userId)),
    });
    if (stakeholder) return true;

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, projectId),
        columns: { leadId: true },
    });
    if (!project?.leadId) return false;

    const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, project.leadId), eq(leads.clientId, userId)),
        columns: { id: true },
    });
    return !!lead;
}

async function hasAssignedTaskInProject(projectId: string, userId: string): Promise<boolean> {
    const rows = await db
        .select({ taskId: taskAssignees.taskId })
        .from(taskAssignees)
        .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
        .where(and(eq(tasks.projectId, projectId), eq(taskAssignees.userId, userId), isNull(tasks.deletedAt)))
        .limit(1);
    return rows.length > 0;
}

/**
 * Who may touch a project:
 * - manager: every project, read and write.
 * - developer: read only, and only when assigned a task in the project (until project teams are built).
 * - client: read and write on their own project (stakeholder, or owner of the originating lead).
 * - sales, content_editor, superadmin: no access to project records.
 */
export async function authorizeProject(projectId: string, mode: "read" | "write"): Promise<AuthzResult> {
    const result = await requireSession();
    if (!result.ok) return result;
    if (!projectId) return FORBIDDEN;

    const { session } = result;
    const userId = session.user.id;

    switch (roleOf(session)) {
        case "manager":
            return result;
        case "developer":
            return mode === "read" && (await hasAssignedTaskInProject(projectId, userId)) ? result : FORBIDDEN;
        case "client":
            return (await isStakeholderOrLeadClient(projectId, userId)) ? result : FORBIDDEN;
        default:
            return FORBIDDEN;
    }
}

/**
 * Who may read or submit a task: a manager, or the developer the task is assigned to.
 * Clients and every other role have no task access.
 */
export async function authorizeTask(taskId: string): Promise<AuthzResult> {
    const result = await requireSession();
    if (!result.ok) return result;
    if (!taskId) return FORBIDDEN;

    const { session } = result;
    switch (roleOf(session)) {
        case "manager":
            return result;
        case "developer": {
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, session.user.id)),
            });
            return assignment ? result : FORBIDDEN;
        }
        default:
            return FORBIDDEN;
    }
}

/** True when a stored file reference (raw URL, or a /api/private-file proxy URL) points at `fileRef`. */
function referencesFile(stored: string | null | undefined, fileRef: string): boolean {
    if (!stored) return false;
    if (stored === fileRef) return true;
    if (stored.startsWith("/api/private-file")) {
        try {
            return new URL(stored, "http://localhost").searchParams.get("blobUrl") === fileRef;
        } catch {
            return false;
        }
    }
    return false;
}

/**
 * Ties a file to a project, so access to one project does not unlock files from another.
 * The file must be one of the project's documents or one of its tasks' proof links.
 */
export async function fileBelongsToProject(projectId: string, fileRef: string): Promise<boolean> {
    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, projectId),
        columns: { documents: true },
    });
    if ((project?.documents ?? []).some((doc) => referencesFile(doc.url, fileRef))) return true;

    const taskRows = await db.query.tasks.findMany({
        where: and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)),
        columns: { proofLinks: true },
    });
    return taskRows.some((task) => (task.proofLinks ?? []).some((link) => referencesFile(link.url, fileRef)));
}
