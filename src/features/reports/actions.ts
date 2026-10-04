"use server";

import { db } from "@/db";
import { leads, tasks, milestones, users, taskAssignees } from "@/db/schema";
import { and, gte, lte, eq, isNotNull, sql } from "drizzle-orm";
import { auth, hasRole } from "@/auth";

export type ReportDateRange = {
    from: Date;
    to: Date;
};

export async function getLeadConversionReport(dateRange: ReportDateRange) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "sales"])) {
        throw new Error("Unauthorized");
    }

    // A lead belongs to the cohort if it was created in the period
    const cohortLeads = await db.query.leads.findMany({
        where: and(
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
    });

    const totalLeads = cohortLeads.length;
    let wonCount = 0;
    let totalWonValue = 0;
    let totalConversionTimeMs = 0;

    cohortLeads.forEach(lead => {
        if (lead.status === "Closed Won" || lead.closedWonAt) {
            wonCount++;
            totalWonValue += Number(lead.estimatedValue) || 0;
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

    // Tasks completed in the date range
    const completedTasks = await db.query.tasks.findMany({
        where: and(
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
