import type { MeetingItem } from "@/features/meetings/actions";

/**
 * Whether a meeting can be marked as done now. Shared by the drawer (to show the button)
 * and `markMeetingDone` (to refuse it), so the two never disagree.
 * Not before it starts, and not while the client is asking for another time.
 */
export function markDoneBlock(
    meeting: Pick<MeetingItem, "status" | "startsAt">,
    now: Date = new Date()
): string | null {
    if (meeting.status === "done") return "This meeting is already marked as done.";
    if (meeting.status === "cancelled") return "A cancelled meeting cannot be marked as done.";
    if (meeting.status === "reschedule_requested") return "The client asked for another time. Reschedule the meeting first.";
    if (new Date(meeting.startsAt).getTime() > now.getTime()) return "This meeting has not started yet. Mark it as done after it takes place.";
    return null;
}

/** Label for the location field, by format. Phone meetings have none (staff call the lead's number). */
export function meetingLocationLabel(format: MeetingItem["format"]): string | null {
    if (format === "video") return "Video / meeting link";
    if (format === "phone") return null;
    return "Venue / address";
}

/**
 * Cleans the location for a format, or returns an error. Shared by the forms and the server actions.
 * Video needs an http(s) link; in person and on site need an address; phone stores nothing.
 */
export function checkMeetingLocation(
    format: MeetingItem["format"],
    raw: string | null | undefined
): { ok: true; location: string | null } | { ok: false; message: string } {
    if (format === "phone") return { ok: true, location: null };
    const location = (raw ?? "").trim();
    if (!location) return { ok: false, message: `Enter the ${meetingLocationLabel(format)!.toLowerCase()}.` };
    if (location.length > 500) return { ok: false, message: "The location is too long (500 characters at most)." };
    if (format === "video") {
        let url: URL | null = null;
        try { url = new URL(location); } catch { /* not a URL */ }
        if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
            return { ok: false, message: "Enter a full meeting link that starts with https://" };
        }
    }
    return { ok: true, location };
}
