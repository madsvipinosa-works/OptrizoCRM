"use client";

import { useState, useEffect } from "react";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
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
import {
    Phone,
    Mail,
    Calendar,
    DollarSign,
    Building2,
    Clock,
    FileText,
    Plus,
    ExternalLink,
    Flame,
    Zap,
    Snowflake,
    AlertTriangle,
    MessageSquare,
    PhoneCall,
    Users,
    ChevronDown,
    Loader2,
    CheckCircle2,
    Search,
    CheckSquare,
    Trash2,
    X,
    Filter,
    Edit3,
    Archive,
    Rocket,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { logLeadActivity, archiveLead, convertLeadToProject, getProjectForLead } from "@/features/crm/actions";
import { completeCrmTask, createCrmTask, deleteCrmTask } from "@/actions/crm-tasks";
import { toast } from "sonner";
import type { LeadItem } from "./LeadsDataTable";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LeadDetailsDrawerProps {
    lead: LeadItem | null;
    isOpen: boolean;
    onClose: () => void;
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
    onStatusChangeRequest?: (leadId: string, leadTitle: string, fromStatus: string, toStatus: string) => void;
    onAssignStaff?: (leadId: string, userIds: string[]) => void;
    onEditLead?: (lead: LeadItem) => void;
    onArchiveLead?: (leadId: string) => void;
}

const STAGES = [
    "New Lead",
    "Discovery & Qualifying",
    "Proposal Sent",
    "In Negotiation",
    "Closed Won",
    "Closed Lost",
] as const;

export function LeadDetailsDrawer({
    lead,
    isOpen,
    onClose,
    assignableUsers,
    isAdmin,
    onStatusChangeRequest,
    onAssignStaff,
    onEditLead,
    onArchiveLead,
}: LeadDetailsDrawerProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "tasks">("overview");
    const [activityType, setActivityType] = useState<"Call" | "Meeting" | "Email" | "Note">("Call");
    const [activityContent, setActivityContent] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [scheduleFollowUpTask, setScheduleFollowUpTask] = useState(false);
    const router = useRouter();
    const [isLogging, setIsLogging] = useState(false);
    const [assigneeSearch, setAssigneeSearch] = useState("");
    const [isArchiving, setIsArchiving] = useState(false);

    // Linked project state for Closed Won handover
    const [linkedProject, setLinkedProject] = useState<{ id: string; title: string; status: string } | null>(null);
    const [isConvertingProject, setIsConvertingProject] = useState(false);

    // Local state for tasks and activity logs to enable instant reactivity
    const [localTasks, setLocalTasks] = useState<any[]>(lead?.crmTasks || []);
    const [localActivityLogs, setLocalActivityLogs] = useState<any[]>(lead?.activityLogs || []);

    useEffect(() => {
        if (lead) {
            setLocalTasks(lead.crmTasks || []);
            setLocalActivityLogs(lead.activityLogs || []);
            // Check for associated delivery project
            getProjectForLead(lead.id).then((p) => {
                setLinkedProject(p);
            });
        }
    }, [lead?.id, lead?.crmTasks, lead?.activityLogs]);

    const handleConvertLead = async () => {
        if (!lead) return;
        setIsConvertingProject(true);
        try {
            const res = await convertLeadToProject(lead.id);
            if (res.success && res.projectId) {
                toast.success(res.message || "Project workspace active!");
                setLinkedProject({ id: res.projectId, title: lead.businessName || "Project", status: "Kickoff" });
                router.push(`/dashboard/pm/${res.projectId}`);
            } else {
                toast.error(res.message || "Failed to convert deal to project");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to convert lead to project");
        } finally {
            setIsConvertingProject(false);
        }
    };

    // Task Creation Form State
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskType, setTaskType] = useState<"Call" | "Email" | "Meeting" | "To-do">("To-do");
    const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High">("Medium");
    const [taskDueDate, setTaskDueDate] = useState("");
    const [taskAssigneeId, setTaskAssigneeId] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);
    const [taskFilter, setTaskFilter] = useState<"all" | "active" | "completed">("all");

    if (!lead) return null;

    const leadTitle = lead.businessName || lead.contactName || lead.client?.name || "Unnamed Opportunity";
    const contactEmail = lead.contactEmail || lead.client?.email;
    const contactPhone = lead.contactPhone;
    const contactName = lead.contactName || lead.client?.name;
    const score = lead.leadScore ?? 50;
    const priority = lead.priority ?? (score >= 75 ? "Hot" : score < 45 ? "Cold" : "Warm");

    const lastContactTime = lead.lastContactedAt
        ? new Date(lead.lastContactedAt)
        : lead.updatedAt
        ? new Date(lead.updatedAt)
        : new Date(lead.createdAt);

    const daysSinceContact = Math.floor((Date.now() - lastContactTime.getTime()) / (1000 * 3600 * 24));
    const isStale = !["Closed Won", "Closed Lost"].includes(lead.status) && daysSinceContact >= 5;

    const currentAssigneeIds = lead.assignees?.map((a) => a.id) || [];
    const handleToggleAssignee = (userId: string) => {
        if (!onAssignStaff) return;
        const newAssignees = currentAssigneeIds.includes(userId)
            ? currentAssigneeIds.filter((id) => id !== userId)
            : [...currentAssigneeIds, userId];
        onAssignStaff(lead.id, newAssignees);
    };

    const handleLogActivity = async () => {
        if (!activityContent.trim()) {
            toast.error("Please enter activity notes.");
            return;
        }

        setIsLogging(true);
        try {
            const res = await logLeadActivity({
                leadId: lead.id,
                activityType,
                content: activityContent.trim(),
                nextFollowUpDate: followUpDate || null,
            });

            if (res.success) {
                toast.success(`${activityType} logged successfully`);
                const newLog = {
                    id: crypto.randomUUID(),
                    leadId: lead.id,
                    activityType,
                    content: activityContent.trim(),
                    createdAt: new Date().toISOString(),
                    author: { name: "You" },
                };
                setLocalActivityLogs((prev) => [newLog, ...prev]);

                // Also create an actionable CRM task if the user checked the schedule checkbox
                if (scheduleFollowUpTask && followUpDate) {
                    try {
                        const assignedUserId = currentAssigneeIds[0] || undefined;
                        const assignedUser = assignableUsers.find((u) => u.id === assignedUserId);
                        const taskRes = await createCrmTask({
                            leadId: lead.id,
                            title: `${activityType} Follow-up: ${activityContent.trim().slice(0, 35)}...`,
                            description: `Follow-up scheduled from logged ${activityType.toLowerCase()}: "${activityContent.trim()}"`,
                            taskType: activityType === "Note" ? "To-do" : activityType,
                            priority: "Medium",
                            dueDate: new Date(followUpDate),
                            assignedTo: assignedUserId,
                        });

                        if (taskRes.success) {
                            const newTask = taskRes.data || {
                                id: crypto.randomUUID(),
                                leadId: lead.id,
                                title: `${activityType} Follow-up: ${activityContent.trim().slice(0, 35)}...`,
                                taskType: activityType === "Note" ? "To-do" : activityType,
                                priority: "Medium",
                                status: "Pending",
                                dueDate: new Date(followUpDate).toISOString(),
                                assignedTo: assignedUserId || null,
                                assignee: assignedUser || null,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            };
                            setLocalTasks((prev) => [{ ...newTask, assignee: assignedUser || newTask.assignee }, ...prev]);
                            toast.success("Follow-up task scheduled!");
                        }
                    } catch (taskErr) {
                        console.error("Failed to schedule follow-up task:", taskErr);
                    }
                }

                setActivityContent("");
                setFollowUpDate("");
                setScheduleFollowUpTask(false);
                setActiveTab("timeline");
            } else {
                toast.error(res.message || "Failed to log activity");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while logging activity");
        } finally {
            setIsLogging(false);
        }
    };

    const handleArchiveLead = async () => {
        if (!confirm(`Are you sure you want to archive "${leadTitle}"? It will be hidden from the active pipeline.`)) return;
        setIsArchiving(true);
        try {
            const res = await archiveLead(lead.id);
            if (res.success) {
                toast.success(res.message || "Lead archived successfully");
                onArchiveLead?.(lead.id);
                onClose();
            } else {
                toast.error(res.message || "Failed to archive lead");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while archiving lead");
        } finally {
            setIsArchiving(false);
        }
    };

    const handleCreateTask = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!taskTitle.trim()) {
            toast.error("Please enter a task title.");
            return;
        }

        setIsSubmittingTask(true);
        try {
            const assignedUser = assignableUsers.find((u) => u.id === taskAssigneeId);
            const res = await createCrmTask({
                leadId: lead.id,
                title: taskTitle.trim(),
                description: taskDescription.trim() || undefined,
                taskType,
                priority: taskPriority,
                dueDate: taskDueDate ? new Date(taskDueDate) : undefined,
                assignedTo: taskAssigneeId || undefined,
            });

            if (res.success) {
                toast.success("Sales task created successfully");
                const newTask = res.data || {
                    id: crypto.randomUUID(),
                    leadId: lead.id,
                    title: taskTitle.trim(),
                    description: taskDescription.trim() || null,
                    taskType,
                    priority: taskPriority,
                    status: "Pending",
                    dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : null,
                    assignedTo: taskAssigneeId || null,
                    assignee: assignedUser || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                const taskWithAssignee = {
                    ...newTask,
                    assignee: assignedUser || newTask.assignee,
                };

                setLocalTasks((prev) => [taskWithAssignee, ...prev]);

                // Reset form
                setTaskTitle("");
                setTaskDescription("");
                setTaskDueDate("");
                setTaskAssigneeId("");
                setTaskType("To-do");
                setTaskPriority("Medium");
                setIsAddingTask(false);
            } else {
                toast.error(res.message || "Failed to create sales task");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while creating task");
        } finally {
            setIsSubmittingTask(false);
        }
    };

    const handleCompleteTask = async (taskId: string) => {
        try {
            const res = await completeCrmTask(taskId);
            if (res.success) {
                toast.success("Task completed!");
                setLocalTasks((prev) =>
                    prev.map((t) =>
                        t.id === taskId
                            ? { ...t, status: "Completed", completedAt: new Date().toISOString() }
                            : t
                    )
                );
            } else {
                toast.error(res.message || "Failed to complete task");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred");
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this sales task?")) return;
        try {
            const res = await deleteCrmTask(taskId);
            if (res.success) {
                toast.success("Task deleted");
                setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
            } else {
                toast.error(res.message || "Failed to delete task");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while deleting task");
        }
    };

    const getPriorityIcon = (p: string) => {
        if (p === "Hot") return <Flame className="h-3 w-3 text-rose-400" />;
        if (p === "Cold") return <Snowflake className="h-3 w-3 text-cyan-400" />;
        return <Zap className="h-3 w-3 text-amber-400" />;
    };

    const getPriorityBadgeClass = (p: string) => {
        if (p === "Hot") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
        if (p === "Cold") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case "Call":
                return <PhoneCall className="h-3.5 w-3.5 text-blue-400" />;
            case "Meeting":
                return <Users className="h-3.5 w-3.5 text-purple-400" />;
            case "Email":
                return <Mail className="h-3.5 w-3.5 text-emerald-400" />;
            default:
                return <MessageSquare className="h-3.5 w-3.5 text-amber-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "New Lead":
                return "bg-blue-500/10 text-blue-400 border-blue-500/30";
            case "Discovery & Qualifying":
                return "bg-purple-500/10 text-purple-400 border-purple-500/30";
            case "Proposal Sent":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            case "In Negotiation":
                return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
            case "Closed Won":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
            case "Closed Lost":
                return "bg-rose-500/10 text-rose-400 border-rose-500/30";
            default:
                return "bg-zinc-800 text-zinc-300 border-zinc-700";
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-[650px] bg-card border-border text-foreground p-0 flex flex-col h-full shadow-2xl"
            >
                {/* 1. Header Section */}
                <SheetHeader className="p-6 border-b border-border space-y-3 bg-muted/20 backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`gap-1 font-semibold text-xs px-2.5 py-0.5 ${getPriorityBadgeClass(priority)}`}>
                                    {getPriorityIcon(priority)} {priority} Priority
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-muted/50 border-border text-muted-foreground font-mono">
                                    Score: <strong className="text-foreground ml-1">{score}/100</strong>
                                </Badge>
                            </div>
                            <SheetTitle className="text-xl font-bold text-foreground tracking-tight">
                                {leadTitle}
                            </SheetTitle>
                            <SheetDescription className="text-xs text-muted-foreground">
                                Created on {format(new Date(lead.createdAt), "MMMM d, yyyy")} • Source: {lead.source || "Website"}
                            </SheetDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Assign Staff Dropdown */}
                            {isAdmin && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs font-semibold gap-1.5 border border-border bg-muted/50 hover:bg-muted text-foreground"
                                        >
                                            <Users className="h-3 w-3 text-muted-foreground" />
                                            {currentAssigneeIds.length === 0 ? "Unassigned" : `${currentAssigneeIds.length} Assigned`}
                                            <ChevronDown className="h-3 w-3 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="bg-card border-border text-foreground w-60 p-0"
                                        onCloseAutoFocus={() => setAssigneeSearch("")}
                                    >
                                        <div className="p-2 border-b border-border">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                                                <Input
                                                    placeholder="Search staff (Sales & Admin)…"
                                                    value={assigneeSearch}
                                                    onChange={(e) => setAssigneeSearch(e.target.value)}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    className="pl-7 h-7 text-xs bg-muted/30 border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="py-1 max-h-52 overflow-y-auto">
                                            {(() => {
                                                const eligibleUsers = assignableUsers.filter(
                                                    (u) => u.role === "sales" || u.role === "superadmin"
                                                );
                                                const filtered = eligibleUsers.filter((u) =>
                                                    (u.name || "").toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                                                    (u.jobTitle || "").toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                                                    (u.role || "").toLowerCase().includes(assigneeSearch.toLowerCase())
                                                );
                                                if (filtered.length === 0) {
                                                    return (
                                                        <p className="text-[11px] text-muted-foreground italic text-center py-3">
                                                            No staff found
                                                        </p>
                                                    );
                                                }
                                                return filtered.map((usr) => {
                                                    const isAssigned = currentAssigneeIds.includes(usr.id);
                                                    const roleLabel = usr.role === "superadmin" ? "Admin" : (usr.jobTitle || "Sales");
                                                    return (
                                                        <DropdownMenuItem
                                                            key={usr.id}
                                                            onSelect={(e) => {
                                                                e.preventDefault();
                                                                handleToggleAssignee(usr.id);
                                                            }}
                                                            className="text-xs focus:bg-muted cursor-pointer flex items-center justify-between mx-1 rounded-md"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-5 h-5 rounded-full bg-muted border border-border text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
                                                                    {usr.name?.[0]?.toUpperCase() || "U"}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-medium truncate text-foreground">{usr.name || "User"}</span>
                                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                                        {usr.jobTitle ? `${usr.jobTitle} • ${roleLabel}` : roleLabel}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {isAssigned && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                                                        </DropdownMenuItem>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {/* Edit Deal Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEditLead?.(lead)}
                                className="h-8 text-xs font-semibold gap-1.5 border border-border bg-muted/50 hover:bg-muted text-foreground"
                                title="Edit Opportunity Details"
                            >
                                <Edit3 className="h-3 w-3 text-primary" />
                                <span>Edit Deal</span>
                            </Button>

                            {/* Interactive Stage Select Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`h-8 text-xs font-semibold gap-1.5 border ${getStatusColor(lead.status)} hover:opacity-80`}
                                    >
                                        {lead.status}
                                        <ChevronDown className="h-3 w-3 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border text-foreground w-48">
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Move Deal Stage</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-border" />
                                    {STAGES.map((stg) => (
                                        <DropdownMenuItem
                                            key={stg}
                                            disabled={stg === lead.status}
                                            onClick={() => onStatusChangeRequest?.(lead.id, leadTitle, lead.status, stg)}
                                            className="text-xs focus:bg-muted cursor-pointer flex items-center justify-between"
                                        >
                                            <span>{stg}</span>
                                            {stg === lead.status && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator className="bg-border" />
                                    <DropdownMenuItem
                                        onClick={handleArchiveLead}
                                        disabled={isArchiving}
                                        className="text-xs text-rose-500 hover:text-rose-400 focus:bg-rose-500/10 focus:text-rose-400 cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Archive className="h-3.5 w-3.5" />
                                        <span>Archive Deal</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Contact Quick Action Bar */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {contactEmail && (
                            <a
                                href={`mailto:${contactEmail}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border text-xs text-foreground hover:bg-muted transition-colors"
                            >
                                <Mail className="h-3 w-3 text-primary" />
                                <span>{contactEmail}</span>
                            </a>
                        )}
                        {contactPhone && (
                            <a
                                href={`tel:${contactPhone}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border text-xs text-foreground hover:bg-muted transition-colors"
                            >
                                <Phone className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                                <span>{contactPhone}</span>
                            </a>
                        )}
                        {contactName && contactName !== leadTitle && (
                            <span className="text-xs text-muted-foreground py-1">Contact: {contactName}</span>
                        )}
                    </div>

                    {/* Stale Alert Banner */}
                    {isStale && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                            <span><strong>Response Required:</strong> No contact recorded for {daysSinceContact} days.</span>
                        </div>
                    )}

                    {/* Closed Won Handover to PM Delivery Banner */}
                    {lead.status === "Closed Won" && (
                        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                                    <Rocket className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                        <span>Deal Closed & Won</span>
                                        {linkedProject && (
                                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                                Active Delivery
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        {linkedProject
                                            ? `Project workspace: ${linkedProject.title}`
                                            : "Ready to provision client delivery workspace and agile milestones."}
                                    </p>
                                </div>
                            </div>

                            {linkedProject ? (
                                <Button
                                    size="sm"
                                    asChild
                                    className="h-8 text-xs bg-emerald-500 text-black hover:bg-emerald-400 font-semibold gap-1.5 shrink-0"
                                >
                                    <Link href={`/dashboard/pm/${linkedProject.id}`}>
                                        <span>Open PM Workspace</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={handleConvertLead}
                                    disabled={isConvertingProject}
                                    className="h-8 text-xs bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5 shrink-0 shadow-xs"
                                >
                                    {isConvertingProject ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Rocket className="h-3.5 w-3.5" />
                                    )}
                                    <span>Convert to PM Project</span>
                                </Button>
                            )}
                        </div>
                    )}
                </SheetHeader>

                {/* 2. Tabs Navigation */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as "overview" | "timeline" | "tasks")}
                        className="flex-1 flex flex-col overflow-hidden"
                    >
                        <div className="px-6 pt-3 border-b border-border bg-muted/20">
                            <TabsList className="bg-muted/50 border border-border p-1">
                                <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                                    Commercial Overview
                                </TabsTrigger>
                                <TabsTrigger value="tasks" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black flex items-center gap-1">
                                    <CheckSquare className="h-3.5 w-3.5" />
                                    Sales Tasks ({localTasks.filter((t: any) => t.status !== "Completed").length})
                                </TabsTrigger>
                                <TabsTrigger value="timeline" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                                    Activity & Audit ({localActivityLogs.length})
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* TAB 1: OVERVIEW */}
                        <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 space-y-6 m-0">
                            {/* Financial & Deal Summary Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                        <DollarSign className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" /> Estimated Value
                                    </div>
                                    <div className="text-lg font-bold text-emerald-500 dark:text-emerald-400 font-mono">
                                        ${(lead.estimatedValue || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        Budget: {lead.budget || "Not specified"}
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                        <Building2 className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" /> Industry & Focus
                                    </div>
                                    <div className="text-sm font-semibold text-foreground truncate">
                                        {lead.industry || "General Agency"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        Timeline: {lead.timelineExpectation || "Flexible"}
                                    </div>
                                </div>
                            </div>

                            {/* Goals / Requirements */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Project Goals & Scope
                                </h4>
                                <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                    {lead.goals || "No specific project goals recorded."}
                                </div>
                            </div>

                            {/* Proposals & Statements of Work */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Proposals & SOW Contracts
                                    </h4>
                                    <Link
                                        href={`/dashboard/proposals/builder/${lead.id}`}
                                        className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                    >
                                        <Plus className="h-3 w-3" /> New SOW Proposal
                                    </Link>
                                </div>

                                {lead.proposals && lead.proposals.length > 0 ? (
                                    <div className="space-y-2">
                                        {lead.proposals.map((prop: any) => (
                                            <div
                                                key={prop.id}
                                                className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                                            >
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-xs text-foreground">
                                                            {prop.proposalCode || "Proposal"}
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px] py-0 border-border">
                                                            {prop.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground font-mono">
                                                        ${(prop.total || 0).toLocaleString()} • Created {new Date(prop.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Link
                                                        href={`/proposal/${prop.id}`}
                                                        target="_blank"
                                                        className="p-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                                        title="Client View"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Link>
                                                    <Link
                                                        href={`/dashboard/proposals/builder/${lead.id}`}
                                                        className="p-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                                        title="Edit in Studio"
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-border text-center space-y-2">
                                        <p className="text-xs text-muted-foreground">No proposals generated yet for this deal.</p>
                                        <Button size="sm" variant="outline" asChild className="h-7 text-xs border-border">
                                            <Link href={`/dashboard/proposals/builder/${lead.id}`}>
                                                Generate First SOW Proposal
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Loss Details (if Closed Lost) */}
                            {lead.status === "Closed Lost" && (
                                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                                    <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Loss Reason: {lead.lossReason?.replace(/_/g, " ") || "Unspecified"}
                                    </div>
                                    {lead.lossNotes && (
                                        <p className="text-xs text-foreground whitespace-pre-wrap">{lead.lossNotes}</p>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* TAB 2: TIMELINE */}
                        <TabsContent value="timeline" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
                            {localActivityLogs && localActivityLogs.length > 0 ? (
                                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border">
                                    {localActivityLogs.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-3 relative">
                                            <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center shrink-0 z-10">
                                                {getActivityIcon(log.activityType)}
                                            </div>
                                            <div className="flex-1 p-3 rounded-xl bg-card border border-border space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-foreground">
                                                        {log.author?.name || "System Event"}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                                    {log.content}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground text-xs">
                                    No activity logs recorded yet. Use the composer below to log your first call or note.
                                </div>
                            )}
                        </TabsContent>

                        {/* TAB 3: TASKS */}
                        <TabsContent value="tasks" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
                            {/* Actions Header Bar */}
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
                                <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border">
                                    {(["all", "active", "completed"] as const).map((filter) => {
                                        const count =
                                            filter === "all"
                                                ? localTasks.length
                                                : filter === "active"
                                                ? localTasks.filter((t: any) => t.status !== "Completed").length
                                                : localTasks.filter((t: any) => t.status === "Completed").length;

                                        return (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={() => setTaskFilter(filter)}
                                                className={`px-2 py-1 rounded-md text-[11px] font-medium capitalize transition-colors flex items-center gap-1.5 ${
                                                    taskFilter === filter
                                                        ? "bg-primary text-black font-semibold"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                {filter}
                                                <span
                                                    className={`text-[10px] px-1 py-0 rounded font-mono ${
                                                        taskFilter === filter
                                                            ? "bg-black/20 text-black font-bold"
                                                            : "bg-muted text-muted-foreground"
                                                    }`}
                                                >
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <Button
                                    size="sm"
                                    variant={isAddingTask ? "outline" : "default"}
                                    onClick={() => setIsAddingTask(!isAddingTask)}
                                    className={`h-7 px-2.5 text-xs font-semibold gap-1 transition-all ${
                                        isAddingTask
                                            ? "border-border text-muted-foreground hover:text-foreground"
                                            : "bg-primary text-black hover:bg-primary/90 shadow-xs"
                                    }`}
                                >
                                    {isAddingTask ? (
                                        <>
                                            <X className="h-3.5 w-3.5" /> Cancel
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-3.5 w-3.5" /> Add Task
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Collapsible Add Task Form Card */}
                            {isAddingTask && (
                                <form
                                    onSubmit={handleCreateTask}
                                    className="p-4 rounded-xl border border-primary/40 bg-card space-y-3.5 shadow-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <CheckSquare className="h-3.5 w-3.5 text-primary" /> Create New Sales Task
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">Assigned to this deal</span>
                                    </div>

                                    {/* Task Title */}
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="Task title (e.g. Schedule discovery call, Send proposal revision...)"
                                            value={taskTitle}
                                            onChange={(e) => setTaskTitle(e.target.value)}
                                            className="h-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                                            autoFocus
                                            required
                                        />
                                    </div>

                                    {/* Grid: Type, Priority, Due Date */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        {/* Type */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground">Type</label>
                                            <Select value={taskType} onValueChange={(val: any) => setTaskType(val)}>
                                                <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground w-full">
                                                    <SelectValue placeholder="Type" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card border-border text-foreground text-xs">
                                                    <SelectItem value="Call">📞 Call</SelectItem>
                                                    <SelectItem value="Email">✉️ Email</SelectItem>
                                                    <SelectItem value="Meeting">👥 Meeting</SelectItem>
                                                    <SelectItem value="To-do">☑️ To-do</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Priority */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground">Priority</label>
                                            <Select value={taskPriority} onValueChange={(val: any) => setTaskPriority(val)}>
                                                <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground w-full">
                                                    <SelectValue placeholder="Priority" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card border-border text-foreground text-xs">
                                                    <SelectItem value="High">🔴 High</SelectItem>
                                                    <SelectItem value="Medium">🟡 Medium</SelectItem>
                                                    <SelectItem value="Low">⚪ Low</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Due Date */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground">Due Date</label>
                                            <Input
                                                type="date"
                                                value={taskDueDate}
                                                onChange={(e) => setTaskDueDate(e.target.value)}
                                                className="h-8 text-xs bg-background border-border text-foreground"
                                            />
                                        </div>
                                    </div>

                                    {/* Assignee Selector */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-muted-foreground">Assign Staff</label>
                                        <Select
                                            value={taskAssigneeId || "unassigned"}
                                            onValueChange={(val) => setTaskAssigneeId(val === "unassigned" ? "" : val)}
                                        >
                                            <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground w-full">
                                                <SelectValue placeholder="Select staff member..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border text-foreground text-xs">
                                                <SelectItem value="unassigned">Unassigned (Anyone)</SelectItem>
                                                {assignableUsers
                                                    .filter((u) => u.role === "sales" || u.role === "superadmin")
                                                    .map((user) => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            {user.name || "User"} {user.role === "superadmin" ? "(Admin)" : user.jobTitle ? `(${user.jobTitle})` : "(Sales)"}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Description / Notes */}
                                    <div className="space-y-1">
                                        <Textarea
                                            placeholder="Optional instructions, context, or meeting agenda..."
                                            value={taskDescription}
                                            onChange={(e) => setTaskDescription(e.target.value)}
                                            rows={2}
                                            className="text-xs bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
                                        />
                                    </div>

                                    {/* Form Footer Buttons */}
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsAddingTask(false)}
                                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={isSubmittingTask || !taskTitle.trim()}
                                            className="h-7 text-xs bg-primary text-black font-semibold hover:bg-primary/90"
                                        >
                                            {isSubmittingTask ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Creating...
                                                </>
                                            ) : (
                                                "Save Task"
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            )}

                            {/* Task Items List */}
                            {(() => {
                                const displayedTasks = localTasks.filter((t: any) => {
                                    if (taskFilter === "active") return t.status !== "Completed";
                                    if (taskFilter === "completed") return t.status === "Completed";
                                    return true;
                                });

                                if (displayedTasks.length === 0) {
                                    return (
                                        <div className="text-center py-12 space-y-3 border border-dashed border-border/60 rounded-xl bg-card/40 p-6 select-none">
                                            <div className="w-10 h-10 rounded-full bg-muted/60 border border-border mx-auto flex items-center justify-center text-muted-foreground">
                                                <CheckSquare className="h-5 w-5" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-foreground">
                                                    {taskFilter === "completed"
                                                        ? "No completed tasks yet"
                                                        : taskFilter === "active"
                                                        ? "No active sales tasks"
                                                        : "No sales tasks created for this lead yet"}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                                                    {taskFilter === "completed"
                                                        ? "Completed follow-ups and calls will appear here."
                                                        : "Keep deals moving forward by assigning follow-up calls, emails, or review tasks."}
                                                </p>
                                            </div>
                                            {!isAddingTask && taskFilter !== "completed" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setIsAddingTask(true)}
                                                    className="h-7 text-xs border-border gap-1 bg-card hover:bg-muted"
                                                >
                                                    <Plus className="h-3 w-3" /> Create First Task
                                                </Button>
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-2.5">
                                        {displayedTasks.map((task: any) => {
                                            const isOverdue =
                                                task.dueDate &&
                                                new Date(task.dueDate).getTime() < Date.now() &&
                                                task.status !== "Completed";
                                            const isDueToday =
                                                task.dueDate &&
                                                new Date(task.dueDate).toDateString() === new Date().toDateString() &&
                                                task.status !== "Completed";
                                            const isCompleted = task.status === "Completed";

                                            return (
                                                <div
                                                    key={task.id}
                                                    className={`p-3.5 rounded-xl border transition-all duration-200 ${
                                                        isCompleted
                                                            ? "bg-muted/20 border-border/60 opacity-70"
                                                            : "bg-card border-border hover:border-primary/40 shadow-xs"
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="space-y-1.5 flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4
                                                                    className={`text-xs font-semibold truncate ${
                                                                        isCompleted
                                                                            ? "line-through text-muted-foreground"
                                                                            : "text-foreground"
                                                                    }`}
                                                                >
                                                                    {task.title}
                                                                </h4>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[9px] py-0 h-4 bg-muted/60 border-border text-muted-foreground"
                                                                >
                                                                    {task.taskType}
                                                                </Badge>
                                                                {task.priority === "High" && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[9px] py-0 h-4 bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20 font-semibold"
                                                                    >
                                                                        High
                                                                    </Badge>
                                                                )}
                                                                {isOverdue && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[9px] py-0 h-4 bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20"
                                                                    >
                                                                        Overdue
                                                                    </Badge>
                                                                )}
                                                                {isDueToday && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[9px] py-0 h-4 bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20"
                                                                    >
                                                                        Due Today
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            {task.description && (
                                                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                                    {task.description}
                                                                </p>
                                                            )}

                                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2 flex-wrap">
                                                                {task.dueDate && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-3 w-3" />
                                                                        Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                                                                    </span>
                                                                )}
                                                                <span className="flex items-center gap-1">
                                                                    <Users className="h-3 w-3" />
                                                                    Assigned: {task.assignee?.name || "Unassigned"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Right Actions */}
                                                        <div className="shrink-0 flex items-center gap-1.5">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[9px] py-0.5 ${
                                                                    isCompleted
                                                                        ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20"
                                                                        : "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20"
                                                                }`}
                                                            >
                                                                {task.status}
                                                            </Badge>

                                                            {!isCompleted && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                                                                    onClick={() => handleCompleteTask(task.id)}
                                                                    title="Mark Completed"
                                                                >
                                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                                                                </Button>
                                                            )}

                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-6 w-6 text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10"
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                title="Delete Task"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </TabsContent>
                    </Tabs>
                </div>

                {/* 3. Quick Activity Logger Dock */}
                <div className="p-4 border-t border-border bg-card/90 backdrop-blur-md space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border">
                            {(["Call", "Meeting", "Email", "Note"] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setActivityType(type)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                        activityType === type
                                            ? "bg-primary text-black"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-muted-foreground hover:text-foreground">
                                <input
                                    type="checkbox"
                                    checked={scheduleFollowUpTask}
                                    onChange={(e) => setScheduleFollowUpTask(e.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary accent-primary"
                                />
                                <span>Create task</span>
                            </label>
                            <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <Input
                                    type="date"
                                    value={followUpDate}
                                    onChange={(e) => setFollowUpDate(e.target.value)}
                                    className="h-7 text-xs bg-muted/30 border-border text-foreground w-32 py-0"
                                    title="Next Follow Up Date"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Textarea
                            placeholder={`Log ${activityType.toLowerCase()} details or key discussion points...`}
                            value={activityContent}
                            onChange={(e) => setActivityContent(e.target.value)}
                            rows={2}
                            className="bg-muted/30 border-border text-foreground text-xs resize-none placeholder:text-muted-foreground focus-visible:ring-primary"
                        />
                        <Button
                            type="button"
                            onClick={handleLogActivity}
                            disabled={isLogging || !activityContent.trim()}
                            className="h-auto bg-primary text-black font-semibold text-xs px-4 self-end shrink-0"
                        >
                            {isLogging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Log"}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
