"use client";

import { useState, useOptimistic, startTransition, useEffect, useMemo } from "react";
import { LeadsDataTable, type LeadItem } from "./LeadsDataTable";
import { LeadsKanbanBoard } from "./LeadsKanbanBoard";
import { LeadStatusValidationModal } from "./LeadStatusValidationModal";
import { CloseLostModal } from "./CloseLostModal";
import { LeadDetailsDrawer } from "./LeadDetailsDrawer";
import { EditLeadModal } from "./EditLeadModal";
import {
    transitionLeadStage,
    bulkUpdateLeadStatus,
    bulkAssignLeads,
    archiveLead,
    unarchiveLead,
} from "@/features/crm/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    LayoutList,
    Columns,
    Search,
    Users,
    User,
    RefreshCw,
    AlertTriangle,
    CalendarClock,
    Archive,
    Building2,
    DollarSign,
    Globe,
    Calendar,
    X,
} from "lucide-react";
import { toast } from "sonner";
import type { LossReason } from "@/lib/schemas";

interface LeadsPipelineViewProps {
    initialLeads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    currentUserId: string;
    isAdmin?: boolean;
    initialLeadId?: string;
    initialQuery?: string;
    initialStatus?: string;
}

export function LeadsPipelineView({
    initialLeads,
    assignableUsers,
    currentUserId,
    isAdmin,
    initialLeadId,
    initialQuery = "",
    initialStatus = "all",
}: LeadsPipelineViewProps) {
    const [leadsList, setLeadsList] = useState<LeadItem[]>(initialLeads);
    const [viewLayout, setViewLayout] = useState<"kanban" | "table">("kanban");
    const [scopeMode, setScopeMode] = useState<"all" | "mine">("all");
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [selectedStageFilter, setSelectedStageFilter] = useState<string>(
        initialStatus && initialStatus !== "all" ? initialStatus : "all"
    );
    const [selectedIndustryFilter, setSelectedIndustryFilter] = useState<string>("all");
    const [selectedValueFilter, setSelectedValueFilter] = useState<string>("all");
    const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("all");
    const [selectedDateRange, setSelectedDateRange] = useState<string>("all");
    const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
    const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>("all");
    const [staleOnlyFilter, setStaleOnlyFilter] = useState(false);
    const [overdueTasksOnly, setOverdueTasksOnly] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    // Edit modal state
    const [editingLead, setEditingLead] = useState<LeadItem | null>(null);

    // Side-over drawer state
    const [selectedLeadForDrawer, setSelectedLeadForDrawer] = useState<LeadItem | null>(null);

    useEffect(() => {
        if (!initialLeadId) return;
        const lead = leadsList.find((item) => item.id === initialLeadId);
        if (lead) setSelectedLeadForDrawer(lead);
    }, [initialLeadId, leadsList]);

    // Intercept Validation Modal state (for generic transitions)
    const [pendingValidation, setPendingValidation] = useState<{
        isOpen: boolean;
        leadId?: string;
        leadIds?: string[];
        leadTitle: string;
        fromStatus: string;
        toStatus: string;
    }>({
        isOpen: false,
        leadTitle: "",
        fromStatus: "",
        toStatus: "",
    });

    // Close Lost Modal state (for Closed Lost transitions)
    const [closeLostModalState, setCloseLostModalState] = useState<{
        isOpen: boolean;
        leadId?: string;
        leadTitle: string;
    }>({
        isOpen: false,
        leadTitle: "",
    });

    const [isSubmittingMutation, setIsSubmittingMutation] = useState(false);

    // React 19 Optimistic State Update Hook
    const [optimisticLeads, setOptimisticLeads] = useOptimistic(
        leadsList,
        (state: LeadItem[], update: { leadId: string; newStatus: string; lossReason?: string; lossNotes?: string }) => {
            return state.map((lead) =>
                lead.id === update.leadId
                    ? {
                          ...lead,
                          status: update.newStatus,
                          lossReason: update.lossReason || lead.lossReason,
                          lossNotes: update.lossNotes || lead.lossNotes,
                          updatedAt: new Date().toISOString(),
                      }
                    : lead
            );
        }
    );

    // Dynamically calculate distinct industries with counts
    const distinctIndustries = useMemo(() => {
        const counts: Record<string, number> = {};
        optimisticLeads.forEach((lead) => {
            if (showArchived ? !lead.isArchived : lead.isArchived) return;
            const ind = lead.industry?.trim();
            if (ind) {
                counts[ind] = (counts[ind] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, count]) => ({ name, count }));
    }, [optimisticLeads, showArchived]);

    // Dynamically calculate distinct sources with counts (case-insensitive deduplication & normalization)
    const distinctSources = useMemo(() => {
        const map = new Map<string, { name: string; count: number }>();
        optimisticLeads.forEach((lead) => {
            if (showArchived ? !lead.isArchived : lead.isArchived) return;
            const src = lead.source?.trim();
            if (src) {
                const key = src.toLowerCase();
                const existing = map.get(key);
                if (existing) {
                    existing.count += 1;
                } else {
                    map.set(key, { name: src, count: 1 });
                }
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [optimisticLeads, showArchived]);

    // Filter leads across both views
    const filteredLeads = optimisticLeads.filter((lead) => {
        // Archived filter (hide archived by default; if showArchived is true, view only archived)
        if (showArchived) {
            if (!lead.isArchived) return false;
        } else {
            if (lead.isArchived) return false;
        }

        // Staff assignment scope filter
        if (scopeMode === "mine") {
            const isAssigned = lead.assignees?.some((a) => a.id === currentUserId);
            if (!isAssigned) return false;
        }

        // Specific Assignee filter
        if (selectedAssigneeFilter !== "all") {
            if (selectedAssigneeFilter === "unassigned") {
                if (lead.assignees && lead.assignees.length > 0) return false;
            } else {
                const hasRep = lead.assignees?.some((a) => a.id === selectedAssigneeFilter);
                if (!hasRep) return false;
            }
        }

        // Stage / Status filter (Applies in table view where stages are mixed in rows)
        if (viewLayout === "table" && selectedStageFilter !== "all") {
            if (selectedStageFilter === "active") {
                if (["Closed Won", "Closed Lost"].includes(lead.status)) return false;
            } else if (lead.status !== selectedStageFilter) {
                return false;
            }
        }

        // Industry filter
        if (selectedIndustryFilter !== "all") {
            if (selectedIndustryFilter === "unspecified") {
                if (lead.industry && lead.industry.trim() !== "") return false;
            } else {
                if ((lead.industry || "").trim().toLowerCase() !== selectedIndustryFilter.toLowerCase()) {
                    return false;
                }
            }
        }

        // Deal Value ($) Range filter
        if (selectedValueFilter !== "all") {
            const val = lead.estimatedValue ?? 0;
            if (selectedValueFilter === "under-10k" && val >= 10000) return false;
            if (selectedValueFilter === "10k-25k" && (val < 10000 || val > 25000)) return false;
            if (selectedValueFilter === "25k-50k" && (val <= 25000 || val > 50000)) return false;
            if (selectedValueFilter === "50k-100k" && (val <= 50000 || val > 100000)) return false;
            if (selectedValueFilter === "over-100k" && val <= 100000) return false;
        }

        // Lead Source filter (case-insensitive)
        if (selectedSourceFilter !== "all") {
            if ((lead.source || "").trim().toLowerCase() !== selectedSourceFilter.toLowerCase()) return false;
        }

        // Date Range / Timeframe filter
        if (selectedDateRange !== "all") {
            const createdAtTime = new Date(lead.createdAt).getTime();
            const now = Date.now();
            if (selectedDateRange === "today") {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                if (createdAtTime < startOfDay.getTime()) return false;
            } else if (selectedDateRange === "7days") {
                if (now - createdAtTime > 7 * 24 * 3600 * 1000) return false;
            } else if (selectedDateRange === "30days") {
                if (now - createdAtTime > 30 * 24 * 3600 * 1000) return false;
            } else if (selectedDateRange === "quarter") {
                if (now - createdAtTime > 90 * 24 * 3600 * 1000) return false;
            } else if (selectedDateRange === "year") {
                if (now - createdAtTime > 365 * 24 * 3600 * 1000) return false;
            }
        }

        // Priority filter
        if (selectedPriorityFilter !== "all") {
            const score = lead.leadScore ?? 50;
            const priority = lead.priority ?? (score >= 75 ? "Hot" : score < 45 ? "Cold" : "Warm");
            if (priority !== selectedPriorityFilter) return false;
        }

        // Overdue tasks filter
        if (overdueTasksOnly) {
            const now = Date.now();
            const hasOverdue = lead.crmTasks?.some((t: any) => {
                if (t.status === "Completed") return false;
                if (!t.dueDate) return false;
                return new Date(t.dueDate).getTime() < now;
            });
            if (!hasOverdue) return false;
        }

        // Stale-only filter (>5 days without contact, not in terminal stage)
        if (staleOnlyFilter) {
            if (["Closed Won", "Closed Lost"].includes(lead.status)) return false;
            const lastActivity = lead.lastContactedAt
                ? new Date(lead.lastContactedAt).getTime()
                : lead.updatedAt
                ? new Date(lead.updatedAt).getTime()
                : new Date(lead.createdAt).getTime();
            const daysIdle = Math.floor((Date.now() - lastActivity) / (1000 * 3600 * 24));
            if (daysIdle < 5) return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = (lead.businessName || lead.contactName || lead.client?.name || "").toLowerCase().includes(q);
            const matchEmail = (lead.contactEmail || lead.client?.email || "").toLowerCase().includes(q);
            const matchIndustry = (lead.industry || "").toLowerCase().includes(q);
            if (!matchName && !matchEmail && !matchIndustry) return false;
        }

        return true;
    });

    // Reset all filters function
    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedStageFilter("all");
        setSelectedIndustryFilter("all");
        setSelectedValueFilter("all");
        setSelectedSourceFilter("all");
        setSelectedDateRange("all");
        setSelectedPriorityFilter("all");
        setSelectedAssigneeFilter("all");
        setStaleOnlyFilter(false);
        setOverdueTasksOnly(false);
        setShowArchived(false);
    };

    // Calculate active filter tags for the pill bar
    const activeFilters = [
        viewLayout === "table" && selectedStageFilter !== "all" && {
            label: `Stage: ${selectedStageFilter === "active" ? "Active Deals" : selectedStageFilter}`,
            clear: () => setSelectedStageFilter("all"),
        },
        selectedIndustryFilter !== "all" && {
            label: `Industry: ${selectedIndustryFilter === "unspecified" ? "Unspecified" : selectedIndustryFilter}`,
            clear: () => setSelectedIndustryFilter("all"),
        },
        selectedValueFilter !== "all" && {
            label: `Value: ${
                selectedValueFilter === "under-10k" ? "< $10k" :
                selectedValueFilter === "10k-25k" ? "$10k - $25k" :
                selectedValueFilter === "25k-50k" ? "$25k - $50k" :
                selectedValueFilter === "50k-100k" ? "$50k - $100k" : "> $100k"
            }`,
            clear: () => setSelectedValueFilter("all"),
        },
        selectedSourceFilter !== "all" && {
            label: `Source: ${selectedSourceFilter}`,
            clear: () => setSelectedSourceFilter("all"),
        },
        selectedPriorityFilter !== "all" && {
            label: `Priority: ${selectedPriorityFilter}`,
            clear: () => setSelectedPriorityFilter("all"),
        },
        selectedAssigneeFilter !== "all" && {
            label: `Assignee: ${selectedAssigneeFilter === "unassigned" ? "Unassigned" : assignableUsers.find(u => u.id === selectedAssigneeFilter)?.name || "Staff"}`,
            clear: () => setSelectedAssigneeFilter("all"),
        },
        selectedDateRange !== "all" && {
            label: `Created: ${
                selectedDateRange === "today" ? "Today" :
                selectedDateRange === "7days" ? "Past 7d" :
                selectedDateRange === "30days" ? "Past 30d" :
                selectedDateRange === "quarter" ? "Past 90d" : "Past 1y"
            }`,
            clear: () => setSelectedDateRange("all"),
        },
        overdueTasksOnly && {
            label: "Overdue Tasks",
            clear: () => setOverdueTasksOnly(false),
        },
        staleOnlyFilter && {
            label: "Stale (>5d)",
            clear: () => setStaleOnlyFilter(false),
        },
        showArchived && {
            label: "Archived Deals",
            clear: () => setShowArchived(false),
        },
        searchQuery.trim() !== "" && {
            label: `Search: "${searchQuery}"`,
            clear: () => setSearchQuery(""),
        },
    ].filter(Boolean) as { label: string; clear: () => void }[];

    // Handle editing a deal
    const handleLeadUpdated = (updatedData: Partial<LeadItem> & { id: string }) => {
        setLeadsList((prev) =>
            prev.map((lead) => (lead.id === updatedData.id ? { ...lead, ...updatedData } : lead))
        );
        if (selectedLeadForDrawer?.id === updatedData.id) {
            setSelectedLeadForDrawer((prev) => (prev ? { ...prev, ...updatedData } : null));
        }
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
        if (selectedLeadForDrawer?.id === leadId) {
            setSelectedLeadForDrawer((prev) => (prev ? { ...prev, isArchived: willArchive } : null));
        }

        try {
            const res = willArchive ? await archiveLead(leadId) : await unarchiveLead(leadId);
            if (res.success) {
                toast.success(res.message || (willArchive ? "Deal archived" : "Deal restored to pipeline"));
            } else {
                toast.error(res.message || "Failed to update deal status");
                // Revert
                setLeadsList((prev) =>
                    prev.map((l) => (l.id === leadId ? { ...l, isArchived: !willArchive } : l))
                );
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to archive/unarchive deal");
            setLeadsList((prev) =>
                prev.map((l) => (l.id === leadId ? { ...l, isArchived: !willArchive } : l))
            );
        }
    };

    // Intercept Callback: Triggered by Drag-and-Drop or Quick Status Dropdown
    const handleStatusChangeRequest = (
        leadId: string,
        leadTitle: string,
        fromStatus: string,
        toStatus: string
    ) => {
        if (toStatus === "Closed Lost") {
            setCloseLostModalState({
                isOpen: true,
                leadId,
                leadTitle,
            });
        } else {
            setPendingValidation({
                isOpen: true,
                leadId,
                leadTitle,
                fromStatus,
                toStatus,
            });
        }
    };

    // Execution of generic stage transition
    const handleConfirmStatusChange = async (reasonNotes?: string) => {
        const { leadId, leadIds, toStatus } = pendingValidation;
        if (!toStatus) return;
        if (!leadId && (!leadIds || leadIds.length === 0)) return;

        setIsSubmittingMutation(true);

        if (leadIds && leadIds.length > 0) {
            startTransition(() => {
                leadIds.forEach((id) => setOptimisticLeads({ leadId: id, newStatus: toStatus }));
            });
            try {
                const res = await bulkUpdateLeadStatus(leadIds, toStatus as any);
                if (res.success) {
                    if (res.errors && Object.keys(res.errors).length > 0) {
                        toast.warning(res.message);
                    } else {
                        toast.success(res.message);
                    }
                    setLeadsList((prev) =>
                        prev.map((l) => (leadIds.includes(l.id) ? { ...l, status: toStatus } : l))
                    );
                } else {
                    toast.error(res.message || "Failed to bulk update deals");
                }
            } catch (err) {
                console.error(err);
                toast.error("An unexpected error occurred during bulk update");
            } finally {
                setIsSubmittingMutation(false);
                setPendingValidation({
                    isOpen: false,
                    leadTitle: "",
                    fromStatus: "",
                    toStatus: "",
                });
            }
        } else if (leadId) {
            startTransition(() => {
                setOptimisticLeads({ leadId, newStatus: toStatus });
            });

            try {
                const res = await transitionLeadStage({
                    leadId,
                    newStatus: toStatus as any,
                    reasonNotes,
                });
                if (res.success) {
                    toast.success(res.message || `Moved deal to ${toStatus}`);
                    setLeadsList((prev) =>
                        prev.map((l) => (l.id === leadId ? { ...l, status: toStatus } : l))
                    );
                    if (selectedLeadForDrawer?.id === leadId) {
                        setSelectedLeadForDrawer((prev) => (prev ? { ...prev, status: toStatus } : null));
                    }
                } else {
                    toast.error(res.message || "Failed to update deal status");
                }
            } catch (err) {
                console.error(err);
                toast.error("An unexpected error occurred");
            } finally {
                setIsSubmittingMutation(false);
                setPendingValidation({
                    isOpen: false,
                    leadTitle: "",
                    fromStatus: "",
                    toStatus: "",
                });
            }
        }
    };

    // Execution of Closed Lost transition with mandatory reason
    const handleConfirmCloseLost = async (lossReason: LossReason, lossNotes?: string) => {
        const { leadId } = closeLostModalState;
        if (!leadId) return;

        setIsSubmittingMutation(true);
        startTransition(() => {
            setOptimisticLeads({ leadId, newStatus: "Closed Lost", lossReason, lossNotes });
        });

        try {
            const res = await transitionLeadStage({
                leadId,
                newStatus: "Closed Lost",
                lossReason,
                lossNotes,
            });

            if (res.success) {
                toast.success(res.message || "Opportunity marked as Closed Lost");
                setLeadsList((prev) =>
                    prev.map((l) =>
                        l.id === leadId ? { ...l, status: "Closed Lost", lossReason, lossNotes } : l
                    )
                );
                if (selectedLeadForDrawer?.id === leadId) {
                    setSelectedLeadForDrawer((prev) =>
                        prev ? { ...prev, status: "Closed Lost", lossReason, lossNotes } : null
                    );
                }
            } else {
                toast.error(res.message || "Failed to update deal status");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while marking deal as lost");
        } finally {
            setIsSubmittingMutation(false);
            setCloseLostModalState({
                isOpen: false,
                leadId: undefined,
                leadTitle: "",
            });
        }
    };

    const handleBulkStatusChangeRequest = (leadIds: string[], toStatus: string) => {
        setPendingValidation({
            isOpen: true,
            leadIds,
            leadTitle: `${leadIds.length} Selected Deals`,
            fromStatus: "Mixed",
            toStatus,
        });
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

    const handleAssignStaff = (leadId: string, assigneeUserIds: string[]) => {
        startTransition(async () => {
            const res = await bulkAssignLeads([leadId], assigneeUserIds);
            if (res.success) {
                toast.success("Lead assignments updated");
                const matchedUsers = assignableUsers.filter((u) => assigneeUserIds.includes(u.id));
                setLeadsList((prev) =>
                    prev.map((l) => (l.id === leadId ? { ...l, assignees: matchedUsers as any } : l))
                );
                if (selectedLeadForDrawer?.id === leadId) {
                    setSelectedLeadForDrawer((prev) =>
                        prev ? { ...prev, assignees: matchedUsers as any } : null
                    );
                }
            } else {
                toast.error(res.message || "Failed to update assignments");
            }
        });
    };

    return (
        <div className="space-y-4">
            {/* Control Bar: View Toggle, Search, Filters, Reset */}
            <div className="space-y-3">
                {/* Top Row: Scope & View Switcher + Search & Reset */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border glass-card">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View Scope Tabs */}
                        <Tabs value={scopeMode} onValueChange={(v) => setScopeMode(v as "all" | "mine")}>
                            <TabsList className="bg-muted/50 border border-border p-1">
                                <TabsTrigger
                                    value="all"
                                    className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black font-medium"
                                >
                                    <Users className="h-3.5 w-3.5 mr-1.5" /> All Pipeline ({leadsList.filter(l => !l.isArchived).length})
                                </TabsTrigger>
                                <TabsTrigger
                                    value="mine"
                                    className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black font-medium"
                                >
                                    <User className="h-3.5 w-3.5 mr-1.5" /> My Assigned
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {/* View Switcher: Kanban vs Table */}
                        <div className="flex items-center rounded-lg border border-border p-1 bg-muted/50">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewLayout("kanban")}
                                className={`h-8 px-3 text-xs gap-1.5 font-medium ${
                                    viewLayout === "kanban"
                                        ? "bg-primary text-black hover:bg-primary/90"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Columns className="h-3.5 w-3.5" />
                                Kanban Pipeline
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewLayout("table")}
                                className={`h-8 px-3 text-xs gap-1.5 font-medium ${
                                    viewLayout === "table"
                                        ? "bg-primary text-black hover:bg-primary/90"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <LayoutList className="h-3.5 w-3.5" />
                                Data Table
                            </Button>
                        </div>
                    </div>

                    {/* Search & Reset */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search company, contact, email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-8 bg-card border-border text-xs text-foreground placeholder:text-muted-foreground focus:border-primary h-9"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className={`h-9 px-3 border-border text-xs transition-colors bg-card ${
                                activeFilters.length > 0
                                    ? "text-primary border-primary/40 hover:bg-primary/10"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Reset all filters and search"
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            Reset
                        </Button>
                    </div>
                </div>

                {/* Secondary Row: Multi-faceted Filter Bar */}
                <div className="p-3.5 rounded-xl border border-border glass-card flex flex-wrap items-center gap-2.5">
                    {/* Stage Filter (Shown only in Table view since Kanban columns already divide deals by stage) */}
                    {viewLayout === "table" && (
                        <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
                            <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-[155px]">
                                <SelectValue placeholder="Stage" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                                <SelectItem value="all" className="text-xs font-medium">All Stages</SelectItem>
                                <SelectItem value="active" className="text-xs text-primary font-medium">⚡ Active Deals Only</SelectItem>
                                <SelectItem value="New Lead" className="text-xs">New Lead</SelectItem>
                                <SelectItem value="Discovery & Qualifying" className="text-xs">Discovery & Qualifying</SelectItem>
                                <SelectItem value="Proposal Sent" className="text-xs">Proposal Sent</SelectItem>
                                <SelectItem value="In Negotiation" className="text-xs">In Negotiation</SelectItem>
                                <SelectItem value="Closed Won" className="text-xs text-emerald-500 dark:text-emerald-400">Closed Won</SelectItem>
                                <SelectItem value="Closed Lost" className="text-xs text-rose-500 dark:text-rose-400">Closed Lost</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    {/* Industry Filter */}
                    <Select value={selectedIndustryFilter} onValueChange={setSelectedIndustryFilter}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-[145px]">
                            <div className="flex items-center gap-1.5 truncate">
                                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                <SelectValue placeholder="Industry" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="all" className="text-xs font-medium">All Industries</SelectItem>
                            {distinctIndustries.map((ind) => (
                                <SelectItem key={ind.name} value={ind.name} className="text-xs">
                                    {ind.name} ({ind.count})
                                </SelectItem>
                            ))}
                            <SelectItem value="unspecified" className="text-xs text-muted-foreground">Unspecified</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Deal Value Filter */}
                    <Select value={selectedValueFilter} onValueChange={setSelectedValueFilter}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-[135px]">
                            <div className="flex items-center gap-1.5 truncate">
                                <DollarSign className="h-3 w-3 text-emerald-400 shrink-0" />
                                <SelectValue placeholder="Deal Value" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="all" className="text-xs font-medium">All Deal Values</SelectItem>
                            <SelectItem value="under-10k" className="text-xs">Under $10,000</SelectItem>
                            <SelectItem value="10k-25k" className="text-xs">$10,000 - $25,000</SelectItem>
                            <SelectItem value="25k-50k" className="text-xs">$25,000 - $50,000</SelectItem>
                            <SelectItem value="50k-100k" className="text-xs">$50,000 - $100,000</SelectItem>
                            <SelectItem value="over-100k" className="text-xs font-semibold text-emerald-400">$100,000+</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Assignee Filter Dropdown */}
                    <Select value={selectedAssigneeFilter} onValueChange={setSelectedAssigneeFilter}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-[135px]">
                            <SelectValue placeholder="Assignee" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="all" className="text-xs font-medium">All Assignees</SelectItem>
                            <SelectItem value="unassigned" className="text-xs text-muted-foreground">⚪ Unassigned Only</SelectItem>
                            {assignableUsers.map((user) => (
                                <SelectItem key={user.id} value={user.id} className="text-xs">
                                    👤 {user.name || "Staff"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Priority Filter */}
                    <Select value={selectedPriorityFilter} onValueChange={setSelectedPriorityFilter}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-[120px]">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
                            <SelectItem value="Hot" className="text-xs">🔥 Hot Only</SelectItem>
                            <SelectItem value="Warm" className="text-xs">⚡ Warm Only</SelectItem>
                            <SelectItem value="Cold" className="text-xs">❄️ Cold Only</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Lead Source Filter */}
                    {distinctSources.length > 0 && (
                        <Select value={selectedSourceFilter} onValueChange={setSelectedSourceFilter}>
                            <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-[130px]">
                                <div className="flex items-center gap-1.5 truncate">
                                    <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <SelectValue placeholder="Source" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                                <SelectItem value="all" className="text-xs font-medium">All Sources</SelectItem>
                                {distinctSources.map((src) => (
                                    <SelectItem key={src.name} value={src.name} className="text-xs">
                                        {src.name} ({src.count})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Date Range Filter */}
                    <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-[120px]">
                            <div className="flex items-center gap-1.5 truncate">
                                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                <SelectValue placeholder="Timeframe" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="all" className="text-xs">All Time</SelectItem>
                            <SelectItem value="today" className="text-xs">Created Today</SelectItem>
                            <SelectItem value="7days" className="text-xs">Past 7 Days</SelectItem>
                            <SelectItem value="30days" className="text-xs">Past 30 Days</SelectItem>
                            <SelectItem value="quarter" className="text-xs">Past 90 Days</SelectItem>
                            <SelectItem value="year" className="text-xs">Past Year</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Divider */}
                    <div className="h-5 w-px bg-border hidden lg:block" />

                    {/* Quick Toggles */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOverdueTasksOnly((prev) => !prev)}
                            className={`h-8 text-xs gap-1.5 border transition-all ${
                                overdueTasksOnly
                                    ? "bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/40 font-semibold"
                                    : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                            }`}
                            title="Filter deals with overdue tasks"
                        >
                            <CalendarClock className="h-3.5 w-3.5 text-rose-500" />
                            Overdue Tasks
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStaleOnlyFilter((prev) => !prev)}
                            className={`h-8 text-xs gap-1.5 border transition-all ${
                                staleOnlyFilter
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold"
                                    : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            {"Stale (>5d)"}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowArchived((prev) => !prev)}
                            className={`h-8 text-xs gap-1.5 border transition-all ${
                                showArchived
                                    ? "bg-primary/20 text-primary border-primary/50 font-semibold"
                                    : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                            }`}
                            title="View archived deals"
                        >
                            <Archive className="h-3.5 w-3.5" />
                            {showArchived ? "Viewing Archived" : "Archived Deals"}
                        </Button>
                    </div>
                </div>

                {/* Active Filter Chips & Results Count Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground font-medium">
                            Showing <strong className="text-foreground">{filteredLeads.length}</strong> of{" "}
                            {leadsList.filter(l => showArchived ? l.isArchived : !l.isArchived).length} opportunities
                        </span>

                        {activeFilters.length > 0 && (
                            <>
                                <span className="text-border">|</span>
                                {activeFilters.map((f, i) => (
                                    <Badge
                                        key={i}
                                        variant="secondary"
                                        className="h-6 px-2 text-[11px] gap-1 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 transition-colors font-medium cursor-pointer"
                                        onClick={f.clear}
                                    >
                                        {f.label}
                                        <X className="h-3 w-3 opacity-70 hover:opacity-100" />
                                    </Badge>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline ml-1"
                                >
                                    Clear all
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Active Pipeline View */}
            {viewLayout === "table" ? (
                <LeadsDataTable
                    leads={filteredLeads}
                    assignableUsers={assignableUsers}
                    isAdmin={isAdmin}
                    onStatusChangeRequest={handleStatusChangeRequest}
                    onBulkStatusChange={handleBulkStatusChangeRequest}
                    onBulkAssign={handleBulkAssign}
                    onSelectLead={(lead) => setSelectedLeadForDrawer(lead)}
                    onEditLead={(lead) => setEditingLead(lead)}
                    onArchiveLead={handleArchiveLead}
                    onResetFilters={handleResetFilters}
                />
            ) : (
                <LeadsKanbanBoard
                    leads={filteredLeads}
                    assignableUsers={assignableUsers}
                    isAdmin={isAdmin}
                    onStatusChangeRequest={handleStatusChangeRequest}
                    onSelectLead={(lead) => setSelectedLeadForDrawer(lead)}
                    onEditLead={(lead) => setEditingLead(lead)}
                    onArchiveLead={handleArchiveLead}
                />
            )}

            {/* Side-Over Lead Details Drawer */}
            <LeadDetailsDrawer
                lead={selectedLeadForDrawer}
                isOpen={!!selectedLeadForDrawer}
                onClose={() => setSelectedLeadForDrawer(null)}
                assignableUsers={assignableUsers}
                isAdmin={isAdmin}
                onStatusChangeRequest={handleStatusChangeRequest}
                onAssignStaff={handleAssignStaff}
                onEditLead={(lead) => setEditingLead(lead)}
                onArchiveLead={handleArchiveLead}
            />

            {/* Edit Lead Modal */}
            <EditLeadModal
                lead={editingLead}
                isOpen={!!editingLead}
                onClose={() => setEditingLead(null)}
                onLeadUpdated={handleLeadUpdated}
            />

            {/* Closed Lost Mandatory Loss Modal */}
            <CloseLostModal
                isOpen={closeLostModalState.isOpen}
                onClose={() => setCloseLostModalState({ isOpen: false, leadTitle: "", leadId: undefined })}
                onConfirm={handleConfirmCloseLost}
                leadTitle={closeLostModalState.leadTitle}
                isSubmitting={isSubmittingMutation}
            />

            {/* Generic Stage Transition Confirmation Modal */}
            <LeadStatusValidationModal
                isOpen={pendingValidation.isOpen}
                onClose={() =>
                    setPendingValidation({
                        isOpen: false,
                        leadId: undefined,
                        leadIds: undefined,
                        leadTitle: "",
                        fromStatus: "",
                        toStatus: "",
                    })
                }
                onConfirm={handleConfirmStatusChange}
                leadTitle={pendingValidation.leadTitle}
                fromStatus={pendingValidation.fromStatus}
                toStatus={pendingValidation.toStatus}
                isSubmitting={isSubmittingMutation}
            />
        </div>
    );
}
