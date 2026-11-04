import "server-only";

import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { milestones, sprints, tasks } from "@/db/schema";
import {
  deriveSprintStatus,
  todayInManila,
  type SprintStatus,
} from "@/features/sprints/sprint-status";

export type SprintWithCounts = {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  createdBy: string | null;
  createdAt: Date;
  status: SprintStatus;
  taskCounts: {
    total: number;
    toDo: number;
    inProgress: number;
    inReview: number;
    changesRequested: number;
    done: number;
  };
};

/**
 * Loads all sprints for a project ordered by startDate ASC, with derived status and task counts.
 *
 * NOTE: This query performs NO authorization check itself.
 * Callers MUST verify role and project access (`requireRole` + `authorizeProject(...).ok`) before calling.
 */
export async function getSprints(projectId: string): Promise<SprintWithCounts[]> {
  if (!projectId) return [];

  const today = todayInManila();

  const projectSprints = await db
    .select()
    .from(sprints)
    .where(eq(sprints.projectId, projectId))
    .orderBy(asc(sprints.startDate), asc(sprints.createdAt));

  if (projectSprints.length === 0) {
    return [];
  }

  const sprintIds = projectSprints.map((s) => s.id);
  const sprintTasks = await db
    .select({
      id: tasks.id,
      sprintId: tasks.sprintId,
      status: tasks.status,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(tasks.sprintId, sprintIds),
        isNull(tasks.deletedAt),
      ),
    );

  const countsBySprint = new Map<string, SprintWithCounts["taskCounts"]>();
  for (const s of projectSprints) {
    countsBySprint.set(s.id, {
      total: 0,
      toDo: 0,
      inProgress: 0,
      inReview: 0,
      changesRequested: 0,
      done: 0,
    });
  }

  for (const t of sprintTasks) {
    if (!t.sprintId) continue;
    const c = countsBySprint.get(t.sprintId);
    if (!c) continue;
    c.total += 1;
    if (t.status === "to_do") c.toDo += 1;
    else if (t.status === "in_progress") c.inProgress += 1;
    else if (t.status === "in_review") c.inReview += 1;
    else if (t.status === "changes_requested") c.changesRequested += 1;
    else if (t.status === "done") c.done += 1;
  }

  return projectSprints.map((s) => ({
    ...s,
    status: deriveSprintStatus(s.startDate, s.endDate, today),
    taskCounts: countsBySprint.get(s.id)!,
  }));
}

/**
 * Loads non-deleted Development tasks that are in the backlog (`status = 'backlog'`)
 * plus tasks sitting in an ended sprint with an unfinished status (`in_progress`, `in_review`, `changes_requested`, or `to_do`),
 * ordered by `createdAt` ASC.
 *
 * NOTE: This query performs NO authorization check itself.
 * Callers MUST verify manager role and project access (`requireRole(["manager"])` + `authorizeProject(...).ok`) before calling.
 */
export async function getBacklog(projectId: string) {
  if (!projectId) return [];

  const today = todayInManila();

  const devMilestones = await db
    .select({ id: milestones.id })
    .from(milestones)
    .where(
      and(
        eq(milestones.projectId, projectId),
        or(eq(milestones.name, "development"), eq(milestones.title, "Full-Stack Development")),
        isNull(milestones.deletedAt),
      ),
    );

  if (devMilestones.length === 0) {
    return [];
  }

  const devMilestoneIds = devMilestones.map((m) => m.id);

  const endedSprints = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(and(eq(sprints.projectId, projectId), lt(sprints.endDate, today)));

  const endedSprintIds = endedSprints.map((s) => s.id);

  const unfinishedInEndedSprint =
    endedSprintIds.length > 0
      ? and(
          inArray(tasks.sprintId, endedSprintIds),
          inArray(tasks.status, ["to_do", "in_progress", "in_review", "changes_requested"]),
        )
      : undefined;

  const statusCond = unfinishedInEndedSprint
    ? or(eq(tasks.status, "backlog"), unfinishedInEndedSprint)
    : eq(tasks.status, "backlog");

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(tasks.milestoneId, devMilestoneIds),
        isNull(tasks.deletedAt),
        statusCond,
      ),
    )
    .orderBy(asc(tasks.createdAt));
}

