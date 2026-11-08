"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { acceptCompletion, requestCompletionFixes } from "@/features/pm/completion-actions";

type Doc = { id: string; title: string; fileName: string; fileUrl: string };

/** Shown while the PM waits for the client: review the handover files, then accept or ask for fixes. */
export function AcceptanceCard({ projectId, documents }: { projectId: string; documents: Doc[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [fixing, setFixing] = useState(false);
    const [comment, setComment] = useState("");

    const run = async (fn: () => Promise<{ success: boolean; error?: string; message?: string }>) => {
        setBusy(true);
        try {
            const res = await fn();
            if (res.success) {
                toast.success(res.message || "Done.");
                router.refresh();
            } else {
                toast.error(res.error || "Something went wrong.");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl bg-card border border-border p-5 space-y-4">
            <div>
                <h3 className="text-base font-bold text-foreground">Please review your project handover</h3>
                <p className="text-sm text-muted-foreground">
                    Open the files below. If everything is as agreed, accept the handover. Otherwise tell us what needs fixing.
                </p>
            </div>
            <div className="divide-y divide-border/60">
                {documents.map((d) => (
                    <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-2 text-sm text-primary hover:underline">
                        <span className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{d.title}</span></span>
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </a>
                ))}
            </div>
            {fixing ? (
                <div className="space-y-2">
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="What needs to be fixed?" aria-label="What needs to be fixed" />
                    <div className="flex gap-2">
                        <Button disabled={busy || !comment.trim()} onClick={() => run(() => requestCompletionFixes(projectId, comment))}>Send to project manager</Button>
                        <Button variant="outline" disabled={busy} onClick={() => setFixing(false)}>Cancel</Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => run(() => acceptCompletion(projectId))}>Accept handover</Button>
                    <Button variant="outline" disabled={busy} onClick={() => setFixing(true)}>Request fixes</Button>
                </div>
            )}
        </div>
    );
}
