import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatHm, isPastManila, manilaToDate, nowHm, todayYmd } from "@/lib/datetime";

// Nov 6, 2026, 10:00 AM in Manila is 02:00 UTC.
const AT = new Date("2026-11-06T02:00:00.000Z");

describe("datetime", () => {
    it("formats in Manila time whatever the server timezone is", () => {
        expect(formatDate(AT)).toBe("Nov 6, 2026");
        expect(formatDateTime(AT)).toMatch(/^Nov 6, 2026, 10:00\sAM$/);
        expect(formatHm("14:30")).toMatch(/^2:30\sPM$/);
    });

    it("reads picked date and time as Manila", () => {
        expect(manilaToDate("2026-11-06", "10:00").toISOString()).toBe("2026-11-06T02:00:00.000Z");
        expect(todayYmd(new Date("2026-11-06T17:00:00.000Z"))).toBe("2026-11-07"); // 1 AM in Manila
        expect(nowHm(AT)).toBe("10:00");
    });

    it("tells past from future", () => {
        expect(isPastManila("2026-11-06", "09:59", AT)).toBe(true);
        expect(isPastManila("2026-11-06", "10:01", AT)).toBe(false);
        expect(isPastManila("2026-11-05", undefined, AT)).toBe(true);
        expect(isPastManila("2026-11-06", undefined, AT)).toBe(false);
    });
});

import { formatWithZone, zonedToDate, tzLabel, isValidTimezone } from "@/lib/datetime";

describe("client timezone", () => {
    const AT2 = new Date("2026-11-06T02:00:00.000Z"); // 10:00 AM Manila, 6:00 AM in Dubai
    it("shows the client's time next to Manila time", () => {
        expect(formatWithZone(AT2, "Asia/Dubai")).toMatch(/^Nov 6, 2026, 6:00\sAM GMT\+4 \(Nov 6, 2026, 10:00\sAM Manila time\)$/);
        expect(formatWithZone(AT2, null)).toMatch(/^Nov 6, 2026, 10:00\sAM \(Manila time\)$/);
        expect(formatWithZone(AT2, "Asia/Manila")).toMatch(/\(Manila time\)$/);
        expect(tzLabel(AT2)).toBe("PHT");
    });
    it("reads a picked time in the client's zone, including daylight saving", () => {
        expect(zonedToDate("2026-11-06", "06:00", "Asia/Dubai").toISOString()).toBe("2026-11-06T02:00:00.000Z");
        expect(zonedToDate("2026-07-01", "09:00", "America/Los_Angeles").toISOString()).toBe("2026-07-01T16:00:00.000Z"); // PDT, UTC-7
        expect(zonedToDate("2026-12-01", "09:00", "America/Los_Angeles").toISOString()).toBe("2026-12-01T17:00:00.000Z"); // PST, UTC-8
    });
    it("rejects names that are not timezones", () => {
        expect(isValidTimezone("Asia/Dubai")).toBe(true);
        expect(isValidTimezone("Mars/Olympus")).toBe(false);
    });
});
