/**
 * CRM Deal & Proposal Value Utilities
 * Pure synchronous functions to compute effective deal values.
 */

export interface LeadWithProposalsInput {
    estimatedValue: number;
    proposals?: Array<{
        total?: number | null;
        status: string;
        updatedAt?: Date | string;
    }>;
}

/**
 * Computes the effective deal value for a lead by prioritizing active proposal pricing
 * over the initial raw estimated value:
 * 1. Approved proposal (Accepted contract total)
 * 2. Sent proposal (Active quote in client review)
 * 3. Draft proposal with total > 0 (Working proposal estimate)
 * 4. Fallback: lead.estimatedValue
 */
export function getLeadEffectiveValue(lead: LeadWithProposalsInput): number {
    if (lead.proposals && lead.proposals.length > 0) {
        // Priority 1: Approved proposal with total > 0
        const approved = lead.proposals.find(p => p.status === "Approved" && (p.total ?? 0) > 0);
        if (approved && approved.total) return Number(approved.total);

        // Priority 2: Sent proposal with total > 0
        const sent = lead.proposals.find(p => p.status === "Sent" && (p.total ?? 0) > 0);
        if (sent && sent.total) return Number(sent.total);

        // Priority 3: Draft proposal with total > 0
        const draft = lead.proposals.find(p => p.status === "Draft" && (p.total ?? 0) > 0);
        if (draft && draft.total) return Number(draft.total);
    }
    return lead.estimatedValue || 0;
}
