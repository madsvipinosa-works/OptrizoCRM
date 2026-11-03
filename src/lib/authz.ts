import "server-only";

import type { Session } from "next-auth";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { agencyProjects, leads, projectStakeholders, projectTeamMembers, taskAssignees, tasks, payments, document } from "@/db/schema";

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

export async function requireRole(role: string | string[]): Promise<AuthzResult> {
    const roleList = Array.isArray(role) ? role : [role];
    return requireRoles(roleList);
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

async function isProjectTeamMember(projectId: string, userId: string): Promise<boolean> {
    const member = await db.query.projectTeamMembers.findFirst({
        where: and(eq(projectTeamMembers.projectId, projectId), eq(projectTeamMembers.userId, userId)),
    });
    return !!member;
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
            return mode === "read" && (await isProjectTeamMember(projectId, userId)) ? result : FORBIDDEN;
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
 * Accepts:
 * - project.documents (JSON array items)
 * - tasks.proofLinks
 * - agency_project.signOffFileUrl
 * - payment.proofFileUrl
 * - document.fileUrl (handover files)
 * - proposals.signedFileUrl (for the project's lead)
 */
export async function fileBelongsToProject(projectId: string, fileRef: string): Promise<boolean> {
    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, projectId),
        columns: { documents: true, signOffFileUrl: true, leadId: true },
        with: {
            lead: {
                with: {
                    proposals: {
                        columns: { signedFileUrl: true },
                    },
                },
            },
        },
    });
    if ((project?.documents ?? []).some((doc) => referencesFile(doc.url, fileRef))) return true;
    if (referencesFile(project?.signOffFileUrl, fileRef)) return true;
    if (project?.lead?.proposals?.some((p) => referencesFile(p.signedFileUrl, fileRef))) return true;

    const taskRows = await db.query.tasks.findMany({
        where: and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)),
        columns: { proofLinks: true },
    });
    if (taskRows.some((task) => (task.proofLinks ?? []).some((link) => referencesFile(link.url, fileRef)))) return true;

    const paymentRows = await db.query.payments.findMany({
        where: eq(payments.projectId, projectId),
        columns: { proofFileUrl: true },
    });
    if (paymentRows.some((p) => referencesFile(p.proofFileUrl, fileRef))) return true;

    const documentRows = await db.query.document.findMany({
        where: eq(document.projectId, projectId),
        columns: { fileUrl: true },
    });
    if (documentRows.some((d) => referencesFile(d.fileUrl, fileRef))) return true;

    return false;
}

/** Extracts the raw fileRef from a proxy URL or returns the URL directly. */
export function extractFileRef(fileUrl: string): string {
    if (fileUrl.startsWith("/api/private-file")) {
        try {
            const parsed = new URL(fileUrl, "http://localhost");
            return parsed.searchParams.get("blobUrl") || parsed.searchParams.get("local") || fileUrl;
        } catch {
            return fileUrl;
        }
    }
    return fileUrl;
}

/**
 * Validates that a fileUrl is safe to attach to a project:
 * 1. Must be a non-empty string with an allowed file storage scheme.
 * 2. If it is a /api/private-file proxy URL containing a projectId param, that projectId must match.
 * 3. Cannot already belong to a different project in the system (prevents cross-project attachment attacks).
 */
export async function validateFileUrlForProject(
    projectId: string,
    fileUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!fileUrl || typeof fileUrl !== "string") {
        return { ok: false, error: "Invalid file URL." };
    }

    const trimmed = fileUrl.trim();
    if (
        !trimmed.startsWith("/api/private-file") &&
        !trimmed.startsWith("/uploads/") &&
        !trimmed.includes(".blob.vercel-storage.com")
    ) {
        return { ok: false, error: "Invalid file storage location." };
    }

    if (trimmed.startsWith("/api/private-file")) {
        try {
            const parsed = new URL(trimmed, "http://localhost");
            const urlProjectId = parsed.searchParams.get("projectId");
            if (urlProjectId && urlProjectId !== projectId) {
                return { ok: false, error: "File does not belong to this project." };
            }
        } catch {
            return { ok: false, error: "Malformed file URL." };
        }
    }

    const fileRef = extractFileRef(trimmed);

    // Cross-project check: reject if this file is registered to any other project
    const otherDoc = await db.query.document.findFirst({
        where: and(ne(document.projectId, projectId), or(eq(document.fileUrl, trimmed), eq(document.fileUrl, fileRef))),
        columns: { id: true },
    });
    if (otherDoc) return { ok: false, error: "File belongs to another project." };

    const otherPayment = await db.query.payments.findFirst({
        where: and(ne(payments.projectId, projectId), or(eq(payments.proofFileUrl, trimmed), eq(payments.proofFileUrl, fileRef))),
        columns: { id: true },
    });
    if (otherPayment) return { ok: false, error: "File belongs to another project." };

    const otherProject = await db.query.agencyProjects.findFirst({
        where: and(ne(agencyProjects.id, projectId), or(eq(agencyProjects.signOffFileUrl, trimmed), eq(agencyProjects.signOffFileUrl, fileRef))),
        columns: { id: true },
    });
    if (otherProject) return { ok: false, error: "File belongs to another project." };

    return { ok: true };
}
