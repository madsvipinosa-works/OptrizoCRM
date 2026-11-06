"use client";

/**
 * Logout confirmation, shared by every "Log out" control.
 *
 * Copy is plain and only states what is true: who is signed in and that they
 * will need to sign in again. Logging out is not destructive, so the confirm
 * button is neutral (not red) and Cancel gets focus first. While signing out,
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
                className="gap-0 p-6 sm:max-w-[380px]"
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
                <DialogHeader className="gap-1.5 text-left">
                    <span aria-hidden="true" className="mb-2 grid size-10 place-items-center rounded-xl bg-muted text-foreground">
                        <LogOut className="size-[18px]" />
                    </span>
                    <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">Log out?</DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                        {email ? (
                            <>
                                You&apos;re signed in as <span className="font-medium text-foreground">{email}</span>.{" "}
                            </>
                        ) : null}
                        You&apos;ll need to sign in again to use Optrizo CRM.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-6 flex-row gap-2 sm:justify-end">
                    <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => onOpenChange(false)}
                        className="h-10 flex-1 sm:flex-none active:scale-[0.97]"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirm}
                        disabled={isPending}
                        className="h-10 flex-1 gap-1.5 bg-foreground font-semibold text-background hover:bg-foreground/90 sm:flex-none active:scale-[0.97]"
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
