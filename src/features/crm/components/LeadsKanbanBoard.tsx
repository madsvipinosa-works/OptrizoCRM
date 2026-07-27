"use client";

import { useState } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { LeadCard } from "./LeadCard";
import { Building2, DollarSign, Calendar, GripVertical, MoreHorizontal, User } from "lucide-react";
import { format } from "date-fns";
import type { LeadItem } from "./LeadsDataTable";

interface LeadsKanbanBoardProps {
    leads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null }[];
    isAdmin?: boolean;
    onStatusChangeRequest: (leadId: string, leadTitle: string, fromStatus: string, toStatus: string) => void;
}

const STAGES = [
    "Pending Approval",
    "In Review",
    "Proposal Sent",
    "Closed Won",
    "Closed Lost",
] as const;

export function LeadsKanbanBoard({
    leads,
    assignableUsers,
    isAdmin,
    onStatusChangeRequest,
}: LeadsKanbanBoardProps) {
    const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px drag tolerance prevents accidental clicks
            },
        }),
        useSensor(KeyboardSensor)
    );

    const activeLead = leads.find((l) => l.id === activeLeadId);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveLeadId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveLeadId(null);

        if (!over) return;

        const draggedLeadId = active.id as string;
        const draggedLead = leads.find((l) => l.id === draggedLeadId);
        if (!draggedLead) return;

        // Determine destination column status
        const overId = over.id as string;
        let targetStatus: string | null = null;

        if (STAGES.includes(overId as any)) {
            targetStatus = overId;
        } else {
            const targetLead = leads.find((l) => l.id === overId);
            if (targetLead) targetStatus = targetLead.status;
        }

        if (targetStatus && targetStatus !== draggedLead.status) {
            const leadTitle = draggedLead.businessName || draggedLead.client?.name || "Lead";
            // Intercept & open validation modal!
            onStatusChangeRequest(draggedLead.id, leadTitle, draggedLead.status, targetStatus);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
                {STAGES.map((stage) => {
                    const columnLeads = leads.filter((l) => l.status === stage);
                    const totalBudget = columnLeads.reduce((acc, l) => {
                        if (!l.budget) return acc;
                        const match = l.budget.match(/\d+/);
                        const val = match ? parseInt(match[0]) : 0;
                        const mult = l.budget.toLowerCase().includes("k") ? 1000 : 1;
                        return acc + val * mult;
                    }, 0);

                    return (
                        <KanbanColumn
                            key={stage}
                            stage={stage}
                            leads={columnLeads}
                            totalBudget={totalBudget}
                            assignableUsers={assignableUsers}
                            isAdmin={isAdmin}
                        />
                    );
                })}
            </div>

            <DragOverlay>
                {activeLead ? (
                    <div className="opacity-95 rotate-1 scale-105 transition-transform">
                        <KanbanCardContent lead={activeLead} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function KanbanColumn({
    stage,
    leads,
    totalBudget,
    assignableUsers,
    isAdmin,
}: {
    stage: string;
    leads: LeadItem[];
    totalBudget: number;
    assignableUsers: any[];
    isAdmin?: boolean;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage,
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-xl border border-white/10 bg-zinc-950/60 p-3 min-h-[500px] transition-colors ${
                isOver ? "border-primary/50 bg-primary/5" : ""
            }`}
        >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getStageBadgeStyle(stage)}>
                        {stage}
                    </Badge>
                    <span className="text-xs font-semibold text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full">
                        {leads.length}
                    </span>
                </div>
                {totalBudget > 0 && (
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                        ${totalBudget >= 1000 ? `${(totalBudget / 1000).toFixed(0)}k` : totalBudget}
                    </span>
                )}
            </div>

            {/* Draggable Items Context */}
            <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3 flex-1">
                    {leads.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-lg p-6 text-center text-xs text-zinc-600">
                            Drop leads here
                        </div>
                    ) : (
                        leads.map((lead) => (
                            <DraggableKanbanCard
                                key={lead.id}
                                lead={lead}
                                assignableUsers={assignableUsers}
                                isAdmin={isAdmin}
                            />
                        ))
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

function DraggableKanbanCard({
    lead,
    assignableUsers,
    isAdmin,
}: {
    lead: LeadItem;
    assignableUsers: any[];
    isAdmin?: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative rounded-lg border border-white/10 bg-black/40 hover:bg-white/5 p-3 shadow-md transition-all ${
                isDragging ? "opacity-30 border-primary" : ""
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 p-0.5 rounded"
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <Dialog>
                        <DialogTrigger asChild>
                            <h4 className="text-xs font-semibold text-white truncate cursor-pointer hover:text-primary transition-colors">
                                {lead.businessName || lead.client?.name || "Unknown Lead"}
                            </h4>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 p-0 overflow-hidden outline-none">
                            <DialogHeader className="sr-only">
                                <DialogTitle>Lead Details</DialogTitle>
                                <DialogDescription>Full details</DialogDescription>
                            </DialogHeader>
                            <LeadCard
                                lead={lead as any}
                                assignableUsers={assignableUsers}
                                isAdmin={isAdmin}
                            />
                        </DialogContent>
                    </Dialog>
                    <p className="text-[11px] text-zinc-400 truncate">
                        {lead.client?.email || "No email"}
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-500 hover:text-white">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 p-0 overflow-hidden outline-none">
                        <DialogHeader className="sr-only">
                            <DialogTitle>Lead Details</DialogTitle>
                            <DialogDescription>Full details</DialogDescription>
                        </DialogHeader>
                        <LeadCard
                            lead={lead as any}
                            assignableUsers={assignableUsers}
                            isAdmin={isAdmin}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                {lead.budget ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" />
                        {lead.budget}
                    </span>
                ) : (
                    <span className="text-zinc-600 text-[10px]">No budget</span>
                )}

                {lead.assignees && lead.assignees.length > 0 ? (
                    <div className="flex -space-x-1">
                        {lead.assignees.slice(0, 2).map((a, i) => (
                            <div
                                key={i}
                                className="w-5 h-5 rounded-full bg-zinc-900 border border-white/20 text-primary flex items-center justify-center text-[9px] font-bold"
                                title={a.name || "User"}
                            >
                                {a.name?.[0]?.toUpperCase() || "U"}
                            </div>
                        ))}
                    </div>
                ) : (
                    <span className="text-zinc-600 text-[9px] uppercase tracking-wider">Unassigned</span>
                )}
            </div>
        </div>
    );
}

function KanbanCardContent({ lead }: { lead: LeadItem }) {
    return (
        <div className="rounded-lg border border-primary/50 bg-zinc-900 p-3 shadow-2xl w-64">
            <h4 className="text-xs font-semibold text-white">
                {lead.businessName || lead.client?.name || "Lead"}
            </h4>
            <p className="text-[11px] text-zinc-400 truncate">{lead.client?.email}</p>
            {lead.budget && (
                <div className="mt-2 text-xs font-semibold text-emerald-400">
                    ${lead.budget}
                </div>
            )}
        </div>
    );
}

function getStageBadgeStyle(stage: string) {
    switch (stage) {
        case "Pending Approval": return "bg-blue-500/10 text-blue-400 border-blue-500/30 text-[11px]";
        case "In Review": return "bg-purple-500/10 text-purple-400 border-purple-500/30 text-[11px]";
        case "Proposal Sent": return "bg-amber-500/10 text-amber-400 border-amber-500/30 text-[11px]";
        case "Closed Won": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px]";
        case "Closed Lost": return "bg-rose-500/10 text-rose-400 border-rose-500/30 text-[11px]";
        default: return "bg-zinc-800 text-zinc-300 text-[11px]";
    }
}
