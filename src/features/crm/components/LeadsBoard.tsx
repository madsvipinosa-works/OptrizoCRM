"use client";

import { LeadsPipelineView } from "./LeadsPipelineView";
import type { LeadItem } from "./LeadsDataTable";

interface LeadsBoardProps {
    leads: any[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    currentUserId: string;
    query?: string;
    status?: string;
    isAdmin?: boolean;
    initialLeadId?: string;
}

export function LeadsBoard({
    leads,
    assignableUsers,
    currentUserId,
    isAdmin,
    initialLeadId,
}: LeadsBoardProps) {
    return (
        <LeadsPipelineView
            initialLeads={leads as LeadItem[]}
            assignableUsers={assignableUsers}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            initialLeadId={initialLeadId}
        />
    );
}
