/** Days the client has to answer before the PM may complete the project with assumed acceptance. */
export const ACCEPTANCE_WAIT_DAYS = 14;

type AcceptanceFields = {
    acceptanceRequestedAt: Date | null;
    acceptedAt: Date | null;
    fixesRequestedAt: Date | null;
};

export type AcceptanceState = "not_requested" | "awaiting" | "fixes_requested" | "accepted";

/** Where the client acceptance stands. A new request after fixes puts it back to "awaiting". */
export function acceptanceState(p: AcceptanceFields): AcceptanceState {
    if (p.acceptedAt) return "accepted";
    if (!p.acceptanceRequestedAt) return "not_requested";
    if (p.fixesRequestedAt && p.fixesRequestedAt >= p.acceptanceRequestedAt) return "fixes_requested";
    return "awaiting";
}

/** The PM may complete without the client only after the wait, and only while still awaiting an answer. */
export function canAssumeAcceptance(p: AcceptanceFields, now: Date = new Date()): boolean {
    if (acceptanceState(p) !== "awaiting" || !p.acceptanceRequestedAt) return false;
    return now.getTime() - p.acceptanceRequestedAt.getTime() >= ACCEPTANCE_WAIT_DAYS * 86_400_000;
}
