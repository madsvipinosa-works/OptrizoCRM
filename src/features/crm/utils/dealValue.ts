/**
 * CRM Deal & Proposal Value Utilities
 * Pure synchronous functions to compute effective deal values.
 */

export interface LeadWithProposalsInput {
    estimatedValue?: number | string | null;
    proposals?: Array<{
        total?: number | null;
        status: string;
        updatedAt?: Date | string | null;
        createdAt?: Date | string | null;
        deletedAt?: Date | string | null;
    }> | null;
}

/**
 * Computes the effective deal value for a lead by prioritizing active (non-deleted)
 * proposal pricing over the initial raw estimated value, ordered by most recently updated:
 * 1. Approved proposal (Accepted contract total)
 * 2. Sent proposal (Active quote in client review)
 * 3. Draft proposal with total > 0 (Working proposal estimate)
 * 4. Fallback: lead.estimatedValue
 */
export function getLeadEffectiveValue(lead: LeadWithProposalsInput): number {
    if (lead.proposals && lead.proposals.length > 0) {
        const activeProposals = lead.proposals
            .filter(p => !p.deletedAt)
            .sort((a, b) => {
                const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return timeB - timeA;
            });

        // Priority 1: Approved proposal with total > 0
        const approved = activeProposals.find(p => p.status === "Approved" && (p.total ?? 0) > 0);
        if (approved && approved.total) return Number(approved.total);

        // Priority 2: Sent proposal with total > 0
        const sent = activeProposals.find(p => p.status === "Sent" && (p.total ?? 0) > 0);
        if (sent && sent.total) return Number(sent.total);

        // Priority 3: Draft proposal with total > 0
        const draft = activeProposals.find(p => p.status === "Draft" && (p.total ?? 0) > 0);
        if (draft && draft.total) return Number(draft.total);
    }
    return Number(lead.estimatedValue) || 0;
}
