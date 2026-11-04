"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { excludeBacklogTasks } from "@/features/sprints/task-filters";

export interface MyTaskItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    reviewNote?: string | null;
    dueDate: Date | string | null;
    projectId: string;
    projectTitle: string;
    milestoneId: string;
    milestoneTitle: string;
}

const MILESTONE_TITLES: Record<string, string> = {
    requirements: "Requirements",
    design: "Design",
    development: "Development",
    uat_testing: "UAT and testing",
    handover: "Handover",
};

function formatMilestoneName(name: string): string {
    const key = name.toLowerCase().replace(/\s+/g, "_");
    return MILESTONE_TITLES[key] || name;
}

function normalizeStatus(status: string): "to_do" | "in_progress" | "changes_requested" | "in_review" | "done" {
    if (status === "to_do" || status === "Todo") return "to_do";
    if (status === "in_progress" || status === "In Progress") return "in_progress";
    if (status === "changes_requested" || status === "Changes Requested") return "changes_requested";
    if (status === "in_review" || status === "In Review") return "in_review";
    if (status === "done" || status === "Done") return "done";
    return "to_do";
}

const STATUS_DISPLAY: Record<
    string,
    { label: string; badgeClass: string; dotClass: string }
> = {
    to_do: {
        label: "To do",
        badgeClass: "bg-muted text-foreground border-border",
        dotClass: "bg-muted-foreground",
    },
    in_progress: {
        label: "In progress",
        badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
        dotClass: "bg-blue-500",
    },
    changes_requested: {
        label: "Changes requested",
        badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        dotClass: "bg-rose-500",
    },
    in_review: {
        label: "In review",
        badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
        dotClass: "bg-amber-500",
    },
    done: {
        label: "Done",
        badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
        dotClass: "bg-emerald-500",
    },
};

export function MyTasksList({ tasks }: { tasks: MyTaskItem[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [projectFilter, setProjectFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [hideDone, setHideDone] = useState(false);

    // Exclude backlog tasks from developer list (Decision D12)
    const visibleTasks = useMemo(() => excludeBacklogTasks(tasks), [tasks]);

    // Collect unique projects for dropdown
    const uniqueProjects = useMemo(() => {
        const map = new Map<string, string>();
        visibleTasks.forEach((t) => {
            if (!map.has(t.projectId)) {
                map.set(t.projectId, t.projectTitle);
            }
        });
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [visibleTasks]);

    // Check for urgent banner items (changes requested or new to-do)
    const alertTask = useMemo(() => {
        return (
            visibleTasks.find((t) => normalizeStatus(t.status) === "changes_requested") ||
            visibleTasks.find((t) => normalizeStatus(t.status) === "to_do")
        );
    }, [visibleTasks]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return visibleTasks.filter((t) => {
            const norm = normalizeStatus(t.status);

            // Search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = t.title.toLowerCase().includes(q);
                const matchDesc = t.description?.toLowerCase().includes(q);
                const matchProject = t.projectTitle.toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchProject) return false;
            }

            // Project filter
            if (projectFilter !== "all" && t.projectId !== projectFilter) {
                return false;
            }

            // Status filter
            if (statusFilter !== "all") {
                if (statusFilter === "in_progress") {
                    if (norm !== "in_progress" && norm !== "changes_requested") return false;
                } else if (norm !== statusFilter) {
                    return false;
                }
            }

            // Hide done
            if (hideDone && norm === "done") {
                return false;
            }

            return true;
        });
    }, [visibleTasks, searchQuery, projectFilter, statusFilter, hideDone]);

    return (
        <div className="space-y-4 w-full">
            {/* Context Alert Banner (Mockup 094) */}
            {alertTask && (
                <div
                    className={cn(
                        "rounded-xl p-3.5 sm:p-4 text-sm flex items-center justify-between gap-3 border shadow-xs",
                        normalizeStatus(alertTask.status) === "changes_requested"
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
                            : "bg-primary/10 border-primary/25 text-foreground"
                    )}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        {normalizeStatus(alertTask.status) === "changes_requested" ? (
                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                        ) : (
                            <Clock className="w-5 h-5 text-primary shrink-0" />
                        )}
                        <span className="truncate">
                            <strong>
                                {normalizeStatus(alertTask.status) === "changes_requested"
                                    ? "Changes requested: "
                                    : "Task ready: "}
                            </strong>
                            {alertTask.title} on <em>{alertTask.projectTitle}</em>
                            {alertTask.dueDate ? `, due ${format(new Date(alertTask.dueDate), "MMM d")}` : ""}.
                        </span>
                    </div>
                    <Link
                        href={`/dashboard/pm/${alertTask.projectId}`}
                        className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 shrink-0"
                    >
                        View board &rarr;
                    </Link>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-end gap-3 justify-between">
                <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
                    {/* Search */}
                    <div className="space-y-1.5 flex-1 min-w-[200px] max-w-sm">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Search
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                            <Input
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-xs sm:text-sm bg-card border-border"
                            />
                        </div>
                    </div>

                    {/* Project Filter */}
                    <div className="space-y-1.5 w-[180px] shrink-0">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Project
                        </label>
                        <Select value={projectFilter} onValueChange={setProjectFilter}>
                            <SelectTrigger className="h-9 text-xs sm:text-sm bg-card border-border">
                                <SelectValue placeholder="All projects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All projects</SelectItem>
                                {uniqueProjects.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-1.5 w-[150px] shrink-0">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Status
                        </label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 text-xs sm:text-sm bg-card border-border">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="to_do">To do</SelectItem>
                                <SelectItem value="in_progress">In progress</SelectItem>
                                <SelectItem value="in_review">In review</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Hide Done Checkbox */}
                    <label className="flex items-center gap-2 h-9 text-xs sm:text-sm cursor-pointer select-none text-muted-foreground hover:text-foreground">
                        <input
                            type="checkbox"
                            checked={hideDone}
                            onChange={(e) => setHideDone(e.target.checked)}
                            className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <span>Hide done</span>
                    </label>
                </div>

                <div className="text-xs text-muted-foreground h-9 flex items-center shrink-0">
                    Showing {filteredTasks.length} of {visibleTasks.length} tasks
                </div>
            </div>

            {/* Tasks List Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-3 p-3.5 px-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
                    <span className="col-span-4">Task</span>
                    <span className="col-span-3">Project name</span>
                    <span className="col-span-2">Milestone</span>
                    <span className="col-span-1">Due</span>
                    <span className="col-span-2 text-right">Status</span>
                </div>

                {/* Table Body */}
                {filteredTasks.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                        {visibleTasks.length === 0
                            ? "You have no tasks assigned across active projects."
                            : "No tasks match your filters."}
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filteredTasks.map((t) => {
                            const norm = normalizeStatus(t.status);
                            const isDone = norm === "done";
                            const isChangesRequested = norm === "changes_requested";
                            const isToDo = norm === "to_do";

                            return (
                                <Link
                                    key={t.id}
                                    href={`/dashboard/pm/${t.projectId}`}
                                    className={cn(
                                        "block hover:bg-muted/40 transition-colors p-3.5 sm:px-5 group",
                                        isDone && "opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                                        {/* Task Title & Badges */}
                                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                                            <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                                {t.title}
                                            </span>
                                            {isChangesRequested && (
                                                <Badge
                                                    variant="destructive"
                                                    className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 bg-rose-500 text-white shrink-0 whitespace-nowrap"
                                                >
                                                    Changes requested
                                                </Badge>
                                            )}
                                            {isToDo && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0 bg-primary/15 text-primary border-primary/30 shrink-0 whitespace-nowrap"
                                                >
                                                    New
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Project Title */}
                                        <div className="col-span-3 text-xs sm:text-sm text-muted-foreground truncate">
                                            {t.projectTitle}
                                        </div>

                                        {/* Milestone */}
                                        <div className="col-span-2 text-xs sm:text-sm text-muted-foreground truncate">
                                            {formatMilestoneName(t.milestoneTitle)}
                                        </div>

                                        {/* Due Date */}
                                        <div className="col-span-1 text-xs text-muted-foreground whitespace-nowrap">
                                            {t.dueDate ? format(new Date(t.dueDate), "MMM d") : "—"}
                                        </div>

                                        {/* Status & Arrow */}
                                        <div className="col-span-2 flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                            <span
                                                className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap",
                                                    STATUS_DISPLAY[norm]?.badgeClass
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        STATUS_DISPLAY[norm]?.dotClass
                                                    )}
                                                />
                                                {STATUS_DISPLAY[norm]?.label || t.status}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
