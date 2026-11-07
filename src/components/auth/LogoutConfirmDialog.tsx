"use client";

/**
 * Logout confirmation, shared by every "Log out" control.
 *
 * Copy is plain and only states what is true: who is signed in and that they
 * will need to sign in again. Logging out is not destructive, so the confirm
 * button is Optrizo ink (not green, not red) and Cancel gets focus first. While signing out,
 * the dialog cannot be dismissed and the button shows progress.
 */

import { useRef, useTransition } from "react";
import { signOut as clientSignOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { handleSignOut as serverSignOut } from "@/features/auth/signout-action";

/** Server sign-out first; fall back to the client call if the action throws. */
export async function signOutEverywhere() {
    try {
        await serverSignOut();
    } catch {
        // The server action redirects by throwing; the client call below covers any other failure.
    }
    await clientSignOut({ callbackUrl: "/" });
}

interface LogoutConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Shown so the person knows which account they are leaving. */
    email?: string | null;
    /** Defaults to signing out on both server and client. */
    onConfirm?: () => Promise<void> | void;
}

export function LogoutConfirmDialog({ open, onOpenChange, email, onConfirm = signOutEverywhere }: LogoutConfirmDialogProps) {
    const [isPending, startTransition] = useTransition();
    const returnFocus = useRef<HTMLElement | null>(null);

    const confirm = () => {
        startTransition(async () => {
            await onConfirm();
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                // Stay open while signing out, so the state is never ambiguous.
                if (isPending) return;
                onOpenChange(next);
            }}
        >
            <DialogContent
                showCloseButton={false}
                // Card surface so it lifts off the page in dark mode; 12px like every Optrizo dialog.
                // Opens 200ms with a strong ease-out, closes faster (150ms): the system answering.
                className="gap-0 rounded-xl border-border bg-card p-6 ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=closed]:duration-150 sm:max-w-[400px]"
                onOpenAutoFocus={() => {
                    // Remember what opened the dialog, to give focus back when it closes.
                    const active = document.activeElement;
                    returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null;
                }}
                onCloseAutoFocus={(e) => {
                    if (returnFocus.current?.isConnected) {
                        e.preventDefault();
                        returnFocus.current.focus();
                    }
                }}
                onEscapeKeyDown={(e) => isPending && e.preventDefault()}
                onPointerDownOutside={(e) => isPending && e.preventDefault()}
            >
                <DialogHeader className="flex-row items-start gap-4 text-left">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                        <LogOut className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 space-y-1">
                        <DialogTitle className="text-lg font-semibold leading-snug tracking-tight text-foreground">Log out?</DialogTitle>
                        <DialogDescription className="text-pretty text-sm leading-relaxed text-muted-foreground">
                            You&apos;ll need to sign in again to use Optrizo CRM.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                {email && (
                    // Which account is being left, on its own line so a long address never splits a sentence.
                    <p className="mt-5 flex min-w-0 items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
                        <span className="shrink-0 text-muted-foreground">Signed in as</span>
                        <span className="truncate font-medium text-foreground" title={email}>{email}</span>
                    </p>
                )}
                {/* Two equal buttons fill the row: balanced, and both easy to hit on a phone. */}
                <DialogFooter className="mt-6 grid grid-cols-2 gap-2 sm:flex-none">
                    <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => onOpenChange(false)}
                        // The default dark outline vanished on the card; a muted fill keeps Cancel looking like a button.
                        className="h-10 rounded-lg border-border bg-card hover:bg-muted dark:border-border dark:bg-muted dark:hover:bg-muted/70 active:scale-[0.97]"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirm}
                        disabled={isPending}
                        // Optrizo ink, not brand green (reads as success) or red (logging out loses nothing).
                        className="h-10 gap-1.5 rounded-lg bg-foreground font-semibold text-background hover:bg-foreground/90 active:scale-[0.97]"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                Logging out…
                            </>
                        ) : (
                            "Log out"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
