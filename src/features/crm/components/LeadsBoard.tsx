"use client";

import { LeadsPipelineView } from "./LeadsPipelineView";
import type { LeadItem } from "./LeadsDataTable";

interface LeadsBoardProps {
    leads: any[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null }[];
    currentUserId: string;
    query?: string;
    status?: string;
    isAdmin?: boolean;
}

export function LeadsBoard({
    leads,
    assignableUsers,
    currentUserId,
    isAdmin,
}: LeadsBoardProps) {
    return (
        <LeadsPipelineView
            initialLeads={leads as LeadItem[]}
            assignableUsers={assignableUsers}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
        />
    );
}
