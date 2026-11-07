"use client";

import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ChevronDown,
    ChevronsUpDown,
    ArrowDown,
    ArrowUp,
    FileText,
    MoreHorizontal,
    Edit3,
    Archive,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { getLeadSubStatus, getDaysInStage } from "@/features/crm/utils/stageUtils";
import { SubStatusChip } from "./LeadsKanbanBoard";

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
        priority?: string;
    goals: string | null;
    industry?: string | null;
    targetAudience?: string | null;
    timelineExpectation?: string | null;
    status: string;
    source: string | null;
    stageChangedAt?: Date | string | null;
    lastContactedAt?: Date | string | null;
    nextFollowUpDate?: Date | string | null;
    lossReason?: string | null;
    lossNotes?: string | null;
    isArchived?: boolean;
    service?: { id: string; title: string } | null;
    otherServiceText?: string | null;
    urgency?: string | null;
    clientType?: string | null;
    roleInCompany?: string | null;
    contactPreference?: string | null;
    details?: string | null;
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
    onBulkAssign?: (leadIds: string[], assigneeUserId: string) => void;
    onSelectLead?: (lead: LeadItem) => void;
    onEditLead?: (lead: LeadItem) => void;
    onArchiveLead?: (leadId: string) => void;
    onResetFilters?: () => void;
}

const STAGES = [
    "New Lead",
    "Discovery & Qualifying",
    "Proposal Sent",
    "In Negotiation",
    "Closed Won",
    "Closed Lost",
] as const;

// Display names follow the mockups; stored values stay unchanged.
const STAGE_LABEL: Record<string, string> = {
    "New Lead": "New lead",
    "Discovery & Qualifying": "Discovery",
    "Proposal Sent": "Proposal sent",
    "In Negotiation": "Negotiation",
    "Closed Won": "Closed",
    "Closed Lost": "Closed lost",
};

type SortField = "stage" | "businessName" | "lastContact" | "daysInStage";

function SortableHead({
    label,
    field,
    sortField,
    sortOrder,
    onSort,
    className = "",
}: {
    label: string;
    field: SortField;
    sortField: SortField;
    sortOrder: "asc" | "desc";
    onSort: (field: SortField) => void;
    className?: string;
}) {
    const active = sortField === field;
    const Icon = !active ? ChevronsUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
    return (
        <TableHead
            className={className}
            aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
        >
            <button
                type="button"
                onClick={() => onSort(field)}
                className={`-ml-1.5 inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground ${
                    active ? "text-foreground" : "text-muted-foreground"
                }`}
            >
                {label}
                <Icon className="size-3.5 opacity-70" aria-hidden="true" />
            </button>
        </TableHead>
    );
}

export function LeadsDataTable({
    leads,
    assignableUsers,
    isAdmin,
    onBulkAssign,
    onSelectLead,
    onEditLead,
    onArchiveLead,
    onResetFilters,
}: LeadsDataTableProps) {
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [sortField, setSortField] = useState<SortField>("stage");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    // Pagination State: Defaults to 10 items as requested
    const [pageSize, setPageSize] = useState<number>(10);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Reset pagination to page 1 whenever leads length, sortField, or sortOrder change
    // (adjusting state during render, not in an effect: https://react.dev/learn/you-might-not-need-an-effect)
    const pageResetKey = `${leads.length}|${sortField}|${sortOrder}`;
    const [lastPageResetKey, setLastPageResetKey] = useState(pageResetKey);
    if (lastPageResetKey !== pageResetKey) {
        setLastPageResetKey(pageResetKey);
        setCurrentPage(1);
    }

    const toggleSelectRow = (id: string) => {
        setSelectedLeadIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const sortedLeads = useMemo(() => {
        const direction = sortOrder === "asc" ? 1 : -1;
        const nameOf = (lead: LeadItem) => (lead.businessName || lead.contactName || lead.client?.name || "").toLowerCase();
        const stageIndex = (lead: LeadItem) => {
            const index = STAGES.indexOf(lead.status as (typeof STAGES)[number]);
            return index === -1 ? STAGES.length : index;
        };
        const lastContactTime = (lead: LeadItem) => (lead.lastContactedAt ? new Date(lead.lastContactedAt).getTime() : 0);

        return [...leads].sort((a, b) => {
            let result = 0;
            if (sortField === "businessName") result = nameOf(a).localeCompare(nameOf(b));
            else if (sortField === "lastContact") result = lastContactTime(a) - lastContactTime(b);
            else if (sortField === "daysInStage") result = getDaysInStage(a) - getDaysInStage(b);
            else result = stageIndex(a) - stageIndex(b);
            // Stable tie-break: newest lead first.
            return result * direction || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [leads, sortField, sortOrder]);

    // Pagination calculations
    const totalItems = sortedLeads.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedLeads = useMemo(() => {
        return sortedLeads.slice(startIndex, endIndex);
    }, [sortedLeads, startIndex, endIndex]);

    // Current page selection state
    const isCurrentPageAllSelected =
        paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeadIds.includes(l.id));

    const toggleSelectCurrentPage = () => {
        if (isCurrentPageAllSelected) {
            const pageIds = new Set(paginatedLeads.map((l) => l.id));
            setSelectedLeadIds((prev) => prev.filter((id) => !pageIds.has(id)));
        } else {
            const pageIds = paginatedLeads.map((l) => l.id);
            setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const selectAllMatching = () => {
        setSelectedLeadIds(sortedLeads.map((l) => l.id));
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortOrder(field === "lastContact" || field === "daysInStage" ? "desc" : "asc");
        }
    };

    return (
        <div className="space-y-4">
            {/* Bulk Action Bar */}
            {selectedLeadIds.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="min-w-6 rounded-full bg-primary px-2 py-0.5 text-center text-xs font-bold tabular-nums text-primary-foreground">
                            {selectedLeadIds.length}
                        </span>
                        selected
                    </div>

                    <div className="flex items-center gap-2">
                        {onBulkAssign && isAdmin && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-8 gap-1 text-sm">
                                        Assign to <ChevronDown className="size-3.5" />
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

            {/* Smart Multi-Page Selection Banner */}
            {isCurrentPageAllSelected && totalItems > paginatedLeads.length && (
                <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-2.5 text-sm text-foreground animate-in fade-in duration-150">
                    <div>
                        <span>
                            All <strong className="font-semibold tabular-nums">{paginatedLeads.length}</strong> leads on this page are selected.
                        </span>
                        {selectedLeadIds.length < totalItems ? (
                            <button
                                type="button"
                                onClick={selectAllMatching}
                                className="ml-2 font-semibold underline underline-offset-4"
                            >
                                Select all {totalItems} leads
                            </button>
                        ) : (
                            <span className="ml-2 font-semibold">
                                All {totalItems} leads are selected.
                            </span>
                        )}
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLeadIds([])}
                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                        Clear Selection
                    </Button>
                </div>
            )}

            {/* Leads table (mockup step 2a): sorted by stage by default */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto override-scrollbar">
                <Table className="min-w-[900px]">
                    <TableHeader>
                        <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                            <TableHead className="w-[44px] px-4">
                                <Checkbox
                                    checked={isCurrentPageAllSelected}
                                    onCheckedChange={toggleSelectCurrentPage}
                                    aria-label="Select all rows on this page"
                                />
                            </TableHead>
                            <SortableHead label="Business name" field="businessName" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} className="min-w-[200px]" />
                            <TableHead className="text-sm font-medium text-muted-foreground">Service</TableHead>
                            <SortableHead label="Stage" field="stage" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} />
                            <TableHead className="text-sm font-medium text-muted-foreground">Status</TableHead>
                            <TableHead className="text-sm font-medium text-muted-foreground">Client type</TableHead>
                            <SortableHead label="Last contact" field="lastContact" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} />
                            <SortableHead label="In stage" field="daysInStage" sortField={sortField} sortOrder={sortOrder} onSort={toggleSort} />
                            <TableHead className="w-[76px]"><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedLeads.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={9} className="py-16 text-center">
                                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">No leads match</p>
                                        <p className="text-sm text-muted-foreground">Try a different search or stage.</p>
                                        {onResetFilters && (
                                            <Button variant="outline" size="sm" onClick={onResetFilters} className="mt-2 gap-1.5">
                                                <RotateCcw className="size-3.5" />
                                                Clear filters
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedLeads.map((lead) => {
                                const isSelected = selectedLeadIds.includes(lead.id);
                                const leadTitle = lead.businessName || lead.contactName || lead.client?.name || "Unnamed lead";
                                const clientName = lead.contactName || lead.client?.name;
                                const service = lead.service?.title || lead.otherServiceText || null;
                                const lastContact = lead.lastContactedAt ? new Date(lead.lastContactedAt) : null;
                                const days = getDaysInStage(lead);
                                const isClosed = ["Closed Won", "Closed Lost"].includes(lead.status);

                                return (
                                    <TableRow
                                        key={lead.id}
                                        data-state={isSelected ? "selected" : undefined}
                                        tabIndex={0}
                                        aria-label={`Open ${leadTitle}`}
                                        onClick={() => onSelectLead?.(lead)}
                                        onKeyDown={(event) => {
                                            if (event.target !== event.currentTarget) return;
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                onSelectLead?.(lead);
                                            }
                                        }}
                                        className="group cursor-pointer border-border outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/60 data-[state=selected]:bg-primary/[0.06]"
                                    >
                                        <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelectRow(lead.id)}
                                                aria-label={`Select ${leadTitle}`}
                                            />
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="text-sm font-semibold text-foreground">{leadTitle}</div>
                                            {clientName && clientName !== leadTitle && (
                                                <div className="text-xs text-muted-foreground">{clientName}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-foreground">
                                            {service ?? <span className="text-muted-foreground">Not set</span>}
                                        </TableCell>
                                        <TableCell className="text-sm text-foreground">{STAGE_LABEL[lead.status] ?? lead.status}</TableCell>
                                        <TableCell>
                                            <SubStatusChip status={getLeadSubStatus(lead)} />
                                        </TableCell>
                                        <TableCell className="text-sm capitalize text-foreground">{lead.clientType ?? "local"}</TableCell>
                                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                                            {lastContact ? format(lastContact, "MMM d") : "—"}
                                        </TableCell>
                                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                                            {isClosed ? "—" : days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`}
                                        </TableCell>
                                        <TableCell className="pr-3" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-0.5">
                                                {lead.proposals && lead.proposals.length > 0 && (
                                                    <Link
                                                        href={`/dashboard/proposals/${lead.proposals[0].id}`}
                                                        prefetch={false}
                                                        aria-label={`View proposal for ${leadTitle}`}
                                                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                    >
                                                        <FileText className="size-4" />
                                                    </Link>
                                                )}
                                                {(onEditLead || onArchiveLead) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                type="button"
                                                                aria-label={`Actions for ${leadTitle}`}
                                                                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                            >
                                                                <MoreHorizontal className="size-4" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-40">
                                                            {onEditLead && (
                                                                <DropdownMenuItem onClick={() => onEditLead(lead)} className="gap-2">
                                                                    <Edit3 className="size-3.5" /> Edit details
                                                                </DropdownMenuItem>
                                                            )}
                                                            {onArchiveLead && (
                                                                <DropdownMenuItem onClick={() => onArchiveLead(lead.id)} className="gap-2 text-destructive focus:text-destructive">
                                                                    <Archive className="size-3.5" /> {lead.isArchived ? "Unarchive" : "Archive"}
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

                {/* Pagination Footer: 10 items default + navigation + selector */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border text-xs">
                    {/* Left: Range and Rows per Page */}
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="text-muted-foreground font-medium">
                            Showing{" "}
                            <strong className="text-foreground font-semibold">
                                {totalItems === 0 ? "0" : `${startIndex + 1}–${endIndex}`}
                            </strong>{" "}
                            of <strong className="text-foreground font-semibold">{totalItems}</strong> leads
                        </span>

                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Rows per page:</span>
                            <Select
                                value={String(pageSize)}
                                onValueChange={(val) => {
                                    setPageSize(Number(val));
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="h-7 w-[68px] text-xs bg-card border-border text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    <SelectItem value="10" className="text-xs">10</SelectItem>
                                    <SelectItem value="25" className="text-xs">25</SelectItem>
                                    <SelectItem value="50" className="text-xs">50</SelectItem>
                                    <SelectItem value="100" className="text-xs">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Right: Page Navigation Controls */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground mr-2 font-medium">
                            Page <strong className="text-foreground">{safeCurrentPage}</strong> of{" "}
                            <strong className="text-foreground">{totalPages}</strong>
                        </span>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={safeCurrentPage <= 1}
                            className="h-7 w-7 p-0 bg-card border-border text-foreground disabled:opacity-40"
                            title="First Page"
                        >
                            <ChevronsLeft className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={safeCurrentPage <= 1}
                            className="h-7 px-2.5 gap-1 bg-card border-border text-xs text-foreground disabled:opacity-40"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Prev</span>
                        </Button>

                        {/* Page Number Pills */}
                        <div className="flex items-center gap-1 mx-1">
                            {getPageNumbers(safeCurrentPage, totalPages).map((p, idx) => {
                                if (p === "...") {
                                    return (
                                        <span key={`dots-${idx}`} className="px-1 text-muted-foreground">
                                            ...
                                        </span>
                                    );
                                }
                                const pageNum = Number(p);
                                const isActive = pageNum === safeCurrentPage;
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={isActive ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`h-7 w-7 p-0 text-xs font-semibold ${
                                            isActive
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : "bg-card border-border text-foreground hover:bg-muted"
                                        }`}
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safeCurrentPage >= totalPages}
                            className="h-7 px-2.5 gap-1 bg-card border-border text-xs text-foreground disabled:opacity-40"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={safeCurrentPage >= totalPages}
                            className="h-7 w-7 p-0 bg-card border-border text-foreground disabled:opacity-40"
                            title="Last Page"
                        >
                            <ChevronsRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
    if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
        return [1, 2, 3, 4, "...", totalPages];
    }
    if (currentPage >= totalPages - 2) {
        return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}
