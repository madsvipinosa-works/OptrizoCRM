"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scheduleBudgetPricingMeeting } from "@/features/meetings/actions";
import { toast } from "sonner";
import { Calendar, Users, FileText, Loader2, Video, Phone, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

interface BookPricingMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    proposalId: string;
    proposalCode?: string | null;
    clientName?: string | null;
    businessName?: string | null;
    onSuccess?: (meetingId: string) => void;
}

export function BookPricingMeetingModal({
    isOpen,
    onClose,
    proposalId,
    proposalCode,
    clientName,
    businessName,
    onSuccess,
}: BookPricingMeetingModalProps) {
    const router = useRouter();
    const [format, setFormat] = useState<"video" | "phone" | "in_person" | "on_site">("video");
    const [date, setDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
    });
    const [time, setTime] = useState("10:00");
    const [agenda, setAgenda] = useState("Review proposed scope, deliverables, timeline, and discuss budget and pricing options.");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !time) {
            toast.error("Please pick a date and time");
            return;
        }

        const startsAt = new Date(`${date}T${time}:00`);
        if (isNaN(startsAt.getTime())) {
            toast.error("Invalid date or time");
            return;
        }
        if (startsAt < new Date()) {
            toast.error("Cannot schedule a meeting in the past");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await scheduleBudgetPricingMeeting({
                proposalId,
                format,
                startsAt,
                agenda,
            });

            if (res.success) {
                toast.success("Budget & pricing meeting scheduled! Client has been notified.");
                onSuccess?.(res.meetingId!);
                onClose();
                router.refresh();
            } else {
                toast.error(res.message || "Failed to schedule meeting");
            }
        } catch {
            toast.error("Failed to schedule meeting");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full glass-card border-border text-foreground">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Schedule Budget & Pricing Meeting
                        </DialogTitle>
                        <div className="text-xs text-muted-foreground">
                            {businessName || "Opportunity"} · {clientName || "Client"}
                            {proposalCode ? ` · SOW #${proposalCode}` : ""}
                        </div>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div className="space-y-1">
                            <Label className="text-xs">Meeting Format</Label>
                            <Select value={format} onValueChange={(val: "video" | "phone" | "in_person" | "on_site") => setFormat(val)}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="video" className="text-xs flex items-center gap-2">
                                        <Video className="h-3.5 w-3.5 inline mr-1" /> Video call (Google Meet)
                                    </SelectItem>
                                    <SelectItem value="phone" className="text-xs flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5 inline mr-1" /> Phone call
                                    </SelectItem>
                                    <SelectItem value="in_person" className="text-xs flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 inline mr-1" /> In person (Office)
                                    </SelectItem>
                                    <SelectItem value="on_site" className="text-xs flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 inline mr-1" /> On site (Client premises)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Date</Label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Time</Label>
                                <Input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                Attendees (fixed)
                            </Label>
                            <Input
                                value="Project Manager (required), Client (required)"
                                disabled
                                className="h-9 text-xs bg-muted/50 cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                Agenda
                            </Label>
                            <Textarea
                                value={agenda}
                                onChange={(e) => setAgenda(e.target.value)}
                                rows={3}
                                className="text-xs leading-relaxed"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={isSubmitting} className="font-semibold text-xs">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                    Sending Invite...
                                </>
                            ) : (
                                "Send Invite to Client"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
