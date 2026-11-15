"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getTaskUpdates, postTaskUpdate, type TaskUpdateItem } from "@/features/pm/actions";
import { MAX_UPDATE_NOTE_LENGTH } from "@/features/pm/task-attachments";
import { AttachmentEditor, AttachmentList } from "./TaskAttachments";
import type { TaskAttachment } from "@/db/schema";

const first = (name: string | null) => (name || "Someone").split(" ")[0];

function headline(u: TaskUpdateItem) {
    switch (u.kind) {
        case "progress":
            return `${first(u.authorName)} posted an update`;
        case "submission":
            return `${first(u.authorName)} submitted it for review`;
        case "changes_requested":
            return "Changes requested";
        default:
            return "Approved and moved to Done";
    }
}

/**
 * What has happened on a task, newest first, so the PM can see the work before the final submission.
 * Posting an update never changes the task's status.
 */
export function TaskProgress({
    taskId,
    projectId,
    canPost,
    fallback,
}: {
    taskId: string;
    projectId: string;
    canPost: boolean;
    /** Rows built from the status, shown for older tasks that have no recorded updates yet. */
    fallback: { what: string; when: string }[];
}) {
    const [updates, setUpdates] = useState<TaskUpdateItem[] | null>(null);
    const [note, setNote] = useState("");
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [posting, setPosting] = useState(false);

    const load = useCallback(async () => {
        setUpdates(await getTaskUpdates(taskId));
    }, [taskId]);

    // The parent remounts this per task (key), so the form and the list start fresh for each one.
    useEffect(() => {
        let live = true;
        getTaskUpdates(taskId).then((rows) => {
            if (live) setUpdates(rows);
        });
        return () => {
            live = false;
        };
    }, [taskId]);

    const post = async () => {
        setPosting(true);
        const res = await postTaskUpdate({ taskId, note, attachments });
        setPosting(false);
        if (res.success) {
            toast.success("Update posted");
            setNote("");
            setAttachments([]);
            await load();
        } else {
            toast.error(res.message || "Could not post the update");
        }
    };

    const rows = updates ?? [];
    const canSend = !posting && (note.trim().length > 0 || attachments.length > 0);

    return (
        <div className="space-y-4">
            {canPost && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <Label htmlFor={`progress-note-${taskId}`} className="text-sm text-muted-foreground">
                        Post an update
                    </Label>
                    <Textarea
                        id={`progress-note-${taskId}`}
                        rows={3}
                        value={note}
                        maxLength={MAX_UPDATE_NOTE_LENGTH}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What did you finish, and what is next?"
                        className="bg-card text-base"
                    />
                    <AttachmentEditor value={attachments} onChange={setAttachments} projectId={projectId} disabled={posting} />
                    <Button type="button" size="sm" onClick={post} disabled={!canSend} className="h-9 gap-1.5 font-semibold active:scale-[0.97]">
                        {posting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                        Post update
                    </Button>
                </div>
            )}

            {updates === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
                fallback.length > 0 ? (
                    <ol className="relative ml-1 space-y-4 border-l border-border pl-5">
                        {fallback.map((h, i) => (
                            <li key={h.what} className="relative">
                                <Dot active={i === fallback.length - 1} />
                                <p className="text-base text-foreground">{h.what}</p>
                                <p className="text-sm text-muted-foreground">{h.when}</p>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="text-sm text-muted-foreground">No updates yet.</p>
                )
            ) : (
                <ol className="relative ml-1 space-y-5 border-l border-border pl-5">
                    {rows.map((u, i) => (
                        <li key={u.id} className="relative space-y-1.5">
                            <Dot active={i === 0} />
                            <p className="text-base text-foreground">{headline(u)}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(u.createdAt), "MMM d · h:mm a")}</p>
                            {u.note && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{u.note}</p>}
                            <AttachmentList items={u.attachments} />
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

function Dot({ active }: { active: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-background", active ? "bg-brand-deep" : "bg-muted-foreground/40")}
        />
    );
}
