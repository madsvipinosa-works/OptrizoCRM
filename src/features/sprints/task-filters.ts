import type { SprintStatus } from "@/features/sprints/sprint-status";

export type FilterableSprint = {
  id: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
};

export type FilterableTask = {
  id: string;
  milestoneId?: string;
  status: string;
  sprintId?: string | null;
  carriedOver?: boolean | null;
};

/**
 * Picks the default sprint for the board picker (Decision D4):
 * 1. The active sprint (`status === "active"`).
 * 2. Else the nearest planned sprint (`status === "planned"` ordered by `startDate` ASC).
 * 3. Else the latest ended sprint (`status === "ended"` ordered by `endDate` DESC).
 * 4. Else `null` when the project has no sprints.
 */
export function pickDefaultSprint<S extends FilterableSprint>(sprints: S[]): S | null {
  if (!sprints || sprints.length === 0) return null;

  const active = sprints.find((s) => s.status === "active");
  if (active) return active;

  const planned = sprints
    .filter((s) => s.status === "planned")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (planned.length > 0) return planned[0];

  const ended = sprints
    .filter((s) => s.status === "ended")
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  if (ended.length > 0) return ended[0];

  return sprints[0] ?? null;
}

/**
 * Returns true if the milestone represents the Development phase.
 */
export function isDevelopmentMilestone(milestone?: {
  name?: string | null;
  title?: string | null;
} | null): boolean {
  if (!milestone) return false;
  const name = (milestone.name || "").toLowerCase().trim();
  const title = (milestone.title || "").toLowerCase().trim();
  return (
    name === "development" ||
    title === "development" ||
    title === "full-stack development"
  );
}

/**
 * Returns true when a task is in backlog status.
 */
export function isBacklogTask(task: { status: string }): boolean {
  return task.status.toLowerCase().trim() === "backlog";
}

/**
 * Excludes backlog tasks from developer task lists (Decision D12).
 */
export function excludeBacklogTasks<T extends { status: string }>(tasks: T[]): T[] {
  return tasks.filter((t) => !isBacklogTask(t));
}

/**
 * Flags whether a task has been carried over from an ended sprint (Decision D5).
 */
export function isTaskCarriedOver(task: { carriedOver?: boolean | null }): boolean {
  return Boolean(task.carriedOver);
}

/**
 * Filters tasks for the Kanban board columns:
 * - Never includes `backlog` tasks in board columns.
 * - In the Development milestone: returns only tasks belonging to `selectedSprintId`
 *   (or `[]` when no sprint is selected / no sprints exist).
 * - In all other milestones: returns all non-backlog tasks.
 */
export function filterBoardTasks<T extends FilterableTask>(
  tasks: T[],
  options: {
    isDevelopment: boolean;
    selectedSprintId: string | null;
  },
): T[] {
  const nonBacklog = excludeBacklogTasks(tasks);
  if (!options.isDevelopment) {
    return nonBacklog;
  }
  if (!options.selectedSprintId) {
    return [];
  }
  return nonBacklog.filter((t) => t.sprintId === options.selectedSprintId);
}

