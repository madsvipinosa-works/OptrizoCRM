"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createTask, deleteTask } from "@/features/pm/actions";
import { moveTaskToSprint } from "@/features/sprints/actions";
import type { SprintWithCounts } from "@/features/sprints/queries";
import { isBacklogTask, isTaskCarriedOver } from "@/features/sprints/task-filters";
import type { PmTask } from "./PmKanbanBoard";
import { FormSelect } from "@/components/ui/form-select";

interface BacklogPanelProps {
  projectId: string;
  developmentMilestoneId: string;
  backlogTasks: PmTask[];
  sprints: SprintWithCounts[];
  onOpenPlanSprint: (selectedIds?: string[]) => void;
  onTasksChanged?: () => void;
}

export function BacklogPanel({
  projectId,
  developmentMilestoneId,
  backlogTasks,
  sprints,
  onOpenPlanSprint,
  onTasksChanged,
}: BacklogPanelProps) {
  const router = useRouter();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const targetableSprints = sprints.filter((s) => s.status !== "ended");

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || !developmentMilestoneId) return;

    setIsAdding(true);
    try {
      const res = await createTask(
        projectId,
        developmentMilestoneId,
        title,
        undefined,
        undefined,
        1,
        undefined,
        { toBacklog: true }
      );
      if (res.success) {
        toast.success("Task added to backlog");
        setNewTaskTitle("");
        onTasksChanged?.();
        router.refresh();
      } else {
        toast.error(res.message || "Failed to add task to backlog");
      }
    } catch (err) {
      console.error("Add backlog task error:", err);
      toast.error("An error occurred while adding task");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteBacklogTask = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      const res = await deleteTask(taskId);
      if (res.success) {
        toast.success("Backlog task deleted");
        setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId));
        onTasksChanged?.();
        router.refresh();
      } else {
        toast.error(res.message || "Failed to delete task");
      }
    } catch (err) {
      console.error("Delete backlog task error:", err);
      toast.error("An error occurred while deleting task");
    } finally {
      setDeletingId(null);
    }
  };

  const handleMoveToSprint = async (taskId: string, sprintId: string) => {
    if (!sprintId) return;
    setMovingId(taskId);
    try {
      const res = await moveTaskToSprint({ taskId, sprintId });
      if (res.ok) {
        toast.success("Task moved to sprint");
        setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId));
        onTasksChanged?.();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to move task to sprint");
      }
    } catch (err) {
      console.error("Move task to sprint error:", err);
      toast.error("An error occurred while moving task");
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-card border border-border rounded-xl p-4 sm:p-5 gap-4 shadow-xs min-h-[360px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-foreground">Backlog</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {backlogTasks.length} Development task{backlogTasks.length === 1 ? "" : "s"} not in an
            active sprint yet
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              onOpenPlanSprint(selectedTaskIds.length > 0 ? selectedTaskIds : undefined)
            }
            className="h-9 text-xs sm:text-sm font-semibold"
          >
            {selectedTaskIds.length > 0
              ? `Plan sprint with selected (${selectedTaskIds.length})`
              : "Plan sprint"}
          </Button>
        </div>
      </div>

      {/* Add Task Inline Field */}
      <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a Development task to the backlog..."
          className="h-9 text-xs sm:text-sm bg-background border-border flex-1"
          disabled={isAdding}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={isAdding || !newTaskTitle.trim()}
          className="h-9 text-xs sm:text-sm font-semibold gap-1.5 shrink-0"
        >
          {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          <span>Add task</span>
        </Button>
      </form>

      {/* Backlog & Carried-Over Table */}
      <div className="flex-1 overflow-x-auto">
        {backlogTasks.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            No tasks in the backlog. Use the field above to add Development tasks.
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                <th className="py-2 px-2.5 w-9"></th>
                <th className="py-2 px-2.5">Task</th>
                <th className="py-2 px-2.5">Assigned</th>
                <th className="py-2 px-2.5 text-right">Move to</th>
                <th className="py-2 px-2.5 w-10 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {backlogTasks.map((task) => {
                const isBacklog = isBacklogTask(task);
                const isCarried = isTaskCarriedOver(task) || !isBacklog;
                const isChecked = selectedTaskIds.includes(task.id);
                const assigneeNames =
                  task.assignees && task.assignees.length > 0
                    ? task.assignees
                        .map((a) => a.user.name || a.user.email || "Developer")
                        .join(", ")
                    : "Unassigned";

                return (
                  <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-2.5 align-middle">
                      <input
                        type="checkbox"
                        aria-label={`Select ${task.title}`}
                        checked={isChecked}
                        onChange={() => handleToggleSelect(task.id)}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-2.5 align-middle font-semibold text-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{task.title}</span>
                        {isCarried && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-semibold px-2 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          >
                            Carried over
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 align-middle text-xs sm:text-sm text-muted-foreground">
                      {assigneeNames}
                    </td>
                    <td className="py-2.5 px-2.5 align-middle text-right">
                      {targetableSprints.length > 0 ? (
                        <FormSelect
                          aria-label={`Move ${task.title} to sprint`}
                          value=""
                          disabled={movingId === task.id}
                          onChange={(e) => handleMoveToSprint(task.id, e.target.value)}
                          className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                         variant="plain">
                          <option value="">Keep in backlog</option>
                          {targetableSprints.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.startDate})
                            </option>
                          ))}
                        </FormSelect>
                      ) : (
                        <span className="text-xs text-muted-foreground">Keep in backlog</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 align-middle text-right">
                      {isBacklog && (
                        <button
                          type="button"
                          disabled={deletingId === task.id}
                          onClick={() => handleDeleteBacklogTask(task.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete backlog task"
                          aria-label={`Delete ${task.title}`}
                        >
                          {deletingId === task.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      <div className="mt-auto text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
        Tasks leave the backlog when they are put in a sprint. Tasks still here when Development
        ends are flagged to the PM before UAT starts.
      </div>
    </div>
  );
}

