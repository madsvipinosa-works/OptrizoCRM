/**
 * DRAFT SCORING LOGIC
 * TODO: Confirm specific point values and criteria with the client.
 * Currently uses placeholder weights.
 */
export function calculateLeadScore(data: { budget?: string; service?: string; message: string }): number {
    let score = 0;

    // 1. Budget Scoring (Max 50)
    if (data.budget) {
        if (data.budget === "$10k+") score += 50;
        else if (data.budget === "$5k - $10k") score += 30;
        else if (data.budget === "$1k - $5k") score += 10;
        else score += 5; // <$1k
    }

    // 2. Service Urgency / Type (Max 30)
    // Assuming context from message or future fields
    const lowerMessage = data.message.toLowerCase();
    if (lowerMessage.includes("urgent") || lowerMessage.includes("asap")) {
        score += 20;
    }
    if (lowerMessage.includes("enterprise") || lowerMessage.includes("platform")) {
        score += 10;
    }

    // 3. Completeness (Max 20)
    if (data.message.length > 100) score += 20;
    else if (data.message.length > 50) score += 10;

    return Math.min(score, 100);
}
