import { describe, it, expect } from "vitest";

interface PricingLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

function calculateProposalTotals(
  items: PricingLineItem[],
  discount = 0,
  tax = 0
) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const grandTotal = Math.max(0, subtotal - discount + tax);
  return { subtotal, grandTotal };
}

function parseSafeDate(dateVal: any, daysAhead = 30): string {
  try {
    if (dateVal) {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }
  } catch {}
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

describe("Proposal & SOW Studio Calculations Unit Tests", () => {
  it("should calculate correct subtotal and grand total for standard line items", () => {
    const items: PricingLineItem[] = [
      { name: "Strategic Design & Discovery", quantity: 1, unitPrice: 3000, total: 3000 },
      { name: "Full-Stack Web Development", quantity: 1, unitPrice: 7000, total: 7000 },
      { name: "Deployment & QA Handover", quantity: 1, unitPrice: 2000, total: 2000 },
    ];

    const { subtotal, grandTotal } = calculateProposalTotals(items, 1000, 500);

    expect(subtotal).toBe(12000);
    expect(grandTotal).toBe(11500); // 12000 - 1000 + 500
  });

  it("should clamp grand total to zero if discount exceeds subtotal + tax", () => {
    const items: PricingLineItem[] = [
      { name: "Consultation Call", quantity: 1, unitPrice: 500, total: 500 },
    ];

    const { subtotal, grandTotal } = calculateProposalTotals(items, 1000, 0);

    expect(subtotal).toBe(500);
    expect(grandTotal).toBe(0);
  });

  it("should handle empty or malformed line items gracefully without throwing", () => {
    const items: any[] = [
      { name: "Broken Item 1", total: undefined },
      { name: "Broken Item 2", total: null },
      { name: "Valid Item", total: 1500 },
    ];

    const { subtotal, grandTotal } = calculateProposalTotals(items);

    expect(subtotal).toBe(1500);
    expect(grandTotal).toBe(1500);
  });

  describe("Proposal Safe Date Parsing", () => {
    it("should format valid date strings to YYYY-MM-DD", () => {
      const parsed = parseSafeDate("2026-12-31T15:30:00.000Z");
      expect(parsed).toBe("2026-12-31");
    });

    it("should fallback to 30 days ahead when date is invalid or null", () => {
      const fallbackNull = parseSafeDate(null);
      const fallbackInvalid = parseSafeDate("invalid-date-string");

      const expectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      expect(fallbackNull).toBe(expectedDate);
      expect(fallbackInvalid).toBe(expectedDate);
    });
  });
});
