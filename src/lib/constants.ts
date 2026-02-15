export const SCORING_RULES = {
    budget: [
        { label: "< $1k", value: "<$1k", score: 5 },
        { label: "$1k - $5k", value: "$1k - $5k", score: 10 },
        { label: "$5k - $10k", value: "$5k - $10k", score: 30 },
        { label: "$10k+", value: "$10k+", score: 50 },
    ],
    urgencyKeywords: {
        high: { keywords: ["urgent", "asap", "immediate"], score: 20 },
        medium: { keywords: ["enterprise", "platform"], score: 10 },
    },
    messageLength: {
        long: { minChars: 100, score: 20 },
        medium: { minChars: 50, score: 10 },
    }
} as const;

// Helper to get budget options for Select component
export const BUDGET_OPTIONS = SCORING_RULES.budget.map(b => b.value);
