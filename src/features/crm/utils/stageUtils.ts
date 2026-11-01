/**
 * Utility functions for lead stage sub-statuses and duration in stage (spec §4).
 * Sub-status uses lead fields only.
 */

export type LeadStageSubStatus =
    | "No contact yet"
    | "In progress"
    | "Sent"
    | "Needs revision"
    | "Signed"
    | "Declined";

export function getLeadSubStatus(lead: { status: string }): LeadStageSubStatus {
    switch (lead.status) {
        case "New Lead":
            return "No contact yet";
        case "Discovery & Qualifying":
            return "In progress";
        case "Proposal Sent":
            return "Sent";
        case "In Negotiation":
            return "Needs revision";
        case "Closed Won":
            return "Signed";
        case "Closed Lost":
            return "Declined";
        default:
            return "No contact yet";
    }
}

export function getDaysInStage(lead: {
    stageChangedAt?: Date | string | null;
    createdAt?: Date | string | null;
}): number {
    const referenceDate = lead.stageChangedAt
        ? new Date(lead.stageChangedAt)
        : lead.createdAt
        ? new Date(lead.createdAt)
        : new Date();

    const diffMs = Date.now() - referenceDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatDaysInStage(days: number): string {
    if (days === 0) return "Today";
    return `${days}d in stage`;
}
