import { describe, expect, it } from "vitest";
import { budgetRangeError, digitsOnly, formatBudgetRange, parseBudgetRange } from "@/features/crm/budget-range";

describe("discovery budget range", () => {
    it("formats pesos and dollars with grouped digits", () => {
        expect(formatBudgetRange("100000", "500000", "PHP")).toBe("₱100,000 – ₱500,000");
        expect(formatBudgetRange("2500", "8000", "USD")).toBe("$2,500 – $8,000");
    });

    it("reads back what it saved", () => {
        expect(parseBudgetRange("₱100,000 – ₱500,000")).toEqual({ currency: "PHP", min: "100000", max: "500000" });
        expect(parseBudgetRange("$2,500 – $8,000")).toEqual({ currency: "USD", min: "2500", max: "8000" });
    });

    it("leaves older free-text values alone", () => {
        expect(parseBudgetRange("50k to 100k")).toBeNull();
        expect(parseBudgetRange("")).toBeNull();
        expect(parseBudgetRange(null)).toBeNull();
    });

    it("keeps digits only", () => {
        expect(digitsOnly("₱1,500.00x")).toBe("150000");
        expect(digitsOnly("007")).toBe("7");
    });

    it("refuses empty, zero and reversed ranges", () => {
        expect(budgetRangeError("", "500")).not.toBeNull();
        expect(budgetRangeError("0", "500")).not.toBeNull();
        expect(budgetRangeError("500", "100")).not.toBeNull();
        expect(budgetRangeError("100", "100")).toBeNull();
        expect(budgetRangeError("100", "500")).toBeNull();
    });
});
