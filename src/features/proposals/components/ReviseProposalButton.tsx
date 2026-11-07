"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProposalRevision } from "@/features/proposals/actions";

/** Starts the next version (or opens the draft that already exists) and goes to the editor (mockup 18d). */
export function ReviseProposalButton({ leadId, nextVersion, className }: { leadId: string; nextVersion: number; className?: string }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    return (
        <Button
            type="button"
            disabled={pending}
            className={className ?? "h-10 gap-1.5 font-semibold active:scale-[0.97]"}
            onClick={() =>
                start(async () => {
                    const res = await createProposalRevision(leadId);
                    // An existing draft comes back as proposalId with success false: open it instead of failing.
                    if ("proposalId" in res && res.proposalId) {
                        router.push(`/dashboard/proposals/builder/${res.proposalId}`);
                        return;
                    }
                    toast.error(("message" in res && res.message) || "Could not start the new version.");
                })
            }
        >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Revise the proposal (v{nextVersion})
        </Button>
    );
}
