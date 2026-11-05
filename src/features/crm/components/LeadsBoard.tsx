"use client";

import type { ReactNode } from "react";
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
    headerActions?: ReactNode;
}

export function LeadsBoard({
    leads,
    assignableUsers,
    currentUserId,
    query,
    status,
    isAdmin,
    initialLeadId,
    headerActions,
}: LeadsBoardProps) {
    return (
        <LeadsPipelineView
            initialLeads={leads as LeadItem[]}
            assignableUsers={assignableUsers}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            initialLeadId={initialLeadId}
            initialQuery={query}
            initialStatus={status}
            headerActions={headerActions}
        />
    );
}
