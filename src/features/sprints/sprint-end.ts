import "server-only";

import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { agencyProjects, sprints, tasks } from "@/db/schema";
import { logAction } from "@/features/audit/log";
import { todayInManila } from "@/features/sprints/sprint-status";

export type ApplyEndedSprintsResult = {
  returned: number;
  carried: number;
};

/**
 * Lazy, idempotent sprint-end handler (spec §4).
 *
 * Must only be called by server code that has already verified caller authorization.
 * Never calls revalidatePath, redirect, or notFound because it may run during page render.
 *
 * Lock order inside transaction: agency_project FOR UPDATE -> sprint -> task.
 */
export async function applyEndedSprints(projectId: string): Promise<ApplyEndedSprintsResult> {
  if (!projectId) {
    return { returned: 0, carried: 0 };
  }

  const today = todayInManila();

  // 1. Cheap pre-check SELECT with no lock: does any ended sprint of this project
  // still have to_do tasks or uncarried active tasks?
  const endedSprints = await db
    .select({ id: sprints.id, name: sprints.name })
    .from(sprints)
    .where(and(eq(sprints.projectId, projectId), lt(sprints.endDate, today)));

  if (endedSprints.length === 0) {
    return { returned: 0, carried: 0 };
  }

  const endedSprintIds = endedSprints.map((s) => s.id);

  const pendingTasks = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      carriedOver: tasks.carriedOver,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(tasks.sprintId, endedSprintIds),
        isNull(tasks.deletedAt),
      ),
    );

  const needsWork = pendingTasks.some(
    (t) =>
      t.status === "to_do" ||
      ((t.status === "in_progress" ||
        t.status === "in_review" ||
        t.status === "changes_requested") &&
        t.carriedOver === false),
  );

  if (!needsWork) {
    return { returned: 0, carried: 0 };
  }

  // 2. Open transaction: lock agency_project FOR UPDATE first, then update tasks
  const txResult = await db.transaction(async (tx) => {
    await tx
      .select({ id: agencyProjects.id })
      .from(agencyProjects)
      .where(eq(agencyProjects.id, projectId))
      .for("update");

    const lockedEndedSprints = await tx
      .select({ id: sprints.id, name: sprints.name })
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), lt(sprints.endDate, today)))
      .for("update");

    if (lockedEndedSprints.length === 0) {
      return {
        returnedRows: [] as { id: string; sprintId: string | null }[],
        carriedRows: [] as { id: string; sprintId: string | null }[],
        sprintMap: new Map<string, string>(),
      };
    }

    const lockedEndedIds = lockedEndedSprints.map((s) => s.id);
    const sprintMap = new Map(lockedEndedSprints.map((s) => [s.id, s.name]));

    // 3. Return to_do tasks in ended sprints back to backlog (sprint_id = NULL)
    const returnedRows = await tx
      .update(tasks)
      .set({
        status: "backlog",
        sprintId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.projectId, projectId),
          inArray(tasks.sprintId, lockedEndedIds),
          eq(tasks.status, "to_do"),
          isNull(tasks.deletedAt),
        ),
      )
      .returning({ id: tasks.id, sprintId: tasks.sprintId });

    // 4. Mark active unfinished tasks in ended sprints as carried_over = true
    const carriedRows = await tx
      .update(tasks)
      .set({
        carriedOver: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.projectId, projectId),
          inArray(tasks.sprintId, lockedEndedIds),
          inArray(tasks.status, ["in_progress", "in_review", "changes_requested"]),
          eq(tasks.carriedOver, false),
          isNull(tasks.deletedAt),
        ),
      )
      .returning({ id: tasks.id, sprintId: tasks.sprintId });

    return { returnedRows, carriedRows, sprintMap };
  });

  const returnedCount = txResult.returnedRows.length;
  const carriedCount = txResult.carriedRows.length;

  // 5. After commit, write one logAction per affected sprint with projectId
  if (returnedCount > 0 || carriedCount > 0) {
    try {
      const affectedSprintIds = new Set<string>();
      for (const row of txResult.carriedRows) {
        if (row.sprintId) affectedSprintIds.add(row.sprintId);
      }
      for (const row of txResult.returnedRows) {
        if (row.sprintId) affectedSprintIds.add(row.sprintId);
      }
      // Because RETURNING on the first update returns the post-update sprintId (which is null),
      // fall back to the ended sprints that had pending work if no non-null sprintId was captured.
      if (affectedSprintIds.size === 0) {
        for (const s of endedSprints) {
          affectedSprintIds.add(s.id);
        }
      }

      for (const sid of affectedSprintIds) {
        const sName = txResult.sprintMap.get(sid) ?? sid;
        await logAction(
          "UPDATE",
          "Sprint",
          `Sprint "${sName}" ended: ${returnedCount} task(s) returned to backlog, ${carriedCount} task(s) carried over`,
          undefined,
          projectId,
        );
      }
    } catch (err) {
      console.error("Post-commit audit log error in applyEndedSprints:", err);
    }
  }

  return { returned: returnedCount, carried: carriedCount };
}

