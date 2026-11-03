import "server-only";

import { db } from "@/db";
import {
    agencyProjects,
    leads,
    projectStakeholders,
    milestones,
    payments,
    document,
    notifications,
} from "@/db/schema";
import { eq, and, or, desc, asc, isNull, inArray, sql } from "drizzle-orm";

/**
 * Finds all project IDs that belong to a client user via:
 * 1. leads.clientId === userId
 * 2. projectStakeholders.userId === userId
 */
export async function getClientProjectIds(userId: string): Promise<string[]> {
    const userLeads = await db.query.leads.findMany({
        where: eq(leads.clientId, userId),
        columns: { id: true },
    });
    const leadIds = userLeads.map((l) => l.id);

    const leadProjects = leadIds.length > 0
        ? await db.query.agencyProjects.findMany({
              where: and(inArray(agencyProjects.leadId, leadIds), eq(agencyProjects.isArchived, false)),
              columns: { id: true },
          })
        : [];

    const stakeholderRecords = await db.query.projectStakeholders.findMany({
        where: eq(projectStakeholders.userId, userId),
        columns: { projectId: true },
    });

    const set = new Set<string>();
    leadProjects.forEach((p) => set.add(p.id));
    stakeholderRecords.forEach((s) => set.add(s.projectId));
    return Array.from(set);
}

/**
 * Checks if a client user owns a project via lead or stakeholder junction.
 */
export async function isClientProjectOwner(projectId: string, userId: string): Promise<boolean> {
    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, projectId),
        columns: { id: true, leadId: true },
        with: {
            lead: { columns: { clientId: true } },
            stakeholders: { columns: { userId: true } },
        },
    });

    if (!project) return false;
    if (project.lead?.clientId === userId) return true;
    if (project.stakeholders.some((s) => s.userId === userId)) return true;
    return false;
}

/**
 * Computes milestone counts in SQL: total, completed, in_progress, pending.
 * Guarantees ZERO task queries or leaks to the client.
 */
export async function getProjectMilestoneStats(projectIds: string[]): Promise<
    Record<string, { total: number; completed: number; inProgress: number; pending: number }>
> {
    if (projectIds.length === 0) return {};

    const rows = await db
        .select({
            projectId: milestones.projectId,
            status: milestones.status,
            count: sql<number>`count(*)::int`,
        })
        .from(milestones)
        .where(and(inArray(milestones.projectId, projectIds), isNull(milestones.deletedAt)))
        .groupBy(milestones.projectId, milestones.status);

    const result: Record<string, { total: number; completed: number; inProgress: number; pending: number }> = {};
    for (const pid of projectIds) {
        result[pid] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
    }

    for (const row of rows) {
        if (!result[row.projectId]) {
            result[row.projectId] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
        }
        result[row.projectId].total += row.count;
        if (row.status === "Completed") result[row.projectId].completed += row.count;
        else if (row.status === "In Progress") result[row.projectId].inProgress += row.count;
        else result[row.projectId].pending += row.count;
    }

    return result;
}

/**
 * Home dashboard summary data for a client.
 */
export async function getClientHome(userId: string) {
    const projectIds = await getClientProjectIds(userId);

    // 1. Pending proposals
    const clientLeads = await db.query.leads.findMany({
        where: eq(leads.clientId, userId),
        with: {
            proposals: {
                where: (p, { inArray }) => inArray(p.status, ["sent", "pricing_meeting_requested", "changes_requested"]),
                orderBy: (p, { desc }) => [desc(p.createdAt)],
            },
        },
    });
    const pendingProposals = clientLeads.flatMap((l) =>
        l.proposals.map((p) => ({
            ...p,
            title: l.businessName || p.proposalCode || "Project Proposal",
        }))
    );

    // 2. Active projects with milestone counts
    const milestoneStats = await getProjectMilestoneStats(projectIds);
    const projects = projectIds.length > 0
        ? await db.query.agencyProjects.findMany({
              where: and(inArray(agencyProjects.id, projectIds), eq(agencyProjects.isArchived, false)),
              orderBy: [desc(agencyProjects.updatedAt)],
              columns: {
                  id: true,
                  title: true,
                  description: true,
                  status: true,
                  progressPercentage: true,
                  stagingUrls: true,
                  updatedAt: true,
                  createdAt: true,
              },
          })
        : [];

    const projectsWithStats = projects.map((p) => ({
        ...p,
        stats: milestoneStats[p.id] || { total: 0, completed: 0, inProgress: 0, pending: 0 },
    }));

    // 3. Due / Unpaid payments across client's projects
    const duePayments = projectIds.length > 0
        ? await db.query.payments.findMany({
              where: and(
                  inArray(payments.projectId, projectIds),
                  or(eq(payments.status, "due"), eq(payments.status, "proof_uploaded"))
              ),
              orderBy: [asc(payments.dueDate), asc(payments.createdAt)],
              with: {
                  project: { columns: { id: true, title: true } },
              },
          })
        : [];

    // 4. Recent notifications
    const recentNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: [desc(notifications.createdAt)],
        limit: 5,
    });

    return {
        pendingProposals,
        activeProjects: projectsWithStats,
        duePayments,
        recentNotifications,
    };
}

/**
 * Projects list data for a client.
 */
export async function getClientProjects(userId: string) {
    const projectIds = await getClientProjectIds(userId);
    if (projectIds.length === 0) return [];

    const milestoneStats = await getProjectMilestoneStats(projectIds);
    const projects = await db.query.agencyProjects.findMany({
        where: and(inArray(agencyProjects.id, projectIds), eq(agencyProjects.isArchived, false)),
        orderBy: [desc(agencyProjects.createdAt)],
        columns: {
            id: true,
            title: true,
            description: true,
            status: true,
            progressPercentage: true,
            stagingUrls: true,
            completedAt: true,
            warrantyEndsAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return projects.map((p) => ({
        ...p,
        stats: milestoneStats[p.id] || { total: 0, completed: 0, inProgress: 0, pending: 0 },
    }));
}

/**
 * Single project details for client:
 * Milestones, Payments, Handover files (post-completion), Warranty, and Feedback.
 * Strict zero-task query.
 */
export async function getClientProject(projectId: string, userId: string) {
    const isOwner = await isClientProjectOwner(projectId, userId);
    if (!isOwner) return null;

    const project = await db.query.agencyProjects.findFirst({
        where: and(eq(agencyProjects.id, projectId), eq(agencyProjects.isArchived, false)),
        with: {
            milestones: {
                where: (m, { isNull }) => isNull(m.deletedAt),
                orderBy: (m, { asc }) => [asc(m.order)],
            },
            payments: {
                with: {
                    scheduleItem: true,
                },
            },
            feedback: {
                where: (f, { eq }) => eq(f.clientId, userId),
            },
        },
    });

    if (!project) return null;

    const sortedPayments = [...project.payments].sort((a, b) => {
        const orderA = a.scheduleItem?.sortOrder ?? 999;
        const orderB = b.scheduleItem?.sortOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const milestoneStatsMap = await getProjectMilestoneStats([projectId]);
    const stats = milestoneStatsMap[projectId] || { total: 0, completed: 0, inProgress: 0, pending: 0 };

    const handoverDocs = project.status === "Completed"
        ? await db.query.document.findMany({
              where: eq(document.projectId, projectId),
              orderBy: (d, { desc }) => [desc(d.createdAt)],
          })
        : [];

    return {
        ...project,
        payments: sortedPayments,
        stats,
        userFeedback: project.feedback[0] || null,
        handoverDocuments: handoverDocs,
        handoverUnlocked: project.status === "Completed",
    };
}

/**
 * Documents list data for a client:
 * Non-draft proposals and handover files from completed projects.
 */
export async function getClientDocuments(userId: string) {
    const projectIds = await getClientProjectIds(userId);

    // 1. Non-draft proposals
    const clientLeads = await db.query.leads.findMany({
        where: eq(leads.clientId, userId),
        with: {
            proposals: {
                where: (p, { notInArray }) => notInArray(p.status, ["draft", "replaced"]),
                orderBy: (p, { desc }) => [desc(p.createdAt)],
            },
        },
    });
    const proposalsList = clientLeads.flatMap((l) =>
        l.proposals.map((p) => ({
            id: p.id,
            proposalCode: p.proposalCode,
            title: l.businessName || p.proposalCode || "Proposal",
            status: p.status,
            signedFileUrl: p.signedFileUrl,
            signedAt: p.signedAt,
            createdAt: p.createdAt,
        }))
    );

    // 2. Handover documents for completed projects
    const completedProjects = projectIds.length > 0
        ? await db.query.agencyProjects.findMany({
              where: and(inArray(agencyProjects.id, projectIds), eq(agencyProjects.status, "Completed")),
              columns: { id: true, title: true },
          })
        : [];

    const completedProjectIds = completedProjects.map((p) => p.id);
    const handoverDocs = completedProjectIds.length > 0
        ? await db.query.document.findMany({
              where: inArray(document.projectId, completedProjectIds),
              orderBy: (d, { desc }) => [desc(d.createdAt)],
          })
        : [];

    const projectTitleMap = new Map<string, string>();
    completedProjects.forEach((p) => projectTitleMap.set(p.id, p.title));

    const handoverList = handoverDocs.map((doc) => ({
        ...doc,
        projectTitle: projectTitleMap.get(doc.projectId) || "Project",
    }));

    return {
        proposals: proposalsList,
        handoverDocuments: handoverList,
    };
}
