"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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

export default function ClientAppointmentsPage() {
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

        const suggestedAt = new Date(`${suggestModal.date}T${suggestModal.time}:00`);
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
            <div className="space-y-6 max-w-5xl mx-auto w-full p-4 md:p-8 text-center text-xs text-muted-foreground">
                Loading appointments...
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto w-full p-4 md:p-8">
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
                    <div className="text-base font-bold text-foreground flex items-center gap-2">
                        <CalendarCheck className="h-5 w-5 text-primary" />
                        New invitation · needs your reply
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-border pt-3">
                        <div className="space-y-1 text-sm">
                            <div className="font-bold text-foreground">
                                {pendingInvite.type === "discovery"
                                    ? "Discovery meeting"
                                    : pendingInvite.type === "budget_pricing"
                                    ? "Budget & Pricing meeting"
                                    : `${pendingInvite.type.replace("_", " ")} meeting`}
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                <span>
                                    {new Intl.DateTimeFormat("en-US", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                    }).format(new Date(pendingInvite.startsAt))}
                                </span>
                                <span>•</span>
                                <span className="capitalize">
                                    {pendingInvite.format === "video" ? "Video call" : pendingInvite.format}
                                </span>
                                <span>•</span>
                                <span>
                                    {pendingInvite.type === "budget_pricing"
                                        ? "with your Project Manager"
                                        : "with your Sales Consultant"}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                size="sm"
                                onClick={() => handleConfirm(pendingInvite.id)}
                                disabled={isSubmitting}
                                className="h-9 px-4 text-xs font-semibold bg-primary text-black hover:bg-primary/90"
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
                                className="h-9 px-3 text-xs font-semibold text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
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
                    <h2 className="text-base font-bold text-foreground">Upcoming</h2>
                    {upcomingList.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No upcoming meetings.</p>
                    ) : (
                        <div className="divide-y divide-border">
                            {upcomingList.map((m) => (
                                <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-xs text-foreground capitalize">
                                            {m.type === "discovery" ? "Discovery meeting" : m.type.replace("_", " ")}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Intl.DateTimeFormat("en-US", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            }).format(new Date(m.startsAt))}{" "}
                                            · {m.format === "video" ? "Video call" : m.format}
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`text-xs font-semibold ${
                                            m.status === "confirmed"
                                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                                : "bg-cyan-500/10 text-cyan-500 border-cyan-500/30"
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
                    <h2 className="text-base font-bold text-foreground">Past</h2>
                    {pastList.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No past meetings.</p>
                    ) : (
                        <div className="divide-y divide-border">
                            {pastList.map((m) => (
                                <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-xs text-foreground capitalize">
                                            {m.type === "discovery" ? "Discovery meeting" : m.type.replace("_", " ")}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Intl.DateTimeFormat("en-US", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            }).format(new Date(m.startsAt))}{" "}
                                            · {m.format === "video" ? "Video call" : m.format}
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`text-xs font-semibold ${
                                            m.status === "done"
                                                ? "bg-muted text-muted-foreground border-border"
                                                : "bg-rose-500/10 text-rose-500 border-rose-500/30"
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
                        <DialogTitle className="text-lg font-bold">Suggest another time</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Preferred Date</Label>
                            <Input
                                type="date"
                                min={new Date().toLocaleDateString("en-CA")}
                                value={suggestModal.date}
                                onChange={(e) => setSuggestModal((prev) => ({ ...prev, date: e.target.value }))}
                                className="text-xs h-9 bg-card border-border"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Preferred Time</Label>
                            <Input
                                type="time"
                                value={suggestModal.time}
                                onChange={(e) => setSuggestModal((prev) => ({ ...prev, time: e.target.value }))}
                                className="text-xs h-9 bg-card border-border"
                            />
                        </div>
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
                            className="text-xs h-9 bg-primary text-black font-semibold"
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
                        <DialogTitle className="text-lg font-bold">Decline Meeting Invitation</DialogTitle>
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
                            className="text-xs h-9 bg-rose-600 text-white font-semibold hover:bg-rose-700"
                        >
                            {isSubmitting ? "Declining..." : "Decline meeting"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
