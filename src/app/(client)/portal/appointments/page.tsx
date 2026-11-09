"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { formatWithZone, nowHm, todayYmd, tzLabel, zonedToDate } from "@/lib/datetime";
import { meetingFormatLabel } from "@/lib/email-templates";
import { useDeviceTimezone } from "@/hooks/use-device-timezone";
import {
    Check,
    RotateCcw,
    X,
    CalendarCheck,
} from "lucide-react";
import {
    getClientAppointments,
    respondToMeeting,
    type MeetingItem,
} from "@/features/meetings/actions";

/** Sentence-case meeting names ("budget_pricing" read "Budget pricing" with CSS capitalize). */
function meetingTitle(type: string) {
    if (type === "discovery") return "Discovery meeting";
    if (type === "budget_pricing") return "Budget and pricing meeting";
    if (type === "project_review") return "Project review meeting";
    if (type === "uat") return "UAT meeting";
    const t = type.replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** What the meeting is about: the project once there is one, otherwise the service the client asked for. */
function meetingSubject(m: { project?: { title: string } | null; lead?: { service?: { title: string } | null; businessName: string | null } | null }) {
    return m.project?.title ?? m.lead?.service?.title ?? m.lead?.businessName ?? null;
}

export default function ClientAppointmentsPage() {
    const tz = useDeviceTimezone();
    const [appointments, setAppointments] = useState<MeetingItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog state for "Suggest another time"
    const [suggestModal, setSuggestModal] = useState<{
        isOpen: boolean;
        meetingId: string | null;
        date: string;
        time: string;
    }>({
        isOpen: false,
        meetingId: null,
        date: "",
        time: "10:00",
    });

    // Dialog state for "Decline"
    const [declineModal, setDeclineModal] = useState<{
        isOpen: boolean;
        meetingId: string | null;
        reason: string;
    }>({
        isOpen: false,
        meetingId: null,
        reason: "",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadAppointments = async () => {
        try {
            const data = await getClientAppointments();
            setAppointments(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAppointments();
    }, []);

    // Past invites cannot be answered any more (the server refuses them too).
    const pendingInvite = appointments.find((m) => m.status === "awaiting_client" && new Date(m.startsAt).getTime() > Date.now());
    const upcomingList = appointments.filter((m) =>
        ["confirmed", "reschedule_requested"].includes(m.status)
    );
    const pastList = appointments.filter((m) =>
        ["done", "cancelled"].includes(m.status)
    );

    const handleConfirm = async (meetingId: string) => {
        setIsSubmitting(true);
        try {
            const res = await respondToMeeting({
                meetingId,
                response: "confirm",
            });
            if (res.success) {
                toast.success("Meeting confirmed! We'll send you a reminder before the meeting.");
                loadAppointments();
            } else {
                toast.error(res.message || "Failed to confirm meeting");
            }
        } catch {
            toast.error("Error confirming meeting");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSuggestSubmit = async () => {
        if (!suggestModal.meetingId || !suggestModal.date || !suggestModal.time) {
            toast.error("Please pick a date and time");
            return;
        }

        const suggestedAt = zonedToDate(suggestModal.date, suggestModal.time, tz);
        if (isNaN(suggestedAt.getTime())) {
            toast.error("Invalid date or time");
            return;
        }
        if (suggestedAt.getTime() <= Date.now()) {
            toast.error("Pick a date and time in the future");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await respondToMeeting({
                meetingId: suggestModal.meetingId,
                response: "suggest_time",
                suggestedAt,
            });
            if (res.success) {
                toast.success("Your suggested time was sent to the Optrizo team.");
                setSuggestModal({ isOpen: false, meetingId: null, date: "", time: "10:00" });
                loadAppointments();
            } else {
                toast.error(res.message || "Failed to submit time");
            }
        } catch {
            toast.error("Error submitting suggested time");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeclineSubmit = async () => {
        if (!declineModal.meetingId) return;

        setIsSubmitting(true);
        try {
            const res = await respondToMeeting({
                meetingId: declineModal.meetingId,
                response: "decline",
                declineReason: declineModal.reason,
            });
            if (res.success) {
                toast.success("Meeting invitation declined.");
                setDeclineModal({ isOpen: false, meetingId: null, reason: "" });
                loadAppointments();
            } else {
                toast.error(res.message || "Failed to decline meeting");
            }
        } catch {
            toast.error("Error declining meeting");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-5xl py-12 text-center text-sm text-muted-foreground">
                Loading appointments...
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Appointments</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Your meetings with Optrizo. We email you a reminder before each one.
                </p>
            </div>

            {/* Top Banner: New invitation · needs your reply (Mockup 076-4c) */}
            {pendingInvite && (
                <div className="p-5 rounded-2xl border-2 border-primary bg-card shadow-sm space-y-4">
                    <div className="text-base font-semibold text-foreground flex items-center gap-2">
                        <CalendarCheck className="h-5 w-5 text-brand-deep" />
                        New invitation · needs your reply
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-border pt-3">
                        <div className="space-y-1 text-sm">
                            <div className="font-semibold text-foreground">{meetingTitle(pendingInvite.type)}</div>
                            {meetingSubject(pendingInvite) && <div className="text-foreground">{meetingSubject(pendingInvite)}</div>}
                            <div className="text-muted-foreground">
                                {formatWithZone(pendingInvite.startsAt, tz)} · {meetingFormatLabel(pendingInvite.format)} ·{" "}
                                {pendingInvite.type === "discovery" ? "with your sales consultant" : "with your project manager"}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                size="sm"
                                onClick={() => handleConfirm(pendingInvite.id)}
                                disabled={isSubmitting}
                                className="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Confirm
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    setSuggestModal({
                                        isOpen: true,
                                        meetingId: pendingInvite.id,
                                        date: "",
                                        time: "10:00",
                                    })
                                }
                                disabled={isSubmitting}
                                className="h-9 px-3 text-xs font-semibold"
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Suggest another time
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    setDeclineModal({
                                        isOpen: true,
                                        meetingId: pendingInvite.id,
                                        reason: "",
                                    })
                                }
                                disabled={isSubmitting}
                                className="h-9 px-3 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Decline
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upcoming & Past Sections (Mockup 076-4c) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upcoming */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                    <h2 className="text-base font-semibold text-foreground">Upcoming</h2>
                    {upcomingList.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No upcoming meetings.</p>
                    ) : (
                        <div className="divide-y divide-border">
                            {upcomingList.map((m) => (
                                <div key={m.id} className="py-3 flex items-start justify-between gap-3 text-sm">
                                    <div className="min-w-0 space-y-0.5">
                                        <div className="font-medium text-foreground">{meetingTitle(m.type)}</div>
                                        {meetingSubject(m) && <div className="text-foreground">{meetingSubject(m)}</div>}
                                        <div className="text-muted-foreground">
                                            {formatWithZone(m.startsAt, tz)} · {meetingFormatLabel(m.format)}
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`shrink-0 text-xs font-semibold ${
 m.status === "confirmed"
                                                ? "bg-brand-soft text-brand-deep border-brand-deep/30"
                                                : "bg-stage-discovery/10 text-stage-discovery border-stage-discovery/30"
                                        }`}
                                    >
                                        {m.status === "confirmed" ? "Confirmed" : "Reschedule requested"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Past */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                    <h2 className="text-base font-semibold text-foreground">Past</h2>
                    {pastList.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No past meetings.</p>
                    ) : (
                        <div className="divide-y divide-border">
                            {pastList.map((m) => (
                                <div key={m.id} className="py-3 flex items-start justify-between gap-3 text-sm">
                                    <div className="min-w-0 space-y-0.5">
                                        <div className="font-medium text-foreground">{meetingTitle(m.type)}</div>
                                        {meetingSubject(m) && <div className="text-foreground">{meetingSubject(m)}</div>}
                                        <div className="text-muted-foreground">
                                            {formatWithZone(m.startsAt, tz)} · {meetingFormatLabel(m.format)}
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`shrink-0 text-xs font-semibold ${
 m.status === "done"
                                                ? "bg-muted text-muted-foreground border-border"
                                                : "bg-destructive/10 text-destructive border-destructive/30"
                                        }`}
                                    >
                                        {m.status === "done" ? "Done" : "Cancelled"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Suggest Another Time Modal */}
            <Dialog open={suggestModal.isOpen} onOpenChange={(open) => !open && setSuggestModal((prev) => ({ ...prev, isOpen: false }))}>
                <DialogContent className="max-w-md bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Suggest another time</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Preferred Date</Label>
                            <DatePicker value={suggestModal.date} onChange={(date) => setSuggestModal((prev) => ({ ...prev, date }))} min={todayYmd(undefined, tz)} className="bg-card border-border" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Preferred Time</Label>
                            <TimePicker value={suggestModal.time} onChange={(time) => setSuggestModal((prev) => ({ ...prev, time }))} min={suggestModal.date === todayYmd(undefined, tz) ? nowHm(undefined, tz) : undefined} className="bg-card border-border" />
                        </div>
                        <p className="text-xs text-muted-foreground">Times are in your timezone ({tz.replace("_", " ")}, {tzLabel(new Date(), tz)}).</p>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSuggestModal((prev) => ({ ...prev, isOpen: false }))}
                            className="text-xs h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSuggestSubmit}
                            disabled={isSubmitting}
                            className="text-xs h-9 bg-primary text-primary-foreground font-semibold"
                        >
                            {isSubmitting ? "Sending..." : "Submit preference"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Decline Meeting Modal */}
            <Dialog open={declineModal.isOpen} onOpenChange={(open) => !open && setDeclineModal((prev) => ({ ...prev, isOpen: false }))}>
                <DialogContent className="max-w-md bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Decline Meeting Invitation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Reason for declining (optional)</Label>
                            <Textarea
                                rows={3}
                                value={declineModal.reason}
                                onChange={(e) => setDeclineModal((prev) => ({ ...prev, reason: e.target.value }))}
                                placeholder="Let us know why you are unable to meet or if you'd like to follow up later."
                                className="text-xs bg-muted/40 border-border"
                            />
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeclineModal((prev) => ({ ...prev, isOpen: false }))}
                            className="text-xs h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleDeclineSubmit}
                            disabled={isSubmitting}
                            className="text-xs h-9 bg-destructive text-white font-semibold hover:bg-destructive/90"
                        >
                            {isSubmitting ? "Declining..." : "Decline meeting"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
