"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Video,
    Phone,
    MapPin,
} from "lucide-react";
import {
    getMeetings,
    checkAndSendMeetingReminders,
    type MeetingItem,
} from "@/features/meetings/actions";
import { ScheduleDiscoveryMeetingModal } from "@/features/meetings/components/ScheduleDiscoveryMeetingModal";
import { MeetingDetailDrawer } from "@/features/meetings/components/MeetingDetailDrawer";

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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "confirmed":
                return (
                    <Badge variant="outline" className="bg-brand-soft text-brand-deep border-brand-deep/20 text-xs font-semibold whitespace-nowrap">
                        Confirmed
                    </Badge>
                );
            case "awaiting_client":
                return (
                    <Badge variant="outline" className="bg-stage-negotiation/10 text-stage-negotiation border-stage-negotiation/30 text-xs font-semibold whitespace-nowrap">
                        Awaiting client
                    </Badge>
                );
            case "reschedule_requested":
                return (
                    <Badge variant="outline" className="bg-stage-discovery/10 text-stage-discovery border-stage-discovery/30 text-xs font-semibold whitespace-nowrap">
                        Reschedule requested
                    </Badge>
                );
            case "done":
                return (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-semibold whitespace-nowrap">
                        Done
                    </Badge>
                );
            case "cancelled":
                return (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs font-semibold whitespace-nowrap">
                        Cancelled
                    </Badge>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex-1 space-y-5 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meetings</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Every client appointment in one place, with its status.
                    </p>
                </div>
                {isSales && (
                    <Button
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="bg-primary text-black font-semibold hover:bg-primary/90 h-9 text-xs gap-1.5"
                    >
                        <Plus className="h-4 w-4" />
                        Schedule appointment
                    </Button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-border pb-3">
                <button
                    onClick={() => setSelectedTab("upcoming")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        selectedTab === "upcoming"
                            ? "bg-primary text-black"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Upcoming ({upcomingMeetings.length})
                </button>
                <button
                    onClick={() => setSelectedTab("done")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        selectedTab === "done"
                            ? "bg-primary text-black"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Done ({doneMeetings.length})
                </button>
                <button
                    onClick={() => setSelectedTab("cancelled")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        selectedTab === "cancelled"
                            ? "bg-primary text-black"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Cancelled ({cancelledMeetings.length})
                </button>
            </div>

            {/* Meetings Table (Mockup 025-4a) */}
            <div className="space-y-2">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground">
                    <div className="col-span-3">Date and time</div>
                    <div className="col-span-3">Business name</div>
                    <div className="col-span-2">Meeting type</div>
                    <div className="col-span-2">Attendees</div>
                    <div className="col-span-2 text-right">Status</div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-xs text-muted-foreground">Loading meetings...</div>
                ) : displayedMeetings.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                        No {selectedTab} meetings found.
                    </div>
                ) : (
                    displayedMeetings.map((meeting) => {
                        const mDate = new Date(meeting.startsAt);
                        const dateFormatted = mDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                        });
                        const timeFormatted = mDate.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                        });

                        return (
                            <div
                                key={meeting.id}
                                onClick={() => setSelectedMeeting(meeting)}
                                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center p-3.5 bg-card border border-border hover:border-primary/50 rounded-xl transition-all cursor-pointer shadow-2xs group"
                            >
                                {/* Date and time */}
                                <div className="col-span-3">
                                    <div className="text-xs font-bold text-foreground">
                                        {dateFormatted}, {timeFormatted}
                                    </div>
                                    <div className="text-xs text-muted-foreground capitalize flex items-center gap-1 mt-0.5">
                                        {meeting.format === "video" ? (
                                            <Video className="h-3 w-3" />
                                        ) : meeting.format === "phone" ? (
                                            <Phone className="h-3 w-3" />
                                        ) : (
                                            <MapPin className="h-3 w-3" />
                                        )}
                                        {meeting.format.replace("_", " ")}
                                    </div>
                                </div>

                                {/* Business name */}
                                <div className="col-span-3">
                                    <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                        {meeting.lead?.businessName || "Opportunity"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Client: {meeting.lead?.contactName || "Direct Contact"}
                                    </div>
                                </div>

                                {/* Meeting type */}
                                <div className="col-span-2 text-xs font-medium text-foreground capitalize">
                                    {meeting.type === "discovery"
                                        ? "Discovery"
                                        : meeting.type === "budget_pricing"
                                        ? "Budget and pricing"
                                        : meeting.type === "project_review"
                                        ? "Project review"
                                        : "UAT"}
                                </div>

                                {/* Attendees */}
                                <div className="col-span-2 text-xs text-muted-foreground truncate">
                                    {meeting.attendees && meeting.attendees.length > 0
                                        ? meeting.attendees.join(", ")
                                        : "Sales, PM"}
                                </div>

                                {/* Status */}
                                <div className="col-span-2 flex items-center justify-start md:justify-end">
                                    {getStatusBadge(meeting.status)}
                                </div>
                            </div>
                        );
                    })
                )}
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
