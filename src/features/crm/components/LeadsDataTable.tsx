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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { LeadCard } from "./LeadCard";
import { Calendar, DollarSign, Building2, ChevronDown, UserCheck, ArrowUpDown, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export type LeadItem = {
    id: string;
    businessName: string | null;
    clientId: string;
    client?: { name: string | null; email: string };
    goals: string | null;
    status: string;
    industry?: string | null;
    budget: string | null;
    source: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    assignees?: { id: string; name: string | null; image: string | null; jobTitle?: string | null }[];
    activityLogs?: any[];
};

interface LeadsDataTableProps {
    leads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null }[];
    isAdmin?: boolean;
    onStatusChangeRequest: (leadId: string, leadTitle: string, fromStatus: string, toStatus: string) => void;
    onBulkStatusChange?: (leadIds: string[], toStatus: string) => void;
    onBulkAssign?: (leadIds: string[], assigneeUserId: string) => void;
}

const STAGES = ["Pending Approval", "In Review", "Proposal Sent", "Closed Won", "Closed Lost"] as const;

export function LeadsDataTable({
    leads,
    assignableUsers,
    isAdmin,
    onStatusChangeRequest,
    onBulkStatusChange,
    onBulkAssign,
}: LeadsDataTableProps) {
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [sortField, setSortField] = useState<"createdAt" | "businessName" | "budget">("createdAt");
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

    // Sort leads
    const sortedLeads = [...leads].sort((a, b) => {
        if (sortField === "businessName") {
            const nameA = (a.businessName || a.client?.name || "").toLowerCase();
            const nameB = (b.businessName || b.client?.name || "").toLowerCase();
            return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else if (sortField === "budget") {
            const parseVal = (val: string | null) => {
                if (!val) return 0;
                const match = val.match(/\d+/);
                return match ? parseInt(match[0]) : 0;
            };
            const valA = parseVal(a.budget);
            const valB = parseVal(b.budget);
            return sortOrder === "asc" ? valA - valB : valB - valA;
        } else {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
        }
    });

    const toggleSort = (field: "createdAt" | "businessName" | "budget") => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

    if (leads.length === 0) {
        return (
            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl text-zinc-400 bg-white/5">
                No leads match the current filters.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Bulk Action Bar Floating Header */}
            {selectedLeadIds.length > 0 && (
                <div className="flex items-center justify-between p-3 px-4 rounded-xl bg-primary/10 border border-primary/30 text-white animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                            <strong className="text-primary font-semibold">{selectedLeadIds.length}</strong> lead{selectedLeadIds.length > 1 ? "s" : ""} selected
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {onBulkStatusChange && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="bg-black/60 border-white/20 text-xs h-8">
                                        Bulk Move Status <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-950 border-white/15 text-white">
                                    <DropdownMenuLabel className="text-xs text-zinc-400">Change Status To</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    {STAGES.map((stg) => (
                                        <DropdownMenuItem
                                            key={stg}
                                            onClick={() => {
                                                onBulkStatusChange(selectedLeadIds, stg);
                                                setSelectedLeadIds([]);
                                            }}
                                            className="text-xs focus:bg-white/10 cursor-pointer"
                                        >
                                            {stg}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {isAdmin && onBulkAssign && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="bg-black/60 border-white/20 text-xs h-8">
                                        Bulk Assign Staff <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-950 border-white/15 text-white">
                                    <DropdownMenuLabel className="text-xs text-zinc-400">Assign To Staff</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    {assignableUsers.map((usr) => (
                                        <DropdownMenuItem
                                            key={usr.id}
                                            onClick={() => {
                                                onBulkAssign(selectedLeadIds, usr.id);
                                                setSelectedLeadIds([]);
                                            }}
                                            className="text-xs focus:bg-white/10 cursor-pointer"
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
                            className="text-xs h-8 text-zinc-400 hover:text-white"
                        >
                            Clear Selection
                        </Button>
                    </div>
                </div>
            )}

            {/* Smart Data Table */}
            <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-xl backdrop-blur-md">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="hover:bg-transparent border-white/10">
                            <TableHead className="w-[40px] px-3">
                                <Checkbox
                                    checked={selectedLeadIds.length === leads.length && leads.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                    className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                                />
                            </TableHead>
                            <TableHead className="min-w-[200px]">
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleSort("businessName")}
                                    className="p-0 text-xs font-semibold hover:bg-transparent hover:text-primary text-zinc-300 flex items-center gap-1"
                                >
                                    Lead / Contact <ArrowUpDown className="h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead className="w-[160px]">Status Stage</TableHead>
                            <TableHead>Industry / Focus</TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleSort("budget")}
                                    className="p-0 text-xs font-semibold hover:bg-transparent hover:text-primary text-zinc-300 flex items-center gap-1"
                                >
                                    Budget / Value <ArrowUpDown className="h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead>Assignees</TableHead>
                            <TableHead className="text-right">
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleSort("createdAt")}
                                    className="p-0 text-xs font-semibold hover:bg-transparent hover:text-primary text-zinc-300 flex items-center gap-1 ml-auto"
                                >
                                    Created <ArrowUpDown className="h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead className="w-[50px] text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedLeads.map((lead) => {
                            const isSelected = selectedLeadIds.includes(lead.id);
                            const leadTitle = lead.businessName || lead.client?.name || "Unknown Lead";

                            return (
                                <TableRow
                                    key={lead.id}
                                    className={`border-white/10 transition-colors group ${
                                        isSelected ? "bg-primary/5" : "hover:bg-white/5"
                                    }`}
                                >
                                    <TableCell className="px-3">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelectRow(lead.id)}
                                            className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <div className="flex flex-col cursor-pointer">
                                                    <span className="font-semibold text-white group-hover:text-primary transition-colors text-sm">
                                                        {leadTitle}
                                                    </span>
                                                    <span className="text-xs text-zinc-400">
                                                        {lead.client?.email || "No email"}
                                                    </span>
                                                </div>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 p-0 overflow-hidden outline-none">
                                                <DialogHeader className="sr-only">
                                                    <DialogTitle>Lead Details: {leadTitle}</DialogTitle>
                                                    <DialogDescription>Overview and activity history for {leadTitle}</DialogDescription>
                                                </DialogHeader>
                                                <LeadCard
                                                    lead={lead as any}
                                                    assignableUsers={assignableUsers}
                                                    isAdmin={isAdmin}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="p-0 h-auto hover:bg-transparent"
                                                >
                                                    <Badge
                                                        variant="secondary"
                                                        className={`cursor-pointer hover:opacity-80 transition-opacity ${getStatusBadgeColor(lead.status)}`}
                                                    >
                                                        {lead.status}
                                                        <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                                                    </Badge>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="bg-zinc-950 border-white/15 text-white">
                                                <DropdownMenuLabel className="text-xs text-zinc-400">Move Lead Stage</DropdownMenuLabel>
                                                <DropdownMenuSeparator className="bg-white/10" />
                                                {STAGES.map((stg) => (
                                                    <DropdownMenuItem
                                                        key={stg}
                                                        disabled={stg === lead.status}
                                                        onClick={() => onStatusChangeRequest(lead.id, leadTitle, lead.status, stg)}
                                                        className="text-xs focus:bg-white/10 cursor-pointer flex items-center justify-between"
                                                    >
                                                        <span>{stg}</span>
                                                        {stg === lead.status && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                    <TableCell>
                                        {lead.industry ? (
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                                                <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                                                {lead.industry}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-600 italic">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {lead.budget ? (
                                            <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                                                <DollarSign className="h-3.5 w-3.5" />
                                                {lead.budget}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-600 italic">Unspecified</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {lead.assignees && lead.assignees.length > 0 ? (
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <div className="flex -space-x-1.5">
                                                    {lead.assignees.slice(0, 3).map((assignee, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="w-6 h-6 rounded-full bg-zinc-900 border border-white/20 text-primary flex items-center justify-center font-bold text-[10px]"
                                                            title={assignee.name || "Staff"}
                                                        >
                                                            {assignee.name?.[0]?.toUpperCase() || "U"}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-xs text-zinc-400 max-w-[90px] truncate">
                                                    {lead.assignees[0]?.name}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Unassigned</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1 text-xs text-zinc-400">
                                            <Calendar className="h-3 w-3 text-zinc-500" />
                                            {format(new Date(lead.createdAt), "MMM d")}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-white/10">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 p-0 overflow-hidden outline-none">
                                                <DialogHeader className="sr-only">
                                                    <DialogTitle>Lead Details: {leadTitle}</DialogTitle>
                                                    <DialogDescription>Quick view of lead info</DialogDescription>
                                                </DialogHeader>
                                                <LeadCard
                                                    lead={lead as any}
                                                    assignableUsers={assignableUsers}
                                                    isAdmin={isAdmin}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function getStatusBadgeColor(status: string) {
    switch (status) {
        case "Pending Approval": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
        case "In Review": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
        case "Proposal Sent": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
        case "Closed Won": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
        case "Closed Lost": return "bg-rose-500/10 text-rose-400 border-rose-500/30";
        default: return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
}
