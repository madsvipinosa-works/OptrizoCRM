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
import { LeadCard } from "./LeadCard";
import type { LeadItem } from "./LeadsDataTable";

interface LeadsKanbanBoardProps {
    leads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
    onStatusChangeRequest: (leadId: string, leadTitle: string, fromStatus: string, toStatus: string) => void;
    onSelectLead?: (lead: LeadItem) => void;
}

const STAGES = [
    "New Lead",
    "Discovery & Qualifying",
    "Proposal Sent",
    "In Negotiation",
    "Closed Won",
    "Closed Lost",
] as const;

export function LeadsKanbanBoard({
    leads,
    assignableUsers,
    isAdmin,
    onStatusChangeRequest,
    onSelectLead,
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
            const leadTitle = draggedLead.businessName || draggedLead.contactName || draggedLead.client?.name || "Opportunity";
            onStatusChangeRequest(draggedLead.id, leadTitle, draggedLead.status, targetStatus);
        }
    };

    return (
        <DndContext
            id="crm-kanban-dnd-context"
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start pb-4">
                {STAGES.map((stage) => {
                    const columnLeads = leads.filter((l) => l.status === stage);
                    const totalColumnValue = columnLeads.reduce((acc, l) => acc + (l.estimatedValue || 0), 0);

                    return (
                        <KanbanColumn
                            key={stage}
                            stage={stage}
                            leads={columnLeads}
                            totalValue={totalColumnValue}
                            assignableUsers={assignableUsers}
                            isAdmin={isAdmin}
                            onSelectLead={onSelectLead}
                        />
                    );
                })}
            </div>

            <DragOverlay>
                {activeLead ? (
                    <div className="opacity-95 rotate-1 scale-105 transition-transform w-72 pointer-events-none">
                        <LeadCard lead={activeLead} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function KanbanColumn({
    stage,
    leads,
    totalValue,
    assignableUsers,
    isAdmin,
    onSelectLead,
}: {
    stage: string;
    leads: LeadItem[];
    totalValue: number;
    assignableUsers: any[];
    isAdmin?: boolean;
    onSelectLead?: (lead: LeadItem) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage,
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-xl border border-white/10 bg-zinc-950/70 p-3 min-h-[550px] transition-colors ${
                isOver ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : ""
            }`}
        >
            {/* Column Header */}
            <div className="flex flex-col gap-1 pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <Badge variant="secondary" className={`font-semibold ${getStageBadgeStyle(stage)}`}>
                        {stage}
                    </Badge>
                    <span className="text-[11px] font-bold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                        {leads.length}
                    </span>
                </div>
                {totalValue > 0 && (
                    <div className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-end">
                        ${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(0)}k` : totalValue.toLocaleString()}
                    </div>
                )}
            </div>

            {/* Draggable Items Context */}
            <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5 flex-1">
                    {leads.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-lg p-6 text-center text-xs text-zinc-600 select-none">
                            Drop deals here
                        </div>
                    ) : (
                        leads.map((lead) => (
                            <DraggableKanbanCard
                                key={lead.id}
                                lead={lead}
                                assignableUsers={assignableUsers}
                                isAdmin={isAdmin}
                                onSelectLead={onSelectLead}
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
    onSelectLead,
}: {
    lead: LeadItem;
    assignableUsers: any[];
    isAdmin?: boolean;
    onSelectLead?: (lead: LeadItem) => void;
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
            {...attributes}
            {...listeners}
            className={`cursor-grab active:cursor-grabbing transition-all ${
                isDragging ? "opacity-30 scale-95" : ""
            }`}
        >
            <LeadCard
                lead={lead}
                assignableUsers={assignableUsers}
                isAdmin={isAdmin}
                onSelect={onSelectLead}
            />
        </div>
    );
}

function getStageBadgeStyle(stage: string) {
    switch (stage) {
        case "New Lead":
            return "bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]";
        case "Discovery & Qualifying":
            return "bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]";
        case "Proposal Sent":
            return "bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]";
        case "In Negotiation":
            return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]";
        case "Closed Won":
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]";
        case "Closed Lost":
            return "bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]";
        default:
            return "bg-zinc-800 text-zinc-300 text-[10px]";
    }
}
