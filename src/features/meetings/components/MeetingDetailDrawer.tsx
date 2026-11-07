"use client";

/**
 * Meeting detail drawer (mockup 4b, 04-sales/026; PM steps 13–15).
 * Layout: business · client line, meeting title, status with a plain
 * explanation, the four facts, meeting notes, history, and the three
 * actions pinned at the bottom.
 *
 * Who can change what (workflow-spec, "Meetings"): Sales edits `discovery`;
 * the PM edits `budget_pricing`, `project_review` and `uat`. Each role can
 * view the other's meetings read-only. The server actions enforce this too.
 */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2, Lock, RotateCcw, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { markDoneBlock } from "@/features/meetings/rules";
import {
    cancelMeeting,
    markMeetingDone,
    rescheduleMeeting,
    updateMeetingNotes,
    type MeetingItem,
} from "@/features/meetings/actions";

interface MeetingDetailDrawerProps {
    meeting: MeetingItem | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
    /** Current user's role: "sales" or "manager" (PM). */
    role?: string;
}

const TYPE_TITLE: Record<MeetingItem["type"], string> = {
    discovery: "Discovery meeting",
    budget_pricing: "Budget and pricing meeting",
    project_review: "Project review meeting",
    uat: "UAT meeting",
};

const FORMAT_LABEL: Record<MeetingItem["format"], string> = {
    video: "Video call",
    phone: "Phone call",
    in_person: "In person",
    on_site: "On site",
};

// Shared with the meetings list so a status looks the same everywhere (same tones as the Proposals list).
export const MEETING_STATUS: Record<MeetingItem["status"], { label: string; chip: string; dot: string; note: string }> = {
    awaiting_client: {
        label: "Awaiting client",
        chip: "bg-stage-negotiation/15 text-foreground",
        dot: "bg-stage-negotiation",
        note: "Invite sent. Waiting for the client to accept.",
    },
    confirmed: {
        label: "Confirmed",
        chip: "bg-brand-soft text-brand-deep",
        dot: "bg-brand-deep",
        note: "The client accepted the invite.",
    },
    reschedule_requested: {
        label: "New time requested",
        chip: "bg-stage-discovery/15 text-foreground",
        dot: "bg-stage-discovery",
        note: "The client asked for another time.",
    },
    done: {
        label: "Done",
        chip: "bg-muted text-muted-foreground",
        dot: "bg-muted-foreground",
        note: "This meeting is marked as done.",
    },
    cancelled: {
        label: "Cancelled",
        chip: "bg-destructive/10 text-destructive",
        dot: "bg-destructive",
        note: "This meeting was cancelled.",
    },
};

export function MeetingStatusChip({ status }: { status: MeetingItem["status"] }) {
    const s = MEETING_STATUS[status];
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.chip}`}>
            <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
            {s.label}
        </span>
    );
}

const SALES_TYPES: MeetingItem["type"][] = ["discovery"];

const dateTime = (value: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const shortDate = (value: Date | string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));

export function MeetingDetailDrawer({ meeting, isOpen, onClose, onUpdate, role = "sales" }: MeetingDetailDrawerProps) {
    // Keep the last meeting on screen while the sheet slides out.
    const [shown, setShown] = useState<MeetingItem | null>(meeting);
    if (meeting && meeting !== shown) setShown(meeting);
    const current = meeting ?? shown;

    return (
        <Sheet open={isOpen && !!meeting} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                // Do not jump into the notes field on open (it would pop the phone keyboard).
                // Focus the panel itself instead, so keyboard users start inside it.
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
                }}
                className="flex w-full flex-col gap-0 border-l border-border bg-card p-0 text-foreground sm:max-w-[520px]"
            >
                {current && (
                    // Keyed by id: opening another meeting starts with its own notes and forms.
                    <MeetingDetail key={current.id} meeting={current} role={role} onClose={onClose} onUpdate={onUpdate} />
                )}
            </SheetContent>
        </Sheet>
    );
}

function MeetingDetail({
    meeting,
    role,
    onClose,
    onUpdate,
}: {
    meeting: MeetingItem;
    role: string;
    onClose: () => void;
    onUpdate?: () => void;
}) {
    const [notes, setNotes] = useState(meeting.notes || "");
    const [panel, setPanel] = useState<"none" | "reschedule" | "cancel">("none");
    const [rescheduleDate, setRescheduleDate] = useState("");
    const [rescheduleTime, setRescheduleTime] = useState("10:00");
    const [cancelReason, setCancelReason] = useState("");
    const [busy, setBusy] = useState<"none" | "notes" | "done" | "reschedule" | "cancel">("none");

    const ownerRole = SALES_TYPES.includes(meeting.type) ? "sales" : "manager";
    const canEdit = role === ownerRole;
    const isOpenMeeting = meeting.status !== "done" && meeting.status !== "cancelled";
    // Same rule the server applies: not before it starts, not while the client wants another time.
    const canMarkDone = markDoneBlock(meeting) === null;
    const status = MEETING_STATUS[meeting.status];
    const notesChanged = notes !== (meeting.notes || "");

    const business = meeting.lead?.businessName || "Not linked";
    const client = meeting.lead?.contactName || "Not given";

    const history: { label: string; meta: string; dot: string }[] = [
        { label: "Scheduled", meta: `${shortDate(meeting.createdAt)} · by ${meeting.creator?.name || (ownerRole === "sales" ? "Sales" : "Project Manager")}`, dot: "bg-brand-deep" },
    ];
    if (meeting.status === "confirmed" || meeting.status === "done") {
        history.push({ label: "Client confirmed", meta: "from the client portal", dot: "bg-brand-deep" });
    }
    if (meeting.clientSuggestedAt) {
        history.push({ label: "Client asked for another time", meta: `suggested ${dateTime(meeting.clientSuggestedAt)}`, dot: "bg-stage-discovery" });
    }
    if (meeting.reminderSent) {
        const dayBefore = new Date(new Date(meeting.startsAt).getTime() - 24 * 60 * 60 * 1000);
        history.push({ label: "Reminder sent", meta: `${shortDate(dayBefore)} · automatic, one day before`, dot: "bg-muted-foreground" });
    }
    if (meeting.status === "done") {
        history.push({ label: "Marked as done", meta: shortDate(meeting.updatedAt), dot: "bg-brand-deep" });
    }
    if (meeting.status === "cancelled") {
        history.push({ label: "Cancelled", meta: shortDate(meeting.updatedAt), dot: "bg-destructive" });
    }

    const run = async (kind: typeof busy, action: () => Promise<{ success: boolean; message?: string }>, ok: string, close = true) => {
        setBusy(kind);
        try {
            const res = await action();
            if (res.success) {
                toast.success(ok);
                onUpdate?.();
                if (close) onClose();
            } else {
                toast.error(res.message || "Something went wrong. Try again.");
            }
        } catch {
            toast.error("Something went wrong. Try again.");
        } finally {
            setBusy("none");
        }
    };

    const saveNotes = () =>
        run("notes", () => updateMeetingNotes({ meetingId: meeting.id, notes }), "Notes saved", false);

    const markDone = () =>
        run(
            "done",
            () => markMeetingDone({ meetingId: meeting.id, notes }),
            meeting.type === "discovery" ? "Meeting done. The discovery form is now unlocked." : "Meeting marked as done"
        );

    const submitReschedule = () => {
        const startsAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
        if (!rescheduleDate || Number.isNaN(startsAt.getTime())) {
            toast.error("Pick a new date and time.");
            return;
        }
        run("reschedule", () => rescheduleMeeting({ meetingId: meeting.id, startsAt }), "Rescheduled. A new invite was sent to the client.");
    };

    const submitCancel = () =>
        run(
            "cancel",
            () => cancelMeeting({ meetingId: meeting.id, reason: cancelReason.trim() || undefined }),
            "Meeting cancelled"
        );

    const useSuggestedTime = () => {
        if (!meeting.clientSuggestedAt) return;
        const d = new Date(meeting.clientSuggestedAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        setRescheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setRescheduleTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
        setPanel("reschedule");
    };

    return (
        <>
            {/* Header */}
            <SheetHeader className="gap-0 px-6 pb-5 pt-6 pr-14 text-left">
                <p className="text-sm text-muted-foreground">
                    Business name: {business} · Client name: {client}
                </p>
                <SheetTitle className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{TYPE_TITLE[meeting.type]}</SheetTitle>
                <SheetDescription asChild>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <MeetingStatusChip status={meeting.status} />
                        <span>{status.note}</span>
                    </div>
                </SheetDescription>
            </SheetHeader>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
                {meeting.status === "reschedule_requested" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stage-discovery/10 px-4 py-3 ring-1 ring-inset ring-stage-discovery/25">
                        <p className="text-sm text-foreground">
                            Client suggested{" "}
                            <strong className="font-semibold">
                                {meeting.clientSuggestedAt ? dateTime(meeting.clientSuggestedAt) : "another time"}
                            </strong>
                        </p>
                        {canEdit && meeting.clientSuggestedAt && (
                            <Button size="sm" variant="outline" onClick={useSuggestedTime} className="h-8 bg-card">
                                Use this time
                            </Button>
                        )}
                    </div>
                )}

                {meeting.status === "cancelled" && meeting.declineReason && (
                    <div className="rounded-xl bg-destructive/[0.06] px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-destructive/25">
                        <span className="text-muted-foreground">Reason: </span>
                        {meeting.declineReason}
                    </div>
                )}

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <dt className="text-sm text-muted-foreground">Date and time</dt>
                        <dd className="mt-0.5 text-base tabular-nums text-foreground">{dateTime(meeting.startsAt)}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-muted-foreground">Format</dt>
                        <dd className="mt-0.5 text-base text-foreground">{FORMAT_LABEL[meeting.format]}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-muted-foreground">Attendees</dt>
                        <dd className="mt-0.5 text-base text-foreground">
                            {meeting.attendees?.length ? meeting.attendees.join(", ") : "Not set"}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm text-muted-foreground">Linked to</dt>
                        <dd className="mt-0.5 text-base text-foreground">
                            {meeting.lead ? (
                                role === "sales" ? (
                                    <Link href={`/dashboard/leads/${meeting.lead.id}`} className="underline-offset-4 hover:underline">
                                        Lead: {business}
                                    </Link>
                                ) : (
                                    <>Lead: {business}</>
                                )
                            ) : (
                                "Not linked"
                            )}
                        </dd>
                    </div>
                </dl>

                <div>
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`notes-${meeting.id}`} className="text-sm text-muted-foreground">
                            Meeting notes
                        </label>
                        {canEdit && meeting.status !== "cancelled" && notesChanged && (
                            <Button size="sm" variant="ghost" onClick={saveNotes} disabled={busy !== "none"} className="h-7 gap-1 px-2 text-sm">
                                {busy === "notes" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                Save notes
                            </Button>
                        )}
                    </div>
                    <Textarea
                        id={`notes-${meeting.id}`}
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        readOnly={!canEdit || meeting.status === "cancelled"}
                        placeholder={canEdit ? "What was agreed? These notes are saved with the meeting." : "No notes yet."}
                        className="mt-1.5 min-h-[84px] resize-y text-base read-only:bg-muted/40"
                    />
                </div>

                <div>
                    <h3 className="text-sm text-muted-foreground">History</h3>
                    <ol className="mt-3 space-y-3">
                        {history.map((item) => (
                            <li key={item.label} className="flex gap-3">
                                <span aria-hidden="true" className={`mt-[7px] size-2 shrink-0 rounded-full ${item.dot}`} />
                                <div>
                                    <p className="text-base text-foreground">{item.label}</p>
                                    <p className="text-sm text-muted-foreground">{item.meta}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            {/* Footer: actions pinned to the bottom (mockup 4b) */}
            <div className="shrink-0 border-t border-border bg-card px-6 py-4">
                {panel === "reschedule" && (
                    <div className="composer-enter mb-3 space-y-3 rounded-xl bg-muted/50 p-3 ring-1 ring-inset ring-border/70">
                        <p className="text-sm font-medium text-foreground">New date and time</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Input type="date" aria-label="New date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="h-9 bg-card" />
                            <Input type="time" aria-label="New time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="h-9 bg-card" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setPanel("none")}>Back</Button>
                            <Button size="sm" onClick={submitReschedule} disabled={busy !== "none"} className="gap-1.5 font-semibold">
                                {busy === "reschedule" && <Loader2 className="size-3.5 animate-spin" />}
                                Send new invite
                            </Button>
                        </div>
                    </div>
                )}

                {panel === "cancel" && (
                    <div className="composer-enter mb-3 space-y-3 rounded-xl bg-destructive/[0.05] p-3 ring-1 ring-inset ring-destructive/25">
                        <p className="text-sm font-medium text-foreground">Cancel this meeting? The client is told by email.</p>
                        <Input
                            aria-label="Reason (optional)"
                            placeholder="Reason (optional)"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="h-9 bg-card"
                        />
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setPanel("none")}>Keep meeting</Button>
                            <Button size="sm" variant="destructive" onClick={submitCancel} disabled={busy !== "none"} className="gap-1.5 font-semibold">
                                {busy === "cancel" && <Loader2 className="size-3.5 animate-spin" />}
                                Cancel meeting
                            </Button>
                        </div>
                    </div>
                )}

                {canEdit && isOpenMeeting ? (
                    <>
                    {!canMarkDone && (
                        <p className="mb-3 text-sm text-muted-foreground">
                            {meeting.status === "reschedule_requested"
                                ? "Mark as done comes back once the meeting is rescheduled and has taken place."
                                : `You can mark it as done once it starts (${dateTime(meeting.startsAt)}).`}
                        </p>
                    )}
                    <div className={`grid grid-cols-2 gap-2 ${canMarkDone ? "sm:grid-cols-3" : ""}`}>
                        {canMarkDone && (
                            <Button onClick={markDone} disabled={busy !== "none"} className="col-span-2 h-11 gap-1.5 font-semibold active:scale-[0.97] sm:col-span-1">
                                {busy === "done" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" aria-hidden="true" />}
                                Mark as done
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            aria-pressed={panel === "reschedule"}
                            onClick={() => setPanel(panel === "reschedule" ? "none" : "reschedule")}
                            disabled={busy !== "none"}
                            className="h-11 gap-1.5 active:scale-[0.97]"
                        >
                            <CalendarClock className="size-4" aria-hidden="true" />
                            Reschedule
                        </Button>
                        <Button
                            variant="outline"
                            aria-pressed={panel === "cancel"}
                            onClick={() => setPanel(panel === "cancel" ? "none" : "cancel")}
                            disabled={busy !== "none"}
                            className="h-11 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]"
                        >
                            <XCircle className="size-4" aria-hidden="true" />
                            Cancel meeting
                        </Button>
                    </div>
                    </>
                ) : (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        {canEdit ? (
                            meeting.status === "done" ? (
                                <>
                                    <Check className="size-4 text-brand-deep" aria-hidden="true" /> Done. Notes can still be updated.
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="size-4" aria-hidden="true" /> Cancelled. Schedule a new meeting from the lead.
                                </>
                            )
                        ) : (
                            <>
                                <Lock className="size-4" aria-hidden="true" />
                                View only. {ownerRole === "sales" ? "Sales" : "The Project Manager"} manages this meeting.
                            </>
                        )}
                    </p>
                )}
            </div>
        </>
    );
}
