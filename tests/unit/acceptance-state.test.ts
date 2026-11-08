import { describe, expect, it } from "vitest";
import { acceptanceState, canAssumeAcceptance } from "@/features/pm/acceptance-state";

const d = (s: string) => new Date(s);
const base = { acceptanceRequestedAt: null, acceptedAt: null, fixesRequestedAt: null };

describe("acceptanceState", () => {
    it("walks request, fixes, new request, accepted", () => {
        expect(acceptanceState(base)).toBe("not_requested");
        const asked = { ...base, acceptanceRequestedAt: d("2026-11-01") };
        expect(acceptanceState(asked)).toBe("awaiting");
        const fixes = { ...asked, fixesRequestedAt: d("2026-11-02") };
        expect(acceptanceState(fixes)).toBe("fixes_requested");
        const again = { ...fixes, acceptanceRequestedAt: d("2026-11-03") };
        expect(acceptanceState(again)).toBe("awaiting");
        expect(acceptanceState({ ...again, acceptedAt: d("2026-11-04") })).toBe("accepted");
    });
});

describe("canAssumeAcceptance", () => {
    const asked = { ...base, acceptanceRequestedAt: d("2026-11-01T00:00:00Z") };
    it("is blocked before 14 days and allowed after", () => {
        expect(canAssumeAcceptance(asked, d("2026-11-14T00:00:00Z"))).toBe(false);
        expect(canAssumeAcceptance(asked, d("2026-11-15T00:00:00Z"))).toBe(true);
    });
    it("is never allowed when not requested, fixes pending, or accepted", () => {
        expect(canAssumeAcceptance(base, d("2027-01-01"))).toBe(false);
        expect(canAssumeAcceptance({ ...asked, fixesRequestedAt: d("2026-11-02") }, d("2027-01-01"))).toBe(false);
        expect(canAssumeAcceptance({ ...asked, acceptedAt: d("2026-11-02") }, d("2027-01-01"))).toBe(false);
    });
});
