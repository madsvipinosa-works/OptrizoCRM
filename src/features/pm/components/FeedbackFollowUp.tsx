"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveFeedbackFollowUp } from "@/features/client-portal/feedback-actions";

/** The PM's internal note on a client's feedback. The client's answers cannot be changed here. */
export function FeedbackFollowUp({ projectId, initialNote, reviewedAt, suggestion }: { projectId: string; initialNote: string; reviewedAt: string | null; suggestion: string | null }) {
    const router = useRouter();
    const [note, setNote] = useState(initialNote);
    const [busy, setBusy] = useState(false);

    const run = async (action: "note" | "call" | "reviewed") => {
        setBusy(true);
        try {
            const res = await saveFeedbackFollowUp(projectId, note, action);
            if (res.success) {
                toast.success(res.message || "Saved.");
                router.refresh();
            } else {
                toast.error(res.error || "Something went wrong.");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5" aria-labelledby="followup">
            <h2 id="followup" className="text-lg font-semibold text-foreground">Follow-up</h2>
            {suggestion && <p className="text-sm text-foreground">{suggestion}</p>}
            <div className="space-y-1.5">
                <label htmlFor="followup-note" className="text-sm text-muted-foreground">Your note (internal)</label>
                <Textarea id="followup-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => run("call")}>Log follow-up call</Button>
                <Button variant="outline" disabled={busy || Boolean(reviewedAt)} onClick={() => run("reviewed")}>
                    {reviewedAt ? `Reviewed ${new Date(reviewedAt).toLocaleDateString()}` : "Mark as reviewed"}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => run("note")}>Save note</Button>
            </div>
            <p className="text-sm text-muted-foreground">You can add notes, but you can&apos;t change the client&apos;s answers.</p>
        </section>
    );
}
