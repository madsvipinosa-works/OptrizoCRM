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
