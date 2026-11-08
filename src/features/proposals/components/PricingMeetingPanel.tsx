"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { createProposalRevision } from "@/features/proposals/actions";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/datetime";

interface PricingMeetingInfo {
    id: string;
    status: "awaiting_client" | "confirmed" | "reschedule_requested" | "done" | "cancelled";
    startsAt: Date | string;
    format: string;
    agenda?: string | null;
    notes?: string | null;
}

interface PricingMeetingPanelProps {
    proposalId?: string;
    leadId: string;
    proposalStatus: string;
    pricingMeeting?: PricingMeetingInfo | null;
    onBookMeeting?: () => void;
}

export function PricingMeetingPanel({
    leadId,
    proposalStatus,
    pricingMeeting,
    onBookMeeting,
}: PricingMeetingPanelProps) {
    const router = useRouter();
    const [isCreatingRevision, setIsCreatingRevision] = useState(false);

    const handleOpenProposal = async () => {
        setIsCreatingRevision(true);
        try {
            const res = await createProposalRevision(leadId);
            if (res.proposalId) {
                router.push(`/dashboard/proposals/builder/${res.proposalId}`);
            } else {
                toast.error(res.message || "Failed to open proposal revision");
            }
        } catch {
            toast.error("Error creating proposal revision");
        } finally {
            setIsCreatingRevision(false);
        }
    };

    // Meeting is completed -> Manager needs to open revision and add price
    if (pricingMeeting?.status === "done") {
        return (
            <Card className="border-brand-deep/30 bg-brand-soft shadow-sm">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-brand-soft text-brand-deep border-brand-deep/30 text-xs font-semibold">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pricing Meeting Completed
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {formatDate(pricingMeeting.startsAt)}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            Scope and pricing discussed with client. Ready to add final pricing and schedule.
                        </p>
                        {pricingMeeting.notes && (
                            <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border/50 max-w-xl">
                                <strong>Outcome notes:</strong> {pricingMeeting.notes}
                            </p>
                        )}
                    </div>
                    <Button
                        size="sm"
                        onClick={handleOpenProposal}
                        disabled={isCreatingRevision}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs whitespace-nowrap gap-1.5 shadow-sm"
                    >
                        {isCreatingRevision ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowRight className="h-4 w-4" />
                        )}
                        Open proposal and add price
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Meeting is requested by client, but not scheduled yet
    if (proposalStatus === "pricing_meeting_requested" && (!pricingMeeting || pricingMeeting.status === "cancelled")) {
        return (
            <Card className="border-stage-negotiation/30 bg-stage-negotiation/5 shadow-sm">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-stage-negotiation/10 text-stage-negotiation border-stage-negotiation/30 text-xs font-semibold">
                                <AlertCircle className="h-3.5 w-3.5 mr-1" /> Pricing Meeting Requested
                            </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            Client requested a budget and pricing meeting to finalize scope and investment.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Schedule a call with the client to align on the package and milestones.
                        </p>
                    </div>
                    {onBookMeeting && (
                        <Button
                            size="sm"
                            onClick={onBookMeeting}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs whitespace-nowrap gap-1.5 shadow-sm"
                        >
                            <Calendar className="h-4 w-4" />
                            Book pricing meeting
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Meeting is active (awaiting_client, confirmed, or reschedule_requested)
    if (pricingMeeting && ["awaiting_client", "confirmed", "reschedule_requested"].includes(pricingMeeting.status)) {
        const formattedDate = formatDateTime(pricingMeeting.startsAt);

        return (
            <Card className="border-border bg-card shadow-sm">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className={`text-xs font-semibold ${
 pricingMeeting.status === "confirmed"
                                        ? "bg-brand-soft text-brand-deep border-brand-deep/30"
                                        : pricingMeeting.status === "reschedule_requested"
                                        ? "bg-stage-discovery/10 text-stage-discovery border-stage-discovery/30"
                                        : "bg-stage-negotiation/10 text-stage-negotiation border-stage-negotiation/30"
                                }`}
                            >
                                <Clock className="h-3.5 w-3.5 mr-1" />
                                {pricingMeeting.status === "confirmed"
                                    ? "Meeting Confirmed"
                                    : pricingMeeting.status === "reschedule_requested"
                                    ? "Reschedule Requested"
                                    : "Awaiting Client Confirmation"}
                            </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            Budget & Pricing Meeting · {formattedDate} ({pricingMeeting.format === "video" ? "Video call" : pricingMeeting.format})
                        </p>
                        {pricingMeeting.agenda && (
                            <p className="text-xs text-muted-foreground">{pricingMeeting.agenda}</p>
                        )}
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push("/dashboard/meetings")}
                        className="text-xs font-semibold"
                    >
                        View in Meetings
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return null;
}
