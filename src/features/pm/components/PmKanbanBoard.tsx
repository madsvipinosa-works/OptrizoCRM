"use client";

import React, { useState, useOptimistic } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import {
    GripVertical,
    Calendar,
    Lock,
    ShieldCheck,
    Trash2,
    AlertTriangle,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PmTask {
    id: string;
    milestoneId: string;
    title: string;
    description: string | null;
    status: "Todo" | "In Progress" | "Blocked" | "Changes Requested" | "In Review" | "Done";
    requiresProof?: boolean;
    proofLinks?: { label: string; url: string }[] | null;
    proofNotes?: string | null;
    blockedReason?: string | null;
    isBlockedByClient?: boolean;
    assignees: { user: { id: string; name: string | null; image?: string | null; jobTitle?: string | null; role?: string | null } }[];
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
    onStatusChangeRequest: (taskId: string, targetStatus: "Todo" | "In Progress" | "Blocked" | "Changes Requested" | "In Review" | "Done") => void;
    onDeleteTask: (task: PmTask) => void;
    onViewProofs?: (task: PmTask, initialTab?: "proofs" | "audit") => void;
    onClickTask?: (task: PmTask) => void;
}

// 5 Columns with high-contrast, cohesive theme palette
// "Changes Requested" tasks live inside the "In Progress" column with an orange label & exclamation
const COLUMNS: {
    id: "Todo" | "In Progress" | "Blocked" | "In Review" | "Done";
    title: string;
    dotColor: string;
    badgeColor: string;
}[] = [
    { id: "Todo", title: "To Do", dotColor: "bg-muted-foreground", badgeColor: "bg-muted text-foreground border-border" },
    { id: "In Progress", title: "In Progress", dotColor: "bg-blue-500", badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30" },
    { id: "Blocked", title: "Blocked", dotColor: "bg-rose-500", badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30" },
    { id: "In Review", title: "In Review", dotColor: "bg-amber-500", badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
    { id: "Done", title: "Done", dotColor: "bg-emerald-500", badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" },
];

export function PmKanbanBoard({
    tasks,
    teamMembers,
    currentUserId,
    currentUserRole,
    onStatusChangeRequest,
    onDeleteTask,
    onViewProofs,
    onClickTask,
}: PmKanbanBoardProps) {
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    // Optimistic UI updates
    const [optimisticTasks, setOptimisticTasks] = useOptimistic(
        tasks,
        (currentTasks, update: { taskId: string; newStatus: PmTask["status"]; proofLinks?: { label: string; url: string }[]; proofNotes?: string }) => {
            return currentTasks.map((t) =>
                t.id === update.taskId
                    ? {
                          ...t,
                          status: update.newStatus,
                          proofLinks: update.proofLinks !== undefined ? update.proofLinks : t.proofLinks,
                          proofNotes: update.proofNotes !== undefined ? update.proofNotes : t.proofNotes,
                      }
                    : t
            );
        }
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor)
    );

    const activeTask = optimisticTasks.find((t) => t.id === activeTaskId);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveTaskId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTaskId(null);

        if (!over) return;

        const draggedTaskId = active.id as string;
        const draggedTask = optimisticTasks.find((t) => t.id === draggedTaskId);
        if (!draggedTask) return;

        const overId = over.id as string;
        let targetStatus: PmTask["status"] | null = null;

        if (COLUMNS.some((col) => col.id === overId)) {
            targetStatus = overId as PmTask["status"];
        } else {
            const targetTask = optimisticTasks.find((t) => t.id === overId);
            if (targetTask) {
                targetStatus = targetTask.status === "Changes Requested" ? "In Progress" : targetTask.status;
            }
        }

        if (targetStatus && targetStatus !== draggedTask.status) {
            onStatusChangeRequest(draggedTaskId, targetStatus);
        }
    };

    return (
        <DndContext id="pm-kanban-dnd-context" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="w-full flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2 scrollbar-none">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-stretch min-w-[950px] lg:min-w-full h-full">
                    {COLUMNS.map((col) => {
                        // "In Progress" column houses both "In Progress" and "Changes Requested" tasks
                        const columnTasks = optimisticTasks.filter((t) => {
                            if (col.id === "In Progress") {
                                return t.status === "In Progress" || t.status === "Changes Requested";
                            }
                            return t.status === col.id;
                        });

                        return (
                            <PmKanbanColumn
                                key={col.id}
                                column={col}
                                tasks={columnTasks}
                                allTasks={optimisticTasks}
                                currentUserRole={currentUserRole}
                                onDeleteTask={onDeleteTask}
                                onViewProofs={onViewProofs}
                                onClickTask={onClickTask}
                            />
                        );
                    })}
                </div>
            </div>

            <DragOverlay>
                {activeTask ? (
                    <div className="opacity-95 rotate-1 scale-105 transition-transform shadow-2xl pointer-events-none">
                        <TaskCardContent
                            task={activeTask}
                            allTasks={optimisticTasks}
                            currentUserRole={currentUserRole}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function PmKanbanColumn({
    column,
    tasks,
    allTasks,
    currentUserRole,
    onDeleteTask,
    onViewProofs,
    onClickTask,
}: {
    column: { id: "Todo" | "In Progress" | "Blocked" | "In Review" | "Done"; title: string; dotColor: string; badgeColor: string };
    tasks: PmTask[];
    allTasks: PmTask[];
    currentUserRole?: string;
    onDeleteTask: (task: PmTask) => void;
    onViewProofs?: (task: PmTask, initialTab?: "proofs" | "audit") => void;
    onClickTask?: (task: PmTask) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "bg-card/75 border border-border rounded-2xl p-3.5 sm:p-4 flex flex-col h-full min-h-[460px] transition-all shadow-xs",
                isOver && "border-primary/60 bg-primary/10 ring-1 ring-primary/20"
            )}
        >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3.5 px-1">
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
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-17rem)] pr-1 scrollbar-thin">
                    {tasks.length === 0 ? (
                        <div className="h-24 rounded-xl border-2 border-dashed border-border/70 flex items-center justify-center text-xs text-muted-foreground font-medium">
                            No tasks
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <SortableTaskCard
                                key={task.id}
                                task={task}
                                allTasks={allTasks}
                                currentUserRole={currentUserRole}
                                onDeleteTask={onDeleteTask}
                                onViewProofs={onViewProofs}
                                onClickTask={onClickTask}
                            />
                        ))
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

function SortableTaskCard({
    task,
    allTasks,
    currentUserRole,
    onDeleteTask,
    onViewProofs,
    onClickTask,
}: {
    task: PmTask;
    allTasks: PmTask[];
    currentUserRole?: string;
    onDeleteTask: (task: PmTask) => void;
    onViewProofs?: (task: PmTask, initialTab?: "proofs" | "audit") => void;
    onClickTask?: (task: PmTask) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="h-28 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 opacity-50"
            />
        );
    }

    return (
        <div ref={setNodeRef} style={style}>
            <TaskCardContent
                task={task}
                allTasks={allTasks}
                currentUserRole={currentUserRole}
                dragHandleProps={{ ...attributes, ...listeners }}
                onDeleteTask={() => onDeleteTask(task)}
                onViewProofs={(tab) => onViewProofs?.(task, tab)}
                onClickTask={() => onClickTask?.(task)}
            />
        </div>
    );
}

function TaskCardContent({
    task,
    allTasks,
    currentUserRole,
    dragHandleProps,
    onDeleteTask,
    onViewProofs,
    onClickTask,
}: {
    task: PmTask;
    allTasks: PmTask[];
    currentUserRole?: string;
    dragHandleProps?: Record<string, unknown>;
    onDeleteTask?: () => void;
    onViewProofs?: (initialTab?: "proofs" | "audit") => void;
    onClickTask?: () => void;
}) {
    const isLocked = (() => {
        if (!task.dependsOnTaskId) return false;
        const parent = allTasks.find((t) => t.id === task.dependsOnTaskId);
        return parent ? parent.status !== "Done" : false;
    })();

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done";
    const isChangesRequested = task.status === "Changes Requested";

    return (
        <div
            onClick={onClickTask}
            className={cn(
                "group relative flex flex-col w-full rounded-xl border shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:cursor-pointer p-3.5 gap-2.5",
                isChangesRequested
                    ? "bg-orange-500/[0.08] border-orange-500/50 hover:border-orange-500/80 shadow-orange-950/20"
                    : "bg-card border-border hover:border-primary/40 text-foreground"
            )}
        >
            {/* Header: Grip Handle, Title & Action Menu */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                    <div
                        {...dragHandleProps}
                        className="cursor-grab text-muted-foreground/60 hover:text-foreground p-0.5 shrink-0 mt-0.5 transition-colors"
                    >
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <h4
                        className={cn(
                            "font-semibold text-sm leading-snug break-words",
                            isChangesRequested ? "text-orange-600 dark:text-orange-300" : "text-foreground"
                        )}
                        title={task.title}
                    >
                        {task.title}
                    </h4>
                </div>

                {/* Delete Button for Admins/Managers */}
                {["superadmin", "manager"].includes(currentUserRole || "") && onDeleteTask && (
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask();
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-500 transition-colors"
                            title="Delete task"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Description */}
            {task.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pl-5">
                    {task.description}
                </p>
            )}

            {/* Badges / Status Indicators */}
            <div className="flex flex-wrap gap-1.5 items-center pl-5">
                {/* Effort Weight Badge */}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary/10 text-foreground dark:text-primary border border-primary/25">
                    {task.weight ?? 1} pts
                </span>

                {/* Estimated Hours & Capacity Guardrail Badge */}
                {task.estimatedHours != null && task.estimatedHours > 0 && (
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium border transition-colors",
                            task.estimatedHours > 40
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                                : task.estimatedHours > 30
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                                : "bg-muted text-muted-foreground border-border"
                        )}
                        title={
                            task.estimatedHours > 40
                                ? `Over Capacity Warning: ${task.estimatedHours}h exceeds standard 40h weekly developer limit (+${task.estimatedHours - 40}h)`
                                : `Estimated effort: ${task.estimatedHours}h`
                        }
                    >
                        {task.estimatedHours > 40 ? (
                            <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                        ) : (
                            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                        <span>{task.estimatedHours}h</span>
                        {task.estimatedHours > 40 && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold text-rose-500">Over</span>
                        )}
                    </span>
                )}

                {/* Changes Requested Badge with Exclamation Icon */}
                {isChangesRequested && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onViewProofs) onViewProofs("audit");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-300 border border-orange-500/40 hover:bg-orange-500/25 transition-colors cursor-pointer"
                        title="View AI quality audit review & feedback"
                    >
                        <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />
                        <span>Changes Requested</span>
                    </button>
                )}

                {/* Locked Badge */}
                {isLocked && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                        <Lock className="w-3 h-3 text-amber-500" />
                        <span>Locked</span>
                    </span>
                )}

                {/* Proof / Quality Gate Badge */}
                {(task.status === "In Review" || task.status === "Done" || (task.proofLinks && task.proofLinks.length > 0) || task.proofNotes) && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onViewProofs) {
                                onViewProofs(task.status === "In Review" ? "audit" : "proofs");
                            }
                        }}
                        className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer",
                            task.status === "In Review"
                                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/25"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/25"
                        )}
                        title="View quality audit & proofs"
                    >
                        <ShieldCheck className="w-3 h-3 shrink-0" />
                        <span>
                            {task.status === "In Review"
                                ? "AI Audit: Passed"
                                : task.proofLinks && task.proofLinks.length > 0
                                ? `Proofs (${task.proofLinks.length})`
                                : "Proof"}
                        </span>
                    </button>
                )}
            </div>

            {/* Blocked Reason */}
            {task.status === "Blocked" && task.blockedReason && (
                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs leading-tight ml-5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />
                    <span className="line-clamp-2" title={task.blockedReason}>
                        <span className="font-semibold text-rose-500">Blocked:</span> {task.blockedReason}
                    </span>
                </div>
            )}

            {/* Footer: Due Date & Assignees */}
            <div className="flex items-center justify-between pt-2 border-t border-border mt-1 pl-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {task.dueDate && (
                        <div
                            className={cn(
                                "flex items-center gap-1 text-[11px]",
                                isOverdue ? "text-rose-500 font-semibold" : "text-muted-foreground"
                            )}
                        >
                            <Calendar className={cn("w-3.5 h-3.5", isOverdue ? "text-rose-500" : "text-muted-foreground")} />
                            <span>{format(new Date(task.dueDate), "MMM d")}</span>
                        </div>
                    )}
                </div>

                {/* Overlapping Avatars */}
                {task.assignees && task.assignees.length > 0 && (
                    <div className="flex items-center -space-x-2 shrink-0 ml-auto">
                        {task.assignees.map((a) => (
                            <Avatar key={a.user.id} className="w-6 h-6 border-2 border-card ring-1 ring-border">
                                {a.user.image && <AvatarImage src={a.user.image} alt={a.user.name || "User"} />}
                                <AvatarFallback className="text-[9px] bg-primary text-black font-bold">
                                    {a.user.name ? a.user.name.substring(0, 2).toUpperCase() : "U"}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
