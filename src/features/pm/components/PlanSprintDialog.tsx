"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { planSprint } from "@/features/sprints/actions";
import { updateTaskDetails } from "@/features/pm/actions";
import { FormSelect } from "@/components/ui/form-select";
import type { TeamMemberItem } from "./AssigneeCombobox";
import { isBacklogTask, isTaskCarriedOver } from "@/features/sprints/task-filters";
import type { PmTask } from "./PmKanbanBoard";
import { cn } from "@/lib/utils";

interface PlanSprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  existingSprintCount: number;
  /** Sprints already planned; their days cannot be picked again. */
  existingSprints?: { startDate: string; endDate: string }[];
  backlogTasks: PmTask[];
  initialSelectedTaskIds?: string[];
  developmentStartDate?: Date | string | null;
  developmentEndDate?: Date | string | null;
  onSprintPlanned?: (sprintId: string) => void;
  /** Mockup 23b: pick the developer for each task while planning. */
  teamMembers?: TeamMemberItem[];
  /** Existing sprints, for the "Dates start after Sprint N" hint. */
  sprints?: { name: string; endDate: string }[];
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
  existingSprints = [],
  backlogTasks,
  initialSelectedTaskIds,
  developmentStartDate,
  developmentEndDate,
  onSprintPlanned,
  teamMembers = [],
  sprints = [],
}: PlanSprintDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(`Sprint ${existingSprintCount + 1}`);
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Developer per task (mockup 23b); starts as the task's current first assignee.
  const [assignee, setAssignee] = useState<Record<string, string>>({});

  const hasDevelopmentDates = Boolean(developmentStartDate && developmentEndDate);
  const short = (d: Date | string) => format(new Date(d), "MMM d");
  const devRange = hasDevelopmentDates ? `${short(developmentStartDate!)} – ${short(developmentEndDate!)}` : null;
  const lastSprint = [...sprints].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1);
  const dateHint = devRange
    ? `${lastSprint ? `Dates start after ${lastSprint.name} and must` : "Dates must"} end by ${short(developmentEndDate!)}, when Development ends.`
    : null;
  const nameOf = (id?: string) => (teamMembers.find((m) => m.id === id)?.name || "").split(" ")[0];
  const notified = [...new Set(selectedIds.map((id) => nameOf(assignee[id])).filter(Boolean))];
  const notifyLine = notified.length
    ? `On save: ${notified.length > 1 ? `${notified.slice(0, -1).join(", ")} and ${notified.at(-1)} are` : `${notified[0]} is`} notified, and the sprint is saved in Activity.`
    : "On save: the sprint is saved in Activity.";

  // Pickable window: today (or the Development start, if later) up to the Development end.
  const devStartYmd = developmentStartDate ? todayYmd(new Date(developmentStartDate)) : undefined;
  const devEndYmd = developmentEndDate ? todayYmd(new Date(developmentEndDate)) : undefined;
  const minDate = devStartYmd && devStartYmd > todayYmd() ? devStartYmd : todayYmd();
  const taken = existingSprints.map((s) => ({ from: s.startDate.slice(0, 10), to: s.endDate.slice(0, 10) }));
  // A range that starts before and ends after an existing sprint would swallow it, so cap the end at the next sprint.
  const nextSprintStart = startDate
    ? taken.map((r) => r.from).filter((f) => f > startDate).sort()[0]
    : undefined;
  const endMax = nextSprintStart
    ? new Date(new Date(`${nextSprintStart}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)
    : undefined;
  const maxEnd = [devEndYmd, endMax].filter(Boolean).sort()[0];

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
      setAssignee(Object.fromEntries(backlogTasks.map((t) => [t.id, t.assignees?.[0]?.user.id ?? ""])));
    }
  }, [open, existingSprintCount, defaultPreselectedIds, backlogTasks]);

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
      // Reassign first, so the sprint's notifications go to the developers chosen here.
      for (const id of selectedIds) {
        const task = backlogTasks.find((t) => t.id === id);
        const chosen = assignee[id];
        if (task && chosen && chosen !== task.assignees?.[0]?.user.id) {
          const r = await updateTaskDetails(id, { assigneeIds: [chosen] });
          if (!r.success) {
            setErrorMessage(r.message || `Could not assign "${task.title}".`);
            return;
          }
        }
      }
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
        <SheetHeader className="shrink-0 border-b border-border p-5 sm:p-6 pb-4">
          <SheetTitle className="text-xl font-semibold tracking-tight text-foreground">Plan sprint</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {projectTitle} · Development{devRange ? ` (${devRange})` : ""}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {!hasDevelopmentDates && (
              <div
                role="note"
                className="flex items-start gap-2.5 rounded-lg border border-stage-negotiation/30 bg-stage-negotiation/10 p-3 text-sm text-foreground"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-stage-negotiation" aria-hidden="true" />
                <span>The Development milestone has no dates yet, so any sprint dates are allowed.</span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive"
              >
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-name" className="text-sm text-muted-foreground">
                  Sprint name <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="sprint-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sprint 1"
                  maxLength={80}
                  required
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sprint-start" className="text-sm text-muted-foreground">
                  Start date <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <DatePicker id="sprint-start" value={startDate} onChange={(v) => { setStartDate(v); if (endDate && endDate < v) setEndDate(""); }} min={minDate} max={devEndYmd} disabledRanges={taken} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sprint-end" className="text-sm text-muted-foreground">
                  End date <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <DatePicker id="sprint-end" value={endDate} onChange={setEndDate} min={startDate || minDate} max={maxEnd} disabledRanges={taken} required />
              </div>
            </div>
            {dateHint && <p className="-mt-2 text-sm text-muted-foreground">{dateHint}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="sprint-goal" className="text-sm text-muted-foreground">
                Sprint goal
              </Label>
              <Input
                id="sprint-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Driver app delivery list and status updates"
                maxLength={500}
                className="h-10 text-sm"
              />
            </div>

            {/* Task Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Tasks from backlog ({backlogTasks.length} not in a sprint)</span>
                <strong className="text-brand-deep font-semibold tabular-nums">{selectedIds.length} selected</strong>
              </div>

              {backlogTasks.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  No backlog or carried-over tasks available to select. You can still create an
                  empty sprint.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {backlogTasks.map((task) => {
                    const checked = selectedIds.includes(task.id);
                    const isCarried = isTaskCarriedOver(task) || !isBacklogTask(task);
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors duration-150",
                          checked
                            ? "border-brand-deep/40 bg-brand-soft text-foreground"
                            : "border-border bg-card text-foreground hover:bg-muted/40"
                        )}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTask(task.id)}
                            className="size-4 shrink-0 rounded border-border accent-[var(--brand-deep)]"
                          />
                          <span className="min-w-0 text-base">{task.title}</span>
                          {isCarried && (
                            <Badge
                              variant="secondary"
                              className="text-xs font-semibold px-1.5 py-0 bg-stage-negotiation/15 text-stage-negotiation border-stage-negotiation/30 shrink-0"
                            >
                              Carried over
                            </Badge>
                          )}
                        </label>
                        <FormSelect
                          aria-label={`Developer for ${task.title}`}
                          value={assignee[task.id] ?? ""}
                          onChange={(e) => setAssignee((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          className="w-36 shrink-0 bg-card text-sm"
                        >
                          <option value="">Not assigned</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {(m.name || m.email || "Developer").split(" ")[0]} (Dev)
                            </option>
                          ))}
                        </FormSelect>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t border-border bg-card p-4 sm:px-6">
            <span className="hidden text-sm text-muted-foreground sm:inline">{notifyLine}</span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="h-10 bg-card px-5 active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !name.trim() || !startDate || !endDate} className="h-10 px-5 font-semibold active:scale-[0.97]">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Save sprint
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

