import "server-only";

import { db } from "@/db";
import { milestones, tasks, payments, paymentScheduleItems, agencyProjects } from "@/db/schema";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CloseMilestoneResult = {
    closedMilestone: typeof milestones.$inferSelect;
    nextMilestone: typeof milestones.$inferSelect | null;
    duePaymentIds: string[];
};

/**
 * Transactional helper to complete a milestone, advance to the next milestone in sequence,
 * and mark any linked payments as due.
 *
 * MUST be called inside a transaction (e.g. from approveTask or markEmptyMilestoneDone).
 */
export async function closeMilestoneAndAdvance(
    tx: DbTransaction,
    milestoneId: string,
    opts?: { doneReason?: string }
): Promise<CloseMilestoneResult> {
    // 1. Lock the current milestone
    const [currentMilestone] = await tx
        .select()
        .from(milestones)
        .where(and(eq(milestones.id, milestoneId), isNull(milestones.deletedAt)))
        .for("update");

    if (!currentMilestone) {
        throw new Error("Milestone not found");
    }

    if (currentMilestone.status !== "In Progress") {
        throw new Error(`Milestone is not In Progress (status: ${currentMilestone.status})`);
    }

    // 2. Check: Development milestone cannot be closed if any tasks remain in Backlog
    if (currentMilestone.name === "development" || currentMilestone.title === "Full-Stack Development") {
        const backlogTasks = await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(and(
                eq(tasks.projectId, currentMilestone.projectId),
                eq(tasks.status, "backlog"),
                isNull(tasks.deletedAt)
            ));
        if (backlogTasks.length > 0) {
            throw new Error("Cannot close Development milestone while tasks remain in backlog");
        }
    }

    // 3. Mark the milestone Completed
    const [closedMilestone] = await tx
        .update(milestones)
        .set({
            status: "Completed",
            completedAt: new Date(),
            doneReason: opts?.doneReason ? opts.doneReason.trim().slice(0, 2000) : null,
            updatedAt: new Date(),
        })
        .where(eq(milestones.id, milestoneId))
        .returning();

    // 4. Find the next pending milestone by order
    const pendingMilestones = await tx
        .select()
        .from(milestones)
        .where(and(
            eq(milestones.projectId, currentMilestone.projectId),
            eq(milestones.status, "Pending"),
            isNull(milestones.deletedAt)
        ))
        .orderBy(asc(milestones.order))
        .for("update");

    let nextMilestone: typeof milestones.$inferSelect | null = null;
    if (pendingMilestones.length > 0) {
        const nextCandidate = pendingMilestones[0];
        const [updatedNext] = await tx
            .update(milestones)
            .set({
                status: "In Progress",
                updatedAt: new Date(),
            })
            .where(eq(milestones.id, nextCandidate.id))
            .returning();
        nextMilestone = updatedNext;
    } else {
        // If no more pending milestones, check if all milestones for this project are Completed
        const allRemaining = await tx
            .select({ id: milestones.id, status: milestones.status })
            .from(milestones)
            .where(and(eq(milestones.projectId, currentMilestone.projectId), isNull(milestones.deletedAt)));
        if (allRemaining.length > 0 && allRemaining.every((m) => m.status === "Completed")) {
            await tx
                .update(agencyProjects)
                .set({ status: "Completed", updatedAt: new Date() })
                .where(eq(agencyProjects.id, currentMilestone.projectId));
        }
    }

    // 5. Advance payments: find not_yet_due payments for this project matching the milestone trigger
    const candidatePayments = await tx
        .select({
            paymentId: payments.id,
            trigger: paymentScheduleItems.trigger,
        })
        .from(payments)
        .innerJoin(paymentScheduleItems, eq(payments.scheduleItemId, paymentScheduleItems.id))
        .where(and(
            eq(payments.projectId, currentMilestone.projectId),
            eq(payments.status, "not_yet_due")
        ))
        .for("update");

    const duePaymentIds: string[] = [];
    for (const p of candidatePayments) {
        const isMatch =
            p.trigger === currentMilestone.name ||
            (currentMilestone.name === "uat_testing" && p.trigger === "before_completion");

        if (isMatch) {
            duePaymentIds.push(p.paymentId);
        }
    }

    if (duePaymentIds.length > 0) {
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await tx
            .update(payments)
            .set({
                status: "due",
                becameDueAt: new Date(),
                dueDate,
                updatedAt: new Date(),
            })
            .where(inArray(payments.id, duePaymentIds));
    }

    return {
        closedMilestone: closedMilestone || currentMilestone,
        nextMilestone,
        duePaymentIds,
    };
}
