"use client";

import { useState, useOptimistic, startTransition } from "react";
import { LeadsDataTable, type LeadItem } from "./LeadsDataTable";
import { LeadsKanbanBoard } from "./LeadsKanbanBoard";
import { LeadStatusValidationModal } from "./LeadStatusValidationModal";
import { updateLeadStatusWithAudit, bulkUpdateLeadStatus, bulkAssignLeads } from "@/features/crm/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Columns, Search, Users, User, Filter, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface LeadsPipelineViewProps {
    initialLeads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null }[];
    currentUserId: string;
    isAdmin?: boolean;
}

export function LeadsPipelineView({
    initialLeads,
    assignableUsers,
    currentUserId,
    isAdmin,
}: LeadsPipelineViewProps) {
    // Enterprise View Toggle state: "table" (Default) vs "kanban" (Secondary)
    const [viewLayout, setViewLayout] = useState<"table" | "kanban">("table");
    const [scopeMode, setScopeMode] = useState<"all" | "mine">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStageFilter, setSelectedStageFilter] = useState<string>("all");

    // Intercept Validation Modal state
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
    const [isSubmittingMutation, setIsSubmittingMutation] = useState(false);

    // React 19 Optimistic State Update Hook
    const [optimisticLeads, setOptimisticLeads] = useOptimistic(
        initialLeads,
        (state: LeadItem[], update: { leadId: string; newStatus: string }) => {
            return state.map((lead) =>
                lead.id === update.leadId
                    ? { ...lead, status: update.newStatus, updatedAt: new Date().toISOString() }
                    : lead
            );
        }
    );

    // Filter leads across both views without re-fetching from database
    const filteredLeads = optimisticLeads.filter((lead) => {
        // Staff assignment scope filter
        if (scopeMode === "mine") {
            const isAssigned = lead.assignees?.some((a) => a.id === currentUserId);
            if (!isAssigned) return false;
        }

        // Stage filter
        if (selectedStageFilter !== "all" && lead.status !== selectedStageFilter) {
            return false;
        }

        // Search query filter (Business Name, Client Email, Industry)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = (lead.businessName || lead.client?.name || "").toLowerCase().includes(q);
            const matchEmail = (lead.client?.email || "").toLowerCase().includes(q);
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
        setPendingValidation({
            isOpen: true,
            leadId,
            leadTitle,
            fromStatus,
            toStatus,
        });
    };

    // Execution of Mutating Server Action with Optimistic UI Feedback
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
                    toast.error(res.message || "Failed to bulk update leads");
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
            // Instant Optimistic Feedback
            startTransition(() => {
                setOptimisticLeads({ leadId, newStatus: toStatus });
            });

            try {
                const res = await updateLeadStatusWithAudit(leadId, toStatus as any, reasonNotes);
                if (res.success) {
                    toast.success(res.message || `Moved lead stage to ${toStatus}`);
                } else {
                    toast.error(res.message || "Failed to update lead status");
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

    // Intercept Bulk Status Mutation
    const handleBulkStatusChangeRequest = (leadIds: string[], toStatus: string) => {
        setPendingValidation({
            isOpen: true,
            leadIds,
            leadTitle: `${leadIds.length} Selected Leads`,
            fromStatus: "Mixed",
            toStatus,
        });
    };

    // Bulk Staff Assignment
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

                    {/* Enterprise View Toggle Button Group */}
                    <div className="flex items-center rounded-lg border border-white/10 p-1 bg-white/5">
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
                            Kanban Flow
                        </Button>
                    </div>
                </div>

                {/* Search & Quick Filter Input */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                        <Input
                            placeholder="Filter by lead, client email..."
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
                            setSelectedStageFilter("all");
                        }}
                        className="h-9 px-3 border-white/15 text-xs text-zinc-400 hover:text-white bg-black/40"
                    >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Reset
                    </Button>
                </div>
            </div>

            {/* Active View Display */}
            {viewLayout === "table" ? (
                <LeadsDataTable
                    leads={filteredLeads}
                    assignableUsers={assignableUsers}
                    isAdmin={isAdmin}
                    onStatusChangeRequest={handleStatusChangeRequest}
                    onBulkStatusChange={handleBulkStatusChangeRequest}
                    onBulkAssign={handleBulkAssign}
                />
            ) : (
                <LeadsKanbanBoard
                    leads={filteredLeads}
                    assignableUsers={assignableUsers}
                    isAdmin={isAdmin}
                    onStatusChangeRequest={handleStatusChangeRequest}
                />
            )}

            {/* Accidental Drag & Drop / Mutation Intercept Modal */}
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
