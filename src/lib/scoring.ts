/**
 * DRAFT SCORING LOGIC
 * TODO: Confirm specific point values and criteria with the client.
 * Currently uses placeholder weights.
 */
import { SCORING_RULES } from "@/lib/constants";

export function calculateLeadScore(data: { budget?: string; service?: string; message: string }): number {
    let score = 0;

    // 1. Budget Scoring
    if (data.budget) {
        const budgetRule = SCORING_RULES.budget.find(b => b.value === data.budget);
        if (budgetRule) {
            score += budgetRule.score;
        }
    }

    // 2. Service Urgency / Type
    const lowerMessage = data.message.toLowerCase();

    // Check High Urgency
    if (SCORING_RULES.urgencyKeywords.high.keywords.some(k => lowerMessage.includes(k))) {
        score += SCORING_RULES.urgencyKeywords.high.score;
    }
    // Check Medium Urgency (only if not high)
    else if (SCORING_RULES.urgencyKeywords.medium.keywords.some(k => lowerMessage.includes(k))) {
        score += SCORING_RULES.urgencyKeywords.medium.score;
    }

    // 3. Completeness
    if (data.message.length > SCORING_RULES.messageLength.long.minChars) {
        score += SCORING_RULES.messageLength.long.score;
    } else if (data.message.length > SCORING_RULES.messageLength.medium.minChars) {
        score += SCORING_RULES.messageLength.medium.score;
    }

    return Math.min(score, 100);
}
