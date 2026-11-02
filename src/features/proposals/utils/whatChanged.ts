export interface ProposalComparisonData {
    scope?: string | null;
    deliverables?: unknown;
    timeline?: string | null;
    technicalApproach?: string | null;
    priceMode?: string | null;
    currency?: string | null;
    totalPrice?: number | null;
    total?: number | null;
    subtotal?: number | null;
    terms?: string | null;
    milestones?: Array<{ name?: string | null; startDate?: Date | string | null; endDate?: Date | string | null }> | null;
    paymentScheduleItems?: Array<{ label?: string | null; percent?: number | null; trigger?: string | null }> | null;
}

/**
 * Compares a proposal version with its previous version (v - 1).
 * Checks: price, timeline, scope, and payment schedule.
 * Returns an array of human-readable section names that changed.
 * Uses no external diff libraries.
 */
export function getWhatChanged(
    current: ProposalComparisonData,
    previous?: ProposalComparisonData | null
): string[] {
    if (!previous) return [];

    const changed: string[] = [];

    // 1. Price
    const priceChanged =
        current.priceMode !== previous.priceMode ||
        current.currency !== previous.currency ||
        current.totalPrice !== previous.totalPrice ||
        current.total !== previous.total ||
        current.subtotal !== previous.subtotal;
    if (priceChanged) {
        changed.push("Price & Investment");
    }

    // 2. Timeline
    const timelineChanged = current.timeline !== previous.timeline;
    if (timelineChanged) {
        changed.push("Timeline");
    }

    // 3. Scope & Deliverables
    const scopeChanged =
        current.scope !== previous.scope ||
        current.technicalApproach !== previous.technicalApproach ||
        JSON.stringify(current.deliverables ?? null) !== JSON.stringify(previous.deliverables ?? null);
    if (scopeChanged) {
        changed.push("Scope & Deliverables");
    }

    // 4. Milestones & Payment Schedule
    const milestonesChanged =
        JSON.stringify(current.milestones ?? []) !== JSON.stringify(previous.milestones ?? []);
    const scheduleChanged =
        JSON.stringify(current.paymentScheduleItems ?? []) !== JSON.stringify(previous.paymentScheduleItems ?? []);
    if (milestonesChanged || scheduleChanged) {
        changed.push("Milestones & Schedule");
    }

    // 5. Terms
    if (current.terms !== previous.terms && previous.terms !== undefined) {
        changed.push("Terms & Conditions");
    }

    return changed;
}
