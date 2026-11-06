"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scheduleDiscoveryMeeting, getActiveLeadsForMeeting, getManagersForMeeting } from "@/features/meetings/actions";
import { toast } from "sonner";
import { Calendar, Users, FileText } from "lucide-react";

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
    const [date, setDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
    });
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

        const startsAt = new Date(`${date}T${time}:00`);
        if (isNaN(startsAt.getTime())) {
            toast.error("Invalid meeting date and time");
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
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Schedule appointment
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Lead Selection if not preselected */}
                    {!initialLeadId && availableLeads.length > 0 ? (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Select Opportunity</Label>
                            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                                <SelectTrigger className="text-xs h-9 bg-card border-border">
                                    <SelectValue placeholder="Choose a lead..." />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {availableLeads.map((l) => (
                                        <SelectItem key={l.id} value={l.id} className="text-xs">
                                            {l.businessName || l.contactName || "Unnamed Opportunity"} ({l.contactName || "Contact"})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Business name</Label>
                                <Input
                                    value={displayBusinessName}
                                    disabled
                                    className="bg-muted text-xs h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Client name</Label>
                                <Input
                                    value={displayClientName}
                                    disabled
                                    className="bg-muted text-xs h-9"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Meeting type</Label>
                            <Input
                                value="Discovery"
                                disabled
                                className="bg-muted text-xs h-9 font-semibold"
                            />
                            <p className="text-[11px] text-muted-foreground">Pricing meetings are booked by the PM.</p>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Format</Label>
                            <Select value={format} onValueChange={(val: "video" | "phone" | "in_person" | "on_site") => setFormat(val)}>
                                <SelectTrigger className="text-xs h-9 bg-card border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="video" className="text-xs">Video call</SelectItem>
                                    <SelectItem value="phone" className="text-xs">Phone call</SelectItem>
                                    <SelectItem value="in_person" className="text-xs">In person</SelectItem>
                                    <SelectItem value="on_site" className="text-xs">On site</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Date</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className="text-xs h-9 bg-card border-border"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Time</Label>
                            <Input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                required
                                className="text-xs h-9 bg-card border-border"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> Attendees
                        </Label>
                        <Input value="Sales (required)" disabled className="bg-muted text-xs h-9" />
                        <Select value={pmId} onValueChange={setPmId}>
                            <SelectTrigger className="text-xs h-9 bg-card border-border" aria-label="Project Manager (optional)">
                                <SelectValue placeholder="Project Manager (optional)" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="none" className="text-xs">No Project Manager</SelectItem>
                                {managers.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">
                                        {m.name} (Project Manager, optional)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                            The Project Manager is optional. If you pick one, they are notified and can hear the requirements first-hand.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Agenda or notes
                        </Label>
                        <Textarea
                            rows={3}
                            value={agenda}
                            onChange={(e) => setAgenda(e.target.value)}
                            placeholder="Learn their goals, the features they need and their timeline."
                            className="text-xs bg-card border-border"
                        />
                    </div>

                    <DialogFooter className="pt-2 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="text-xs h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="text-xs h-9 bg-primary text-black font-semibold hover:bg-primary/90"
                        >
                            {isSubmitting ? "Sending invite..." : "Send invite to client"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
