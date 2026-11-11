"use client";

/**
 * Negotiation thread on a proposal (mockups 18d, 18e, 18f), laid out as a conversation:
 * avatar, name, role and time on each message; PM replies tinted green, change requests amber,
 * talks held outside the system grey. The list scrolls inside the card and the reply box stays
 * at the bottom. The client portal uses the same component with role "client".
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatDateTime, todayYmd } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { replyToClient, logOutsideDiscussion, sendClientMessage } from "@/features/proposals/signing";

export interface ProposalMessageItem {
    id: string;
    proposalId: string;
    authorId: string | null;
    kind: string; // 'change_request' | 'message' | 'reply' | 'outside_discussion'
    topics?: unknown;
    body: string;
    outsideType?: string | null;
    heldAt?: Date | string | null;
    createdAt: Date | string;
    author?: { id: string; name: string | null; role: string | null; email: string } | null;
}

interface ProposalThreadProps {
    proposalId: string;
    messages: ProposalMessageItem[];
    userRole: string;
    onMessageSent?: () => void;
}

const OUTSIDE_LABEL: Record<string, string> = { call: "Phone call", email: "Email", in_person: "In person" };

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "?";

export function ProposalThread({ proposalId, messages, userRole, onMessageSent }: ProposalThreadProps) {
    const router = useRouter();
    const isManager = userRole === "manager";
    const isClient = userRole === "client";
    const listRef = useRef<HTMLOListElement>(null);

    const [replyBody, setReplyBody] = useState("");
    const [isSending, setIsSending] = useState(false);

    const [showOutside, setShowOutside] = useState(false);
    const [outsideType, setOutsideType] = useState<"call" | "email" | "in_person">("call");
    const [outsideDate, setOutsideDate] = useState(() => todayYmd());
    const [outsideSummary, setOutsideSummary] = useState("");
    const [outsideError, setOutsideError] = useState<string | null>(null);
    const [isLogging, setIsLogging] = useState(false);

    // Open at the newest message, like any conversation.
    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const sendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyBody.trim()) return;
        setIsSending(true);
        try {
            const res = isManager ? await replyToClient(proposalId, replyBody.trim()) : await sendClientMessage(proposalId, replyBody.trim());
            if (res.success) {
                toast.success(isManager ? "Reply sent. The client sees it in their portal." : "Message sent to your Project Manager.");
                setReplyBody("");
                onMessageSent?.();
                router.refresh();
            } else {
                toast.error(res.message || "Could not send the message.");
            }
        } catch {
            toast.error("Could not send the message.");
        } finally {
            setIsSending(false);
        }
    };

    const logOutside = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!outsideSummary.trim()) {
            setOutsideError("Write what was discussed.");
            return;
        }
        setIsLogging(true);
        try {
            const res = await logOutsideDiscussion(proposalId, outsideType, outsideDate, outsideSummary.trim());
            if (res.success) {
                toast.success("Saved to the negotiation log. Sales sees it in the activity log.");
                setOutsideSummary("");
                setShowOutside(false);
                onMessageSent?.();
                router.refresh();
            } else {
                setOutsideError(res.message || "Could not save the discussion.");
            }
        } catch {
            setOutsideError("Could not save the discussion.");
        } finally {
            setIsLogging(false);
        }
    };

    const canWrite = isManager || isClient;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
                <h2 id="negotiation-heading" className="text-lg font-semibold tracking-tight text-foreground">
                    {isClient ? "Messages" : "Negotiation"}
                </h2>
                <span className="text-sm tabular-nums text-muted-foreground">
                    {messages.length} {messages.length === 1 ? "message" : "messages"}
                </span>
            </div>

            {messages.length === 0 ? (
                <p className="flex flex-1 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">
                    {isClient
                        ? "No messages yet. Ask your Project Manager anything about this proposal; replies appear here."
                        : "No messages yet. Questions and change requests from the client appear here, with any talks logged from outside."}
                </p>
            ) : (
                <ol ref={listRef} className="max-h-[min(60vh,560px)] flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {messages.map((msg) => {
                        const outside = msg.kind === "outside_discussion";
                        const request = msg.kind === "change_request";
                        const fromPm = msg.kind === "reply" || outside || msg.author?.role === "manager";
                        const who = msg.author?.name || msg.author?.email || (fromPm ? "Project Manager" : "Client");
                        const role = fromPm ? "Project Manager" : "Client";
                        const topics = Array.isArray(msg.topics) ? (msg.topics as string[]) : [];
                        return (
                            <li key={msg.id} className="flex gap-3">
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                                        fromPm ? "bg-brand-soft text-brand-deep" : "bg-muted text-foreground"
                                    )}
                                >
                                    {initials(who)}
                                </span>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                        <p className="text-sm">
                                            <span className="font-semibold text-foreground">{who}</span>{" "}
                                            <span className="text-muted-foreground">· {role}</span>
                                        </p>
                                        <time className="text-xs tabular-nums text-muted-foreground" dateTime={new Date(msg.createdAt).toISOString()}>
                                            {formatDateTime(msg.createdAt)}
                                        </time>
                                    </div>
                                    <div
                                        className={cn(
                                            "space-y-1.5 rounded-lg px-3.5 py-2.5 text-sm",
                                            outside ? "bg-muted" : request ? "bg-stage-negotiation/10 ring-1 ring-inset ring-stage-negotiation/25" : fromPm ? "bg-brand-soft/50" : "bg-muted/60"
                                        )}
                                    >
                                        {(outside || request) && (
                                            <p className="text-xs font-semibold text-muted-foreground">
                                                {outside
                                                    ? `Held outside · ${OUTSIDE_LABEL[msg.outsideType ?? ""] ?? "Discussion"}${msg.heldAt ? ` · ${formatDate(msg.heldAt)}` : ""}`
                                                    : "Change request"}
                                            </p>
                                        )}
                                        {topics.length > 0 && (
                                            <p className="flex flex-wrap gap-1.5">
                                                {topics.map((t) => (
                                                    <span key={t} className="rounded-full bg-stage-negotiation/15 px-2 py-0.5 text-xs font-medium capitalize text-foreground">
                                                        {t}
                                                    </span>
                                                ))}
                                            </p>
                                        )}
                                        <p className="whitespace-pre-wrap break-words leading-relaxed text-foreground">{msg.body}</p>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {canWrite && (
                <form onSubmit={sendReply} className="space-y-2 border-t border-border px-5 py-4">
                    <Label htmlFor={`reply-${proposalId}`} className="sr-only">
                        {isManager ? "Reply to the client" : "Message your Project Manager"}
                    </Label>
                    <Textarea
                        id={`reply-${proposalId}`}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        onKeyDown={(e) => {
                            // Ctrl/Cmd+Enter sends, as in most chat tools.
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                        }}
                        rows={2}
                        className="min-h-[72px] resize-none bg-card text-sm leading-relaxed"
                        placeholder={isManager ? "Reply to the client. They see it in their portal." : "Ask your Project Manager about this proposal."}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {isManager ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setOutsideError(null);
                                    setShowOutside(true);
                                }}
                                className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
                            >
                                Log outside discussion
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button type="submit" disabled={isSending || !replyBody.trim()} className="h-9 gap-1.5 font-semibold active:scale-[0.97]">
                            {isSending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                            {isManager ? "Send reply" : "Send message"}
                        </Button>
                    </div>
                </form>
            )}

            <Dialog open={showOutside} onOpenChange={(open) => !isLogging && setShowOutside(open)}>
                <DialogContent className="max-w-md rounded-xl border-border bg-card text-foreground">
                    <form onSubmit={logOutside} className="space-y-4">
                        <DialogHeader className="text-left">
                            <DialogTitle className="text-lg font-semibold tracking-tight">Log a discussion held outside the system</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                For example a call with the client or their lawyer. Saved to this thread and the Sales activity log.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="outside-type" className="text-sm text-muted-foreground">How</Label>
                                <FormSelect id="outside-type" value={outsideType} onChange={(e) => setOutsideType(e.target.value as "call" | "email" | "in_person")}>
                                    <option value="call">Phone call</option>
                                    <option value="email">Email</option>
                                    <option value="in_person">In person</option>
                                </FormSelect>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="outside-date" className="text-sm text-muted-foreground">Date</Label>
                                <DatePicker id="outside-date" value={outsideDate} onChange={setOutsideDate} max={todayYmd()} required className="bg-card" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="outside-summary" className="text-sm text-muted-foreground">What was discussed</Label>
                            <Textarea
                                id="outside-summary"
                                value={outsideSummary}
                                onChange={(e) => {
                                    setOutsideSummary(e.target.value);
                                    setOutsideError(null);
                                }}
                                rows={4}
                                aria-invalid={outsideError ? true : undefined}
                                aria-describedby={outsideError ? "outside-error" : undefined}
                                className="bg-card text-sm leading-relaxed"
                                placeholder="e.g. Called the client. They accept reports later as a separate phase. Target price around ₱260,000."
                            />
                            {outsideError && (
                                <p id="outside-error" role="alert" className="text-sm text-destructive">
                                    {outsideError}
                                </p>
                            )}
                        </div>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" className="bg-card" onClick={() => setShowOutside(false)} disabled={isLogging}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLogging} className="gap-1.5 font-semibold active:scale-[0.97]">
                                {isLogging && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                                Save to negotiation log
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
