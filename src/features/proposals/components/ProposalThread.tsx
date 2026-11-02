"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { replyToClient, logOutsideDiscussion, sendClientMessage } from "@/features/proposals/signing";
import { toast } from "sonner";
import {
    MessageSquare,
    Send,
    Phone,
    Mail,
    Users,
    Loader2,
    PlusCircle,
    UserCheck,
    AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

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
    author?: {
        id: string;
        name: string | null;
        role: string | null;
        email: string;
    } | null;
}

interface ProposalThreadProps {
    proposalId: string;
    messages: ProposalMessageItem[];
    userRole: string;
    onMessageSent?: () => void;
}

export function ProposalThread({
    proposalId,
    messages,
    userRole,
    onMessageSent,
}: ProposalThreadProps) {
    const router = useRouter();
    const [replyBody, setReplyBody] = useState("");
    const [isSending, setIsSending] = useState(false);

    // Outside discussion modal state
    const [showOutsideModal, setShowOutsideModal] = useState(false);
    const [outsideType, setOutsideType] = useState<"call" | "email" | "in_person">("call");
    const [outsideDate, setOutsideDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [outsideSummary, setOutsideSummary] = useState("");
    const [isLoggingOutside, setIsLoggingOutside] = useState(false);

    const isManager = userRole === "manager";
    const isClient = userRole === "client";

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyBody.trim()) return;

        setIsSending(true);
        try {
            const res = isManager
                ? await replyToClient(proposalId, replyBody.trim())
                : await sendClientMessage(proposalId, replyBody.trim());

            if (res.success) {
                toast.success(isManager ? "Reply sent to client" : "Message sent to Project Manager");
                setReplyBody("");
                onMessageSent?.();
                router.refresh();
            } else {
                toast.error(res.message || "Failed to send message");
            }
        } catch {
            toast.error("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    const handleLogOutsideSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!outsideSummary.trim()) {
            toast.error("Please provide a summary of the discussion");
            return;
        }

        setIsLoggingOutside(true);
        try {
            const res = await logOutsideDiscussion(proposalId, outsideType, outsideDate, outsideSummary.trim());
            if (res.success) {
                toast.success("Outside discussion logged and notified to Sales");
                setOutsideSummary("");
                setShowOutsideModal(false);
                onMessageSent?.();
                router.refresh();
            } else {
                toast.error(res.message || "Failed to log outside discussion");
            }
        } catch {
            toast.error("Failed to log outside discussion");
        } finally {
            setIsLoggingOutside(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Discussion & Negotiation Thread</h3>
                    <Badge variant="outline" className="text-[10px] font-mono ml-1">
                        {messages.length}
                    </Badge>
                </div>
                {isManager && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowOutsideModal(true)}
                        className="h-7 text-xs gap-1 border-dashed"
                    >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Log Outside Discussion
                    </Button>
                )}
            </div>

            {/* Message List */}
            {messages.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl bg-card/40">
                    No messages or change requests yet. The client can request revisions or send questions here.
                </div>
            ) : (
                <div className="space-y-3">
                    {messages.map((msg) => {
                        const isChangeRequest = msg.kind === "change_request";
                        const isOutside = msg.kind === "outside_discussion";
                        const isReply = msg.kind === "reply";
                        const authorName = msg.author?.name || msg.author?.email || (isReply ? "Project Manager" : "Client");
                        const topics = Array.isArray(msg.topics) ? (msg.topics as string[]) : [];

                        const dateFormatted = new Intl.DateTimeFormat("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                        }).format(new Date(msg.createdAt));

                        if (isOutside) {
                            return (
                                <div
                                    key={msg.id}
                                    className="p-3.5 rounded-xl border border-border bg-muted/30 text-xs space-y-1.5"
                                >
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                                            {msg.outsideType === "call" ? (
                                                <Phone className="h-3.5 w-3.5 text-blue-500" />
                                            ) : msg.outsideType === "email" ? (
                                                <Mail className="h-3.5 w-3.5 text-purple-500" />
                                            ) : (
                                                <Users className="h-3.5 w-3.5 text-emerald-500" />
                                            )}
                                            <span>
                                                Outside Discussion ({msg.outsideType || "Discussion"}) · logged by {authorName}
                                            </span>
                                            {msg.heldAt && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    (Held {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(msg.heldAt))})
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-mono text-muted-foreground">{dateFormatted}</span>
                                    </div>
                                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                </div>
                            );
                        }

                        if (isChangeRequest) {
                            return (
                                <div
                                    key={msg.id}
                                    className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-2"
                                >
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <span>Change Request from {authorName}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-muted-foreground">{dateFormatted}</span>
                                    </div>
                                    {topics.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {topics.map((t) => (
                                                <Badge
                                                    key={t}
                                                    variant="outline"
                                                    className="text-[10px] capitalize bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                                >
                                                    {t}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                </div>
                            );
                        }

                        // Regular message or reply
                        return (
                            <div
                                key={msg.id}
                                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                                    isReply
                                        ? "border-primary/20 bg-primary/5 ml-4 sm:ml-8"
                                        : "border-border bg-card"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                        {isReply ? (
                                            <UserCheck className="h-3.5 w-3.5 text-primary" />
                                        ) : (
                                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                        <span>{authorName}</span>
                                        {isReply && (
                                            <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30">
                                                PM
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-mono text-muted-foreground">{dateFormatted}</span>
                                </div>
                                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reply Input Form (For PM or Client) */}
            {(isManager || isClient) && (
                <form onSubmit={handleSendReply} className="space-y-2 pt-2">
                    <Textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder={
                            isManager
                                ? "Reply to the client about this proposal or revision..."
                                : "Ask a question or reply to the Project Manager..."
                        }
                        rows={2}
                        className="text-xs leading-relaxed"
                    />
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isSending || !replyBody.trim()}
                            className="h-8 text-xs font-semibold gap-1.5"
                        >
                            {isSending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Send className="h-3.5 w-3.5" />
                            )}
                            {isManager ? "Send Reply" : "Send Message"}
                        </Button>
                    </div>
                </form>
            )}

            {/* Log Outside Discussion Dialog */}
            <Dialog open={showOutsideModal} onOpenChange={setShowOutsideModal}>
                <DialogContent className="max-w-md w-full glass-card border-border text-foreground">
                    <form onSubmit={handleLogOutsideSubmit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                <Phone className="h-5 w-5 text-primary" />
                                Log Outside Discussion
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-3 py-2 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Channel</Label>
                                    <Select
                                        value={outsideType}
                                        onValueChange={(val: "call" | "email" | "in_person") => setOutsideType(val)}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="call" className="text-xs">
                                                Phone Call
                                            </SelectItem>
                                            <SelectItem value="email" className="text-xs">
                                                Email Discussion
                                            </SelectItem>
                                            <SelectItem value="in_person" className="text-xs">
                                                In-Person Meeting
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Date Held</Label>
                                    <Input
                                        type="date"
                                        value={outsideDate}
                                        onChange={(e) => setOutsideDate(e.target.value)}
                                        required
                                        className="h-9 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Discussion Summary</Label>
                                <Textarea
                                    value={outsideSummary}
                                    onChange={(e) => setOutsideSummary(e.target.value)}
                                    placeholder="Summarize key points agreed upon, client questions, or scope notes..."
                                    rows={4}
                                    required
                                    className="text-xs leading-relaxed"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowOutsideModal(false)}
                                disabled={isLoggingOutside}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isLoggingOutside || !outsideSummary.trim()}
                                className="font-semibold text-xs"
                            >
                                {isLoggingOutside ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                        Logging...
                                    </>
                                ) : (
                                    "Save Discussion Log"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
