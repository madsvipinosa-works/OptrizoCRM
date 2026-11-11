import { describe, expect, it } from "vitest";
import { checkMeetingLocation, meetingLocationLabel } from "@/features/meetings/rules";

describe("meeting location", () => {
    it("needs an http(s) link for video", () => {
        expect(checkMeetingLocation("video", " https://meet.google.com/abc-defg-hij ")).toEqual({ ok: true, location: "https://meet.google.com/abc-defg-hij" });
        expect(checkMeetingLocation("video", "").ok).toBe(false);
        expect(checkMeetingLocation("video", "meet.google.com/abc").ok).toBe(false);
        expect(checkMeetingLocation("video", "javascript:alert(1)").ok).toBe(false);
    });

    it("needs an address for in person and on site", () => {
        expect(checkMeetingLocation("in_person", "Optrizo office, Makati")).toEqual({ ok: true, location: "Optrizo office, Makati" });
        expect(checkMeetingLocation("on_site", "   ").ok).toBe(false);
    });

    it("stores nothing for phone", () => {
        expect(checkMeetingLocation("phone", "anything")).toEqual({ ok: true, location: null });
        expect(meetingLocationLabel("phone")).toBeNull();
    });
});
