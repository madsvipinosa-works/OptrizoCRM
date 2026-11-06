/**
 * Pure rules for the proposal draft editor: no React, no database. Kept separate so they can be tested.
 *
 * Spec rules this file mirrors:
 * - There are always exactly 5 milestones; only their dates change (spec section 3, `proposalMilestones`).
 * - The payment schedule must total exactly 100% (spec section 3, `paymentScheduleItems`).
 * - Only a draft can be edited. A sent version is locked; changes go through a new version.
 * - A priced proposal needs a total price above 0. A "price to be discussed" version cannot be signed.
 */

export const MILESTONE_KEYS = ["requirements", "design", "development", "uat_testing", "handover"] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export type ProposalStatus =
    | "draft"
    | "sent"
    | "pricing_meeting_requested"
    | "changes_requested"
    | "signed"
    | "declined"
    | "replaced";

export type MilestoneDraft = {
    key: string;
    title: string;
    description: string;
    /** YYYY-MM-DD, or "" when not set. */
    startDate: string;
    endDate: string;
};

export type ScheduleDraftItem = {
    id?: string;
    label: string;
    percent: number;
    trigger: string;
    sortOrder?: number;
};

export const LIMITS = {
    projectName: 120,
    overview: 5000,
    solution: 5000,
    exclusions: 2000,
    terms: 5000,
    needsGoals: 3000,
} as const;

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Only a draft can be edited. */
export function isEditableStatus(status: string): boolean {
    return status === "draft";
}

/** A new version can be created from a sent version that is still open (see `createProposalRevision`). */
export function canCreateRevision(status: string): boolean {
    return status === "sent" || status === "pricing_meeting_requested" || status === "changes_requested";
}

/** Plain-language reason a version cannot be edited. `null` for a draft. */
export function readOnlyMessage(status: string): string | null {
    switch (status) {
        case "draft":
            return null;
        case "sent":
        case "pricing_meeting_requested":
        case "changes_requested":
            return "This version was sent to the client, so it is locked. To fix a typo or change anything, create a new version.";
        case "signed":
            return "The client signed this version. It cannot be changed.";
        case "declined":
            return "The client declined this version. It cannot be changed.";
        case "replaced":
            return "A newer version replaced this one. Open the newest version to make changes.";
        default:
            return "This version cannot be edited.";
    }
}

export type StepState = "done" | "current" | "upcoming";

/** The three steps in the header: Draft, Sent to client, Signed. */
export function getStepper(status: string, version: number): Array<{ label: string; state: StepState }> {
    const draftLabel = version > 1 ? `1. Draft v${version} (PM)` : "1. Draft (PM)";
    const steps = [draftLabel, "2. Sent to client", "3. Signed"];

    let current = 0;
    if (status === "signed") current = 3; // all done
    else if (status === "draft") current = 0;
    else current = 1; // sent, pricing meeting requested, changes requested, replaced, declined

    return steps.map((label, index) => ({
        label,
        state: index < current ? "done" : index === current ? "current" : "upcoming",
    }));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** A stored date (Date or ISO string) as YYYY-MM-DD, or "". Dates are stored as UTC midnight, so use UTC. */
export function toDateInput(value: Date | string | null | undefined): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 6" from "2026-11-06". No timezone maths, so the day never shifts. */
export function formatDayMonth(ymd: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) return "";
    return `${SHORT_MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`;
}

/** "5 default milestones · Nov 6 – Mar 10", or "… · Dates not set". */
export function milestoneRangeSummary(milestones: Array<Pick<MilestoneDraft, "startDate" | "endDate">>): string {
    const dates = milestones.flatMap((m) => [m.startDate, m.endDate]).filter(Boolean).sort();
    if (dates.length === 0) return "5 default milestones · Dates not set";
    return `5 default milestones · ${formatDayMonth(dates[0])} – ${formatDayMonth(dates[dates.length - 1])}`;
}

/**
 * Milestone dates must be complete, each start on or before its end, and each milestone must start on or
 * after the end of the one before it (the 5 run in order). Returns one message per milestone key.
 */
export function validateMilestoneDates(
    milestones: Array<Pick<MilestoneDraft, "key" | "title" | "startDate" | "endDate">>,
): { ok: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    let previousEnd = "";
    let previousTitle = "";

    for (const m of milestones) {
        if (!m.startDate || !m.endDate) {
            errors[m.key] = "Set a start date and an end date.";
        } else if (m.startDate > m.endDate) {
            errors[m.key] = "The end date must be on or after the start date.";
        } else if (previousEnd && m.startDate < previousEnd) {
            errors[m.key] = `Starts before "${previousTitle}" ends. The milestones run in order.`;
        }
        if (m.endDate) {
            previousEnd = m.endDate;
            previousTitle = m.title;
        }
    }

    return { ok: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// Payment schedule
// ---------------------------------------------------------------------------

export function scheduleTotalPercent(items: Array<Pick<ScheduleDraftItem, "percent">>): number {
    return items.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
}

/** Valid when there is at least one payment, every payment has a label, and the percents total exactly 100. */
export function validateSchedule(items: ScheduleDraftItem[]): { ok: boolean; message: string | null } {
    if (items.length === 0) return { ok: false, message: "Add at least one payment." };
    if (items.some((item) => !item.label.trim())) return { ok: false, message: "Every payment needs a name." };
    const total = scheduleTotalPercent(items);
    if (total !== 100) return { ok: false, message: `Percents must add up to 100% (now ${total}%).` };
    return { ok: true, message: null };
}

/** "3 payments · 30% on signing, 30% after design approval, 40% on handover" */
export function scheduleSummary(items: ScheduleDraftItem[]): string {
    if (items.length === 0) return "No payments set";
    const parts = items.map((item) => `${item.percent}% ${item.label.trim().toLowerCase()}`);
    return `${items.length} payment${items.length === 1 ? "" : "s"} · ${parts.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/** True while the terms are empty or still the text seeded when the draft was created. */
export function isStandardTerms(terms: string | null | undefined): boolean {
    const value = (terms ?? "").trim();
    return value === "" || value.startsWith("Standard Agency Terms:") || value.startsWith("Standard agency terms apply");
}

// ---------------------------------------------------------------------------
// Fields and sending
// ---------------------------------------------------------------------------

export type DraftFields = {
    projectName: string;
    overview: string;
    solution: string;
    exclusions: string;
    needs: string;
    goals: string;
    priceMode: "priced" | "to_be_discussed";
    currency: "PHP" | "USD";
    /** Whole number, or null when empty. */
    totalPrice: number | null;
    /** YYYY-MM-DD */
    validUntil: string;
    terms: string;
};

/** Length checks that match `SaveProposalSchema`, so the editor can say which field is too long. */
export function validateDraftFields(fields: DraftFields): Record<string, string> {
    const errors: Record<string, string> = {};
    if (fields.projectName.length > LIMITS.projectName) errors.projectName = `At most ${LIMITS.projectName} characters.`;
    if (fields.overview.length > LIMITS.overview) errors.overview = `At most ${LIMITS.overview} characters.`;
    if (fields.solution.length > LIMITS.solution) errors.solution = `At most ${LIMITS.solution} characters.`;
    if (fields.exclusions.length > LIMITS.exclusions) errors.exclusions = `At most ${LIMITS.exclusions} characters.`;
    if (fields.terms.length > LIMITS.terms) errors.terms = `At most ${LIMITS.terms} characters.`;
    if (fields.needs.length > LIMITS.needsGoals) errors.needs = `At most ${LIMITS.needsGoals} characters.`;
    if (fields.goals.length > LIMITS.needsGoals) errors.goals = `At most ${LIMITS.needsGoals} characters.`;
    if (fields.totalPrice !== null && (!Number.isFinite(fields.totalPrice) || fields.totalPrice < 0)) {
        errors.totalPrice = "Enter a price of 0 or more.";
    }
    return errors;
}

/**
 * What must be fixed before the proposal can be sent. `sendProposal` checks the milestone dates and the
 * priced rules again on the server; the project name, overview and valid-until checks are editor rules.
 */
export function getSendProblems(input: {
    fields: DraftFields;
    milestones: MilestoneDraft[];
    schedule: ScheduleDraftItem[];
    /** Today as YYYY-MM-DD in Manila, so "valid until" can be checked against it. */
    today: string;
}): string[] {
    const problems: string[] = [];
    const { fields } = input;

    if (!fields.projectName.trim()) problems.push("Add a project name.");
    if (!fields.overview.trim()) problems.push("Add the project overview.");

    if (!validateMilestoneDates(input.milestones).ok) {
        problems.push("Fix the milestone dates: all 5 need a start and end date, in order.");
    }

    if (fields.priceMode === "priced") {
        if (fields.totalPrice === null || fields.totalPrice <= 0) problems.push("Enter a total price above 0, or switch to Price to be discussed.");
        const schedule = validateSchedule(input.schedule);
        if (!schedule.ok) problems.push(`Payment schedule: ${schedule.message}`);
    }

    if (!fields.validUntil) problems.push("Set a Valid until date.");
    else if (fields.validUntil < input.today) problems.push("The Valid until date has passed.");

    const lengths = validateDraftFields(fields);
    for (const message of Object.values(lengths)) problems.push(message);

    return problems;
}

/** Fields sent to `updateProposal` when saving the draft. Milestones and the schedule are saved by their own dialogs. */
export function buildSavePayload(fields: DraftFields) {
    const priced = fields.priceMode === "priced";
    const price = priced ? (fields.totalPrice ?? 0) : 0;
    return {
        projectName: fields.projectName.trim(),
        scope: fields.overview,
        technicalApproach: fields.solution,
        exclusions: fields.exclusions,
        needsGoals: { needs: fields.needs, goals: fields.goals },
        priceMode: fields.priceMode,
        currency: fields.currency,
        totalPrice: priced ? fields.totalPrice : null,
        // Legacy totals stay in step with the price: the client view and the document read `total`.
        subtotal: price,
        total: price,
        discount: 0,
        tax: 0,
        validUntil: fields.validUntil ? new Date(`${fields.validUntil}T00:00:00.000Z`) : null,
        terms: fields.terms,
    };
}
