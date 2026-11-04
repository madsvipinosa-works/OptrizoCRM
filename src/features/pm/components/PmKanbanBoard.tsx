"use client";

import React, { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import {
    Calendar,
    Lock,
    Trash2,
    Play,
    Send,
    CheckCircle2,
    RotateCcw,
} from "lucide-react";
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
}

// 4 Canonical columns: To Do, In Progress, In Review, Done
// "changes_requested" tasks live inside the "In Progress" column with an orange/red badge
const COLUMNS: {
    id: "to_do" | "in_progress" | "in_review" | "done";
    title: string;
    dotColor: string;
    badgeColor: string;
    subtitle: string;
}[] = [
    {
        id: "to_do",
        title: "To Do",
        dotColor: "bg-muted-foreground",
        badgeColor: "bg-muted text-foreground border-border",
        subtitle: "Task created and assigned",
    },
    {
        id: "in_progress",
        title: "In Progress",
        dotColor: "bg-blue-500",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
        subtitle: "Developer starts work",
    },
    {
        id: "in_review",
        title: "In Review",
        dotColor: "bg-amber-500",
        badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
        subtitle: "Developer submits for PM review",
    },
    {
        id: "done",
        title: "Done",
        dotColor: "bg-emerald-500",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
        subtitle: "PM approves task",
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
}: PmKanbanBoardProps) {
    const [selectedMobileColumn, setSelectedMobileColumn] = useState<"to_do" | "in_progress" | "in_review" | "done">("to_do");
    const boardScrollRef = React.useRef<HTMLDivElement>(null);

    // Exclude backlog tasks from board columns
    const boardTasks = tasks.filter((t) => !isBacklogTask(t));

    const scrollToColumn = (colId: "to_do" | "in_progress" | "in_review" | "done") => {
        setSelectedMobileColumn(colId);
        const el = document.getElementById(`pm-column-${colId}`);
        if (el && boardScrollRef.current) {
            boardScrollRef.current.scrollTo({
                left: el.offsetLeft - 16,
                behavior: "smooth",
            });
        }
    };

    const handleBoardScroll = () => {
        if (!boardScrollRef.current) return;
        const scrollLeft = boardScrollRef.current.scrollLeft;
        const width = boardScrollRef.current.offsetWidth;
        const index = Math.round(scrollLeft / (width * 0.8));
        const targetCol = COLUMNS[Math.min(index, COLUMNS.length - 1)];
        if (targetCol && targetCol.id !== selectedMobileColumn) {
            setSelectedMobileColumn(targetCol.id);
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
            {/* Quick Switch Tab Bar on Mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 md:hidden scrollbar-none px-1 shrink-0">
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
                                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                    : "bg-card/90 text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                            )}
                        >
                            <span className={cn("w-2 h-2 rounded-full", col.dotColor)} />
                            <span>{col.title}</span>
                            <span
                                className={cn(
                                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                                    isSelected ? "bg-primary-foreground/20 text-primary-foreground font-bold" : "bg-muted text-foreground"
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
                className="w-full flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2 scrollbar-none snap-x snap-mandatory md:snap-none"
            >
                <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch w-full min-w-0 md:min-w-[950px] lg:min-w-full h-full">
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
}: {
    column: {
        id: "to_do" | "in_progress" | "in_review" | "done";
        title: string;
        dotColor: string;
        badgeColor: string;
        subtitle: string;
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
                "bg-card/75 border border-border rounded-2xl p-3.5 sm:p-4 flex flex-col h-full min-h-[460px] transition-all shadow-xs",
                "w-[84vw] max-w-[320px] min-w-[270px] shrink-0 snap-center md:w-auto md:max-w-none md:min-w-0 md:shrink"
            )}
        >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 shadow-sm", column.dotColor)} />
                    <h3 className="font-bold text-foreground text-sm tracking-tight">
                        {column.title}
                    </h3>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-mono font-semibold border", column.badgeColor)}>
                        {tasks.length}
                    </span>
                </div>
            </div>

            {/* Cards List */}
            <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-21rem)] sm:max-h-[calc(100vh-17rem)] pr-1 scrollbar-thin">
                {tasks.length === 0 ? (
                    <div className="h-24 rounded-xl border-2 border-dashed border-border/70 flex items-center justify-center text-xs text-muted-foreground font-medium text-center px-4">
                        No tasks in {column.title.toLowerCase()}
                    </div>
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
                        />
                    ))
                )}
            </div>
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
    onRequestChanges,
    onDeleteTask,
    onClickTask,
    isViewOnly,
}: {
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

    // Permission checks
    const isAssignedToUser = currentUserId ? task.assignees?.some((a) => a.user.id === currentUserId) : false;
    const isDeveloper = currentUserRole === "developer";
    const isManager = currentUserRole === "manager";

    return (
        <div
            onClick={() => onClickTask?.(task)}
            className={cn(
                "group relative flex flex-col w-full min-w-0 overflow-hidden rounded-xl border shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 gap-2.5",
                isChangesRequested
                    ? "bg-rose-500/[0.06] border-rose-500/50 hover:border-rose-500/80 shadow-rose-950/10"
                    : "bg-card border-border hover:border-primary/40 text-foreground"
            )}
        >
            {/* Header: Title, Tags & Delete Button */}
            <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    {/* Status & Carried Over Badge Tags */}
                    {(isChangesRequested || isCarriedOver) && (
                        <div className="flex flex-wrap items-center gap-1">
                            {isChangesRequested && (
                                <Badge
                                    variant="destructive"
                                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-rose-500 text-white shrink-0 whitespace-nowrap"
                                >
                                    Changes Requested
                                </Badge>
                            )}
                            {isCarriedOver && (
                                <Badge
                                    variant="secondary"
                                    className="text-[10px] font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 shrink-0 whitespace-nowrap"
                                >
                                    Carried over
                                </Badge>
                            )}
                        </div>
                    )}

                    <h4
                        className={cn(
                            "font-semibold text-sm leading-snug break-words line-clamp-2",
                            isChangesRequested ? "text-rose-700 dark:text-rose-300" : "text-foreground"
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
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Description */}
            {task.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {task.description}
                </p>
            )}

            {/* Review Note Callout if Changes Requested */}
            {isChangesRequested && task.reviewNote && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-800 dark:text-rose-300 line-clamp-2">
                    <span className="font-semibold">Note: </span>
                    {task.reviewNote}
                </div>
            )}

            {/* Metadata Footer */}
            <div className="flex flex-wrap gap-1.5 items-center justify-between pt-1 border-t border-border/40 text-xs">
                {/* Left side: Assignees & Due Date */}
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {/* Assignee Avatar Stack */}
                    {task.assignees && task.assignees.length > 0 ? (
                        <div className="flex items-center -space-x-1.5 shrink-0">
                            {task.assignees.slice(0, 3).map((a) => (
                                <Avatar key={a.user.id} className="w-5 h-5 border-2 border-background ring-1 ring-border shrink-0">
                                    <AvatarImage src={a.user.image || ""} />
                                    <AvatarFallback className="text-[9px] font-bold">
                                        {(a.user.name || a.user.email || "U")[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {task.assignees.length > 3 && (
                                <span className="text-[10px] text-muted-foreground pl-1 font-mono">
                                    +{task.assignees.length - 3}
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-[10px] text-muted-foreground italic shrink-0">Unassigned</span>
                    )}

                    {/* Due Date */}
                    {task.dueDate && (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 text-[11px] whitespace-nowrap shrink-0",
                                isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                            )}
                        >
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{format(new Date(task.dueDate), "MMM d")}</span>
                        </span>
                    )}

                    {/* Prerequisite Indicator */}
                    {isLocked && (
                        <span
                            className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap shrink-0"
                            title={`Prerequisite task "${prerequisiteTask?.title}" must be completed first`}
                        >
                            <Lock className="w-3 h-3" />
                            <span>Blocked</span>
                        </span>
                    )}
                </div>

                {/* Right side: Weight */}
                {task.weight != null && (
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap shrink-0">
                        {task.weight} pts
                    </span>
                )}
            </div>

            {/* Quick Action Buttons (Role and state specific) */}
            {!isViewOnly && (
                <div className="pt-1 flex items-center justify-end gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {/* 1. Developer Start Task */}
                    {normStatus === "to_do" && isDeveloper && isAssignedToUser && onStartTask && (
                        <Button
                            size="sm"
                            variant="default"
                            disabled={isLocked}
                            className="h-7 text-xs font-semibold gap-1 px-2.5 rounded-lg shadow-xs"
                            onClick={() => onStartTask(task.id)}
                        >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Start</span>
                        </Button>
                    )}

                    {/* 2. Developer Submit Work */}
                    {(normStatus === "in_progress" || normStatus === "changes_requested") &&
                        isDeveloper &&
                        isAssignedToUser &&
                        onSubmitTask && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-semibold gap-1 px-2.5 rounded-lg border-blue-500/30 text-blue-600 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 shadow-xs"
                                onClick={() => onSubmitTask(task)}
                            >
                                <Send className="w-3 h-3" />
                                <span>Submit</span>
                            </Button>
                        )}

                    {/* 3. PM Review Actions: Approve or Request Changes */}
                    {normStatus === "in_review" && isManager && (
                        <div className="flex items-center gap-1.5">
                            {onRequestChanges && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-semibold gap-1 px-2 rounded-lg text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 shadow-xs"
                                    onClick={() => onRequestChanges(task)}
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Changes</span>
                                </Button>
                            )}
                            {onApproveTask && (
                                <Button
                                    size="sm"
                                    className="h-7 text-xs font-semibold gap-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                    onClick={() => onApproveTask(task.id)}
                                >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Approve</span>
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
