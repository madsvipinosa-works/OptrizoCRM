"use client";

import React, { useState, useEffect } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
    Calendar,
    Clock,
    AlertTriangle,
    ShieldCheck,
    FileText,
    ExternalLink,
    Pencil,
    Trash2,
    Users,
    Copy,
    Check,
    Lock,
    ArrowRight,
    Sparkles,
    RotateCcw,
    X,
    ChevronDown,
    AlertOctagon,
    CheckCircle2,
    Layers,
    MoreVertical,
    CalendarDays,
    Hash,
    Loader2,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PmTask } from "./PmKanbanBoard";
import { AssigneeCombobox, type TeamMemberItem } from "./AssigneeCombobox";
import { AIAuditCard, type CriteriaItem } from "@/components/tasks/ai-audit-card";
import { getTaskAuditReport } from "@/features/pm/actions";

interface TaskDetailsDrawerProps {
    task: PmTask | null;
    isOpen: boolean;
    onClose: () => void;
    teamMembers: TeamMemberItem[];
    milestones: { id: string; title: string; order: number; status: string }[];
    allTasks: PmTask[];
    currentUserId?: string;
    currentUserRole?: string;
    onStatusChangeRequest: (taskId: string, targetStatus: PmTask["status"]) => void;
    onUpdateTaskDetails: (
        taskId: string,
        data: {
            title?: string;
            description?: string;
            assigneeIds?: string[];
            dueDate?: Date | null;
            weight?: number;
            estimatedHours?: number | null;
        }
    ) => Promise<boolean>;
    onDeleteTask?: (task: PmTask) => void;
    onRequestVerificationReview?: (task: PmTask) => void;
    onRequestBlock?: (task: PmTask) => void;
    onSelectTask?: (task: PmTask) => void;
}

const STATUS_CONFIG: Record<
    PmTask["status"],
    { label: string; badgeClass: string; dotClass: string }
> = {
    Todo: {
        label: "To Do",
        badgeClass: "bg-muted text-foreground border-border",
        dotClass: "bg-muted-foreground",
    },
    "In Progress": {
        label: "In Progress",
        badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
        dotClass: "bg-blue-500",
    },
    Blocked: {
        label: "Blocked",
        badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
        dotClass: "bg-rose-500",
    },
    "Changes Requested": {
        label: "Changes Requested",
        badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/40",
        dotClass: "bg-orange-500",
    },
    "In Review": {
        label: "In Review",
        badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
        dotClass: "bg-amber-500",
    },
    Done: {
        label: "Done",
        badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
        dotClass: "bg-emerald-500",
    },
};

export function TaskDetailsDrawer({
    task,
    isOpen,
    onClose,
    teamMembers,
    milestones,
    allTasks,
    currentUserId,
    currentUserRole,
    onStatusChangeRequest,
    onUpdateTaskDetails,
    onDeleteTask,
    onRequestVerificationReview,
    onRequestBlock,
    onSelectTask,
}: TaskDetailsDrawerProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "deliverables" | "activity">("overview");

    // Inline edit states
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState("");

    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [descInput, setDescInput] = useState("");

    const [weightInput, setWeightInput] = useState<number>(1);
    const [hoursInput, setHoursInput] = useState<string>("");
    const [dueDateInput, setDueDateInput] = useState<string>("");
    const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [copiedTaskId, setCopiedTaskId] = useState(false);

    // AI Audit Report state
    const [auditReport, setAuditReport] = useState<any>(null);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);

    // Synchronize local form inputs when task changes
    useEffect(() => {
        if (task) {
            setTitleInput(task.title || "");
            setDescInput(task.description || "");
            setWeightInput(task.weight ?? 1);
            setHoursInput(task.estimatedHours != null ? String(task.estimatedHours) : "");
            setDueDateInput(
                task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
            );
            setSelectedAssigneeIds(task.assignees?.map((a) => a.user.id) || []);
            setIsEditingTitle(false);
            setIsEditingDesc(false);

            // Fetch AI audit report if task has submission history or is In Review/Done
            if (task.id) {
                setIsLoadingAudit(true);
                getTaskAuditReport(task.id)
                    .then((report) => setAuditReport(report))
                    .catch((err) => {
                        console.error("Failed to load task audit report:", err);
                        setAuditReport(null);
                    })
                    .finally(() => setIsLoadingAudit(false));
            }
        }
    }, [task?.id, task]);

    if (!task) return null;

    const currentMilestone = milestones.find((m) => m.id === task.milestoneId);
    const parentTask = task.dependsOnTaskId ? allTasks.find((t) => t.id === task.dependsOnTaskId) : null;
    const isParentIncomplete = parentTask && parentTask.status !== "Done";

    const isOverdue =
        task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done";
    const canManage = ["superadmin", "manager", "developer"].includes(currentUserRole || "");
    const isManagerOrAdmin = ["superadmin", "manager"].includes(currentUserRole || "");

    // Format deadline
    const getDeadlineDisplay = () => {
        if (!task.dueDate) return null;
        const d = new Date(task.dueDate);
        if (isPast(d) && task.status !== "Done") {
            const daysAgo = Math.abs(differenceInDays(new Date(), d));
            return {
                text: daysAgo === 0 ? "Overdue today" : `Overdue by ${daysAgo}d`,
                isOverdue: true,
            };
        }
        if (isToday(d)) return { text: "Due today", isOverdue: false };
        if (isTomorrow(d)) return { text: "Due tomorrow", isOverdue: false };
        const daysLeft = differenceInDays(d, new Date());
        return {
            text: `Due in ${daysLeft}d (${format(d, "MMM d")})`,
            isOverdue: false,
        };
    };

    const deadlineInfo = getDeadlineDisplay();

    // Handlers
    const handleSaveTitle = async () => {
        if (!titleInput.trim() || titleInput === task.title) {
            setIsEditingTitle(false);
            setTitleInput(task.title);
            return;
        }
        setIsSaving(true);
        const success = await onUpdateTaskDetails(task.id, { title: titleInput.trim() });
        setIsSaving(false);
        if (success) {
            setIsEditingTitle(false);
        }
    };

    const handleSaveDescription = async () => {
        setIsSaving(true);
        const success = await onUpdateTaskDetails(task.id, { description: descInput.trim() });
        setIsSaving(false);
        if (success) {
            setIsEditingDesc(false);
        }
    };

    const handleAssigneesChange = async (newIds: string[]) => {
        setSelectedAssigneeIds(newIds);
        await onUpdateTaskDetails(task.id, { assigneeIds: newIds });
    };

    const handleDueDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDueDateInput(val);
        const dateObj = val ? new Date(val) : null;
        await onUpdateTaskDetails(task.id, { dueDate: dateObj });
    };

    const handleWeightChange = async (newWeight: number) => {
        setWeightInput(newWeight);
        await onUpdateTaskDetails(task.id, { weight: newWeight });
    };

    const handleHoursChange = async (val: string) => {
        setHoursInput(val);
        const parsed = val ? parseInt(val, 10) : null;
        await onUpdateTaskDetails(task.id, { estimatedHours: isNaN(parsed || 0) ? null : parsed });
    };

    const handleCopyTaskId = () => {
        navigator.clipboard.writeText(task.id);
        setCopiedTaskId(true);
        toast.success("Task ID copied to clipboard");
        setTimeout(() => setCopiedTaskId(false), 2000);
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl bg-card border-border text-foreground p-0 flex flex-col h-full shadow-2xl overflow-hidden focus:outline-none"
            >
                {/* 1. Header Section */}
                <SheetHeader className="p-5 sm:p-6 pb-4 border-b border-border bg-muted/20 backdrop-blur-md space-y-3 shrink-0">
                    {/* Top Row: Milestone & Metadata Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            {currentMilestone && (
                                <Badge
                                    variant="outline"
                                    className="bg-primary/10 text-primary border-primary/25 text-xs font-semibold flex items-center gap-1 px-2.5 py-0.5"
                                >
                                    <Layers className="w-3 h-3" />
                                    <span>
                                        M{currentMilestone.order}: {currentMilestone.title}
                                    </span>
                                </Badge>
                            )}

                            {/* Effort Weight */}
                            <Badge
                                variant="outline"
                                className="bg-muted text-foreground border-border text-xs font-mono font-bold"
                            >
                                {task.weight ?? 1} pts
                            </Badge>

                            {/* Hours with Guardrail */}
                            {task.estimatedHours != null && task.estimatedHours > 0 && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-xs font-mono font-medium flex items-center gap-1",
                                        task.estimatedHours > 40
                                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold"
                                            : "bg-muted text-muted-foreground border-border"
                                    )}
                                >
                                    <Clock className="w-3 h-3" />
                                    <span>{task.estimatedHours}h</span>
                                    {task.estimatedHours > 40 && (
                                        <span className="text-[9px] uppercase tracking-wider font-bold text-rose-500 ml-0.5">
                                            Over
                                        </span>
                                    )}
                                </Badge>
                            )}

                            {/* Due date badge */}
                            {deadlineInfo && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-xs font-medium flex items-center gap-1",
                                        deadlineInfo.isOverdue
                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold"
                                            : "bg-muted text-muted-foreground border-border"
                                    )}
                                >
                                    <Calendar className="w-3 h-3" />
                                    <span>{deadlineInfo.text}</span>
                                </Badge>
                            )}
                        </div>

                        {/* More Menu */}
                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border text-foreground w-48">
                                    <DropdownMenuItem onClick={handleCopyTaskId} className="gap-2 cursor-pointer">
                                        {copiedTaskId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                        <span>Copy Task ID</span>
                                    </DropdownMenuItem>
                                    {onDeleteTask && isManagerOrAdmin && (
                                        <>
                                            <DropdownMenuSeparator className="bg-border" />
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    onClose();
                                                    onDeleteTask(task);
                                                }}
                                                className="gap-2 text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span>Delete Task</span>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Task Title (Inline Editable) */}
                    <div className="pt-1">
                        {isEditingTitle && canManage ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    className="text-lg font-bold bg-background border-border focus:border-primary text-foreground"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveTitle();
                                        if (e.key === "Escape") {
                                            setIsEditingTitle(false);
                                            setTitleInput(task.title);
                                        }
                                    }}
                                />
                                <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-black font-semibold shrink-0"
                                    onClick={handleSaveTitle}
                                    disabled={isSaving}
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() => {
                                        setIsEditingTitle(false);
                                        setTitleInput(task.title);
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="group flex items-start gap-2">
                                <SheetTitle
                                    className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug break-words flex-1 cursor-pointer"
                                    onClick={() => canManage && setIsEditingTitle(true)}
                                    title={canManage ? "Click to edit title" : undefined}
                                >
                                    {task.title}
                                </SheetTitle>
                                {canManage && (
                                    <button
                                        onClick={() => setIsEditingTitle(true)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                                        title="Edit title"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                        <SheetDescription className="sr-only">Task details for {task.title}</SheetDescription>
                    </div>

                    {/* 2. Interactive Action Bar: Live Status Dropdown & Contextual Action Buttons */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60">
                        {/* Status Dropdown */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
                            <Select
                                value={task.status}
                                onValueChange={(val) => {
                                    if (val !== task.status) {
                                        onStatusChangeRequest(task.id, val as PmTask["status"]);
                                    }
                                }}
                                disabled={!canManage}
                            >
                                <SelectTrigger
                                    className={cn(
                                        "h-8 text-xs font-semibold px-2.5 rounded-lg border gap-2 shadow-xs transition-colors",
                                        STATUS_CONFIG[task.status]?.badgeClass
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_CONFIG[task.status]?.dotClass)} />
                                        <SelectValue>{STATUS_CONFIG[task.status]?.label}</SelectValue>
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    {(Object.keys(STATUS_CONFIG) as PmTask["status"][]).map((st) => (
                                        <SelectItem key={st} value={st} className="text-xs cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[st].dotClass)} />
                                                <span>{STATUS_CONFIG[st].label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Quick Contextual Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Submit for Review Button */}
                            {["Todo", "In Progress", "Changes Requested"].includes(task.status) && onRequestVerificationReview && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs font-semibold gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30"
                                    onClick={() => onRequestVerificationReview(task)}
                                >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Submit for Review</span>
                                </Button>
                            )}

                            {/* Approve as Done Button (Managers/Admins) */}
                            {task.status === "In Review" && isManagerOrAdmin && (
                                <Button
                                    size="sm"
                                    className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => onStatusChangeRequest(task.id, "Done")}
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Approve as Done</span>
                                </Button>
                            )}

                            {/* Flag Blocked Button */}
                            {task.status !== "Blocked" && onRequestBlock && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs font-medium gap-1 text-muted-foreground hover:text-rose-500 border-border hover:border-rose-500/30"
                                    onClick={() => onRequestBlock(task)}
                                    title="Mark task as blocked"
                                >
                                    <AlertOctagon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Block</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </SheetHeader>

                {/* 3. Tabbed Content Body */}
                <Tabs
                    value={activeTab}
                    onValueChange={(val) => setActiveTab(val as any)}
                    className="flex-1 flex flex-col min-h-0 overflow-hidden"
                >
                    <div className="px-6 pt-3 border-b border-border bg-card shrink-0">
                        <TabsList className="grid grid-cols-3 w-full sm:w-[380px] bg-muted/50 p-1">
                            <TabsTrigger value="overview" className="text-xs font-semibold">
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="deliverables" className="text-xs font-semibold flex items-center gap-1.5">
                                <span>Deliverables</span>
                                {auditReport && (
                                    <span
                                        className={cn(
                                            "w-2 h-2 rounded-full",
                                            auditReport.gateStatus === "Passed" ? "bg-emerald-500" : "bg-amber-500"
                                        )}
                                    />
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="activity" className="text-xs font-semibold">
                                Details & Audit
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* TAB 1: OVERVIEW */}
                    <TabsContent value="overview" className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-6 focus:outline-none">
                        {/* Blocker Callout Banner (if Blocked) */}
                        {task.status === "Blocked" && (
                            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        <span>Task is Blocked</span>
                                        {task.isBlockedByClient && (
                                            <Badge variant="outline" className="bg-rose-500/20 text-rose-500 border-rose-500/40 text-[10px] uppercase font-bold">
                                                Client Blocker
                                            </Badge>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs bg-background border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20"
                                        onClick={() => onStatusChangeRequest(task.id, "In Progress")}
                                    >
                                        Unblock
                                    </Button>
                                </div>
                                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-mono whitespace-pre-wrap">
                                    {task.blockedReason || "No specific reason logged. Awaiting dependency or client sign-off."}
                                </p>
                            </div>
                        )}

                        {/* Dependency Banner */}
                        {parentTask && (
                            <div
                                className={cn(
                                    "rounded-xl border p-3.5 space-y-2 text-xs",
                                    isParentIncomplete
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                                        : "bg-muted/40 border-border text-foreground"
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 font-semibold">
                                        <Lock className={cn("w-3.5 h-3.5", isParentIncomplete ? "text-amber-500" : "text-emerald-500")} />
                                        <span>Depends On Parent Task:</span>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={cn("text-[10px]", STATUS_CONFIG[parentTask.status]?.badgeClass)}
                                    >
                                        {parentTask.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-foreground">{parentTask.title}</span>
                                    {onSelectTask && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary/80"
                                            onClick={() => onSelectTask(parentTask)}
                                        >
                                            <span>View</span>
                                            <ArrowRight className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                                {isParentIncomplete && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                        Warning: This task cannot be moved to In Review or Done until &ldquo;{parentTask.title}&rdquo; is completed.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
                            {/* Assignees */}
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Assignees</span>
                                </Label>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 items-center min-h-[32px]">
                                        {task.assignees && task.assignees.length > 0 ? (
                                            task.assignees.map((a) => (
                                                <div
                                                    key={a.user.id}
                                                    className="flex items-center gap-1.5 bg-background border border-border px-2.5 py-1 rounded-full text-xs font-medium shadow-xs"
                                                >
                                                    <Avatar className="w-5 h-5 border border-border">
                                                        {a.user.image && <AvatarImage src={a.user.image} />}
                                                        <AvatarFallback className="text-[9px] bg-primary text-black font-bold">
                                                            {a.user.name?.substring(0, 2).toUpperCase() || "U"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span>{a.user.name}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                        )}
                                    </div>
                                    {canManage && (
                                        <AssigneeCombobox
                                            teamMembers={teamMembers}
                                            selectedIds={selectedAssigneeIds}
                                            onSelectionChange={handleAssigneesChange}
                                            placeholder="+ Add / Remove staff..."
                                            className="w-full text-xs h-8"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Due Date */}
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    <span>Due Date</span>
                                </Label>
                                {canManage ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="date"
                                            value={dueDateInput}
                                            onChange={handleDueDateChange}
                                            className="bg-background border-border text-foreground text-xs h-8"
                                        />
                                        {dueDateInput && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    setDueDateInput("");
                                                    onUpdateTaskDetails(task.id, { dueDate: null });
                                                }}
                                                title="Clear due date"
                                            >
                                                Clear
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-foreground font-medium pt-1">
                                        {task.dueDate ? format(new Date(task.dueDate), "MMMM d, yyyy") : "No due date set"}
                                    </p>
                                )}
                            </div>

                            {/* Effort Weight Points */}
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5" />
                                    <span>Effort Weight</span>
                                </Label>
                                {canManage ? (
                                    <Select
                                        value={String(weightInput)}
                                        onValueChange={(val) => handleWeightChange(parseInt(val, 10))}
                                    >
                                        <SelectTrigger className="bg-background border-border text-foreground text-xs h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground">
                                            <SelectItem value="1">1 pt (Very Minor)</SelectItem>
                                            <SelectItem value="2">2 pts (Minor)</SelectItem>
                                            <SelectItem value="3">3 pts (Standard)</SelectItem>
                                            <SelectItem value="5">5 pts (Major)</SelectItem>
                                            <SelectItem value="8">8 pts (Complex)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="text-xs text-foreground font-medium pt-1">{task.weight ?? 1} pts</p>
                                )}
                            </div>

                            {/* Estimated Hours */}
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Estimated Hours</span>
                                </Label>
                                {canManage ? (
                                    <Input
                                        type="number"
                                        min="0"
                                        max="160"
                                        placeholder="e.g. 12"
                                        value={hoursInput}
                                        onChange={(e) => handleHoursChange(e.target.value)}
                                        className="bg-background border-border text-foreground text-xs h-8"
                                    />
                                ) : (
                                    <p className="text-xs text-foreground font-medium pt-1">
                                        {task.estimatedHours != null ? `${task.estimatedHours} hours` : "Not estimated"}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Description Section */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Task Description & Scope</span>
                                </Label>
                                {canManage && !isEditingDesc && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                        onClick={() => setIsEditingDesc(true)}
                                    >
                                        <Pencil className="w-3 h-3" />
                                        <span>Edit</span>
                                    </Button>
                                )}
                            </div>

                            {isEditingDesc && canManage ? (
                                <div className="space-y-2">
                                    <Textarea
                                        value={descInput}
                                        onChange={(e) => setDescInput(e.target.value)}
                                        rows={5}
                                        placeholder="Add scope details, requirements, acceptance criteria..."
                                        className="bg-background border-border focus:border-primary text-foreground text-xs sm:text-sm leading-relaxed"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-xs text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                setIsEditingDesc(false);
                                                setDescInput(task.description || "");
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs"
                                            onClick={handleSaveDescription}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Scope"}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs sm:text-sm bg-muted/30 p-4 rounded-xl whitespace-pre-wrap border border-border leading-relaxed text-foreground min-h-[80px]">
                                    {task.description ? (
                                        task.description
                                    ) : (
                                        <span className="text-muted-foreground italic">No detailed description provided.</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* TAB 2: DELIVERABLES & AI QUALITY GATE */}
                    <TabsContent value="deliverables" className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-6 focus:outline-none">
                        {/* Quality Gate Status */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                                    <span>Definition of Done (DoD) & AI Audit</span>
                                </Label>
                                {onRequestVerificationReview && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                        onClick={() => onRequestVerificationReview(task)}
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Update Deliverables</span>
                                    </Button>
                                )}
                            </div>

                            {isLoadingAudit ? (
                                <div className="flex items-center justify-center p-8 border border-border rounded-xl bg-muted/20">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-xs text-muted-foreground">Loading quality gate report...</span>
                                </div>
                            ) : auditReport ? (
                                <AIAuditCard
                                    score={auditReport.aiConfidenceScore}
                                    status={auditReport.gateStatus === "Passed" ? "Passed" : "Failed"}
                                    summary={auditReport.aiSummary}
                                    criteria={auditReport.criteriaBreakdown || []}
                                    submittedBy={auditReport.submittedBy}
                                    proofUrl={auditReport.proofUrl}
                                    createdAt={auditReport.createdAt}
                                />
                            ) : (
                                <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2 bg-muted/10">
                                    <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto" />
                                    <h4 className="text-sm font-semibold text-foreground">No Automated DoD Report Yet</h4>
                                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                        When deliverables or proof links are submitted for review, the automated Quality Gate will evaluate acceptance criteria and display the verification breakdown here.
                                    </p>
                                    {onRequestVerificationReview && (
                                        <div className="pt-2">
                                            <Button
                                                size="sm"
                                                className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs gap-1.5"
                                                onClick={() => onRequestVerificationReview(task)}
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                <span>Submit Deliverables for Verification</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Proof Links */}
                        <div className="space-y-3 pt-4 border-t border-border">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Attached Proof Links</span>
                            </Label>
                            {task.proofLinks && task.proofLinks.length > 0 ? (
                                <div className="space-y-2">
                                    {task.proofLinks.map((link, idx) => (
                                        <a
                                            key={idx}
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                                                        {link.label || "Proof Deliverable"}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground truncate">{link.url}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                Open ↗
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-lg border border-border">
                                    No proof links attached to this task.
                                </p>
                            )}
                        </div>

                        {/* Proof Notes */}
                        {task.proofNotes && (
                            <div className="space-y-2 pt-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Submission Notes</span>
                                </Label>
                                <div className="text-xs bg-muted/30 p-4 rounded-xl whitespace-pre-wrap border border-border leading-relaxed text-foreground">
                                    {task.proofNotes}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* TAB 3: DETAILS & AUDIT */}
                    <TabsContent value="activity" className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4 focus:outline-none">
                        <div className="space-y-3">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                System Audit Metadata
                            </Label>
                            <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-3 text-xs">
                                <div className="flex items-center justify-between py-1 border-b border-border/60">
                                    <span className="text-muted-foreground">Task ID</span>
                                    <div className="flex items-center gap-1 font-mono text-[11px] text-foreground">
                                        <span>{task.id}</span>
                                        <button onClick={handleCopyTaskId} className="p-1 hover:text-primary">
                                            {copiedTaskId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between py-1 border-b border-border/60">
                                    <span className="text-muted-foreground">Milestone</span>
                                    <span className="font-medium text-foreground">
                                        {currentMilestone ? `Milestone ${currentMilestone.order}: ${currentMilestone.title}` : "Unassigned"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-1 border-b border-border/60">
                                    <span className="text-muted-foreground">Requires Quality Gate Proof</span>
                                    <Badge variant="outline" className="text-[10px]">
                                        {task.requiresProof !== false ? "Yes" : "No"}
                                    </Badge>
                                </div>

                                {task.createdAt && (
                                    <div className="flex items-center justify-between py-1 border-b border-border/60">
                                        <span className="text-muted-foreground">Created</span>
                                        <span className="text-foreground">
                                            {format(new Date(task.createdAt), "MMM d, yyyy 'at' h:mm a")} ({formatDistanceToNow(new Date(task.createdAt))} ago)
                                        </span>
                                    </div>
                                )}

                                {task.updatedAt && (
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-muted-foreground">Last Updated</span>
                                        <span className="text-foreground">
                                            {format(new Date(task.updatedAt), "MMM d, yyyy 'at' h:mm a")} ({formatDistanceToNow(new Date(task.updatedAt))} ago)
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* 4. Footer */}
                <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">Esc</kbd> to close
                    </span>
                    <Button
                        className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs px-4"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
