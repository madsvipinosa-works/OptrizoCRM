"use client";

import { Badge } from "@/components/ui/badge";
import { LeadCard } from "./LeadCard";
import type { LeadItem } from "./LeadsDataTable";
import { getLeadEffectiveValue } from "@/features/crm/utils/dealValue";

interface LeadsKanbanBoardProps {
    leads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
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

export function LeadsKanbanBoard({
    leads,
    assignableUsers,
    isAdmin,
    onSelectLead,
    onEditLead,
    onArchiveLead,
}: LeadsKanbanBoardProps) {
    return (
        <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start min-w-[1400px] 2xl:min-w-full">
                {STAGES.map((stage) => {
                    const columnLeads = leads.filter((l) => l.status === stage);
                    const totalColumnValue = columnLeads.reduce((acc, l) => acc + getLeadEffectiveValue(l), 0);

                    return (
                        <KanbanColumn
                            key={stage}
                            stage={stage}
                            leads={columnLeads}
                            totalValue={totalColumnValue}
                            assignableUsers={assignableUsers}
                            isAdmin={isAdmin}
                            onSelectLead={onSelectLead}
                            onEditLead={onEditLead}
                            onArchiveLead={onArchiveLead}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function KanbanColumn({
    stage,
    leads,
    totalValue,
    assignableUsers,
    isAdmin,
    onSelectLead,
    onEditLead,
    onArchiveLead,
}: {
    stage: string;
    leads: LeadItem[];
    totalValue: number;
    assignableUsers: any[];
    isAdmin?: boolean;
    onSelectLead?: (lead: LeadItem) => void;
    onEditLead?: (lead: LeadItem) => void;
    onArchiveLead?: (leadId: string) => void;
}) {
    return (
        <div className="flex flex-col rounded-xl border border-border bg-card/60 backdrop-blur-xs p-3 min-h-[550px] transition-colors w-full min-w-0">
            {/* Column Header */}
            <div className="flex flex-col gap-1 pb-3 mb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <Badge variant="secondary" title={stage} className={`font-semibold ${getStageBadgeStyle(stage)}`}>
                        {stage}
                    </Badge>
                    <span className="text-[11px] font-bold font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                        {leads.length}
                    </span>
                </div>
                {totalValue > 0 && (
                    <div className="text-[11px] font-mono text-emerald-500 dark:text-emerald-400 font-semibold flex items-center justify-end">
                        ${totalValue >= 1000 ? `${Number((totalValue / 1000).toFixed(1))}k` : totalValue.toLocaleString()}
                    </div>
                )}
            </div>

            {/* Column Items */}
            <div className="flex flex-col gap-2.5 flex-1">
                {leads.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-border/60 rounded-lg p-6 text-center text-xs text-muted-foreground/60 select-none">
                        No deals in this stage
                    </div>
                ) : (
                    leads.map((lead) => (
                        <div key={lead.id} className="w-full min-w-0">
                            <LeadCard
                                lead={lead}
                                assignableUsers={assignableUsers}
                                isAdmin={isAdmin}
                                onSelect={onSelectLead}
                                onEdit={onEditLead}
                                onArchive={onArchiveLead}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function getStageBadgeStyle(stage: string) {
    switch (stage) {
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
