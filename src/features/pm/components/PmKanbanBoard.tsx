"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isBacklogTask, isTaskCarriedOver } from "@/features/sprints/task-filters";

export type PmTaskStatus =
    | "Todo"
    | "In Progress"
    | "Changes Requested"
    | "In Review"
    | "Done"
    | "backlog"
    | "to_do"
    | "in_progress"
    | "in_review"
    | "changes_requested"
    | "done";

export interface PmTask {
    id: string;
    milestoneId: string;
    title: string;
    description: string | null;
    status: PmTaskStatus;
    sprintId?: string | null;
    carriedOver?: boolean | null;
    reviewNote?: string | null;
    requiresProof?: boolean;
    proofLinks?: { label: string; url: string }[] | null;
    proofNotes?: string | null;
    assignees: {
        user: {
            id: string;
            name: string | null;
            image?: string | null;
            jobTitle?: string | null;
            role?: string | null;
            email?: string | null;
        };
    }[];
    dueDate: Date | null;
    dependsOnTaskId: string | null;
    weight?: number;
    estimatedHours?: number | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
}

export interface TeamMember {
    id: string;
    name: string | null;
    image?: string | null;
    jobTitle?: string | null;
}

interface PmKanbanBoardProps {
    tasks: PmTask[];
    teamMembers: TeamMember[];
    currentUserId?: string;
    currentUserRole?: string;
    onStartTask?: (taskId: string) => void;
    onSubmitTask?: (task: PmTask) => void;
    onApproveTask?: (taskId: string) => void;
    onRequestChanges?: (task: PmTask) => void;
    onDeleteTask?: (task: PmTask) => void;
    onViewProofs?: (task: PmTask) => void;
    onClickTask?: (task: PmTask) => void;
    isViewOnly?: boolean;
    /** Mockup 27: this card shows "Approved just now". */
    recentlyApprovedId?: string | null;
    /** PM only. New tasks always start in To do, so that is where Add task lives (Trello's "Add a card"). */
    onAddTask?: () => void;
}

// 4 Canonical columns: To Do, In Progress, In Review, Done
// "changes_requested" tasks live inside the "In Progress" column with an orange/red badge
const COLUMNS: {
    id: "to_do" | "in_progress" | "in_review" | "done";
    title: string;
    dotColor: string;
    badgeColor: string;
    subtitle: string;
    empty: string;
}[] = [
    {
        id: "to_do",
        title: "To do",
        dotColor: "bg-muted-foreground",
        badgeColor: "bg-muted text-foreground border-border",
        subtitle: "Auto: task created and assigned",
        empty: "Nothing waiting to start.",
    },
    {
        id: "in_progress",
        title: "In progress",
        dotColor: "bg-stage-new",
        badgeColor: "bg-stage-new/15 text-stage-new dark:text-stage-new border-stage-new/30",
        subtitle: "Auto: developer starts work",
        empty: "No one is working on a task.",
    },
    {
        id: "in_review",
        title: "In review",
        dotColor: "bg-stage-negotiation",
        badgeColor: "bg-stage-negotiation/15 text-stage-negotiation dark:text-stage-negotiation border-stage-negotiation/30",
        subtitle: "Auto: developer submits it",
        empty: "Nothing to review.",
    },
    {
        id: "done",
        title: "Done",
        dotColor: "bg-brand-deep",
        badgeColor: "bg-brand-soft text-brand-deep dark:text-brand-deep border-brand-deep/30",
        subtitle: "Auto: PM approves",
        empty: "No tasks approved yet.",
    },
];

function normalizeStatus(status: PmTaskStatus): "backlog" | "to_do" | "in_progress" | "changes_requested" | "in_review" | "done" {
    if (status === "backlog") return "backlog";
    if (status === "to_do" || status === "Todo") return "to_do";
    if (status === "in_progress" || status === "In Progress") return "in_progress";
    if (status === "changes_requested" || status === "Changes Requested") return "changes_requested";
    if (status === "in_review" || status === "In Review") return "in_review";
    if (status === "done" || status === "Done") return "done";
    return "to_do";
}

export function PmKanbanBoard({
    tasks,
    currentUserId,
    currentUserRole,
    onStartTask,
    onSubmitTask,
    onApproveTask,
    onRequestChanges,
    onDeleteTask,
    onClickTask,
    isViewOnly = false,
    onAddTask,
    recentlyApprovedId,
}: PmKanbanBoardProps) {
    const [selectedMobileColumn, setSelectedMobileColumn] = useState<"to_do" | "in_progress" | "in_review" | "done">("to_do");
    const boardScrollRef = React.useRef<HTMLDivElement>(null);

    // Exclude backlog tasks from board columns
    const boardTasks = tasks.filter((t) => !isBacklogTask(t));

    // A column's distance from the first column = its scroll position inside the strip.
    const columnOffset = (el: HTMLElement) =>
        el.offsetLeft - (document.getElementById(`pm-column-${COLUMNS[0].id}`)?.offsetLeft ?? 0);

    const scrollToColumn = (colId: "to_do" | "in_progress" | "in_review" | "done") => {
        setSelectedMobileColumn(colId);
        const el = document.getElementById(`pm-column-${colId}`);
        if (el && boardScrollRef.current) {
            boardScrollRef.current.scrollTo({
                left: columnOffset(el),
                behavior: "smooth",
            });
        }
    };

    const handleBoardScroll = () => {
        if (!boardScrollRef.current) return;
        const scrollLeft = boardScrollRef.current.scrollLeft;
        // The chip follows the column whose left edge is nearest the scroll position (works for any column width).
        let targetCol = COLUMNS[0];
        let best = Infinity;
        for (const col of COLUMNS) {
            const el = document.getElementById(`pm-column-${col.id}`);
            if (!el) continue;
            const d = Math.abs(columnOffset(el) - scrollLeft);
            if (d < best) { best = d; targetCol = col; }
        }
        if (targetCol && targetCol.id !== selectedMobileColumn) {
            setSelectedMobileColumn(targetCol.id);
        }
    };

    return (
        <div className="flex w-full flex-col">
            {/* Quick Switch Tab Bar on Mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 lg:hidden scrollbar-none px-1 shrink-0">
                {COLUMNS.map((col) => {
                    const count = boardTasks.filter((t) => {
                        const norm = normalizeStatus(t.status);
                        if (col.id === "in_progress") {
                            return norm === "in_progress" || norm === "changes_requested";
                        }
                        return norm === col.id;
                    }).length;
                    const isSelected = selectedMobileColumn === col.id;

                    return (
                        <button
                            key={col.id}
                            type="button"
                            onClick={() => scrollToColumn(col.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                                isSelected
                                    ? "bg-brand-deep text-white border-brand-deep"
                                    : "bg-card/90 text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                            )}
                        >
                            <span className={cn("w-2 h-2 rounded-full", col.dotColor)} />
                            <span>{col.title}</span>
                            <span
                                className={cn(
                                    "text-xs px-1.5 py-0.2 rounded-full tabular-nums",
                                    isSelected ? "bg-white/20 text-white font-semibold" : "bg-muted text-foreground"
                                )}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Columns Grid / Snap Carousel */}
            <div
                ref={boardScrollRef}
                onScroll={handleBoardScroll}
                className="w-full overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory lg:snap-none lg:overflow-visible"
            >
                <div className="flex lg:grid lg:grid-cols-4 gap-3 items-stretch w-full min-w-0 h-full">
                    {COLUMNS.map((col) => {
                        const columnTasks = boardTasks.filter((t) => {
                            const norm = normalizeStatus(t.status);
                            if (col.id === "in_progress") {
                                return norm === "in_progress" || norm === "changes_requested";
                            }
                            return norm === col.id;
                        });

                        return (
                            <PmKanbanColumn
                                key={col.id}
                                column={col}
                                tasks={columnTasks}
                                allTasks={boardTasks}
                                currentUserId={currentUserId}
                                currentUserRole={currentUserRole}
                                onStartTask={onStartTask}
                                onSubmitTask={onSubmitTask}
                                onApproveTask={onApproveTask}
                                onRequestChanges={onRequestChanges}
                                onDeleteTask={onDeleteTask}
                                onClickTask={onClickTask}
                                isViewOnly={isViewOnly}
                                onAddTask={col.id === "to_do" ? onAddTask : undefined}
                                recentlyApprovedId={recentlyApprovedId}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function PmKanbanColumn({
    column,
    tasks,
    allTasks,
    currentUserId,
    currentUserRole,
    onStartTask,
    onSubmitTask,
    onApproveTask,
    onRequestChanges,
    onDeleteTask,
    onClickTask,
    isViewOnly,
    onAddTask,
    recentlyApprovedId,
}: {
    onAddTask?: () => void;
    recentlyApprovedId?: string | null;
    column: {
        id: "to_do" | "in_progress" | "in_review" | "done";
        title: string;
        dotColor: string;
        badgeColor: string;
        subtitle: string;
        empty: string;
    };
    tasks: PmTask[];
    allTasks: PmTask[];
    currentUserId?: string;
    currentUserRole?: string;
    onStartTask?: (taskId: string) => void;
    onSubmitTask?: (task: PmTask) => void;
    onApproveTask?: (taskId: string) => void;
    onRequestChanges?: (task: PmTask) => void;
    onDeleteTask?: (task: PmTask) => void;
    onClickTask?: (task: PmTask) => void;
    isViewOnly?: boolean;
}) {
    return (
        <div
            id={`pm-column-${column.id}`}
            className={cn(
                "bg-muted/70 rounded-xl p-3 flex flex-col h-full min-h-[460px]",
                "w-[84vw] max-w-[320px] min-w-[270px] shrink-0 snap-start lg:w-auto lg:max-w-none lg:min-w-0 lg:shrink"
            )}
        >
            {/* Column Header */}
            <div className="mb-2.5 px-0.5">
                <h3 className="flex items-baseline justify-between gap-2 text-base font-semibold tracking-tight text-foreground">
                    <span>{column.title}</span>
                    <span className="text-sm font-medium tabular-nums text-muted-foreground" aria-label={`${tasks.length} tasks`}>{tasks.length}</span>
                </h3>
                <p className="text-sm text-muted-foreground">{column.subtitle}</p>
            </div>

            {/* Cards List */}
            <div className="flex flex-col gap-2">
                {tasks.length === 0 ? (
                    <p className="px-0.5 pt-1 text-sm text-muted-foreground">{column.empty}</p>
                ) : (
                    tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            allTasks={allTasks}
                            currentUserId={currentUserId}
                            currentUserRole={currentUserRole}
                            onStartTask={onStartTask}
                            onSubmitTask={onSubmitTask}
                            onApproveTask={onApproveTask}
                            onRequestChanges={onRequestChanges}
                            onDeleteTask={onDeleteTask}
                            onClickTask={onClickTask}
                            isViewOnly={isViewOnly}
                            justApproved={task.id === recentlyApprovedId}
                        />
                    ))
                )}
            </div>
            {onAddTask && (
                <button
                    type="button"
                    onClick={onAddTask}
                    className="mt-2 flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-foreground outline-none transition-colors duration-150 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                >
                    <Plus className="size-4 text-brand-deep" aria-hidden="true" /> Add task
                </button>
            )}
        </div>
    );
}

function TaskCard({
    task,
    allTasks,
    currentUserId,
    currentUserRole,
    onStartTask,
    onSubmitTask,
    onApproveTask,
    onDeleteTask,
    onClickTask,
    isViewOnly,
    justApproved,
}: {
    justApproved?: boolean;
    task: PmTask;
    allTasks: PmTask[];
    currentUserId?: string;
    currentUserRole?: string;
    onStartTask?: (taskId: string) => void;
    onSubmitTask?: (task: PmTask) => void;
    onApproveTask?: (taskId: string) => void;
    onRequestChanges?: (task: PmTask) => void;
    onDeleteTask?: (task: PmTask) => void;
    onClickTask?: (task: PmTask) => void;
    isViewOnly?: boolean;
}) {
    const prerequisiteTask = task.dependsOnTaskId ? allTasks.find((t) => t.id === task.dependsOnTaskId) : null;
    const isLocked = prerequisiteTask ? normalizeStatus(prerequisiteTask.status) !== "done" : false;

    const normStatus = normalizeStatus(task.status);
    const isChangesRequested = normStatus === "changes_requested";
    const isCarriedOver = isTaskCarriedOver(task);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && normStatus !== "done";
    // Trello habit: amber when due within two days.
    const isDueSoon = !!task.dueDate && !isOverdue && normStatus !== "done" && new Date(task.dueDate).getTime() - new Date().getTime() < 2 * 24 * 60 * 60 * 1000;

    // Permission checks
    const isAssignedToUser = currentUserId ? task.assignees?.some((a) => a.user.id === currentUserId) : false;
    const isDeveloper = currentUserRole === "developer";
    const isManager = currentUserRole === "manager";

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Open task ${task.title}`}
            onClick={() => onClickTask?.(task)}
            onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onClickTask?.(task);
                }
            }}
            className={cn(
                "group relative flex flex-col w-full min-w-0 overflow-hidden rounded-lg border bg-card p-3 gap-2.5 text-foreground cursor-pointer outline-none transition-colors duration-150 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
                isChangesRequested ? "border-destructive/40" : "border-border/70"
            )}
        >
            {/* Header: Title, Tags & Delete Button */}
            <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    {/* Status & Carried Over Badge Tags */}
                    {(isChangesRequested || isCarriedOver || isLocked) && (
                        <div className="flex flex-wrap items-center gap-1">
                            {isChangesRequested && (
                                <Badge
                                    variant="outline"
                                    className="text-xs font-semibold px-2 py-0 bg-destructive/10 text-destructive border-transparent shrink-0 whitespace-nowrap"
                                >
                                    Changes requested
                                </Badge>
                            )}
                            {isCarriedOver && (
                                <Badge
                                    variant="secondary"
                                    className="text-xs font-semibold px-2 py-0 bg-stage-negotiation/15 text-stage-negotiation border-transparent shrink-0 whitespace-nowrap"
                                >
                                    Carried over
                                </Badge>
                            )}
                            {isLocked && (
                                <Badge
                                    variant="secondary"
                                    title={`Waiting for "${prerequisiteTask?.title}"`}
                                    className="text-xs font-semibold px-2 py-0 bg-muted text-muted-foreground border-transparent shrink-0 whitespace-nowrap"
                                >
                                    Blocked
                                </Badge>
                            )}
                        </div>
                    )}

                    <h4
                        className={cn(
                            "text-base font-semibold leading-snug break-words line-clamp-2 text-foreground"
                        )}
                        title={task.title}
                    >
                        {task.title}
                    </h4>
                </div>

                {/* Delete Button for Managers (only on tasks that haven't started) */}
                {isManager && onDeleteTask && !isViewOnly && (normStatus === "to_do" || normStatus === "backlog") && (
                    <div className="flex items-center shrink-0 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask(task);
                            }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete task"
                            aria-label={`Delete ${task.title}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Foot, Trello-style: due date chip on the left, the person on the right (mockup 22 content). */}
            <div className="flex items-center justify-between gap-2 text-sm">
                {task.dueDate ? (
                    <span
                        className={cn(
                            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                            normStatus === "done"
                                ? "bg-brand-soft text-brand-deep"
                                : isOverdue
                                ? "bg-destructive/10 text-destructive"
                                : isDueSoon
                                ? "bg-stage-negotiation/15 text-stage-negotiation"
                                : "text-muted-foreground"
                        )}
                    >
                        <Clock className="size-3.5" aria-hidden="true" />
                        {normStatus === "done" ? "Done" : isOverdue ? "Overdue" : "Due"} {format(new Date(task.dueDate), "MMM d")}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">No due date</span>
                )}
                {task.assignees && task.assignees.length > 0 ? (
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span className="flex -space-x-1.5">
                            {task.assignees.slice(0, 3).map((a) => (
                                <span
                                    key={a.user.id}
                                    aria-hidden="true"
                                    className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep ring-2 ring-card"
                                >
                                    {(a.user.name || a.user.email || "D").trim()[0].toUpperCase()}
                                </span>
                            ))}
                        </span>
                        <span className="truncate">
                            {(task.assignees[0].user.name || "Developer").split(" ")[0]} (Dev)
                            {task.assignees.length > 1 ? ` +${task.assignees.length - 1}` : ""}
                        </span>
                    </span>
                ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                )}
            </div>

            {justApproved && normStatus === "done" && (
                <span className="w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-semibold text-brand-deep">Approved just now</span>
            )}

            {/* One action per card (mockup 22). Request changes is in the task drawer, where the comment goes. */}
            {!isViewOnly && (
                <div onClick={(e) => e.stopPropagation()} className="empty:hidden">
                    {normStatus === "to_do" && isDeveloper && isAssignedToUser && onStartTask && (
                        <Button size="sm" disabled={isLocked} className="h-9 w-full text-sm font-semibold active:scale-[0.97]" onClick={() => onStartTask(task.id)}>
                            Start
                        </Button>
                    )}
                    {(normStatus === "in_progress" || normStatus === "changes_requested") && isDeveloper && isAssignedToUser && onSubmitTask && (
                        <Button size="sm" variant="outline" className="h-9 w-full bg-card text-sm font-semibold active:scale-[0.97]" onClick={() => onSubmitTask(task)}>
                            Submit for review
                        </Button>
                    )}
                    {normStatus === "in_review" && isManager && onApproveTask && (
                        <Button size="sm" className="h-9 w-full bg-brand-deep text-sm font-semibold text-white hover:bg-brand-deep/90 active:scale-[0.97]" onClick={() => onApproveTask(task.id)}>
                            Approve
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
