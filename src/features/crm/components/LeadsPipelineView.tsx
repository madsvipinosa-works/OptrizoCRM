"use client";

import { CreateLeadModal } from "./CreateLeadModal";
import { useState, startTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LeadsDataTable, type LeadItem } from "./LeadsDataTable";
import { LeadsKanbanBoard } from "./LeadsKanbanBoard";
import { EditLeadModal } from "./EditLeadModal";
import {
    bulkAssignLeads,
    archiveLead,
    unarchiveLead,
} from "@/features/crm/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Archive, Columns3, LayoutList, Search, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

interface LeadsPipelineViewProps {
    initialLeads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    currentUserId: string;
    isAdmin?: boolean;
    initialLeadId?: string;
    initialQuery?: string;
    initialStatus?: string;
    /** Sales can add an opportunity. The modal is built here, in the client tree, not passed in from the server page. */
    canCreate?: boolean;
}

// Display names follow the mockups (step 2 / 2a); values are the stored stage names.
const STAGE_OPTIONS = [
    { value: "New Lead", label: "New lead" },
    { value: "Discovery & Qualifying", label: "Discovery" },
    { value: "Proposal Sent", label: "Proposal sent" },
    { value: "In Negotiation", label: "Negotiation" },
    { value: "Closed Won", label: "Closed" },
    { value: "Closed Lost", label: "Closed lost" },
] as const;

/**
 * Segmented control: muted track with a raised thumb that slides between options.
 * Keeps the brand green for the one primary action in the header.
 * The thumb moves fast (180ms, strong ease-out): the switch is used many times a day.
 */
function Segmented<T extends string>({
    label,
    value,
    onChange,
    options,
    id,
}: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: ReactNode }[];
    id: string;
}) {
    const reduceMotion = useReducedMotion();
    return (
        <div role="group" aria-label={label} className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        className={`relative flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-[color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring ${
                            active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {active && (
                            <motion.span
                                layoutId={`segment-thumb-${id}`}
                                transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                                className="absolute inset-0 rounded-md bg-card shadow-[0_1px_2px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-border/70"
                            />
                        )}
                        <span className="relative flex items-center gap-1.5">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

export function LeadsPipelineView({
    initialLeads,
    assignableUsers,
    currentUserId,
    isAdmin,
    initialQuery = "",
    initialStatus = "all",
    canCreate = false,
}: LeadsPipelineViewProps) {
    const [leadsList, setLeadsList] = useState<LeadItem[]>(initialLeads);
    const [viewLayout, setViewLayout] = useState<"kanban" | "table">(
        initialStatus === "Closed Lost" ? "table" : "kanban"
    );
    const [scopeMode, setScopeMode] = useState<"all" | "mine">("all");
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [selectedStageFilter, setSelectedStageFilter] = useState<string>(
        initialStatus && initialStatus !== "all" ? initialStatus : "all"
    );
    const [showArchived, setShowArchived] = useState(false);

    // Edit modal state
    const [editingLead, setEditingLead] = useState<LeadItem | null>(null);

    // Opening a lead goes to its own page (mockup step 3).
    const router = useRouter();
    const openLead = (lead: LeadItem) => router.push(`/dashboard/leads/${lead.id}`);

    const optimisticLeads = leadsList;

    // Leads in the current scope (archive view + All/Mine), before search and stage.
    const scopedLeads = optimisticLeads.filter((lead) => {
        if (showArchived ? !lead.isArchived : lead.isArchived) return false;
        if (scopeMode === "mine" && !lead.assignees?.some((a) => a.id === currentUserId)) return false;
        return true;
    });

    const filteredLeads = scopedLeads.filter((lead) => {
        // Stage filter applies in the table view; the board splits by stage already.
        if (viewLayout === "table" && selectedStageFilter !== "all") {
            if (selectedStageFilter === "active") {
                if (["Closed Won", "Closed Lost"].includes(lead.status)) return false;
            } else if (lead.status !== selectedStageFilter) {
                return false;
            }
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const haystack = [
                lead.businessName,
                lead.contactName,
                lead.client?.name,
                lead.contactEmail,
                lead.client?.email,
                lead.service?.title,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(q)) return false;
        }

        return true;
    });

    const lostCount = scopedLeads.filter((lead) => lead.status === "Closed Lost").length;
    const myCount = optimisticLeads.filter(
        (lead) => !lead.isArchived && lead.assignees?.some((a) => a.id === currentUserId)
    ).length;
    const activeLeads = optimisticLeads.filter((lead) => !lead.isArchived);
    const openCount = activeLeads.filter((lead) => !["Closed Won", "Closed Lost"].includes(lead.status)).length;
    const wonCount = activeLeads.filter((lead) => lead.status === "Closed Won").length;
    const unclaimedCount = activeLeads.filter(
        (lead) => !["Closed Won", "Closed Lost"].includes(lead.status) && !(lead.assignees?.length)
    ).length;
    const hasFilters = searchQuery.trim() !== "" || (viewLayout === "table" && selectedStageFilter !== "all");

    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedStageFilter("all");
        setShowArchived(false);
    };

    const showLostLeads = () => {
        setViewLayout("table");
        setSelectedStageFilter("Closed Lost");
    };

    // Handle editing a deal
    const handleLeadUpdated = (updatedData: Partial<LeadItem> & { id: string }) => {
        setLeadsList((prev) =>
            prev.map((lead) => (lead.id === updatedData.id ? { ...lead, ...updatedData } : lead))
        );
    };

    // Handle archiving / unarchiving a deal
    const handleArchiveLead = async (leadId: string) => {
        const lead = leadsList.find((l) => l.id === leadId);
        if (!lead) return;

        const willArchive = !lead.isArchived;

        // Optimistic update
        setLeadsList((prev) =>
            prev.map((l) => (l.id === leadId ? { ...l, isArchived: willArchive } : l))
        );

        try {
            const res = willArchive ? await archiveLead(leadId) : await unarchiveLead(leadId);
            if (res.success) {
                toast.success(res.message || (willArchive ? "Lead archived" : "Lead restored to pipeline"));
            } else {
                toast.error(res.message || "Failed to update lead");
                // Revert
                setLeadsList((prev) =>
                    prev.map((l) => (l.id === leadId ? { ...l, isArchived: !willArchive } : l))
                );
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to archive/unarchive lead");
            setLeadsList((prev) =>
                prev.map((l) => (l.id === leadId ? { ...l, isArchived: !willArchive } : l))
            );
        }
    };

    const handleBulkAssign = (leadIds: string[], assigneeUserId: string) => {
        startTransition(async () => {
            const res = await bulkAssignLeads(leadIds, [assigneeUserId]);
            if (res.success) {
                toast.success(res.message);
                const assignedUser = assignableUsers.find((u) => u.id === assigneeUserId);
                if (assignedUser) {
                    setLeadsList((prev) =>
                        prev.map((l) =>
                            leadIds.includes(l.id)
                                ? { ...l, assignees: [assignedUser as any] }
                                : l
                        )
                    );
                }
            } else {
                toast.error(res.message);
            }
        });
    };

    return (
        <div className="space-y-5">
            {/* Header: title, subtitle and Board/Table switch (mockup step 2 / 2a) */}
            {/* Wraps by available width, not by viewport: the sidebar takes space, so a
                fixed breakpoint squeezed the title. The actions drop below when they don't fit. */}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-[min(100%,22rem)] flex-1">
                    <h1 className="text-2xl font-bold tracking-[-0.025em] text-foreground sm:text-[28px]">Sales pipeline</h1>
                    <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground">
                        {viewLayout === "kanban"
                            ? "Cards move on their own. Log a call, email, or meeting to start discovery."
                            : "Stages change on their own. Log a call, email, or meeting to start discovery."}
                    </p>
                    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                        <span><strong className="font-semibold tabular-nums text-foreground">{openCount}</strong> open</span>
                        <span><strong className="font-semibold tabular-nums text-foreground">{unclaimedCount}</strong> unclaimed</span>
                        <span><strong className="font-semibold tabular-nums text-foreground">{wonCount}</strong> won</span>
                    </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Segmented
                        id="view"
                        label="Pipeline view"
                        value={viewLayout}
                        onChange={setViewLayout}
                        options={[
                            { value: "kanban", label: <><Columns3 className="size-4" aria-hidden="true" />Board</> },
                            { value: "table", label: <><LayoutList className="size-4" aria-hidden="true" />Table</> },
                        ]}
                    />
                    {canCreate && <CreateLeadModal assignableUsers={assignableUsers} />}
                </div>
            </div>

            {/* Toolbar: search, scope, stage (table only), lost and archived shortcuts */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                            type="search"
                            aria-label="Search business or client name"
                            placeholder="Search business or client name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 bg-card pl-9 pr-9"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>

                    <Segmented
                        id="scope"
                        label="Whose leads"
                        value={scopeMode}
                        onChange={setScopeMode}
                        options={[
                            { value: "all", label: "All leads" },
                            { value: "mine", label: <>Mine <span className="tabular-nums text-muted-foreground">{myCount}</span></> },
                        ]}
                    />

                    {viewLayout === "table" && (
                        <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
                            <SelectTrigger aria-label="Stage" className="h-10 w-[170px] bg-card text-sm">
                                <SelectValue placeholder="Stage" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All stages</SelectItem>
                                <SelectItem value="active">Open leads only</SelectItem>
                                {STAGE_OPTIONS.map((stage) => (
                                    <SelectItem key={stage.value} value={stage.value}>
                                        {stage.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {viewLayout === "kanban" && lostCount > 0 && (
                        <Button variant="outline" size="sm" onClick={showLostLeads} className="h-10 bg-card text-sm">
                            Closed lost <span className="tabular-nums text-muted-foreground">({lostCount})</span>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        aria-pressed={showArchived}
                        onClick={() => setShowArchived((prev) => !prev)}
                        className={`h-10 gap-1.5 text-sm ${showArchived ? "border-primary/50 bg-primary/10 text-foreground" : "bg-card text-muted-foreground"}`}
                    >
                        <Archive className="size-4" aria-hidden="true" />
                        {showArchived ? "Showing archived" : "Archived"}
                    </Button>
                </div>
            </div>

            {hasFilters && (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                    Showing <strong className="font-semibold text-foreground tabular-nums">{filteredLeads.length}</strong> of{" "}
                    <span className="tabular-nums">{scopedLeads.length}</span> leads.{" "}
                    <button type="button" onClick={handleResetFilters} className="font-medium text-foreground underline underline-offset-4">
                        Clear filters
                    </button>
                </p>
            )}

            {/* Active Pipeline View */}
            {viewLayout === "table" ? (
                <LeadsDataTable
                    leads={filteredLeads}
                    assignableUsers={assignableUsers}
                    isAdmin={isAdmin}
                    onBulkAssign={handleBulkAssign}
                    onSelectLead={openLead}
                    onEditLead={(lead) => setEditingLead(lead)}
                    onArchiveLead={handleArchiveLead}
                    onResetFilters={handleResetFilters}
                />
            ) : (
                <LeadsKanbanBoard
                    leads={filteredLeads}
                    assignableUsers={assignableUsers}
                    isAdmin={isAdmin}
                    onSelectLead={openLead}
                    onEditLead={(lead) => setEditingLead(lead)}
                    onArchiveLead={handleArchiveLead}
                />
            )}

            {/* Edit Lead Modal */}
            <EditLeadModal
                lead={editingLead}
                isOpen={!!editingLead}
                onClose={() => setEditingLead(null)}
                onLeadUpdated={handleLeadUpdated}
            />

        </div>
    );
}
