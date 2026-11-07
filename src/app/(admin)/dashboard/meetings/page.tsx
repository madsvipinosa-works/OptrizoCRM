"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { addDays, format, isSameDay, isToday, isWeekend, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Video, Phone, MapPin } from "lucide-react";
import {
    getMeetings,
    checkAndSendMeetingReminders,
    type MeetingItem,
} from "@/features/meetings/actions";
import { ScheduleDiscoveryMeetingModal } from "@/features/meetings/components/ScheduleDiscoveryMeetingModal";
import { MeetingDetailDrawer, MeetingStatusChip } from "@/features/meetings/components/MeetingDetailDrawer";

const TYPE_LABEL: Record<MeetingItem["type"], string> = {
    discovery: "Discovery",
    budget_pricing: "Budget and pricing",
    project_review: "Project review",
    uat: "UAT and testing session",
};

const TAB_TONE = {
    upcoming: { dot: "bg-brand-deep", active: "border-brand-deep/30 bg-brand-soft text-brand-deep" },
    done: { dot: "bg-muted-foreground", active: "border-border bg-muted text-foreground" },
    cancelled: { dot: "bg-destructive", active: "border-destructive/30 bg-destructive/10 text-destructive" },
} as const;

const FORMAT_LABEL: Record<MeetingItem["format"], string> = {
    video: "Video call",
    phone: "Phone call",
    in_person: "In person",
    on_site: "On site",
};

export default function MeetingsPage() {
    const { data: session } = useSession();
    // No role until the session has loaded. Defaulting to "sales" showed a PM the Sales controls (and the
    // drawer as view-only) for as long as the session was still loading.
    const role = (session?.user as { role?: string } | undefined)?.role ?? "";
    const isSales = role === "sales";

    const [meetingsList, setMeetingsList] = useState<MeetingItem[]>([]);
    const [selectedTab, setSelectedTab] = useState<"upcoming" | "done" | "cancelled">("upcoming");
    const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(null);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        try {
            // Page-load reminder check per spec §4
            await checkAndSendMeetingReminders();
            const data = await getMeetings();
            setMeetingsList(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter counts
    const upcomingMeetings = useMemo(
        () => meetingsList.filter((m) => ["awaiting_client", "confirmed", "reschedule_requested"].includes(m.status)),
        [meetingsList]
    );
    const doneMeetings = useMemo(
        () => meetingsList.filter((m) => m.status === "done"),
        [meetingsList]
    );
    const cancelledMeetings = useMemo(
        () => meetingsList.filter((m) => m.status === "cancelled"),
        [meetingsList]
    );

    const displayedMeetings = useMemo(() => {
        if (selectedTab === "done") return doneMeetings;
        if (selectedTab === "cancelled") return cancelledMeetings;
        return upcomingMeetings;
    }, [selectedTab, upcomingMeetings, doneMeetings, cancelledMeetings]);

    const tabs = [
        ["upcoming", "Upcoming", upcomingMeetings.length],
        ["done", "Done", doneMeetings.length],
        ["cancelled", "Cancelled", cancelledMeetings.length],
    ] as const;

    // This week, Monday to Friday (mockup "Ref: Sales all appointments"). Cancelled meetings do not count.
    const week = useMemo(() => {
        // On Saturday and Sunday show the coming week, not the one that just ended.
        const now = new Date();
        const monday = startOfWeek(isWeekend(now) ? addDays(now, 2) : now, { weekStartsOn: 1 });
        return Array.from({ length: 5 }, (_, i) => {
            const day = addDays(monday, i);
            const count = meetingsList.filter((m) => m.status !== "cancelled" && isSameDay(new Date(m.startsAt), day)).length;
            return { day, count };
        });
    }, [meetingsList]);

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meetings</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Every client appointment in one place, with its status.
                    </p>
                </div>
                {isSales && (
                    <Button onClick={() => setIsScheduleModalOpen(true)} className="gap-1.5 font-semibold active:scale-[0.97]">
                        <Plus className="size-4" aria-hidden="true" />
                        Schedule appointment
                    </Button>
                )}
            </div>

            <ol aria-label="This week" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {week.map(({ day, count }) => {
                    const today = isToday(day);
                    return (
                        <li
                            key={day.toISOString()}
                            aria-current={today ? "date" : undefined}
                            className={cn(
                                "rounded-xl border bg-card px-4 py-3",
                                today ? "border-brand-deep/50 ring-1 ring-inset ring-brand-deep/30" : "border-border"
                            )}
                        >
                            <p className="text-sm text-muted-foreground">{format(day, "EEE")}{today && " · Today"}</p>
                            <p className="text-lg font-semibold tracking-tight text-foreground">{format(day, "MMM d")}</p>
                            <p className={cn("text-sm tabular-nums", count ? "font-medium text-brand-deep" : "text-muted-foreground")}>
                                {count} {count === 1 ? "meeting" : "meetings"}
                            </p>
                        </li>
                    );
                })}
            </ol>

            {/* Each tab carries its status colour: green upcoming, grey done, red cancelled */}
            <div role="group" aria-label="Meeting list" className="flex flex-wrap gap-2">
                {tabs.map(([tab, label, count]) => {
                    const active = selectedTab === tab;
                    const tone = TAB_TONE[tab];
                    return (
                        <button
                            key={tab}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSelectedTab(tab)}
                            className={cn(
                                "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium outline-none transition-[color,background-color,border-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                                active ? tone.active : "border-border bg-card text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span aria-hidden="true" className={cn("size-2 rounded-full", tone.dot)} />
                            {label}
                            <span className="tabular-nums">({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* Meetings table (mockup 025-4a) */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                    {/* Fixed widths so the columns stay put across tabs, empty or full. */}
                    <table className="w-full table-fixed text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                                <th scope="col" className="w-[42%] px-5 py-2.5 font-medium sm:w-[34%] md:w-[20%]">Date and time</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Business name</th>
                                <th scope="col" className="hidden w-[18%] px-3 py-2.5 font-medium md:table-cell">Meeting type</th>
                                <th scope="col" className="hidden w-[24%] px-3 py-2.5 font-medium lg:table-cell">Attendees</th>
                                <th scope="col" className="w-[136px] px-5 py-2.5 font-medium sm:w-[172px]">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading &&
                                displayedMeetings.map((meeting) => {
                                    const FormatIcon = meeting.format === "video" ? Video : meeting.format === "phone" ? Phone : MapPin;
                                    const business = meeting.lead?.businessName || "Not linked";
                                    return (
                                        <tr
                                            key={meeting.id}
                                            onClick={() => setSelectedMeeting(meeting)}
                                            className="cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-muted/50"
                                        >
                                            <td className="px-5 py-3">
                                                <p className="font-medium tabular-nums text-foreground">{format(new Date(meeting.startsAt), "MMM d, h:mm a")}</p>
                                                <p className="flex items-center gap-1.5 text-muted-foreground">
                                                    <FormatIcon className="size-3.5" aria-hidden="true" />
                                                    {FORMAT_LABEL[meeting.format]}
                                                </p>
                                            </td>
                                            <td className="px-3 py-3">
                                                {/* The row is clickable for the mouse; this button is the keyboard and screen reader way in. */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedMeeting(meeting);
                                                    }}
                                                    className="rounded-sm text-left font-semibold text-foreground outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    {business}
                                                </button>
                                                {meeting.lead?.contactName && <p className="truncate text-muted-foreground">Client name: {meeting.lead.contactName}</p>}
                                            </td>
                                            <td className="hidden px-3 py-3 text-foreground md:table-cell">{TYPE_LABEL[meeting.type]}</td>
                                            <td className="hidden truncate px-3 py-3 text-muted-foreground lg:table-cell" title={meeting.attendees?.join(", ")}>
                                                {meeting.attendees?.length ? meeting.attendees.join(", ") : "Not set"}
                                            </td>
                                            <td className="px-5 py-3">
                                                <MeetingStatusChip status={meeting.status} />
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
                {/* Outside the table: a colSpan row would add hidden columns and shift the headers on small screens. */}
                {isLoading ? (
                    <p className="px-5 py-14 text-center text-sm text-muted-foreground">Loading meetings…</p>
                ) : displayedMeetings.length === 0 ? (
                    <div className="px-5 py-14 text-center text-sm">
                        <p className="font-medium text-foreground">No {selectedTab} meetings.</p>
                        <p className="mt-1 text-muted-foreground">
                            {selectedTab === "upcoming"
                                ? isSales
                                    ? "Schedule a discovery meeting from a lead or with Schedule appointment."
                                    : "Meetings you book or are invited to show up here."
                                : "They show up here once a meeting is " + (selectedTab === "done" ? "marked as done." : "cancelled.")}
                        </p>
                    </div>
                ) : null}
            </div>

            {/* Modals & Drawers */}
            <ScheduleDiscoveryMeetingModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                onSuccess={loadData}
            />

            <MeetingDetailDrawer
                meeting={selectedMeeting}
                isOpen={!!selectedMeeting}
                onClose={() => setSelectedMeeting(null)}
                role={role}
                onUpdate={loadData}
            />
        </div>
    );
}
