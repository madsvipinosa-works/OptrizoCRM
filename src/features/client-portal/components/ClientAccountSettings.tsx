"use client";

import { useState, useTransition } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAccountName, updateAccountPassword } from "@/features/auth/actions";

type Props = { name: string; email: string };

export function ClientAccountSettings({ name, email }: Props) {
    const [displayName, setDisplayName] = useState(name);
    const [nameMessage, setNameMessage] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [isPending, startTransition] = useTransition();

    const saveName = () => startTransition(async () => {
        const result = await updateAccountName(displayName);
        setNameMessage(result.message ?? (result.success ? "Name updated." : "Could not update name."));
    });

    const savePassword = (formData: FormData) => startTransition(async () => {
        const result = await updateAccountPassword(
            String(formData.get("currentPassword") ?? ""),
            String(formData.get("newPassword") ?? ""),
        );
        setPasswordMessage(result.message ?? (result.success ? "Password updated." : "Could not update password."));
        if (result.success) (document.getElementById("account-password-form") as HTMLFormElement)?.reset();
    });

    return (
        <div className="space-y-6">
            <section className="glass-card rounded-2xl border border-border p-5 md:p-7">
                <div className="mb-6 flex items-start gap-3">
                    <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><UserRound className="h-5 w-5" /></span>
                    <div><h2 className="text-lg font-semibold">Profile</h2><p className="text-sm text-muted-foreground">Update the name shown on your account.</p></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">Name<Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" /></label>
                    <label className="space-y-2 text-sm font-medium">Email<Input value={email} readOnly aria-readonly="true" className="bg-muted/40" /><span className="block text-xs text-muted-foreground">Contact support to change your email address.</span></label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={saveName} disabled={isPending || displayName.trim() === name}>{isPending ? "Saving…" : "Save name"}</Button>
                    {nameMessage && <p role="status" className="text-sm text-muted-foreground">{nameMessage}</p>}
                </div>
            </section>

            <section className="glass-card rounded-2xl border border-border p-5 md:p-7">
                <div className="mb-6 flex items-start gap-3">
                    <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><KeyRound className="h-5 w-5" /></span>
                    <div><h2 className="text-lg font-semibold">Change password</h2><p className="text-sm text-muted-foreground">Choose a password with at least 8 characters, one uppercase letter, and one number or symbol.</p></div>
                </div>
                <form id="account-password-form" action={savePassword} className="max-w-xl space-y-4">
                    <label className="block space-y-2 text-sm font-medium">Current password<Input name="currentPassword" type="password" autoComplete="current-password" required /></label>
                    <label className="block space-y-2 text-sm font-medium">New password<Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit" disabled={isPending}>{isPending ? "Updating…" : "Update password"}</Button>
                        {passwordMessage && <p role="status" className="text-sm text-muted-foreground">{passwordMessage}</p>}
                    </div>
                </form>
                <p className="mt-4 text-xs text-muted-foreground">Forgot your current password? <a className="underline underline-offset-4 hover:text-foreground" href="/reset-password">Reset it by email</a>.</p>
            </section>
        </div>
    );
}
