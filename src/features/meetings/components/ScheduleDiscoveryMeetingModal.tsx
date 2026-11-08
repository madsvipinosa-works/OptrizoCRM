"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scheduleDiscoveryMeeting, getActiveLeadsForMeeting, getManagersForMeeting } from "@/features/meetings/actions";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { isPastManila, manilaToDate, nowHm, todayYmd } from "@/lib/datetime";

const labelClass = "text-sm font-medium text-foreground";

interface ScheduleDiscoveryMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId?: string;
    businessName?: string | null;
    clientName?: string | null;
    onSuccess?: () => void;
}

export function ScheduleDiscoveryMeetingModal({
    isOpen,
    onClose,
    leadId: initialLeadId,
    businessName: initialBusinessName,
    clientName: initialClientName,
    onSuccess,
}: ScheduleDiscoveryMeetingModalProps) {
    const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId || "");
    const [availableLeads, setAvailableLeads] = useState<Array<{ id: string; businessName: string | null; contactName: string | null }>>([]);
    const [format, setFormat] = useState<"video" | "phone" | "in_person" | "on_site">("video");
    const [date, setDate] = useState(() => todayYmd(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    const [time, setTime] = useState("10:00");
    // Optional PM attendee. "none" means no PM. Defaults to the lead's assigned PM when it has one.
    const [pmId, setPmId] = useState("none");
    const [managers, setManagers] = useState<Array<{ id: string; name: string }>>([]);
    const [agenda, setAgenda] = useState("Learn their goals, the features they need and their timeline.");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialLeadId) {
            setSelectedLeadId(initialLeadId);
        } else if (isOpen) {
            getActiveLeadsForMeeting().then((leads) => {
                setAvailableLeads(leads);
                if (leads.length > 0 && !selectedLeadId) {
                    setSelectedLeadId(leads[0].id);
                }
            });
        }
    }, [initialLeadId, isOpen, selectedLeadId]);

    // Load the PM choices, and preselect the lead's assigned PM, whenever the chosen lead changes.
    const pmLeadId = initialLeadId || selectedLeadId;
    useEffect(() => {
        if (!isOpen || !pmLeadId) return;
        let cancelled = false;
        getManagersForMeeting(pmLeadId).then((result) => {
            if (cancelled) return;
            setManagers(result.managers);
            setPmId(result.defaultPmId ?? "none");
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, pmLeadId]);

    const activeLead = availableLeads.find((l) => l.id === selectedLeadId);
    const displayBusinessName = initialBusinessName || activeLead?.businessName || "Opportunity";
    const displayClientName = initialClientName || activeLead?.contactName || "Client";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetLeadId = initialLeadId || selectedLeadId;
        if (!targetLeadId) {
            toast.error("Please select a lead to schedule the meeting with");
            return;
        }

        if (!date || !time) {
            toast.error("Please pick a date and time for the meeting");
            return;
        }

        const startsAt = manilaToDate(date, time);
        if (isNaN(startsAt.getTime())) {
            toast.error("Invalid meeting date and time");
            return;
        }
        if (isPastManila(date, time)) {
            toast.error("Pick a date and time that has not passed yet");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await scheduleDiscoveryMeeting({
                leadId: targetLeadId,
                format,
                startsAt,
                pmId: pmId === "none" ? null : pmId,
                agenda,
            });

            if (res.success) {
                toast.success("Discovery meeting scheduled! Invite sent to client.");
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.message || "Failed to schedule meeting");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error scheduling discovery meeting");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg bg-card border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold tracking-tight">Schedule appointment</DialogTitle>
                    {(initialLeadId || availableLeads.length === 0) && (
                        <DialogDescription className="text-sm text-muted-foreground">
                            Discovery meeting with <span className="font-medium text-foreground">{displayBusinessName}</span> ({displayClientName}). Pricing meetings are booked by the PM.
                        </DialogDescription>
                    )}
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    {!initialLeadId && availableLeads.length > 0 && (
                        <div className="space-y-1.5">
                            <Label htmlFor="meeting-lead" className={labelClass}>Lead</Label>
                            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                                <SelectTrigger id="meeting-lead" className="h-9 w-full text-sm">
                                    <SelectValue placeholder="Choose a lead" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableLeads.map((l) => (
                                        <SelectItem key={l.id} value={l.id} className="text-sm">
                                            {l.businessName || l.contactName || "Unnamed lead"}
                                            {l.contactName && l.businessName ? ` (${l.contactName})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">Discovery meeting. Pricing meetings are booked by the PM.</p>
                        </div>
                    )}

                    {/* Mockup step 4: Date | Time, Format | Attendees */}
                    <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className={labelClass}>Date</Label>
                            <DatePicker value={date} onChange={setDate} min={todayYmd()} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelClass}>Time</Label>
                            <TimePicker value={time} onChange={setTime} min={date === todayYmd() ? nowHm() : undefined} aria-label="Time" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="meeting-format" className={labelClass}>Format</Label>
                            <Select value={format} onValueChange={(val: "video" | "phone" | "in_person" | "on_site") => setFormat(val)}>
                                <SelectTrigger id="meeting-format" className="h-9 w-full text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="video" className="text-sm">Video call</SelectItem>
                                    <SelectItem value="phone" className="text-sm">Phone call</SelectItem>
                                    <SelectItem value="in_person" className="text-sm">In person</SelectItem>
                                    <SelectItem value="on_site" className="text-sm">On site</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="meeting-pm" className={labelClass}>Project Manager</Label>
                            <Select value={pmId} onValueChange={setPmId}>
                                <SelectTrigger id="meeting-pm" className="h-9 w-full text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-sm">None</SelectItem>
                                    {managers.map((m) => (
                                        <SelectItem key={m.id} value={m.id} className="text-sm">{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-sm text-muted-foreground sm:col-span-2">
                            You attend as Sales. A Project Manager is optional; if you add one, they are notified and hear the requirements first-hand.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="meeting-agenda" className={labelClass}>Agenda or notes</Label>
                        <Textarea
                            id="meeting-agenda"
                            rows={3}
                            value={agenda}
                            onChange={(e) => setAgenda(e.target.value)}
                            placeholder="Learn their goals, the features they need and their timeline."
                            className="text-sm"
                        />
                    </div>

                    <DialogFooter className="pt-2 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="text-sm h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-9 font-semibold active:scale-[0.97]"
                        >
                            {isSubmitting ? "Sending invite..." : "Send invite to client"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
