"use client";

import { useState, useOptimistic, startTransition } from "react";
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
    UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { LossReason } from "@/lib/schemas";

interface LeadsPipelineViewProps {
    initialLeads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    currentUserId: string;
    isAdmin?: boolean;
}

export function LeadsPipelineView({
    initialLeads,
    assignableUsers,
    currentUserId,
    isAdmin,
}: LeadsPipelineViewProps) {
    const [leadsList, setLeadsList] = useState<LeadItem[]>(initialLeads);
    const [viewLayout, setViewLayout] = useState<"kanban" | "table">("kanban");
    const [scopeMode, setScopeMode] = useState<"all" | "mine">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
    const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>("all");
    const [staleOnlyFilter, setStaleOnlyFilter] = useState(false);
    const [overdueTasksOnly, setOverdueTasksOnly] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    // Edit modal state
    const [editingLead, setEditingLead] = useState<LeadItem | null>(null);

    // Side-over drawer state
    const [selectedLeadForDrawer, setSelectedLeadForDrawer] = useState<LeadItem | null>(null);

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
        <div className="space-y-6">
            {/* Control Bar: View Toggle, Filters, Search */}
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

                    {/* Assignee Filter Dropdown */}
                    <Select value={selectedAssigneeFilter} onValueChange={setSelectedAssigneeFilter}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-36">
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
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border text-foreground w-32">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
                            <SelectItem value="Hot" className="text-xs">🔥 Hot Only</SelectItem>
                            <SelectItem value="Warm" className="text-xs">⚡ Warm Only</SelectItem>
                            <SelectItem value="Cold" className="text-xs">❄️ Cold Only</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Overdue Tasks Quick Toggle */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOverdueTasksOnly((prev) => !prev)}
                        className={`h-8 text-xs gap-1.5 border ${
                            overdueTasksOnly
                                ? "bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/40"
                                : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                        }`}
                        title="Filter deals with overdue tasks"
                    >
                        <CalendarClock className="h-3.5 w-3.5 text-rose-500" />
                        Overdue Tasks
                    </Button>

                    {/* Stale Only Toggle */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStaleOnlyFilter((prev) => !prev)}
                        className={`h-8 text-xs gap-1.5 border ${
                            staleOnlyFilter
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40"
                                : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        {"Stale (>5d)"}
                    </Button>

                    {/* Show Archived Deals Toggle */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowArchived((prev) => !prev)}
                        className={`h-8 text-xs gap-1.5 border ${
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

                {/* Search & Reset */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search company, contact, email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-card border-border text-xs text-foreground placeholder:text-muted-foreground focus:border-primary h-9"
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedPriorityFilter("all");
                            setSelectedAssigneeFilter("all");
                            setStaleOnlyFilter(false);
                            setOverdueTasksOnly(false);
                            setShowArchived(false);
                        }}
                        className="h-9 px-3 border-border text-xs text-muted-foreground hover:text-foreground bg-card"
                        title="Reset Filters"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
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
