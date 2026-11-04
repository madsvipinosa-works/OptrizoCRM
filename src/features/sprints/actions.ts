"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { agencyProjects, milestones, sprints, taskAssignees, tasks } from "@/db/schema";
import { logAction } from "@/features/audit/log";
import { createSystemNotification } from "@/features/notifications/send";
import { applyEndedSprints } from "@/features/sprints/sprint-end";
import { deriveSprintStatus, todayInManila } from "@/features/sprints/sprint-status";
import { authorizeProject, requireRole } from "@/lib/authz";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(val: string): boolean {
  if (!ISO_DATE_RE.test(val)) return false;
  const [y, m, d] = val.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

const PlanSprintSchema = z
  .object({
    projectId: z.string().trim().min(1),
    name: z.string().trim().min(1).max(80),
    goal: z.string().trim().max(500).optional(),
    startDate: z.string().refine(isValidCalendarDate, "Invalid startDate (YYYY-MM-DD)"),
    endDate: z.string().refine(isValidCalendarDate, "Invalid endDate (YYYY-MM-DD)"),
    taskIds: z
      .array(z.string().trim().min(1))
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate task IDs are not allowed"),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

const MoveTaskToSprintSchema = z.object({
  taskId: z.string().trim().min(1),
  sprintId: z.string().trim().min(1),
});

export type PlanSprintResult =
  | {
      ok: true;
      sprintId: string;
      warning?: "no_development_dates";
    }
  | {
      ok: false;
      error: string;
    };

export type MoveTaskToSprintResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

function extractPgCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof e.code === "string") return e.code;
  if (e.cause && typeof e.cause === "object" && typeof e.cause.code === "string") {
    return e.cause.code;
  }
  return undefined;
}

function toSprintEndDueDate(endDateStr: string): Date {
  // Store end of day in Manila (+08:00) or UTC midnight for the sprint end date
  return new Date(`${endDateStr}T23:59:59+08:00`);
}

/**
 * Plans a new sprint and moves selected backlog / carried-over tasks into it.
 */
export async function planSprint(input: {
  projectId: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  taskIds: string[];
}): Promise<PlanSprintResult> {
  // 1. Strict role check FIRST before any DB query
  const authz = await requireRole(["manager"]);
  if (!authz.ok) {
    return { ok: false, error: "FORBIDDEN" };
  }

  // 2. Validate input shape with Zod
  const parsed = PlanSprintSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    if (firstIssue?.path.includes("endDate") && input?.endDate < input?.startDate) {
      return { ok: false, error: "INVALID_DATE_RANGE" };
    }
    return { ok: false, error: firstIssue?.message || "INVALID_INPUT" };
  }

  const { projectId, name, goal, startDate, endDate, taskIds } = parsed.data;
  const today = todayInManila();

  // Reject a sprint whose end date is before todayInManila()
  if (endDate < today) {
    return { ok: false, error: "SPRINT_ALREADY_ENDED" };
  }

  // 3. Project write authorization
  const access = await authorizeProject(projectId, "write");
  if (!access.ok) {
    return { ok: false, error: "FORBIDDEN" };
  }

  // 4. Apply lazy sprint-end cleanup before planning
  await applyEndedSprints(projectId);

  let warning: "no_development_dates" | undefined;
  let newSprintId = "";
  let assigneeUserIds: string[] = [];

  try {
    await db.transaction(async (tx) => {
      // Lock order: agency_project FOR UPDATE -> sprint -> task
      const [lockedProject] = await tx
        .select({ id: agencyProjects.id })
        .from(agencyProjects)
        .where(eq(agencyProjects.id, projectId))
        .for("update");

      if (!lockedProject) {
        throw new Error("PROJECT_NOT_FOUND");
      }

      // Load the project's Development milestone inside the transaction (D2)
      const [devMilestone] = await tx
        .select({
          id: milestones.id,
          startDate: milestones.startDate,
          endDate: milestones.endDate,
        })
        .from(milestones)
        .where(
          and(
            eq(milestones.projectId, projectId),
            or(eq(milestones.name, "development"), eq(milestones.title, "Full-Stack Development")),
            isNull(milestones.deletedAt),
          ),
        );

      if (!devMilestone) {
        throw new Error("DEVELOPMENT_MILESTONE_NOT_FOUND");
      }

      if (devMilestone.startDate && devMilestone.endDate) {
        const milestoneStart = todayInManila(new Date(devMilestone.startDate));
        const milestoneEnd = todayInManila(new Date(devMilestone.endDate));
        if (startDate < milestoneStart || endDate > milestoneEnd) {
          throw new Error("OUTSIDE_DEVELOPMENT_DATES");
        }
      } else {
        warning = "no_development_dates";
      }

      // Insert the sprint
      newSprintId = crypto.randomUUID();
      await tx.insert(sprints).values({
        id: newSprintId,
        projectId,
        name,
        goal: goal || null,
        startDate,
        endDate,
        createdBy: authz.session.user.id,
      });

      // Validate and move tasks if any were selected
      if (taskIds.length > 0) {
        const existingSprints = await tx
          .select({ id: sprints.id, startDate: sprints.startDate, endDate: sprints.endDate })
          .from(sprints)
          .where(eq(sprints.projectId, projectId))
          .for("update");

        const endedSprintIds = new Set(
          existingSprints
            .filter((s) => deriveSprintStatus(s.startDate, s.endDate, today) === "ended")
            .map((s) => s.id),
        );

        const candidateTasks = await tx
          .select({
            id: tasks.id,
            projectId: tasks.projectId,
            milestoneId: tasks.milestoneId,
            status: tasks.status,
            sprintId: tasks.sprintId,
            carriedOver: tasks.carriedOver,
            dueDate: tasks.dueDate,
          })
          .from(tasks)
          .where(
            and(
              inArray(tasks.id, taskIds),
              eq(tasks.projectId, projectId),
              eq(tasks.milestoneId, devMilestone.id),
              isNull(tasks.deletedAt),
            ),
          )
          .for("update");

        const validTasks = candidateTasks.filter((t) => {
          if (t.status === "backlog") return true;
          if (
            (t.status === "in_progress" ||
              t.status === "in_review" ||
              t.status === "changes_requested") &&
            t.sprintId &&
            endedSprintIds.has(t.sprintId)
          ) {
            return true;
          }
          return false;
        });

        // IDOR & status guard: if valid row count differs from unique input count, reject everything
        if (validTasks.length !== taskIds.length) {
          throw new Error("INVALID_TASKS");
        }

        const sprintEndDue = toSprintEndDueDate(endDate);

        for (const t of validTasks) {
          const nextStatus = t.status === "backlog" ? "to_do" : t.status;
          const nextCarriedOver = t.status === "backlog" ? t.carriedOver : true;
          const nextDueDate = t.dueDate ?? sprintEndDue;

          await tx
            .update(tasks)
            .set({
              sprintId: newSprintId,
              status: nextStatus,
              carriedOver: nextCarriedOver,
              dueDate: nextDueDate,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, t.id));
        }

        const assignees = await tx
          .select({ userId: taskAssignees.userId })
          .from(taskAssignees)
          .where(inArray(taskAssignees.taskId, taskIds));

        assigneeUserIds = Array.from(new Set(assignees.map((a) => a.userId).filter(Boolean)));
      }
    });
  } catch (err: unknown) {
    const pgCode = extractPgCode(err);
    if (pgCode === "23P01") {
      return { ok: false, error: "SPRINT_OVERLAP" };
    }
    if (pgCode === "23505") {
      return { ok: false, error: "A sprint with this name already exists in this project." };
    }
    if (err instanceof Error) {
      if (
        err.message === "PROJECT_NOT_FOUND" ||
        err.message === "DEVELOPMENT_MILESTONE_NOT_FOUND" ||
        err.message === "OUTSIDE_DEVELOPMENT_DATES" ||
        err.message === "INVALID_TASKS"
      ) {
        return { ok: false, error: err.message };
      }
    }
    console.error("planSprint error:", err);
    return { ok: false, error: "DATABASE_ERROR" };
  }

  // Post-commit: notify assigned developers (D14), then logAction LAST with actor role and projectId
  try {
    for (const uid of assigneeUserIds) {
      await createSystemNotification(
        uid,
        `Sprint "${name}" (${startDate} to ${endDate}) has been planned with your assigned task(s).`,
        "task",
        `/dashboard/pm/${projectId}`,
      );
    }

    await logAction(
      "CREATE",
      "Sprint",
      `[actorRole:${authz.session.user.role}] Planned sprint "${name}" (${startDate}..${endDate}) with ${taskIds.length} task(s)`,
      authz.session.user.id,
      projectId,
    );
  } catch (postErr) {
    console.error("Post-commit error in planSprint:", postErr);
  }

  return warning ? { ok: true, sprintId: newSprintId, warning } : { ok: true, sprintId: newSprintId };
}

/**
 * Moves a single backlog or carried-over task into a planned or active sprint of the same project.
 */
export async function moveTaskToSprint(input: {
  taskId: string;
  sprintId: string;
}): Promise<MoveTaskToSprintResult> {
  // 1. Strict role check FIRST before any DB query
  const authz = await requireRole(["manager"]);
  if (!authz.ok) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const parsed = MoveTaskToSprintSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const { taskId, sprintId } = parsed.data;

  // 2. Derive projectId from the TASK row (never from caller input)
  const taskRow = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), isNull(tasks.deletedAt)),
    columns: {
      id: true,
      projectId: true,
      milestoneId: true,
      title: true,
    },
  });

  if (!taskRow) {
    return { ok: false, error: "TASK_NOT_FOUND" };
  }

  const projectId = taskRow.projectId;

  // 3. Authorize write access on the task's project
  const access = await authorizeProject(projectId, "write");
  if (!access.ok) {
    return { ok: false, error: "FORBIDDEN" };
  }

  // 4. Apply lazy sprint-end cleanup first
  await applyEndedSprints(projectId);

  const today = todayInManila();
  let sprintName = "";

  try {
    await db.transaction(async (tx) => {
      // Lock order: agency_project FOR UPDATE -> sprint -> task
      await tx
        .select({ id: agencyProjects.id })
        .from(agencyProjects)
        .where(eq(agencyProjects.id, projectId))
        .for("update");

      const [targetSprint] = await tx
        .select({
          id: sprints.id,
          projectId: sprints.projectId,
          name: sprints.name,
          startDate: sprints.startDate,
          endDate: sprints.endDate,
        })
        .from(sprints)
        .where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
        .for("update");

      if (!targetSprint) {
        throw new Error("SPRINT_NOT_FOUND");
      }

      if (deriveSprintStatus(targetSprint.startDate, targetSprint.endDate, today) === "ended") {
        throw new Error("SPRINT_ALREADY_ENDED");
      }

      sprintName = targetSprint.name;

      const [devMilestone] = await tx
        .select({ id: milestones.id })
        .from(milestones)
        .where(
          and(
            eq(milestones.id, taskRow.milestoneId),
            eq(milestones.projectId, projectId),
            or(eq(milestones.name, "development"), eq(milestones.title, "Full-Stack Development")),
            isNull(milestones.deletedAt),
          ),
        );

      if (!devMilestone) {
        throw new Error("NOT_DEVELOPMENT_TASK");
      }

      const [lockedTask] = await tx
        .select({
          id: tasks.id,
          status: tasks.status,
          sprintId: tasks.sprintId,
          carriedOver: tasks.carriedOver,
          dueDate: tasks.dueDate,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.projectId, projectId),
            isNull(tasks.deletedAt),
          ),
        )
        .for("update");

      if (!lockedTask) {
        throw new Error("TASK_NOT_FOUND");
      }

      let isAllowed = lockedTask.status === "backlog";
      if (
        !isAllowed &&
        (lockedTask.status === "in_progress" ||
          lockedTask.status === "in_review" ||
          lockedTask.status === "changes_requested") &&
        lockedTask.sprintId
      ) {
        const [oldSprint] = await tx
          .select({ startDate: sprints.startDate, endDate: sprints.endDate })
          .from(sprints)
          .where(and(eq(sprints.id, lockedTask.sprintId), eq(sprints.projectId, projectId)));
        if (
          oldSprint &&
          deriveSprintStatus(oldSprint.startDate, oldSprint.endDate, today) === "ended"
        ) {
          isAllowed = true;
        }
      }

      if (!isAllowed) {
        throw new Error("INVALID_TASK_STATUS");
      }

      const nextStatus = lockedTask.status === "backlog" ? "to_do" : lockedTask.status;
      const nextCarriedOver = lockedTask.status === "backlog" ? lockedTask.carriedOver : true;
      const nextDueDate = lockedTask.dueDate ?? toSprintEndDueDate(targetSprint.endDate);

      await tx
        .update(tasks)
        .set({
          sprintId: targetSprint.id,
          status: nextStatus,
          carriedOver: nextCarriedOver,
          dueDate: nextDueDate,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (
        err.message === "SPRINT_NOT_FOUND" ||
        err.message === "SPRINT_ALREADY_ENDED" ||
        err.message === "NOT_DEVELOPMENT_TASK" ||
        err.message === "TASK_NOT_FOUND" ||
        err.message === "INVALID_TASK_STATUS"
      ) {
        return { ok: false, error: err.message };
      }
    }
    console.error("moveTaskToSprint error:", err);
    return { ok: false, error: "DATABASE_ERROR" };
  }

  try {
    await logAction(
      "UPDATE",
      "Sprint",
      `[actorRole:${authz.session.user.role}] Moved task "${taskRow.title}" (${taskId}) to sprint "${sprintName}" (${sprintId})`,
      authz.session.user.id,
      projectId,
    );
  } catch (postErr) {
    console.error("Post-commit log error in moveTaskToSprint:", postErr);
  }

  return { ok: true };
}

