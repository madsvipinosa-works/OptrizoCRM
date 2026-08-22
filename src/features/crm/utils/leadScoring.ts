export interface LeadScoringInput {
    estimatedValue?: number | null;
    budget?: string | null;
    timelineExpectation?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    goals?: string | null;
    serviceId?: string | null;
}

export function calculateLeadScore(data: LeadScoringInput): { score: number; priority: "Hot" | "Warm" | "Cold" } {
    let score = 0;

    // 1. Budget / Estimated Value Weight (Max 30 pts)
    const val = data.estimatedValue || 0;
    if (val >= 10000) {
        score += 30;
    } else if (val >= 5000) {
        score += 20;
    } else if (val > 0) {
        score += 10;
    } else if (data.budget && (data.budget.toLowerCase().includes("10k") || data.budget.toLowerCase().includes("20k") || data.budget.toLowerCase().includes("50k"))) {
        score += 25;
    } else if (data.budget && data.budget.toLowerCase().includes("5k")) {
        score += 15;
    } else {
        score += 10;
    }

    // 2. Timeline Urgency Weight (Max 25 pts)
    const timeline = (data.timelineExpectation || "").toLowerCase();
    if (timeline.includes("urgent") || timeline.includes("immediate") || timeline.includes("asap")) {
        score += 25;
    } else if (timeline.includes("1") || timeline.includes("month") || timeline.includes("2-4 weeks")) {
        score += 15;
    } else {
        score += 5;
    }

    // 3. Contact Completeness Weight (Max 25 pts)
    if (data.contactEmail && data.contactEmail.trim().length > 0) score += 10;
    if (data.contactPhone && data.contactPhone.trim().length > 0) score += 10;
    if (data.goals && data.goals.trim().length > 20) score += 5;

    // 4. Service Clarity (Max 20 pts)
    if (data.serviceId && data.serviceId.trim().length > 0) {
        score += 20;
    } else {
        score += 10;
    }

    // Priority Classification: >= 75 -> Hot, 45-74 -> Warm, < 45 -> Cold
    let priority: "Hot" | "Warm" | "Cold" = "Warm";
    if (score >= 75) {
        priority = "Hot";
    } else if (score < 45) {
        priority = "Cold";
    }

    return { score: Math.min(score, 100), priority };
}
