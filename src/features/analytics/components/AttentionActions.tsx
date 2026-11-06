"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unlockUser } from "@/features/users/actions";
import { resendStaffInvite } from "@/features/users/invite-actions";

/** The one action a Super Admin can take from the dashboard on an account that needs attention. */
export function AttentionAction({ kind, userId, name }: { kind: "locked" | "invited"; userId: string; name: string }) {
    const [pending, start] = useTransition();
    const router = useRouter();

    const run = () =>
        start(async () => {
            let ok = false;
            let message: string | undefined;
            if (kind === "locked") {
                const result = await unlockUser(userId);
                ok = result.success;
                message = result.message;
            } else {
                const result = await resendStaffInvite(userId);
                ok = result.ok;
                message = result.ok ? undefined : result.error;
            }
            if (!ok) {
                toast.error(message || "That did not work. Try again.");
                return;
            }
            toast.success(kind === "locked" ? `${name} is unlocked` : `Invite sent again to ${name}`);
            router.refresh();
        });

    return (
        <Button variant="outline" className="shrink-0" onClick={run} disabled={pending}>
            {kind === "locked" ? "Unlock now" : "Resend invite"}
            <span className="sr-only"> for {name}</span>
        </Button>
    );
}
