/**
 * The discovery form's budget is two amounts in the client's currency, saved as one text
 * value ("₱100,000 – ₱500,000") so the database column and the proposal copy stay unchanged.
 * Local clients are quoted in pesos, international clients in US dollars (proposal currency).
 */

export type BudgetCurrency = "PHP" | "USD";

const SIGN: Record<BudgetCurrency, string> = { PHP: "₱", USD: "$" };

/** Keeps digits only, so "₱1,500" and "1500" read the same. */
export const digitsOnly = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/** "250000" → "250,000" for display in the input. */
export const groupDigits = (digits: string) => (digits ? Number(digits).toLocaleString("en-PH") : "");

/** Returns an error to show, or null when the range is valid. */
export function budgetRangeError(min: string, max: string): string | null {
    if (!min || !max) return "Enter both amounts of the budget range.";
    if (Number(min) <= 0 || Number(max) <= 0) return "Budget amounts must be more than zero.";
    if (Number(max) < Number(min)) return "The second amount must be the same as or higher than the first.";
    return null;
}

export function formatBudgetRange(min: string, max: string, currency: BudgetCurrency): string {
    const sign = SIGN[currency];
    return `${sign}${groupDigits(min)} – ${sign}${groupDigits(max)}`;
}

/** Reads a value saved by `formatBudgetRange`. Older free-text values return null. */
export function parseBudgetRange(value: string | null | undefined): { min: string; max: string; currency: BudgetCurrency } | null {
    const match = value?.trim().match(/^([₱$])\s?([\d,]+)\s?[–-]\s?[₱$]\s?([\d,]+)$/);
    if (!match) return null;
    return { currency: match[1] === "$" ? "USD" : "PHP", min: digitsOnly(match[2]), max: digitsOnly(match[3]) };
}
