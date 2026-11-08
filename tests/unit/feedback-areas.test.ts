import { describe, expect, it } from "vitest";
import { csatPercent, lowestArea } from "@/features/client-portal/feedback-areas";

describe("lowestArea", () => {
    it("is null when every answered area is 4 or 5, or none were answered", () => {
        expect(lowestArea({})).toBeNull();
        expect(lowestArea({ ratingCommunication: 5, ratingQuality: 4, ratingOnTime: null })).toBeNull();
    });
    it("returns the lowest area below 4", () => {
        const r = lowestArea({ ratingCommunication: 5, ratingOnTime: 3, ratingValue: 2 });
        expect(r?.short).toBe("Value");
        expect(r?.score).toBe(2);
    });
});

describe("csatPercent", () => {
    it("counts 4 and 5 as satisfied", () => {
        expect(csatPercent([5, 4, 4, 3, 5, 5, 2])).toBe(71);
        expect(csatPercent([])).toBeNull();
    });
});
