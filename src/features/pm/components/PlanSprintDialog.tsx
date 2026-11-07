"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { planSprint } from "@/features/sprints/actions";
import { isBacklogTask, isTaskCarriedOver } from "@/features/sprints/task-filters";
import type { PmTask } from "./PmKanbanBoard";
import { cn } from "@/lib/utils";

interface PlanSprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  existingSprintCount: number;
  backlogTasks: PmTask[];
  initialSelectedTaskIds?: string[];
  developmentStartDate?: Date | string | null;
  developmentEndDate?: Date | string | null;
  onSprintPlanned?: (sprintId: string) => void;
}

function mapPlanSprintError(code: string): string {
  switch (code) {
    case "SPRINT_OVERLAP":
      return "These dates overlap with an existing sprint in this project. Please choose non-overlapping dates.";
    case "INVALID_DATE_RANGE":
      return "End date must be on or after the start date.";
    case "SPRINT_ALREADY_ENDED":
      return "Cannot plan a sprint whose end date is in the past.";
    case "OUTSIDE_DEVELOPMENT_DATES":
      return "Sprint dates must fall within the Development milestone's start and end dates.";
    case "INVALID_TASKS":
      return "One or more selected tasks can no longer be added to a sprint.";
    case "FORBIDDEN":
      return "You do not have permission to plan sprints for this project.";
    default:
      if (code.toLowerCase().includes("already exists")) {
        return "A sprint with this name already exists in this project.";
      }
      return code || "Failed to plan sprint.";
  }
}

export function PlanSprintDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  existingSprintCount,
  backlogTasks,
  initialSelectedTaskIds,
  developmentStartDate,
  developmentEndDate,
  onSprintPlanned,
}: PlanSprintDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(`Sprint ${existingSprintCount + 1}`);
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasDevelopmentDates = Boolean(developmentStartDate && developmentEndDate);

  // Carried-over tasks (or non-backlog unfinished tasks from ended sprints) are pre-selected
  const defaultPreselectedIds = useMemo(() => {
    if (initialSelectedTaskIds && initialSelectedTaskIds.length > 0) {
      return initialSelectedTaskIds;
    }
    return backlogTasks
      .filter((t) => isTaskCarriedOver(t) || !isBacklogTask(t))
      .map((t) => t.id);
  }, [backlogTasks, initialSelectedTaskIds]);

  useEffect(() => {
    if (open) {
      setName(`Sprint ${existingSprintCount + 1}`);
      setGoal("");
      setErrorMessage(null);
      setSelectedIds(defaultPreselectedIds);
    }
  }, [open, existingSprintCount, defaultPreselectedIds]);

  const toggleTask = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !startDate || !endDate) {
      setErrorMessage("Sprint name, start date, and end date are required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await planSprint({
        projectId,
        name: name.trim(),
        goal: goal.trim() || undefined,
        startDate,
        endDate,
        taskIds: selectedIds,
      });

      if (!res.ok) {
        const friendly = mapPlanSprintError(res.error);
        setErrorMessage(friendly);
        toast.error(friendly);
        return;
      }

      if (res.warning === "no_development_dates") {
        toast.warning(
          "Sprint saved. Note: The Development milestone has no start/end dates set, so date containment was not enforced."
        );
      } else {
        toast.success(`${name.trim()} saved`);
      }

      onOpenChange(false);
      onSprintPlanned?.(res.sprintId);
      router.refresh();
    } catch (err) {
      console.error("Plan sprint error:", err);
      setErrorMessage("An unexpected error occurred while saving the sprint.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">Plan sprint</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {projectTitle} · Development
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {!hasDevelopmentDates && (
              <div
                role="note"
                className="flex items-start gap-2.5 rounded-lg border border-stage-negotiation/30 bg-stage-negotiation/10 p-3 text-xs text-stage-negotiation dark:text-stage-negotiation"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-stage-negotiation dark:text-stage-negotiation" />
                <span>
                  The Development milestone has no start or end dates set
                  (<code className="tabular-nums">no_development_dates</code>). Any valid sprint dates
                  are allowed.
                </span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive"
              >
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-name" className="text-xs font-semibold text-muted-foreground">
                  Sprint name
                </Label>
                <Input
                  id="sprint-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sprint 1"
                  maxLength={80}
                  required
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sprint-start" className="text-xs font-semibold text-muted-foreground">
                  Start date
                </Label>
                <DatePicker id="sprint-start" value={startDate} onChange={setStartDate} min={todayYmd()} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sprint-end" className="text-xs font-semibold text-muted-foreground">
                  End date
                </Label>
                <DatePicker id="sprint-end" value={endDate} onChange={setEndDate} min={startDate || todayYmd()} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sprint-goal" className="text-xs font-semibold text-muted-foreground">
                Sprint goal
              </Label>
              <Input
                id="sprint-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Driver app delivery list and status updates"
                maxLength={500}
                className="h-9 text-sm"
              />
            </div>

            {/* Task Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tasks from backlog ({backlogTasks.length} available)</span>
                <strong className="text-primary font-semibold">{selectedIds.length} selected</strong>
              </div>

              {backlogTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  No backlog or carried-over tasks available to select. You can still create an
                  empty sprint.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {backlogTasks.map((task) => {
                    const checked = selectedIds.includes(task.id);
                    const isCarried = isTaskCarriedOver(task) || !isBacklogTask(task);
                    const assigneeLabel =
                      task.assignees && task.assignees.length > 0
                        ? task.assignees
                            .map((a) => a.user.name || a.user.email || "Dev")
                            .join(", ")
                        : "Unassigned";

                    return (
                      <label
                        key={task.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs sm:text-sm cursor-pointer transition-colors",
                          checked
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTask(task.id)}
                            className="w-4 h-4 rounded border-border accent-primary shrink-0"
                          />
                          <span className="font-medium truncate">{task.title}</span>
                          {isCarried && (
                            <Badge
                              variant="secondary"
                              className="text-xs font-semibold px-1.5 py-0 bg-stage-negotiation/15 text-stage-negotiation dark:text-stage-negotiation border-stage-negotiation/30 shrink-0"
                            >
                              Carried over
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {assigneeLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 sm:px-6 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              On save: assigned developers are notified.
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !name.trim() || !startDate || !endDate}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Save sprint
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

