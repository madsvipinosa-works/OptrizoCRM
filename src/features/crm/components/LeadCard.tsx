"use client";

import React, { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
    DollarSign,
    Building2,
    Clock,
    FileText,
    Flame,
    Zap,
    Snowflake,
    AlertTriangle,
    Phone,
    Mail,
    Users,
    CheckSquare,
    MoreVertical,
    Edit3,
    Archive,
    Loader2,
    CheckCircle2,
    Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { archiveLead, convertLeadToProject } from "@/features/crm/actions";
import { toast } from "sonner";
import type { LeadItem } from "./LeadsDataTable";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LeadCardProps {
    lead: LeadItem;
    assignableUsers?: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
    onSelect?: (lead: LeadItem) => void;
    onEdit?: (lead: LeadItem) => void;
    onAssignStaff?: (leadId: string, userIds: string[]) => void;
    onArchive?: (leadId: string) => void;
}

export function LeadCard({
    lead,
    assignableUsers = [],
    isAdmin,
    onSelect,
    onEdit,
    onAssignStaff,
    onArchive,
}: LeadCardProps) {
    const router = useRouter();
    const [isArchiving, setIsArchiving] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    const leadTitle = lead.businessName || lead.contactName || lead.client?.name || "Unnamed Opportunity";
    const score = lead.leadScore ?? 50;
    const priority = lead.priority ?? (score >= 75 ? "Hot" : score < 45 ? "Cold" : "Warm");

    const lastContactTime = lead.lastContactedAt
        ? new Date(lead.lastContactedAt)
        : lead.updatedAt
        ? new Date(lead.updatedAt)
        : new Date(lead.createdAt);

    const daysSinceContact = Math.floor((Date.now() - lastContactTime.getTime()) / (1000 * 3600 * 24));
    const isStale = !["Closed Won", "Closed Lost"].includes(lead.status) && daysSinceContact >= 5;

    // Eager-loaded in parent query - ZERO N+1 database queries
    const activeTasks = lead.crmTasks?.filter((t: any) => t.status !== "Completed") || [];
    const overdueTasksCount = activeTasks.filter((t: any) => t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length;
    const dueTodayTasksCount = activeTasks.filter((t: any) => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length;
    const nextTask = activeTasks[0]; // Tasks are already sorted by dueDate ASC

    const isNextTaskOverdue = nextTask?.dueDate && new Date(nextTask.dueDate).getTime() < Date.now();

    const currentAssigneeIds = lead.assignees?.map((a: any) => a.id) || [];

    const handleToggleAssignee = (userId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!onAssignStaff) return;
        const newAssignees = currentAssigneeIds.includes(userId)
            ? currentAssigneeIds.filter((id: string) => id !== userId)
            : [...currentAssigneeIds, userId];
        onAssignStaff(lead.id, newAssignees);
    };

    const handleArchiveLead = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to archive "${leadTitle}"? It will be hidden from the active pipeline.`)) {
            return;
        }

        setIsArchiving(true);
        try {
            const res = await archiveLead(lead.id);
            if (res.success) {
                toast.success(res.message || "Lead archived successfully");
                onArchive?.(lead.id);
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

    const getPriorityIcon = (p: string) => {
        if (p === "Hot") return <Flame className="h-3 w-3 text-rose-500 dark:text-rose-400" />;
        if (p === "Cold") return <Snowflake className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />;
        return <Zap className="h-3 w-3 text-amber-500 dark:text-amber-400" />;
    };

    const getPriorityBadgeClass = (p: string) => {
        if (p === "Hot") return "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20";
        if (p === "Cold") return "bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/20";
        return "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20";
    };

    const getTaskTypeIcon = (type: string) => {
        switch (type) {
            case "Call":
                return <Phone className="h-2.5 w-2.5 text-blue-400 shrink-0" />;
            case "Email":
                return <Mail className="h-2.5 w-2.5 text-emerald-400 shrink-0" />;
            case "Meeting":
                return <Users className="h-2.5 w-2.5 text-purple-400 shrink-0" />;
            default:
                return <CheckSquare className="h-2.5 w-2.5 text-amber-400 shrink-0" />;
        }
    };

    return (
        <div
            onClick={() => onSelect?.(lead)}
            className={`group relative rounded-xl border bg-card/90 hover:bg-card hover:border-primary/40 transition-all duration-200 p-3.5 space-y-2.5 cursor-pointer shadow-xs hover:shadow-md select-none ${
                isStale
                    ? "border-l-4 border-l-amber-500 border-border"
                    : "border-border"
            }`}
        >
            {/* Top Row: Company Name, Priority / Score, and 3-Dot Menu */}
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-all duration-200 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-clip leading-snug">
                        {leadTitle}
                    </h4>
                    {lead.contactEmail && (
                        <p className="text-[11px] text-muted-foreground truncate">
                            {lead.contactEmail}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                        <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 gap-1 font-semibold ${getPriorityBadgeClass(priority)}`}
                        >
                            {getPriorityIcon(priority)} {priority}
                        </Badge>
                        <span
                            title={`Lead Score: ${score}`}
                            className="text-[10px] font-mono text-muted-foreground font-bold bg-muted px-1.5 py-0.5 rounded border border-border cursor-help"
                        >
                            {score}
                        </span>
                    </div>

                    {/* Quick Action 3-Dot Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity"
                            >
                                <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs bg-card border-border text-foreground">
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit?.(lead);
                                }}
                                className="cursor-pointer gap-2 focus:bg-muted"
                            >
                                <Edit3 className="h-3.5 w-3.5 text-primary" /> Edit Deal
                            </DropdownMenuItem>

                            {assignableUsers.length > 0 && onAssignStaff && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="cursor-pointer gap-2 focus:bg-muted">
                                        <Users className="h-3.5 w-3.5 text-muted-foreground" /> Assign Staff
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-48 bg-card border-border text-foreground text-xs">
                                        <DropdownMenuLabel className="text-[10px] text-muted-foreground">Toggle Assigned Rep</DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-border" />
                                        {assignableUsers
                                            .filter((u) => u.role === "sales" || u.role === "superadmin")
                                            .map((usr) => {
                                                const isAssigned = currentAssigneeIds.includes(usr.id);
                                                return (
                                                    <DropdownMenuItem
                                                        key={usr.id}
                                                        onClick={(e) => handleToggleAssignee(usr.id, e)}
                                                        className="cursor-pointer flex items-center justify-between focus:bg-muted"
                                                    >
                                                        <span className="truncate">{usr.name || "User"}</span>
                                                        {isAssigned && <CheckCircle2 className="h-3 w-3 text-primary shrink-0 ml-1.5" />}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            )}

                            {lead.status === "Closed Won" && (
                                <DropdownMenuItem
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setIsConverting(true);
                                        try {
                                            const res = await convertLeadToProject(lead.id);
                                            if (res.success && res.projectId) {
                                                toast.success(res.message || "Opening PM workspace");
                                                router.push(`/dashboard/pm/${res.projectId}`);
                                            } else {
                                                toast.error(res.message || "Failed to open PM workspace");
                                            }
                                        } catch (err) {
                                            toast.error("Failed to open PM project");
                                        } finally {
                                            setIsConverting(false);
                                        }
                                    }}
                                    disabled={isConverting}
                                    className="cursor-pointer gap-2 text-emerald-500 dark:text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-400 font-medium"
                                >
                                    <Rocket className="h-3.5 w-3.5" />
                                    <span>{isConverting ? "Opening PM..." : "Delivery Project"}</span>
                                </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator className="bg-border" />

                            <DropdownMenuItem
                                onClick={handleArchiveLead}
                                disabled={isArchiving}
                                className="cursor-pointer gap-2 text-rose-500 hover:text-rose-400 focus:bg-rose-500/10 focus:text-rose-400"
                            >
                                {isArchiving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Archive className="h-3.5 w-3.5" />
                                )}
                                Archive Deal
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Middle Row: Industry / Focus & Estimated Value */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[60%]">
                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{lead.industry || "General Focus"}</span>
                </div>

                <div className="flex items-center gap-1 font-mono font-bold text-emerald-500 dark:text-emerald-400 shrink-0">
                    <DollarSign className="h-3 w-3" />
                    {(lead.estimatedValue || 0).toLocaleString()}
                </div>
            </div>

            {/* Next Urgent Task Preview (Zero N+1 query - read from eager loaded lead.crmTasks) */}
            {nextTask && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] transition-colors truncate ${
                    isNextTaskOverdue
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400"
                        : "bg-muted/40 border-border/60 text-muted-foreground"
                }`}>
                    {getTaskTypeIcon(nextTask.taskType)}
                    <span className="font-medium text-foreground truncate flex-1">
                        {nextTask.title}
                    </span>
                    {nextTask.dueDate && (
                        <span className={`shrink-0 font-mono font-semibold text-[9px] ${
                            isNextTaskOverdue ? "text-rose-500 dark:text-rose-400 font-bold" : "text-muted-foreground"
                        }`}>
                            {isNextTaskOverdue ? "Overdue" : format(new Date(nextTask.dueDate), "MMM d")}
                        </span>
                    )}
                </div>
            )}

            {/* Bottom Row: Assignee avatars, task alert badges, last activity time, SOW link */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground">
                {/* Assignees avatar stack */}
                <div className="flex items-center gap-1.5">
                    {lead.assignees && lead.assignees.length > 0 ? (
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {lead.assignees.slice(0, 3).map((assignee, idx) => (
                                <div
                                    key={idx}
                                    className="w-5 h-5 rounded-full bg-card border border-border text-primary flex items-center justify-center font-bold text-[9px]"
                                    title={assignee.name || "Staff"}
                                >
                                    {assignee.name?.[0]?.toUpperCase() || "U"}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-muted-foreground/60 italic text-[10px]">Unassigned</span>
                    )}

                    <span className="text-muted-foreground/40">•</span>

                    {/* Relative Activity */}
                    <span
                        className={`flex items-center gap-1 ${
                            isStale ? "text-amber-500 dark:text-amber-400 font-semibold" : "text-muted-foreground"
                        }`}
                    >
                        <Clock className="h-2.5 w-2.5" />
                        {isStale ? `${daysSinceContact}d idle` : formatDistanceToNow(lastContactTime, { addSuffix: true })}
                    </span>
                </div>

                {/* Right badges & SOW Studio shortcut */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {overdueTasksCount > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20">
                            {overdueTasksCount} Overdue
                        </Badge>
                    )}
                    {overdueTasksCount === 0 && dueTodayTasksCount > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20">
                            {dueTodayTasksCount} Due Today
                        </Badge>
                    )}

                    <Link
                        href={`/dashboard/proposals/builder/${lead.id}`}
                        prefetch={false}
                        className="p-1 rounded bg-muted hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                        title="Open Proposal Studio"
                    >
                        <FileText className="h-3.5 w-3.5" />
                    </Link>

                    {lead.status === "Closed Won" && (
                        <button
                            type="button"
                            onClick={async (e) => {
                                e.stopPropagation();
                                setIsConverting(true);
                                try {
                                    const res = await convertLeadToProject(lead.id);
                                    if (res.success && res.projectId) {
                                        toast.success(res.message || "Opening PM workspace");
                                        router.push(`/dashboard/pm/${res.projectId}`);
                                    } else {
                                        toast.error(res.message || "Failed to open project");
                                    }
                                } catch (err) {
                                    toast.error("Failed to open project");
                                } finally {
                                    setIsConverting(false);
                                }
                            }}
                            disabled={isConverting}
                            className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 transition-colors"
                            title="Open PM Project Delivery Workspace"
                        >
                            <Rocket className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
