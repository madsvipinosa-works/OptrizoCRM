"use server";

import { db } from "@/db";
import { leads, tasks, agencyProjects, proposals, milestones } from "@/db/schema";
import { and, gte, lte, eq, isNull, desc } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { getLeadEffectiveValue } from "@/features/crm/utils/dealValue";

export type ReportDateRange = {
    from: Date;
    to: Date;
};

export type LeadSourceBreakdownItem = {
    source: string;
    inquiries: number;
    won: number;
    lost: number;
    active: number;
    winRate: number;
    revenue: number;
    pipelineValue: number;
};

export type LossReasonBreakdownItem = {
    reason: string;
    count: number;
    percentage: number;
    lostValue: number;
};

export type CohortDealItem = {
    id: string;
    businessName: string;
    contactName: string;
    source: string;
    status: string;
    effectiveValue: number;
    createdAt: string;
    closedDate: string | null;
    cycleDays: number | null;
    lossReason: string | null;
};

export type LeadConversionReportResult = {
    totalLeads: number;
    wonCount: number;
    lostCount: number;
    activeCount: number;
    conversionRate: number;
    winRateOnClosed: number;
    averageConversionTimeDays: number;
    totalWonValue: number;
    totalPipelineValue: number;
    sourceBreakdown: LeadSourceBreakdownItem[];
    lossReasonBreakdown: LossReasonBreakdownItem[];
    cohortDeals: CohortDealItem[];
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
    role: string;
    tasksCompleted: number;
    totalWeight: number;
    avgTurnaroundDays: number | null;
    avgQualityScore: number | null;
};

export type CompletedTaskAuditItem = {
    id: string;
    title: string;
    milestoneTitle: string;
    projectId: string;
    projectTitle: string;
    assignees: string[];
    weight: number;
    aiQualityScore: number | null;
    createdAt: string;
    completedAt: string;
    turnaroundDays: number | null;
};

export type TeamVelocityReportResult = {
    totalCompletedTasks: number;
    totalWeight: number;
    averageTurnaroundTimeDays: number;
    averageAiQualityScore: number | null;
    userVelocity: UserVelocityItem[];
    completedTasks: CompletedTaskAuditItem[];
};

export type CompletedProjectItem = {
    id: string;
    title: string;
    clientName: string;
    companyName: string;
    status: string;
    progress: number;
    startDate: string;
    completedDate: string;
    targetDate: string | null;
    durationDays: number;
    isOnTime: boolean;
    scheduleStatus: "Completed On-Time" | "Completed Late" | "On Track" | "Delayed";
    milestonesCompleted: number;
    totalMilestones: number;
    deliveredStoryPoints: number;
    totalStoryPoints: number;
    contractValue: number;
    earnedValue: number;
};

export type ProjectCompletionReportResult = {
    totalProjectsCompleted: number;
    activeProjectsCount: number;
    totalPortfolioProjects: number;
    onTimeDeliveryRate: number;
    averageProjectDurationDays: number;
    averageProgress: number;
    totalValueDelivered: number;
    totalEarnedValue: number;
    totalContractValue: number;
    totalMilestonesCompleted: number;
    totalMilestones: number;
    totalStoryPointsDelivered: number;
    totalStoryPointsScoped: number;
    projects: CompletedProjectItem[];
};

function normalizeDateRange(dateRange: ReportDateRange): { from: Date; to: Date } {
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);
    return { from, to };
}

export async function getLeadConversionReport(dateRange: ReportDateRange): Promise<LeadConversionReportResult> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "sales"])) {
        throw new Error("Unauthorized");
    }

    const { from, to } = normalizeDateRange(dateRange);

    // A lead belongs to the cohort if it was created in the period and is not archived
    const cohortLeads = await db.query.leads.findMany({
        where: and(
            eq(leads.isArchived, false),
            gte(leads.createdAt, from),
            lte(leads.createdAt, to)
        ),
        columns: {
            id: true,
            businessName: true,
            contactName: true,
            source: true,
            status: true,
            lossReason: true,
            createdAt: true,
            updatedAt: true,
            closedWonAt: true,
            estimatedValue: true,
        },
        with: {
            proposals: {
                where: isNull(proposals.deletedAt),
                orderBy: [desc(proposals.updatedAt)],
            },
        },
        orderBy: (l, { desc: orderDesc }) => [orderDesc(l.createdAt)],
    });

    const totalLeads = cohortLeads.length;
    let wonCount = 0;
    let lostCount = 0;
    let activeCount = 0;
    let totalWonValue = 0;
    let totalPipelineValue = 0;
    let totalConversionTimeMs = 0;
    let validConversionCycleCount = 0;

    const sourceMap: Record<string, {
        source: string;
        inquiries: number;
        won: number;
        lost: number;
        active: number;
        revenue: number;
        pipelineValue: number;
    }> = {};

    const lossMap: Record<string, { reason: string; count: number; lostValue: number }> = {};
    const cohortDeals: CohortDealItem[] = [];

    cohortLeads.forEach(lead => {
        const effectiveValue = getLeadEffectiveValue(lead);
        const sourceName = (lead.source || "Direct / Unspecified").trim() || "Direct / Unspecified";

        if (!sourceMap[sourceName]) {
            sourceMap[sourceName] = {
                source: sourceName,
                inquiries: 0,
                won: 0,
                lost: 0,
                active: 0,
                revenue: 0,
                pipelineValue: 0,
            };
        }
        sourceMap[sourceName].inquiries++;

        const isWon = lead.status === "Closed Won" || Boolean(lead.closedWonAt);
        const isLost = !isWon && lead.status === "Closed Lost";

        let closedDateIso: string | null = null;
        let cycleDays: number | null = null;

        if (isWon) {
            wonCount++;
            totalWonValue += effectiveValue;
            sourceMap[sourceName].won++;
            sourceMap[sourceName].revenue += effectiveValue;

            // Resolve effective conversion timestamp:
            // 1. lead.closedWonAt
            // 2. Approved proposal acceptedAt / updatedAt
            // 3. lead.updatedAt
            const approvedProposal = lead.proposals?.find(p => p.status === "Approved");
            const effectiveWonDate = lead.closedWonAt
                ? new Date(lead.closedWonAt)
                : approvedProposal?.acceptedAt
                    ? new Date(approvedProposal.acceptedAt)
                    : approvedProposal?.updatedAt
                        ? new Date(approvedProposal.updatedAt)
                        : lead.updatedAt
                            ? new Date(lead.updatedAt)
                            : null;

            if (effectiveWonDate) {
                closedDateIso = effectiveWonDate.toISOString();
                const timeToConvert = effectiveWonDate.getTime() - new Date(lead.createdAt).getTime();
                if (timeToConvert > 0) {
                    totalConversionTimeMs += timeToConvert;
                    validConversionCycleCount++;
                    cycleDays = Math.max(1, Math.round(timeToConvert / (1000 * 3600 * 24)));
                }
            }
        } else if (isLost) {
            lostCount++;
            sourceMap[sourceName].lost++;
            const reason = (lead.lossReason || "Unspecified").trim() || "Unspecified";
            if (!lossMap[reason]) {
                lossMap[reason] = { reason, count: 0, lostValue: 0 };
            }
            lossMap[reason].count++;
            lossMap[reason].lostValue += effectiveValue;
            if (lead.updatedAt) {
                closedDateIso = new Date(lead.updatedAt).toISOString();
            }
        } else {
            activeCount++;
            totalPipelineValue += effectiveValue;
            sourceMap[sourceName].active++;
            sourceMap[sourceName].pipelineValue += effectiveValue;
        }

        cohortDeals.push({
            id: lead.id,
            businessName: lead.businessName || lead.contactName || "Unnamed Deal",
            contactName: lead.contactName || "—",
            source: sourceName,
            status: lead.status,
            effectiveValue,
            createdAt: new Date(lead.createdAt).toISOString(),
            closedDate: closedDateIso,
            cycleDays,
            lossReason: lead.lossReason || null,
        });
    });

    const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
    const closedTotal = wonCount + lostCount;
    const winRateOnClosed = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0;
    const averageConversionTimeDays = validConversionCycleCount > 0
        ? (totalConversionTimeMs / validConversionCycleCount) / (1000 * 3600 * 24)
        : 0;

    const sourceBreakdown: LeadSourceBreakdownItem[] = Object.values(sourceMap)
        .map(s => ({
            ...s,
            winRate: s.inquiries > 0 ? (s.won / s.inquiries) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue || b.inquiries - a.inquiries);

    const lossReasonBreakdown: LossReasonBreakdownItem[] = Object.values(lossMap)
        .map(l => ({
            ...l,
            percentage: lostCount > 0 ? (l.count / lostCount) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count || b.lostValue - a.lostValue);

    cohortDeals.sort((a, b) => b.effectiveValue - a.effectiveValue);

    return {
        totalLeads,
        wonCount,
        lostCount,
        activeCount,
        conversionRate,
        winRateOnClosed,
        averageConversionTimeDays,
        totalWonValue,
        totalPipelineValue,
        sourceBreakdown,
        lossReasonBreakdown,
        cohortDeals,
        cohortLeads,
    };
}

export async function getTeamVelocityReport(dateRange: ReportDateRange): Promise<TeamVelocityReportResult> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "sales"])) {
        throw new Error("Unauthorized");
    }

    const { from, to } = normalizeDateRange(dateRange);

    // Fetch all non-deleted "Done" tasks and filter by effective completion timestamp (completedAt || updatedAt)
    const rawDoneTasks = await db.query.tasks.findMany({
        where: and(
            isNull(tasks.deletedAt),
            eq(tasks.status, "Done")
        ),
        with: {
            project: true,
            milestone: true,
            assignees: {
                with: { user: true }
            },
            submissions: {
                orderBy: (s, { desc: orderDesc }) => [orderDesc(s.createdAt)],
            },
        }
    });

    const filteredTasks = rawDoneTasks.filter(task => {
        if (task.project?.isArchived) return false;
        const effectiveCompletedAt = task.completedAt ? new Date(task.completedAt) : new Date(task.updatedAt);
        return effectiveCompletedAt >= from && effectiveCompletedAt <= to;
    });

    const totalCompletedTasks = filteredTasks.length;
    let totalTurnaroundTimeMs = 0;
    let validTurnaroundCount = 0;
    let totalWeight = 0;
    let totalQualityScore = 0;
    let qualityScoreCount = 0;

    const userVelocityMap: Record<string, {
        name: string;
        role: string;
        tasksCompleted: number;
        totalWeight: number;
        turnaroundSumMs: number;
        turnaroundCount: number;
        qualitySum: number;
        qualityCount: number;
    }> = {};

    const completedTasksAudit: CompletedTaskAuditItem[] = [];

    filteredTasks.forEach(task => {
        const effectiveCompletedDate = task.completedAt ? new Date(task.completedAt) : new Date(task.updatedAt);
        const rawTimeToCompleteMs = effectiveCompletedDate.getTime() - new Date(task.createdAt).getTime();
        const hasValidTurnaround = rawTimeToCompleteMs > 0;

        if (hasValidTurnaround) {
            totalTurnaroundTimeMs += rawTimeToCompleteMs;
            validTurnaroundCount++;
        }

        const weight = task.weight || 1;
        totalWeight += weight;

        const latestSubmission = task.submissions?.[0];
        const taskQualityScore = typeof latestSubmission?.aiConfidenceScore === "number"
            ? latestSubmission.aiConfidenceScore
            : null;

        if (taskQualityScore !== null) {
            totalQualityScore += taskQualityScore;
            qualityScoreCount++;
        }

        const assigneeNames: string[] = [];

        if (task.assignees && task.assignees.length > 0) {
            task.assignees.forEach(assignment => {
                const userId = assignment.userId;
                const userName = assignment.user?.name || "Unknown";
                const userRole = assignment.user?.role || "developer";
                assigneeNames.push(userName);

                if (!userVelocityMap[userId]) {
                    userVelocityMap[userId] = {
                        name: userName,
                        role: userRole,
                        tasksCompleted: 0,
                        totalWeight: 0,
                        turnaroundSumMs: 0,
                        turnaroundCount: 0,
                        qualitySum: 0,
                        qualityCount: 0,
                    };
                }
                userVelocityMap[userId].tasksCompleted++;
                userVelocityMap[userId].totalWeight += weight;
                if (hasValidTurnaround) {
                    userVelocityMap[userId].turnaroundSumMs += rawTimeToCompleteMs;
                    userVelocityMap[userId].turnaroundCount++;
                }
                if (taskQualityScore !== null) {
                    userVelocityMap[userId].qualitySum += taskQualityScore;
                    userVelocityMap[userId].qualityCount++;
                }
            });
        } else {
            const unassignedKey = "__unassigned__";
            assigneeNames.push("Unassigned");
            if (!userVelocityMap[unassignedKey]) {
                userVelocityMap[unassignedKey] = {
                    name: "Unassigned",
                    role: "Unassigned",
                    tasksCompleted: 0,
                    totalWeight: 0,
                    turnaroundSumMs: 0,
                    turnaroundCount: 0,
                    qualitySum: 0,
                    qualityCount: 0,
                };
            }
            userVelocityMap[unassignedKey].tasksCompleted++;
            userVelocityMap[unassignedKey].totalWeight += weight;
            if (hasValidTurnaround) {
                userVelocityMap[unassignedKey].turnaroundSumMs += rawTimeToCompleteMs;
                userVelocityMap[unassignedKey].turnaroundCount++;
            }
            if (taskQualityScore !== null) {
                userVelocityMap[unassignedKey].qualitySum += taskQualityScore;
                userVelocityMap[unassignedKey].qualityCount++;
            }
        }

        completedTasksAudit.push({
            id: task.id,
            title: task.title,
            milestoneTitle: task.milestone?.title || "Deliverable",
            projectId: task.projectId,
            projectTitle: task.project?.title || "Agency Project",
            assignees: assigneeNames,
            weight,
            aiQualityScore: taskQualityScore,
            createdAt: new Date(task.createdAt).toISOString(),
            completedAt: effectiveCompletedDate.toISOString(),
            turnaroundDays: hasValidTurnaround
                ? Number((rawTimeToCompleteMs / (1000 * 3600 * 24)).toFixed(1))
                : null,
        });
    });

    const averageTurnaroundTimeDays = validTurnaroundCount > 0
        ? (totalTurnaroundTimeMs / validTurnaroundCount) / (1000 * 3600 * 24)
        : 0;
    const averageAiQualityScore = qualityScoreCount > 0
        ? Math.round(totalQualityScore / qualityScoreCount)
        : null;

    const userVelocity: UserVelocityItem[] = Object.values(userVelocityMap)
        .map(u => ({
            name: u.name,
            role: u.role,
            tasksCompleted: u.tasksCompleted,
            totalWeight: u.totalWeight,
            avgTurnaroundDays: u.turnaroundCount > 0
                ? Number(((u.turnaroundSumMs / u.turnaroundCount) / (1000 * 3600 * 24)).toFixed(1))
                : null,
            avgQualityScore: u.qualityCount > 0
                ? Math.round(u.qualitySum / u.qualityCount)
                : null,
        }))
        .sort((a, b) => {
            if (a.name === "Unassigned") return 1;
            if (b.name === "Unassigned") return -1;
            return b.totalWeight - a.totalWeight || b.tasksCompleted - a.tasksCompleted;
        });

    completedTasksAudit.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    return {
        totalCompletedTasks,
        totalWeight,
        averageTurnaroundTimeDays,
        averageAiQualityScore,
        userVelocity,
        completedTasks: completedTasksAudit,
    };
}

export async function getProjectCompletionReport(dateRange: ReportDateRange): Promise<ProjectCompletionReportResult> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "sales"])) {
        throw new Error("Unauthorized");
    }

    const { from, to } = normalizeDateRange(dateRange);

    // Fetch all non-archived projects active or completed within the reporting period
    const rawProjects = await db.query.agencyProjects.findMany({
        where: and(
            eq(agencyProjects.isArchived, false),
            lte(agencyProjects.createdAt, to),
            gte(agencyProjects.updatedAt, from)
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
        orderBy: (p, { desc: orderDesc }) => [orderDesc(p.updatedAt)]
    });

    let totalValueDelivered = 0;
    let totalEarnedValue = 0;
    let totalContractValue = 0;
    let totalDurationMs = 0;
    let onTimeCount = 0;
    let totalMilestonesCompletedCount = 0;
    let totalMilestonesCount = 0;
    let totalStoryPointsDeliveredCount = 0;
    let totalStoryPointsScopedCount = 0;
    let totalProgressSum = 0;
    let completedProjectsCount = 0;
    let activeProjectsCount = 0;

    const now = new Date();

    const projects: CompletedProjectItem[] = rawProjects.map(project => {
        const lead = project.lead;
        const clientUser = lead?.client;
        const clientName = clientUser?.name || lead?.contactName || "Client";
        const companyName = clientUser?.companyName || lead?.businessName || project.title || "Direct Client";
        const contractValue = lead ? getLeadEffectiveValue(lead) : 0;
        totalContractValue += contractValue;

        const isCompleted = project.status === "Completed";
        if (isCompleted) {
            completedProjectsCount++;
            totalValueDelivered += contractValue;
        } else {
            activeProjectsCount++;
        }

        // Milestones
        const projectMilestones = project.milestones || [];
        const completedMs = projectMilestones.filter(m => m.status === "Completed").length;
        totalMilestonesCompletedCount += completedMs;
        totalMilestonesCount += projectMilestones.length;

        // Story Points / Tasks
        const projectTasks = project.tasks || [];
        const totalPoints = projectTasks.reduce((sum, t) => sum + (t.weight || 1), 0);
        const deliveredPoints = projectTasks
            .filter(t => t.status === "Done")
            .reduce((sum, t) => sum + (t.weight || 1), 0);

        totalStoryPointsDeliveredCount += deliveredPoints;
        totalStoryPointsScopedCount += totalPoints;

        // Progress calculation matching PM module
        let progress = 0;
        if (isCompleted) {
            progress = 100;
        } else if (totalPoints > 0) {
            progress = Math.round((deliveredPoints / totalPoints) * 100);
        } else if (projectMilestones.length > 0) {
            progress = Math.round((completedMs / projectMilestones.length) * 100);
        }
        totalProgressSum += progress;

        const earnedValue = isCompleted
            ? contractValue
            : Math.round((contractValue * progress) / 100);
        totalEarnedValue += earnedValue;

        // Duration calculation
        const start = project.startDate ? new Date(project.startDate) : new Date(project.createdAt);
        const endRef = isCompleted ? new Date(project.updatedAt) : now;
        const durationMs = Math.max(0, endRef.getTime() - start.getTime());
        totalDurationMs += durationMs;
        const durationDays = Math.max(1, Math.round(durationMs / (1000 * 3600 * 24)));

        // Schedule health calculation
        let isOnTime = true;
        if (project.targetDate) {
            const target = new Date(project.targetDate);
            target.setHours(23, 59, 59, 999);
            isOnTime = endRef.getTime() <= target.getTime();
        }
        if (isOnTime) onTimeCount++;

        const scheduleStatus: CompletedProjectItem["scheduleStatus"] = isCompleted
            ? (isOnTime ? "Completed On-Time" : "Completed Late")
            : (isOnTime ? "On Track" : "Delayed");

        return {
            id: project.id,
            title: project.title,
            clientName,
            companyName,
            status: project.status,
            progress,
            startDate: start.toISOString(),
            completedDate: new Date(project.updatedAt).toISOString(),
            targetDate: project.targetDate ? new Date(project.targetDate).toISOString() : null,
            durationDays,
            isOnTime,
            scheduleStatus,
            milestonesCompleted: completedMs,
            totalMilestones: projectMilestones.length,
            deliveredStoryPoints: deliveredPoints,
            totalStoryPoints: totalPoints,
            contractValue,
            earnedValue,
        };
    });

    // Sort Completed first, then by progress descending, then by contractValue descending
    projects.sort((a, b) => {
        const aDone = a.status === "Completed" ? 1 : 0;
        const bDone = b.status === "Completed" ? 1 : 0;
        if (aDone !== bDone) return bDone - aDone;
        if (b.progress !== a.progress) return b.progress - a.progress;
        return b.contractValue - a.contractValue;
    });

    const totalPortfolioProjects = projects.length;
    const onTimeDeliveryRate = totalPortfolioProjects > 0
        ? (onTimeCount / totalPortfolioProjects) * 100
        : 100;
    const averageProjectDurationDays = totalPortfolioProjects > 0
        ? (totalDurationMs / totalPortfolioProjects) / (1000 * 3600 * 24)
        : 0;
    const averageProgress = totalPortfolioProjects > 0
        ? Math.round(totalProgressSum / totalPortfolioProjects)
        : 0;

    return {
        totalProjectsCompleted: completedProjectsCount,
        activeProjectsCount,
        totalPortfolioProjects,
        onTimeDeliveryRate,
        averageProjectDurationDays,
        averageProgress,
        totalValueDelivered,
        totalEarnedValue,
        totalContractValue,
        totalMilestonesCompleted: totalMilestonesCompletedCount,
        totalMilestones: totalMilestonesCount,
        totalStoryPointsDelivered: totalStoryPointsDeliveredCount,
        totalStoryPointsScoped: totalStoryPointsScopedCount,
        projects,
    };
}
