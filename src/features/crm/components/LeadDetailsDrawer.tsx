"use client";

import { useState } from "react";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { logLeadActivity } from "@/features/crm/actions";
import { toast } from "sonner";
import type { LeadItem } from "./LeadsDataTable";
import Link from "next/link";

interface LeadDetailsDrawerProps {
    lead: LeadItem | null;
    isOpen: boolean;
    onClose: () => void;
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
    onStatusChangeRequest?: (leadId: string, leadTitle: string, fromStatus: string, toStatus: string) => void;
    onAssignStaff?: (leadId: string, userIds: string[]) => void;
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
}: LeadDetailsDrawerProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");
    const [activityType, setActivityType] = useState<"Call" | "Meeting" | "Email" | "Note">("Call");
    const [activityContent, setActivityContent] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [isLogging, setIsLogging] = useState(false);
    const [assigneeSearch, setAssigneeSearch] = useState("");

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
                setActivityContent("");
                setFollowUpDate("");
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
                className="w-full sm:max-w-[650px] bg-zinc-950 border-white/10 text-white p-0 flex flex-col h-full shadow-2xl"
            >
                {/* 1. Header Section */}
                <SheetHeader className="p-6 border-b border-white/10 space-y-3 bg-zinc-900/40 backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`gap-1 font-semibold text-xs px-2.5 py-0.5 ${getPriorityBadgeClass(priority)}`}>
                                    {getPriorityIcon(priority)} {priority} Priority
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-white/5 border-white/10 text-zinc-300">
                                    Score: <strong className="text-white ml-1">{score}/100</strong>
                                </Badge>
                            </div>
                            <SheetTitle className="text-xl font-bold text-white tracking-tight">
                                {leadTitle}
                            </SheetTitle>
                            <SheetDescription className="text-xs text-zinc-400">
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
                                            className="h-8 text-xs font-semibold gap-1.5 border border-white/10 bg-white/5 hover:bg-white/10 hover:opacity-80"
                                        >
                                            <Users className="h-3 w-3" />
                                            {currentAssigneeIds.length === 0 ? "Unassigned" : `${currentAssigneeIds.length} Assigned`}
                                            <ChevronDown className="h-3 w-3 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="bg-zinc-950 border-white/15 text-white w-60 p-0"
                                        onCloseAutoFocus={() => setAssigneeSearch("")}
                                    >
                                        <div className="p-2 border-b border-white/10">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 pointer-events-none" />
                                                <Input
                                                    placeholder="Search staff (Sales & Admin)…"
                                                    value={assigneeSearch}
                                                    onChange={(e) => setAssigneeSearch(e.target.value)}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    className="pl-7 h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-primary"
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
                                                        <p className="text-[11px] text-zinc-600 italic text-center py-3">
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
                                                            className="text-xs focus:bg-white/10 cursor-pointer flex items-center justify-between mx-1 rounded-md"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/10 text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
                                                                    {usr.name?.[0]?.toUpperCase() || "U"}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-medium truncate">{usr.name || "User"}</span>
                                                                    <span className="text-[10px] text-zinc-500 truncate">
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
                                <DropdownMenuContent align="end" className="bg-zinc-950 border-white/15 text-white w-48">
                                    <DropdownMenuLabel className="text-xs text-zinc-400">Move Deal Stage</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    {STAGES.map((stg) => (
                                        <DropdownMenuItem
                                            key={stg}
                                            disabled={stg === lead.status}
                                            onClick={() => onStatusChangeRequest?.(lead.id, leadTitle, lead.status, stg)}
                                            className="text-xs focus:bg-white/10 cursor-pointer flex items-center justify-between"
                                        >
                                            <span>{stg}</span>
                                            {stg === lead.status && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Contact Quick Action Bar */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {contactEmail && (
                            <a
                                href={`mailto:${contactEmail}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <Mail className="h-3 w-3 text-primary" />
                                <span>{contactEmail}</span>
                            </a>
                        )}
                        {contactPhone && (
                            <a
                                href={`tel:${contactPhone}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <Phone className="h-3 w-3 text-emerald-400" />
                                <span>{contactPhone}</span>
                            </a>
                        )}
                        {contactName && contactName !== leadTitle && (
                            <span className="text-xs text-zinc-500 py-1">Contact: {contactName}</span>
                        )}
                    </div>

                    {/* Stale Alert Banner */}
                    {isStale && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                            <span><strong>Response Required:</strong> No contact recorded for {daysSinceContact} days.</span>
                        </div>
                    )}
                </SheetHeader>

                {/* 2. Tabs Navigation */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as "overview" | "timeline")}
                        className="flex-1 flex flex-col overflow-hidden"
                    >
                        <div className="px-6 pt-3 border-b border-white/10 bg-zinc-900/20">
                            <TabsList className="bg-white/5 border border-white/10 p-1">
                                <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                                    Commercial Overview
                                </TabsTrigger>
                                <TabsTrigger value="timeline" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                                    Activity & Audit ({lead.activityLogs?.length || 0})
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* TAB 1: OVERVIEW */}
                        <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 space-y-6 m-0">
                            {/* Financial & Deal Summary Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                                    <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Estimated Value
                                    </div>
                                    <div className="text-lg font-bold text-emerald-400 font-mono">
                                        ${(lead.estimatedValue || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        Budget: {lead.budget || "Not specified"}
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                                    <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                                        <Building2 className="h-3.5 w-3.5 text-purple-400" /> Industry & Focus
                                    </div>
                                    <div className="text-sm font-semibold text-white truncate">
                                        {lead.industry || "General Agency"}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        Timeline: {lead.timelineExpectation || "Flexible"}
                                    </div>
                                </div>
                            </div>

                            {/* Goals / Requirements */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                    Project Goals & Scope
                                </h4>
                                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {lead.goals || "No specific project goals recorded."}
                                </div>
                            </div>

                            {/* Proposals & Statements of Work */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
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
                                                className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition-colors"
                                            >
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-xs text-white">
                                                            {prop.proposalCode || "Proposal"}
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px] py-0">
                                                            {prop.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-[11px] text-zinc-400 font-mono">
                                                        ${(prop.total || 0).toLocaleString()} • Created {new Date(prop.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Link
                                                        href={`/proposal/${prop.id}`}
                                                        target="_blank"
                                                        className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                                                        title="Client View"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Link>
                                                    <Link
                                                        href={`/dashboard/proposals/builder/${lead.id}`}
                                                        className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                                                        title="Edit in Studio"
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-white/10 text-center space-y-2">
                                        <p className="text-xs text-zinc-500">No proposals generated yet for this deal.</p>
                                        <Button size="sm" variant="outline" asChild className="h-7 text-xs border-white/10">
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
                                    <div className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Loss Reason: {lead.lossReason?.replace(/_/g, " ") || "Unspecified"}
                                    </div>
                                    {lead.lossNotes && (
                                        <p className="text-xs text-zinc-300 whitespace-pre-wrap">{lead.lossNotes}</p>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* TAB 2: TIMELINE */}
                        <TabsContent value="timeline" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
                            {lead.activityLogs && lead.activityLogs.length > 0 ? (
                                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-white/10">
                                    {lead.activityLogs.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-3 relative">
                                            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center shrink-0 z-10">
                                                {getActivityIcon(log.activityType)}
                                            </div>
                                            <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-white">
                                                        {log.author?.name || "System Event"}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500">
                                                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                                    {log.content}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-zinc-500 text-xs">
                                    No activity logs recorded yet. Use the composer below to log your first call or note.
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {/* 3. Quick Activity Logger Dock */}
                <div className="p-4 border-t border-white/10 bg-zinc-900/60 backdrop-blur-md space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                            {(["Call", "Meeting", "Email", "Note"] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setActivityType(type)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                        activityType === type
                                            ? "bg-primary text-black"
                                            : "text-zinc-400 hover:text-white"
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Clock className="h-3 w-3" />
                            <Input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="h-7 text-xs bg-zinc-950 border-white/10 text-white w-32 py-0"
                                title="Next Follow Up Date"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Textarea
                            placeholder={`Log ${activityType.toLowerCase()} details or key discussion points...`}
                            value={activityContent}
                            onChange={(e) => setActivityContent(e.target.value)}
                            rows={2}
                            className="bg-zinc-950 border-white/10 text-white text-xs resize-none placeholder:text-zinc-600 focus-visible:ring-primary"
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
