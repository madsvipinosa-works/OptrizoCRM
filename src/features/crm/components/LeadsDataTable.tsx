"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DollarSign,
    Building2,
    ChevronDown,
    ArrowUpDown,
    CheckCircle2,
    Clock,
    Flame,
    Zap,
    Snowflake,
    FileText,
    MoreVertical,
    Edit3,
    Archive,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";

export type LeadItem = {
    id: string;
    clientId: string;
    client?: { name: string | null; email: string };
    businessName: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    budget: string | null;
    estimatedValue?: number;
    leadScore?: number;
    priority?: string;
    goals: string | null;
    industry?: string | null;
    targetAudience?: string | null;
    timelineExpectation?: string | null;
    status: string;
    source: string | null;
    lastContactedAt?: Date | string | null;
    nextFollowUpDate?: Date | string | null;
    lossReason?: string | null;
    lossNotes?: string | null;
    isArchived?: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
    activityLogs?: any[];
    proposals?: any[];
    crmTasks?: any[];
    assignees?: any[];
};

interface LeadsDataTableProps {
    leads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
    onStatusChangeRequest: (leadId: string, leadTitle: string, fromStatus: string, toStatus: string) => void;
    onBulkStatusChange?: (leadIds: string[], toStatus: string) => void;
    onBulkAssign?: (leadIds: string[], assigneeUserId: string) => void;
    onSelectLead?: (lead: LeadItem) => void;
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

export function LeadsDataTable({
    leads,
    assignableUsers,
    isAdmin,
    onStatusChangeRequest,
    onBulkStatusChange,
    onBulkAssign,
    onSelectLead,
    onEditLead,
    onArchiveLead,
}: LeadsDataTableProps) {
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [sortField, setSortField] = useState<"createdAt" | "businessName" | "estimatedValue">("createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const toggleSelectAll = () => {
        if (selectedLeadIds.length === leads.length) {
            setSelectedLeadIds([]);
        } else {
            setSelectedLeadIds(leads.map((l) => l.id));
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedLeadIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const sortedLeads = [...leads].sort((a, b) => {
        if (sortField === "businessName") {
            const nameA = (a.businessName || a.contactName || a.client?.name || "").toLowerCase();
            const nameB = (b.businessName || b.contactName || b.client?.name || "").toLowerCase();
            return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else if (sortField === "estimatedValue") {
            const valA = a.estimatedValue || 0;
            const valB = b.estimatedValue || 0;
            return sortOrder === "asc" ? valA - valB : valB - valA;
        } else {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
        }
    });

    const toggleSort = (field: "createdAt" | "businessName" | "estimatedValue") => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

    const getPriorityBadge = (lead: LeadItem) => {
        const score = lead.leadScore ?? 50;
        const priority = lead.priority ?? (score >= 75 ? "Hot" : score < 45 ? "Cold" : "Warm");

        if (priority === "Hot") {
            return (
                <Badge variant="outline" className="text-[10px] gap-1 font-semibold bg-rose-500/10 text-rose-400 border-rose-500/20">
                    <Flame className="h-3 w-3 text-rose-400" /> Hot ({score})
                </Badge>
            );
        }
        if (priority === "Cold") {
            return (
                <Badge variant="outline" className="text-[10px] gap-1 font-semibold bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                    <Snowflake className="h-3 w-3 text-cyan-400" /> Cold ({score})
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold bg-amber-500/10 text-amber-400 border-amber-500/20">
                <Zap className="h-3 w-3 text-amber-400" /> Warm ({score})
            </Badge>
        );
    };

    return (
        <div className="space-y-4">
            {/* Bulk Action Bar */}
            {selectedLeadIds.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/10 text-primary-foreground animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span className="bg-primary text-black px-2 py-0.5 rounded-full font-bold">
                            {selectedLeadIds.length}
                        </span>
                        Selected Opportunities
                    </div>

                    <div className="flex items-center gap-2">
                        {onBulkStatusChange && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-xs h-8 bg-card border-border text-foreground hover:bg-muted">
                                        Bulk Move Stage <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Update Stage for Selected</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-border" />
                                    {STAGES.map((stg) => (
                                        <DropdownMenuItem
                                            key={stg}
                                            onClick={() => {
                                                onBulkStatusChange(selectedLeadIds, stg);
                                                setSelectedLeadIds([]);
                                            }}
                                            className="text-xs focus:bg-muted cursor-pointer"
                                        >
                                            {stg}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {onBulkAssign && isAdmin && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-xs h-8 bg-card border-border text-foreground hover:bg-muted">
                                        Assign Staff <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Assign To Staff</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-border" />
                                    {assignableUsers.map((usr) => (
                                        <DropdownMenuItem
                                            key={usr.id}
                                            onClick={() => {
                                                onBulkAssign(selectedLeadIds, usr.id);
                                                setSelectedLeadIds([]);
                                            }}
                                            className="text-xs focus:bg-muted cursor-pointer"
                                        >
                                            {usr.name || "User"} ({usr.jobTitle || "Staff"})
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLeadIds([])}
                            className="text-xs h-8 text-muted-foreground hover:text-foreground"
                        >
                            Clear
                        </Button>
                    </div>
                </div>
            )}

            {/* High Density Table */}
            <div className="rounded-xl border border-border glass-card overflow-hidden shadow-xs">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent border-border">
                            <TableHead className="w-[40px] px-3">
                                <Checkbox
                                    checked={selectedLeadIds.length === leads.length && leads.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-black"
                                />
                            </TableHead>
                            <TableHead className="min-w-[200px]">
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleSort("businessName")}
                                    className="p-0 text-xs font-semibold hover:bg-transparent hover:text-primary text-muted-foreground flex items-center gap-1"
                                >
                                    Opportunity / Contact <ArrowUpDown className="h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead className="w-[180px]">Pipeline Stage</TableHead>
                            <TableHead>Industry / Focus</TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleSort("estimatedValue")}
                                    className="p-0 text-xs font-semibold hover:bg-transparent hover:text-primary text-muted-foreground flex items-center gap-1"
                                >
                                    Value ($) <ArrowUpDown className="h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead>Priority / Score</TableHead>
                            <TableHead>Assignees</TableHead>
                            <TableHead className="text-right">
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleSort("createdAt")}
                                    className="p-0 text-xs font-semibold hover:bg-transparent hover:text-primary text-muted-foreground flex items-center gap-1 ml-auto"
                                >
                                    Last Contact <ArrowUpDown className="h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead className="w-[60px] text-center">SOW</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedLeads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-xs">
                                    No opportunities found matching your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedLeads.map((lead) => {
                                const isSelected = selectedLeadIds.includes(lead.id);
                                const leadTitle = lead.businessName || lead.contactName || lead.client?.name || "Unknown Opportunity";
                                const email = lead.contactEmail || lead.client?.email;
                                const lastContact = lead.lastContactedAt
                                    ? new Date(lead.lastContactedAt)
                                    : lead.updatedAt
                                    ? new Date(lead.updatedAt)
                                    : new Date(lead.createdAt);
                                const daysIdle = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 3600 * 24));
                                const isStale = !["Closed Won", "Closed Lost"].includes(lead.status) && daysIdle >= 5;

                                return (
                                    <TableRow
                                        key={lead.id}
                                        className={`border-border transition-colors group cursor-pointer ${
                                            isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                                        } ${isStale ? "border-l-2 border-l-amber-500" : ""}`}
                                        onClick={() => onSelectLead?.(lead)}
                                    >
                                        <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelectRow(lead.id)}
                                                className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-black"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs">
                                                    {leadTitle}
                                                </span>
                                                {email && (
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {email}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="p-0 h-auto hover:bg-transparent"
                                                    >
                                                        <Badge
                                                            variant="secondary"
                                                            className={`cursor-pointer hover:opacity-80 transition-opacity font-semibold ${getStatusBadgeColor(lead.status)}`}
                                                        >
                                                            {lead.status}
                                                            <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                                                        </Badge>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="bg-card border-border text-foreground">
                                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Move Deal Stage</DropdownMenuLabel>
                                                    <DropdownMenuSeparator className="bg-border" />
                                                    {STAGES.map((stg) => (
                                                        <DropdownMenuItem
                                                            key={stg}
                                                            disabled={stg === lead.status}
                                                            onClick={() => onStatusChangeRequest(lead.id, leadTitle, lead.status, stg)}
                                                            className="text-xs focus:bg-muted cursor-pointer flex items-center justify-between"
                                                        >
                                                            <span>{stg}</span>
                                                            {stg === lead.status && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs text-foreground">
                                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                                <span>{lead.industry || "General"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-0.5 text-xs text-emerald-500 dark:text-emerald-400 font-mono font-bold">
                                                <DollarSign className="h-3 w-3" />
                                                {(lead.estimatedValue || 0).toLocaleString()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getPriorityBadge(lead)}
                                        </TableCell>
                                        <TableCell>
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
                                                <span className="text-muted-foreground/60 text-[10px] italic">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-xs">
                                            <span className={isStale ? "text-amber-500 dark:text-amber-400 font-semibold flex items-center justify-end gap-1" : "text-muted-foreground"}>
                                                {isStale && <Clock className="h-3 w-3 text-amber-500 dark:text-amber-400 inline" />}
                                                {isStale ? `${daysIdle}d ago` : formatDistanceToNow(lastContact, { addSuffix: true })}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                                <Link
                                                    href={`/dashboard/proposals/builder/${lead.id}`}
                                                    className="inline-flex p-1.5 rounded-md bg-muted hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                                                    title="Open Proposal Studio"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                </Link>
                                                {(onEditLead || onArchiveLead) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="inline-flex p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                            >
                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-36 bg-card border-border text-foreground">
                                                            {onEditLead && (
                                                                <DropdownMenuItem
                                                                    onClick={() => onEditLead(lead)}
                                                                    className="text-xs cursor-pointer gap-2"
                                                                >
                                                                    <Edit3 className="h-3 w-3" /> Edit Deal
                                                                </DropdownMenuItem>
                                                            )}
                                                            {onArchiveLead && (
                                                                <DropdownMenuItem
                                                                    onClick={() => onArchiveLead(lead.id)}
                                                                    className="text-xs cursor-pointer gap-2 text-rose-400 focus:text-rose-400"
                                                                >
                                                                    <Archive className="h-3 w-3" /> {lead.isArchived ? "Unarchive" : "Archive"}
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function getStatusBadgeColor(status: string) {
    switch (status) {
        case "New Lead":
            return "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/30 text-[10px]";
        case "Discovery & Qualifying":
            return "bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/30 text-[10px]";
        case "Proposal Sent":
            return "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30 text-[10px]";
        case "In Negotiation":
            return "bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/30 text-[10px]";
        case "Closed Won":
            return "bg-primary/10 text-primary border-primary/30 text-[10px]";
        case "Closed Lost":
            return "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30 text-[10px]";
        default:
            return "bg-muted text-muted-foreground border-border text-[10px]";
    }
}
