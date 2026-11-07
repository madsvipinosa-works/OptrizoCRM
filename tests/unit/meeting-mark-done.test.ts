import { describe, expect, it } from "vitest";
import { markDoneBlock } from "@/features/meetings/rules";

const now = new Date("2026-11-07T10:00:00+08:00");
const past = new Date("2026-11-06T15:00:00+08:00");
const future = new Date("2026-11-09T09:00:00+08:00");

describe("mark meeting as done", () => {
    it("allows a confirmed or invited meeting that has started", () => {
        expect(markDoneBlock({ status: "confirmed", startsAt: past }, now)).toBeNull();
        expect(markDoneBlock({ status: "awaiting_client", startsAt: past }, now)).toBeNull();
        expect(markDoneBlock({ status: "confirmed", startsAt: now }, now)).toBeNull();
    });

    it("refuses a meeting that has not started", () => {
        expect(markDoneBlock({ status: "confirmed", startsAt: future }, now)).toMatch(/not started/);
    });

    it("refuses while the client asks for another time, even after the old time", () => {
        expect(markDoneBlock({ status: "reschedule_requested", startsAt: past }, now)).toMatch(/another time/);
    });

    it("refuses done and cancelled meetings", () => {
        expect(markDoneBlock({ status: "done", startsAt: past }, now)).not.toBeNull();
        expect(markDoneBlock({ status: "cancelled", startsAt: past }, now)).not.toBeNull();
    });
});
