"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Clock,
    Video,
    Phone,
    MapPin,
    Users,
    Link as LinkIcon,
    CheckCircle2,
    RotateCcw,
    XCircle,
    Save,
} from "lucide-react";
import {
    markMeetingDone,
    rescheduleMeeting,
    cancelMeeting,
    updateMeetingNotes,
    type MeetingItem,
} from "@/features/meetings/actions";

interface MeetingDetailDrawerProps {
    meeting: MeetingItem | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

export function MeetingDetailDrawer({
    meeting,
    isOpen,
    onClose,
    onUpdate,
}: MeetingDetailDrawerProps) {
    const [notes, setNotes] = useState(meeting?.notes || "");
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reschedule dialog state
    const [showReschedule, setShowReschedule] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState("");
    const [rescheduleTime, setRescheduleTime] = useState("10:00");

    if (!meeting) return null;

    const formattedDate = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(meeting.startsAt));

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            const res = await updateMeetingNotes({
                meetingId: meeting.id,
                notes,
            });
            if (res.success) {
                toast.success("Meeting notes saved");
                onUpdate?.();
            } else {
                toast.error(res.message || "Failed to save notes");
            }
        } catch {
            toast.error("Failed to update notes");
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleMarkDone = async () => {
        setIsSubmitting(true);
        try {
            const res = await markMeetingDone({
                meetingId: meeting.id,
                notes,
            });
            if (res.success) {
                toast.success(meeting.type === "budget_pricing" ? "Budget & pricing meeting marked as done" : "Meeting marked as done (Discovery form unlocked)");
                onUpdate?.();
                onClose();
            } else {
                toast.error(res.message || "Failed to mark meeting done");
            }
        } catch {
            toast.error("Error completing meeting");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRescheduleSubmit = async () => {
        if (!rescheduleDate || !rescheduleTime) {
            toast.error("Please pick a new date and time");
            return;
        }

        const newStartsAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
        if (isNaN(newStartsAt.getTime())) {
            toast.error("Invalid date or time");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await rescheduleMeeting({
                meetingId: meeting.id,
                startsAt: newStartsAt,
            });
            if (res.success) {
                toast.success("Meeting rescheduled! New invite sent to client.");
                setShowReschedule(false);
                onUpdate?.();
                onClose();
            } else {
                toast.error(res.message || "Failed to reschedule meeting");
            }
        } catch {
            toast.error("Error rescheduling meeting");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelMeeting = async () => {
        if (!confirm("Are you sure you want to cancel this meeting?")) return;
        setIsSubmitting(true);
        try {
            const res = await cancelMeeting({
                meetingId: meeting.id,
                reason: "Cancelled by sales organizer",
            });
            if (res.success) {
                toast.success("Meeting cancelled");
                onUpdate?.();
                onClose();
            } else {
                toast.error(res.message || "Failed to cancel meeting");
            }
        } catch {
            toast.error("Error cancelling meeting");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "confirmed":
                return (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold">
                        Confirmed
                    </Badge>
                );
            case "awaiting_client":
                return (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30 text-xs font-semibold">
                        Awaiting client
                    </Badge>
                );
            case "reschedule_requested":
                return (
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/30 text-xs font-semibold">
                        Reschedule requested
                    </Badge>
                );
            case "done":
                return (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-semibold">
                        Done
                    </Badge>
                );
            case "cancelled":
                return (
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30 text-xs font-semibold">
                        Cancelled
                    </Badge>
                );
            default:
                return null;
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-md md:max-w-lg bg-card border-l border-border text-foreground flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                    <SheetHeader className="text-left space-y-1 border-b border-border pb-4">
                        <div className="text-xs text-muted-foreground font-medium">
                            {meeting.lead?.businessName || "Opportunity"} · {meeting.lead?.contactName || "Client"}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <SheetTitle className="text-xl font-bold capitalize">
                                {meeting.type === "discovery"
                                    ? "Discovery meeting"
                                    : meeting.type === "budget_pricing"
                                    ? "Budget & Pricing meeting"
                                    : `${meeting.type.replace("_", " ")} meeting`}
                            </SheetTitle>
                            {getStatusBadge(meeting.status)}
                        </div>
                    </SheetHeader>

                    {/* Reschedule banner if requested */}
                    {meeting.status === "reschedule_requested" && (
                        <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-600 dark:text-cyan-300">
                            <strong>Client suggested another time:</strong>{" "}
                            {meeting.clientSuggestedAt
                                ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(meeting.clientSuggestedAt))
                                : "A different time requested"}
                        </div>
                    )}

                    {/* Cancelled banner if decline reason exists */}
                    {meeting.status === "cancelled" && meeting.declineReason && (
                        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
                            <strong>Decline reason:</strong> {meeting.declineReason}
                        </div>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                            <span className="text-muted-foreground flex items-center gap-1 font-medium">
                                <Clock className="h-3.5 w-3.5" /> Date and time
                            </span>
                            <p className="font-semibold text-sm">{formattedDate}</p>
                        </div>

                        <div className="space-y-1">
                            <span className="text-muted-foreground flex items-center gap-1 font-medium">
                                {meeting.format === "video" ? (
                                    <Video className="h-3.5 w-3.5" />
                                ) : meeting.format === "phone" ? (
                                    <Phone className="h-3.5 w-3.5" />
                                ) : (
                                    <MapPin className="h-3.5 w-3.5" />
                                )}
                                Format
                            </span>
                            <p className="font-semibold text-sm capitalize">
                                {meeting.format === "video"
                                    ? "Video call"
                                    : meeting.format === "phone"
                                    ? "Phone call"
                                    : meeting.format === "in_person"
                                    ? "In person"
                                    : "On site"}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <span className="text-muted-foreground flex items-center gap-1 font-medium">
                                <Users className="h-3.5 w-3.5" /> Attendees
                            </span>
                            <p className="font-medium text-foreground">
                                {meeting.attendees && meeting.attendees.length > 0
                                    ? meeting.attendees.join(", ")
                                    : "Sales, Client"}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <span className="text-muted-foreground flex items-center gap-1 font-medium">
                                <LinkIcon className="h-3.5 w-3.5" /> Linked to
                            </span>
                            <p className="font-medium text-foreground">
                                Lead: {meeting.lead?.businessName || meeting.lead?.contactName || "Linked deal"}
                            </p>
                        </div>
                    </div>

                    {/* Meeting Notes */}
                    <div className="space-y-2 border-t border-border pt-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-muted-foreground">Meeting notes</Label>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleSaveNotes}
                                disabled={isSavingNotes}
                                className="h-7 text-xs gap-1 text-primary hover:text-primary/80"
                            >
                                <Save className="h-3 w-3" />
                                {isSavingNotes ? "Saving..." : "Save notes"}
                            </Button>
                        </div>
                        <Textarea
                            rows={4}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Client confirmed scope direction. Needs driver app and dispatcher dashboard."
                            className="text-xs bg-muted/40 border-border"
                        />
                    </div>

                    {/* Inline Reschedule Form (when Reschedule is toggled) */}
                    {showReschedule && (
                        <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-3">
                            <div className="text-xs font-bold text-foreground">Pick new date & time</div>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    type="date"
                                    value={rescheduleDate}
                                    onChange={(e) => setRescheduleDate(e.target.value)}
                                    className="text-xs h-8 bg-card border-border"
                                />
                                <Input
                                    type="time"
                                    value={rescheduleTime}
                                    onChange={(e) => setRescheduleTime(e.target.value)}
                                    className="text-xs h-8 bg-card border-border"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowReschedule(false)}
                                    className="text-xs h-8"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleRescheduleSubmit}
                                    disabled={isSubmitting}
                                    className="text-xs h-8 bg-primary text-black font-semibold"
                                >
                                    {isSubmitting ? "Sending..." : "Confirm & Send"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons Footer */}
                <div className="border-t border-border pt-4 mt-6 flex gap-2">
                    {meeting.status !== "done" && meeting.status !== "cancelled" && (
                        <Button
                            onClick={handleMarkDone}
                            disabled={isSubmitting}
                            className="flex-1 h-10 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Mark as done
                        </Button>
                    )}

                    {meeting.status !== "done" && meeting.status !== "cancelled" && (
                        <Button
                            variant="outline"
                            onClick={() => setShowReschedule((prev) => !prev)}
                            disabled={isSubmitting}
                            className="flex-1 h-10 text-xs font-semibold gap-1.5"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reschedule
                        </Button>
                    )}

                    {meeting.status !== "cancelled" && (
                        <Button
                            variant="outline"
                            onClick={handleCancelMeeting}
                            disabled={isSubmitting}
                            className="h-10 text-xs font-semibold text-rose-500 border-rose-500/30 hover:bg-rose-500/10 gap-1.5"
                        >
                            <XCircle className="h-4 w-4" />
                            Cancel
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
