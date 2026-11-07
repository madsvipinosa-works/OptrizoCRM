import { after } from "next/server";
import { redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { checkAndSendMeetingReminders, getMeetings } from "@/features/meetings/actions";
import { MeetingsView } from "@/features/meetings/components/MeetingsView";

export const metadata = {
    title: "Meetings | Optrizo",
    description: "Every client appointment in one place, with its status.",
};

/** Meetings (mockup 025-4a). Loaded on the server so the list is in the first paint, not after a chain of client calls. */
export default async function MeetingsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    // Spec: Sales and the PM share one meeting list.
    if (!hasRole(session, ["sales", "manager"])) redirect("/dashboard");

    const meetings = await getMeetings();

    // The day-before reminder emails (spec §4) still run on each visit, but after the page is sent,
    // so they no longer hold the list back. shortcut: runs only when someone opens Meetings; move to a scheduled job when one exists.
    after(() => checkAndSendMeetingReminders());

    return <MeetingsView meetings={meetings} role={session.user.role ?? ""} />;
}
