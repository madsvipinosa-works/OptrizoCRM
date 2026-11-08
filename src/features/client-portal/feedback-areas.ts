/** The five areas a client rates in the survey (step 31). Keys match the project_feedback columns. */
export const FEEDBACK_AREAS = [
    { key: "ratingCommunication", short: "Communication", label: "Communication", hint: "Updates, replies, meetings" },
    { key: "ratingQuality", short: "Quality", label: "Quality of the delivered system", hint: "Works as agreed, few defects" },
    { key: "ratingOnTime", short: "On time", label: "Delivery on time", hint: "Milestones met their dates" },
    { key: "ratingValue", short: "Value", label: "Value for the price", hint: "" },
    { key: "ratingPmSupport", short: "PM support", label: "Project Manager support", hint: "" },
] as const;

export type AreaKey = (typeof FEEDBACK_AREAS)[number]["key"];
export type AreaRatings = Partial<Record<AreaKey, number | null>>;

export const OVERALL_LABELS = ["", "Very unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very satisfied"];

/** An area rated below this is flagged for a follow-up. */
export const FOLLOW_UP_BELOW = 4;

/** The lowest area that is below the threshold, or null when every answered area is 4 or 5. */
export function lowestArea(r: AreaRatings): { key: AreaKey; short: string; label: string; score: number } | null {
    let worst: { key: AreaKey; short: string; label: string; score: number } | null = null;
    for (const a of FEEDBACK_AREAS) {
        const score = r[a.key];
        if (typeof score === "number" && score < FOLLOW_UP_BELOW && (!worst || score < worst.score)) {
            worst = { key: a.key, short: a.short, label: a.label, score };
        }
    }
    return worst;
}

/** Share of responses where the overall rating is 4 or 5, as a whole percent. Null with no responses. */
export function csatPercent(overall: number[]): number | null {
    if (overall.length === 0) return null;
    return Math.round((overall.filter((n) => n >= 4).length / overall.length) * 100);
}
