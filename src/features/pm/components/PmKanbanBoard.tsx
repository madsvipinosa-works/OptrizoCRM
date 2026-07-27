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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import {
    GripVertical,
    Clock,
    Lock,
    ShieldCheck,
    Edit2,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PmTask {
    id: string;
    milestoneId: string;
    title: string;
    description: string | null;
    status: "Todo" | "In Progress" | "Blocked" | "In Review" | "Done";
    requiresProof?: boolean;
    proofUrl?: string | null;
    proofNotes?: string | null;
    assignees: { user: { id: string; name: string | null; image?: string | null; jobTitle?: string | null } }[];
    dueDate: Date | null;
    dependsOnTaskId: string | null;
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
    onStatusChangeRequest: (taskId: string, targetStatus: "Todo" | "In Progress" | "Blocked" | "In Review" | "Done") => void;
    onEditTask: (task: PmTask) => void;
    onDeleteTask: (task: PmTask) => void;
}

const COLUMNS: { id: PmTask["status"]; title: string; color: string }[] = [
    { id: "Todo", title: "To Do", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
    { id: "In Progress", title: "In Progress", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    { id: "Blocked", title: "Blocked", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
    { id: "In Review", title: "In Review", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    { id: "Done", title: "Done", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

export function PmKanbanBoard({
    tasks,
    teamMembers,
    currentUserId,
    currentUserRole,
    onStatusChangeRequest,
    onEditTask,
    onDeleteTask,
}: PmKanbanBoardProps) {
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    // Optimistic UI updates
    const [optimisticTasks, setOptimisticTasks] = useOptimistic(
        tasks,
        (currentTasks, update: { taskId: string; newStatus: PmTask["status"]; proofUrl?: string; proofNotes?: string }) => {
            return currentTasks.map((t) =>
                t.id === update.taskId
                    ? {
                          ...t,
                          status: update.newStatus,
                          proofUrl: update.proofUrl !== undefined ? update.proofUrl : t.proofUrl,
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
            if (targetTask) targetStatus = targetTask.status;
        }

        if (targetStatus && targetStatus !== draggedTask.status) {
            onStatusChangeRequest(draggedTaskId, targetStatus);
        }
    };

    return (
        <DndContext id="pm-kanban-dnd-context" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
                {COLUMNS.map((col) => {
                    const columnTasks = optimisticTasks.filter((t) => t.status === col.id);
                    return (
                        <PmKanbanColumn
                            key={col.id}
                            column={col}
                            tasks={columnTasks}
                            allTasks={optimisticTasks}
                            currentUserRole={currentUserRole}
                            onEditTask={onEditTask}
                            onDeleteTask={onDeleteTask}
                        />
                    );
                })}
            </div>

            <DragOverlay>
                {activeTask ? (
                    <div className="opacity-95 rotate-1 scale-105 transition-transform shadow-2xl">
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
    onEditTask,
    onDeleteTask,
}: {
    column: { id: PmTask["status"]; title: string; color: string };
    tasks: PmTask[];
    allTasks: PmTask[];
    currentUserRole?: string;
    onEditTask: (task: PmTask) => void;
    onDeleteTask: (task: PmTask) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col rounded-xl bg-zinc-950/70 border border-zinc-800/80 p-3 min-h-[500px] transition-colors",
                isOver && "border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/20"
            )}
        >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 mb-3">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5 border", column.color)}>
                        {column.title}
                    </Badge>
                    <span className="text-xs text-zinc-400 font-mono font-medium">{tasks.length}</span>
                </div>
            </div>

            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5 flex-1">
                    {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-zinc-800/60 rounded-lg text-zinc-600 text-xs font-medium">
                            <span>No tasks</span>
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <SortableTaskCard
                                key={task.id}
                                task={task}
                                allTasks={allTasks}
                                currentUserRole={currentUserRole}
                                onEditTask={onEditTask}
                                onDeleteTask={onDeleteTask}
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
    onEditTask,
    onDeleteTask,
}: {
    task: PmTask;
    allTasks: PmTask[];
    currentUserRole?: string;
    onEditTask: (task: PmTask) => void;
    onDeleteTask: (task: PmTask) => void;
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
                className="h-28 rounded-lg border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 opacity-50"
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
                onEditTask={() => onEditTask(task)}
                onDeleteTask={() => onDeleteTask(task)}
            />
        </div>
    );
}

function TaskCardContent({
    task,
    allTasks,
    currentUserRole,
    dragHandleProps,
    onEditTask,
    onDeleteTask,
}: {
    task: PmTask;
    allTasks: PmTask[];
    currentUserRole?: string;
    dragHandleProps?: Record<string, unknown>;
    onEditTask?: () => void;
    onDeleteTask?: () => void;
}) {
    const isLocked = (() => {
        if (!task.dependsOnTaskId) return false;
        const parent = allTasks.find((t) => t.id === task.dependsOnTaskId);
        return parent ? parent.status !== "Done" : false;
    })();

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done";

    return (
        <div className="group relative flex flex-col p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 shadow-md transition-all">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <button
                        {...dragHandleProps}
                        className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 transition-colors p-0.5"
                    >
                        <GripVertical className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-semibold text-xs text-zinc-100 truncate leading-snug">
                        {task.title}
                    </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {onEditTask && (
                        <button
                            onClick={onEditTask}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Edit task"
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                    )}
                    {currentUserRole === "admin" && onDeleteTask && (
                        <button
                            onClick={onDeleteTask}
                            className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Delete task"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {task.description && (
                <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {task.description}
                </p>
            )}

            <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-zinc-800/60 text-[10px]">
                {/* Due Date & Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {task.dueDate && (
                        <div
                            className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]",
                                isOverdue
                                    ? "bg-rose-500/10 text-rose-300 border-rose-500/30 font-semibold"
                                    : "bg-zinc-800/80 text-zinc-400 border-zinc-700/50"
                            )}
                        >
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(task.dueDate), "MMM d")}</span>
                        </div>
                    )}

                    {isLocked && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Lock className="w-3 h-3" />
                            <span>Locked</span>
                        </div>
                    )}

                    {task.proofUrl && (
                        <a
                            href={task.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:underline"
                            title={task.proofNotes || "View Proof"}
                        >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Proof</span>
                        </a>
                    )}
                </div>

                {/* Assignees Avatars */}
                <div className="flex -space-x-1 overflow-hidden shrink-0">
                    {task.assignees?.map((a) => (
                        <Avatar key={a.user.id} className="w-5 h-5 border border-zinc-900 ring-1 ring-zinc-800">
                            {a.user.image && <AvatarImage src={a.user.image} alt={a.user.name || "User"} />}
                            <AvatarFallback className="text-[8px] bg-indigo-600 text-white font-semibold">
                                {a.user.name ? a.user.name.substring(0, 2).toUpperCase() : "U"}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                </div>
            </div>
        </div>
    );
}
