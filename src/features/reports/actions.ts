"use server";

import { db } from "@/db";
import { leads, tasks, agencyProjects, proposals, milestones } from "@/db/schema";
import { and, gte, lte, eq, isNotNull, isNull, desc } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { getLeadEffectiveValue } from "@/features/crm/utils/dealValue";

export type ReportDateRange = {
    from: Date;
    to: Date;
};

export type LeadConversionReportResult = {
    totalLeads: number;
    wonCount: number;
    conversionRate: number;
    averageConversionTimeDays: number;
    totalWonValue: number;
    cohortLeads: Array<{
        id: string;
        status: string;
        createdAt: Date;
        closedWonAt: Date | null;
        estimatedValue: number | string | null;
    }>;
};

export type UserVelocityItem = {
    name: string;
    tasksCompleted: number;
    totalWeight: number;
};

export type TeamVelocityReportResult = {
    totalCompletedTasks: number;
    totalWeight: number;
    averageTurnaroundTimeDays: number;
    userVelocity: UserVelocityItem[];
    completedTasks: unknown[];
};

export type CompletedProjectItem = {
    id: string;
    title: string;
    clientName: string;
    companyName: string;
    status: string;
    startDate: string;
    completedDate: string;
    targetDate: string | null;
    durationDays: number;
    isOnTime: boolean;
    milestonesCompleted: number;
    totalMilestones: number;
    totalStoryPoints: number;
    contractValue: number;
};

export type ProjectCompletionReportResult = {
    totalProjectsCompleted: number;
    onTimeDeliveryRate: number;
    averageProjectDurationDays: number;
    totalValueDelivered: number;
    totalMilestonesCompleted: number;
    totalStoryPointsDelivered: number;
    projects: CompletedProjectItem[];
};

export async function getLeadConversionReport(dateRange: ReportDateRange) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "sales"])) {
        throw new Error("Unauthorized");
    }

    // A lead belongs to the cohort if it was created in the period and is not archived
    const cohortLeads = await db.query.leads.findMany({
        where: and(
            eq(leads.isArchived, false),
            gte(leads.createdAt, dateRange.from),
            lte(leads.createdAt, dateRange.to)
        ),
        columns: {
            id: true,
            status: true,
            createdAt: true,
            closedWonAt: true,
            estimatedValue: true,
        },
        with: {
            proposals: {
                where: isNull(proposals.deletedAt),
                orderBy: [desc(proposals.updatedAt)],
            },
        },
    });

    const totalLeads = cohortLeads.length;
    let wonCount = 0;
    let totalWonValue = 0;
    let totalConversionTimeMs = 0;

    cohortLeads.forEach(lead => {
        if (lead.status === "Closed Won" || lead.closedWonAt) {
            wonCount++;
            totalWonValue += getLeadEffectiveValue(lead);
            if (lead.closedWonAt) {
                const timeToConvert = new Date(lead.closedWonAt).getTime() - new Date(lead.createdAt).getTime();
                if (timeToConvert > 0) totalConversionTimeMs += timeToConvert;
            }
        }
    });

    const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
    const averageConversionTimeDays = wonCount > 0 ? (totalConversionTimeMs / wonCount) / (1000 * 3600 * 24) : 0;

    return {
        totalLeads,
        wonCount,
        conversionRate,
        averageConversionTimeDays,
        totalWonValue,
        cohortLeads,
    };
}

export async function getTeamVelocityReport(dateRange: ReportDateRange) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        throw new Error("Unauthorized");
    }

    // Tasks completed in the date range (excluding soft-deleted tasks)
    const completedTasks = await db.query.tasks.findMany({
        where: and(
            isNull(tasks.deletedAt),
            eq(tasks.status, "Done"),
            isNotNull(tasks.completedAt),
            gte(tasks.completedAt, dateRange.from),
            lte(tasks.completedAt, dateRange.to)
        ),
        with: {
            assignees: {
                with: { user: true }
            }
        }
    });

    const totalCompletedTasks = completedTasks.length;
    let totalTurnaroundTimeMs = 0;
    let totalWeight = 0;

    const userVelocity: Record<string, { name: string; tasksCompleted: number; totalWeight: number }> = {};

    completedTasks.forEach(task => {
        const timeToComplete = new Date(task.completedAt!).getTime() - new Date(task.createdAt).getTime();
        if (timeToComplete > 0) totalTurnaroundTimeMs += timeToComplete;
        
        const weight = task.weight || 1;
        totalWeight += weight;

        // Attribute to assignees
        if (task.assignees && task.assignees.length > 0) {
            task.assignees.forEach(assignment => {
                const userId = assignment.userId;
                const userName = assignment.user?.name || "Unknown";
                if (!userVelocity[userId]) {
                    userVelocity[userId] = { name: userName, tasksCompleted: 0, totalWeight: 0 };
                }
                userVelocity[userId].tasksCompleted++;
                userVelocity[userId].totalWeight += weight;
            });
        }
    });

    const averageTurnaroundTimeDays = totalCompletedTasks > 0 ? (totalTurnaroundTimeMs / totalCompletedTasks) / (1000 * 3600 * 24) : 0;

    return {
        totalCompletedTasks,
        totalWeight,
        averageTurnaroundTimeDays,
        userVelocity: Object.values(userVelocity).sort((a, b) => b.tasksCompleted - a.tasksCompleted),
        completedTasks,
    };
}

export async function getProjectCompletionReport(dateRange: ReportDateRange): Promise<ProjectCompletionReportResult> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "sales"])) {
        throw new Error("Unauthorized");
    }

    // Projects completed in the period (excluding archived non-completed projects)
    const rawProjects = await db.query.agencyProjects.findMany({
        where: and(
            eq(agencyProjects.status, "Completed"),
            gte(agencyProjects.updatedAt, dateRange.from),
            lte(agencyProjects.updatedAt, dateRange.to)
        ),
        with: {
            lead: {
                with: {
                    client: true,
                    proposals: {
                        where: isNull(proposals.deletedAt),
                        orderBy: [desc(proposals.updatedAt)],
                    },
                }
            },
            milestones: {
                where: isNull(milestones.deletedAt),
            },
            tasks: {
                where: isNull(tasks.deletedAt),
            },
        },
        orderBy: (p, { desc }) => [desc(p.updatedAt)]
    });

    let totalWonValue = 0;
    let totalDurationMs = 0;
    let onTimeCount = 0;
    let totalMilestonesCompletedCount = 0;
    let totalStoryPointsDeliveredCount = 0;

    const projects: CompletedProjectItem[] = rawProjects.map(project => {
        const lead = project.lead;
        const clientUser = lead?.client;
        const clientName = clientUser?.name || lead?.contactName || "Client";
        const companyName = clientUser?.companyName || lead?.businessName || "Direct Client";
        const contractValue = lead ? getLeadEffectiveValue(lead) : 0;
        totalWonValue += contractValue;

        // Completion and start times
        const start = project.startDate ? new Date(project.startDate) : new Date(project.createdAt);
        const completed = new Date(project.updatedAt);
        const durationMs = Math.max(0, completed.getTime() - start.getTime());
        totalDurationMs += durationMs;
        const durationDays = Math.max(1, Math.round(durationMs / (1000 * 3600 * 24)));

        // On-time calculation
        let isOnTime = true;
        if (project.targetDate) {
            const target = new Date(project.targetDate);
            target.setHours(23, 59, 59, 999);
            isOnTime = completed.getTime() <= target.getTime();
        }
        if (isOnTime) onTimeCount++;

        // Milestones
        const projectMilestones = project.milestones || [];
        const completedMs = projectMilestones.filter(m => m.status === "Completed").length;
        totalMilestonesCompletedCount += completedMs;

        // Story Points / Tasks
        const projectTasks = project.tasks || [];
        const points = projectTasks.reduce((sum, t) => sum + (t.weight || 1), 0);
        totalStoryPointsDeliveredCount += points;

        return {
            id: project.id,
            title: project.title,
            clientName,
            companyName,
            status: project.status,
            startDate: start.toISOString(),
            completedDate: completed.toISOString(),
            targetDate: project.targetDate ? new Date(project.targetDate).toISOString() : null,
            durationDays,
            isOnTime,
            milestonesCompleted: completedMs,
            totalMilestones: projectMilestones.length,
            totalStoryPoints: points,
            contractValue,
        };
    });

    const totalProjectsCompleted = projects.length;
    const onTimeDeliveryRate = totalProjectsCompleted > 0 ? (onTimeCount / totalProjectsCompleted) * 100 : 100;
    const averageProjectDurationDays = totalProjectsCompleted > 0 ? (totalDurationMs / totalProjectsCompleted) / (1000 * 3600 * 24) : 0;

    return {
        totalProjectsCompleted,
        onTimeDeliveryRate,
        averageProjectDurationDays,
        totalValueDelivered: totalWonValue,
        totalMilestonesCompleted: totalMilestonesCompletedCount,
        totalStoryPointsDelivered: totalStoryPointsDeliveredCount,
        projects,
    };
}

