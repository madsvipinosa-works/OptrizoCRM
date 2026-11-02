/**
 * CRM Deal & Proposal Value Utilities
 * Pure synchronous functions to compute effective deal values.
 */

export interface LeadWithProposalsInput {
    estimatedValue?: number | string | null;
    proposals?: Array<{
        total?: number | null;
        totalPrice?: number | null;
        priceMode?: string | null;
        status: string;
        updatedAt?: Date | string | null;
        createdAt?: Date | string | null;
        deletedAt?: Date | string | null;
    }> | null;
}

function getProposalValue(p: { total?: number | null; totalPrice?: number | null; priceMode?: string | null }): number {
    if (p.priceMode === "priced" && p.totalPrice !== undefined && p.totalPrice !== null) {
        return Number(p.totalPrice);
    }
    return Number(p.total ?? 0);
}

/**
 * Computes the effective deal value for a lead by prioritizing active (non-deleted)
 * proposal pricing over the initial raw estimated value, ordered by most recently updated:
 * 1. Signed proposal (Accepted contract total)
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

        // Priority 1: Signed proposal with value > 0
        const signed = activeProposals.find(p => p.status === "signed" && getProposalValue(p) > 0);
        if (signed) return getProposalValue(signed);

        // Priority 2: Sent proposal with value > 0
        const sent = activeProposals.find(p => (p.status === "sent" || p.status === "pricing_meeting_requested" || p.status === "changes_requested") && getProposalValue(p) > 0);
        if (sent) return getProposalValue(sent);

        // Priority 3: Draft proposal with value > 0
        const draft = activeProposals.find(p => p.status === "draft" && getProposalValue(p) > 0);
        if (draft) return getProposalValue(draft);
    }
    return Number(lead.estimatedValue) || 0;
}
