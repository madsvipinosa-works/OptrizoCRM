"use client";

import { useState, useOptimistic, startTransition } from "react";
import { LeadsDataTable, type LeadItem } from "./LeadsDataTable";
import { LeadsKanbanBoard } from "./LeadsKanbanBoard";
import { LeadStatusValidationModal } from "./LeadStatusValidationModal";
import { CloseLostModal } from "./CloseLostModal";
import { LeadDetailsDrawer } from "./LeadDetailsDrawer";
import { transitionLeadStage, updateLeadStatusWithAudit, bulkUpdateLeadStatus, bulkAssignLeads } from "@/features/crm/actions";
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
    Flame,
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
    const [viewLayout, setViewLayout] = useState<"kanban" | "table">("kanban");
    const [scopeMode, setScopeMode] = useState<"all" | "mine">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
    const [staleOnlyFilter, setStaleOnlyFilter] = useState(false);

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
        initialLeads,
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
        // Staff assignment scope filter
        if (scopeMode === "mine") {
            const isAssigned = lead.assignees?.some((a) => a.id === currentUserId);
            if (!isAssigned) return false;
        }

        // Priority filter
        if (selectedPriorityFilter !== "all") {
            const score = lead.leadScore ?? 50;
            const priority = lead.priority ?? (score >= 75 ? "Hot" : score < 45 ? "Cold" : "Warm");
            if (priority !== selectedPriorityFilter) return false;
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
                    // Keep selected lead in drawer in sync if open
                    if (selectedLeadForDrawer?.id === leadId) {
                        setSelectedLeadForDrawer((prev) => prev ? { ...prev, status: toStatus } : null);
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
                if (selectedLeadForDrawer?.id === leadId) {
                    setSelectedLeadForDrawer((prev) => prev ? { ...prev, status: "Closed Lost", lossReason, lossNotes } : null);
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
            } else {
                toast.error(res.message);
            }
        });
    };

    const handleAssignStaff = (leadId: string, assigneeUserIds: string[]) => {
        startTransition(async () => {
            // Optimistically update the local state for immediate UI feedback
            setOptimisticLeads({ leadId, newStatus: optimisticLeads.find(l => l.id === leadId)?.status || "New Lead" }); // Note: We actually need a way to optimistically update assignees, but updating the timestamp via a generic trigger is a fallback. To properly optimistically update, we'd need to fetch the users or at least rely on the server action refresh.
            
            const res = await bulkAssignLeads([leadId], assigneeUserIds);
            if (res.success) {
                toast.success("Lead assignments updated");
                // The server action revalidates the path, so the UI will refresh with the actual avatars.
            } else {
                toast.error(res.message || "Failed to update assignments");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Control Bar: View Toggle, Filters, Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl">
                <div className="flex flex-wrap items-center gap-3">
                    {/* View Scope Tabs */}
                    <Tabs value={scopeMode} onValueChange={(v) => setScopeMode(v as "all" | "mine")}>
                        <TabsList className="bg-white/5 border border-white/10 p-1">
                            <TabsTrigger
                                value="all"
                                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black font-medium"
                            >
                                <Users className="h-3.5 w-3.5 mr-1.5" /> All Pipeline ({optimisticLeads.length})
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
                    <div className="flex items-center rounded-lg border border-white/10 p-1 bg-white/5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewLayout("kanban")}
                            className={`h-8 px-3 text-xs gap-1.5 font-medium ${
                                viewLayout === "kanban"
                                    ? "bg-primary text-black hover:bg-primary/90"
                                    : "text-zinc-400 hover:text-white"
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
                                    : "text-zinc-400 hover:text-white"
                            }`}
                        >
                            <LayoutList className="h-3.5 w-3.5" />
                            Data Table
                        </Button>
                    </div>

                    {/* Priority Filter */}
                    <Select value={selectedPriorityFilter} onValueChange={setSelectedPriorityFilter}>
                        <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-zinc-300 w-32">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/15 text-white">
                            <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
                            <SelectItem value="Hot" className="text-xs">🔥 Hot Only</SelectItem>
                            <SelectItem value="Warm" className="text-xs">⚡ Warm Only</SelectItem>
                            <SelectItem value="Cold" className="text-xs">❄️ Cold Only</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Stale Only Toggle */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStaleOnlyFilter((prev) => !prev)}
                        className={`h-8 text-xs gap-1.5 border ${
                            staleOnlyFilter
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                        }`}
                    >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        {"Stale (>5d)"}
                    </Button>
                </div>

                {/* Search & Reset */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                        <Input
                            placeholder="Search company, contact, email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-black/40 border-white/15 text-xs text-white placeholder:text-zinc-600 focus:border-primary h-9"
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedPriorityFilter("all");
                            setStaleOnlyFilter(false);
                        }}
                        className="h-9 px-3 border-white/15 text-xs text-zinc-400 hover:text-white bg-black/40"
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
                />
            ) : (
                <LeadsKanbanBoard
                    leads={filteredLeads}
                    assignableUsers={assignableUsers}
                    isAdmin={isAdmin}
                    onStatusChangeRequest={handleStatusChangeRequest}
                    onSelectLead={(lead) => setSelectedLeadForDrawer(lead)}
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
