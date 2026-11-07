import { describe, expect, it } from "vitest";
import { customMilestoneError, orderMilestones, sortOrderAfter, validateMilestoneDates } from "@/features/proposals/draft-logic";

const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

describe("milestones the PM adds", () => {
    it("keeps the 5 defaults in order and slots added ones between them", () => {
        const list = orderMilestones([
            { name: "design", startDate: d("2026-11-14"), endDate: d("2026-11-20") },
            { id: "c1", name: null, title: "Content migration", description: "Move old data", sortOrder: 350, startDate: d("2026-12-01"), endDate: d("2026-12-05") },
            { name: "requirements", startDate: d("2026-11-10"), endDate: d("2026-11-13") },
        ]);
        expect(list.map((m) => m.key)).toEqual(["requirements", "design", "development", "c1", "uat_testing", "handover"]);
        expect(list.find((m) => m.key === "c1")).toMatchObject({ custom: true, title: "Content migration", startDate: "2026-12-01" });
        expect(list[0]).toMatchObject({ custom: false, startDate: "2026-11-10", endDate: "2026-11-13" });
    });

    it("shows a standard milestone's new name for this proposal, keeping its key", () => {
        const list = orderMilestones([{ name: "design", title: "UI design", description: "Figma screens", startDate: d("2026-11-14"), endDate: d("2026-11-20") }]);
        expect(list[1]).toMatchObject({ key: "design", custom: false, title: "UI design", description: "Figma screens" });
        // Not renamed: the standard wording.
        expect(list[0].title).toBe("Requirements & Architecture");
    });

    it("puts a new milestone halfway to the next one, or after the last", () => {
        const list = [{ sortOrder: 100 }, { sortOrder: 200 }, { sortOrder: 300 }];
        expect(sortOrderAfter(list, 0)).toBe(150);
        expect(sortOrderAfter(list, 2)).toBe(400);
        expect(sortOrderAfter([{ sortOrder: 100 }, { sortOrder: 101 }], 0)).toBe(101);
    });

    it("needs a name and keeps the text short", () => {
        expect(customMilestoneError({ title: " ", description: "" })).toMatch(/name/);
        expect(customMilestoneError({ title: "x".repeat(81), description: "" })).toMatch(/80/);
        expect(customMilestoneError({ title: "Training", description: "y".repeat(301) })).toMatch(/300/);
        expect(customMilestoneError({ title: "Training", description: "Two sessions" })).toBeNull();
    });

    it("checks the order across defaults and added milestones", () => {
        const list = orderMilestones([
            { name: "requirements", startDate: d("2026-11-10"), endDate: d("2026-11-20") },
            { id: "c1", name: null, title: "Extra", sortOrder: 150, startDate: d("2026-11-15"), endDate: d("2026-11-18") },
        ]);
        expect(validateMilestoneDates(list).errors.c1).toMatch(/Starts before/);
    });
});
