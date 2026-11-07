"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ListTodo, Plus } from "lucide-react";
import { format } from "date-fns";
import type { SprintWithCounts } from "@/features/sprints/queries";
import { cn } from "@/lib/utils";

interface SprintBarProps {
  sprints: SprintWithCounts[];
  selectedSprintId: string | null;
  onSelectSprint: (sprintId: string) => void;
  isManager: boolean;
  backlogCount?: number;
  isBacklogOpen?: boolean;
  onToggleBacklog?: () => void;
  onOpenPlanSprint?: () => void;
}

function formatSprintDateRange(startStr: string, endStr: string): string {
  try {
    const start = new Date(`${startStr}T00:00:00`);
    const end = new Date(`${endStr}T00:00:00`);
    const sameMonth =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${format(start, "MMM d")} – ${format(end, "d")}`;
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  } catch {
    return `${startStr} – ${endStr}`;
  }
}

function getStatusLabel(status: SprintWithCounts["status"]): {
  label: string;
  colorClass: string;
} {
  if (status === "active") {
    return { label: "Current", colorClass: "text-primary font-semibold" };
  }
  if (status === "ended") {
    return { label: "Done", colorClass: "text-brand-deep dark:text-brand-deep font-semibold" };
  }
  return { label: "Planned", colorClass: "text-muted-foreground font-medium" };
}

export function SprintBar({
  sprints,
  selectedSprintId,
  onSelectSprint,
  isManager,
  backlogCount = 0,
  isBacklogOpen = false,
  onToggleBacklog,
  onOpenPlanSprint,
}: SprintBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedSprint =
    sprints.find((s) => s.id === selectedSprintId) ?? sprints[0] ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-xl px-3 py-2 shadow-xs">
      {/* Left: Sprint Picker & Goal */}
      <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
        {selectedSprint ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-label="Choose sprint"
              onClick={() => setDropdownOpen((v) => !v)}
              className="h-9 px-3 rounded-lg border border-primary/50 bg-primary/10 text-foreground text-sm inline-flex items-center gap-2 whitespace-nowrap transition-colors hover:bg-primary/15"
            >
              <strong className="font-semibold">{selectedSprint.name}</strong>
              <span className="text-muted-foreground text-xs">
                {formatSprintDateRange(selectedSprint.startDate, selectedSprint.endDate)} ·{" "}
                <span className={getStatusLabel(selectedSprint.status).colorClass}>
                  {getStatusLabel(selectedSprint.status).label}
                </span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>

            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="Sprints"
                className="absolute left-0 top-11 w-80 bg-card border border-border rounded-xl p-1.5 flex flex-col gap-0.5 z-30"
              >
                {sprints.map((s) => {
                  const isCurrent = s.id === selectedSprint.id;
                  const statusInfo = getStatusLabel(s.status);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      onClick={() => {
                        onSelectSprint(s.id);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors",
                        isCurrent
                          ? "bg-primary/15 text-foreground font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <span className="truncate">
                        <strong className="font-semibold text-sm">{s.name}</strong>{" "}
                        <span className="text-muted-foreground ml-1">
                          {formatSprintDateRange(s.startDate, s.endDate)}
                        </span>
                      </span>
                      <span className={cn("shrink-0", statusInfo.colorClass)}>
                        {statusInfo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground font-medium px-1">
            No sprint planned yet
          </div>
        )}

        {/* Sprint Goal & Task Count */}
        {selectedSprint && (
          <div className="min-w-0 flex-1 text-xs sm:text-sm text-foreground truncate">
            {selectedSprint.goal ? (
              <>
                <strong className="font-semibold">Goal:</strong> {selectedSprint.goal}{" "}
                <span className="text-muted-foreground">
                  · {selectedSprint.taskCounts.done} of {selectedSprint.taskCounts.total} done
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {selectedSprint.taskCounts.done} of {selectedSprint.taskCounts.total} done
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Manager-only Backlog & Plan sprint buttons */}
      {isManager && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleBacklog}
            className={cn(
              "h-9 px-3 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap border transition-colors",
              isBacklogOpen
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            <ListTodo className="w-3.5 h-3.5 shrink-0" />
            <span>Backlog ({backlogCount})</span>
          </button>

          <button
            type="button"
            onClick={onOpenPlanSprint}
            className="h-9 px-3.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap border border-dashed border-border bg-background text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Plan sprint</span>
          </button>
        </div>
      )}
    </div>
  );
}

