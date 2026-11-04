"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteStaff, StaffRole } from "@/features/users/invite-actions";
import { AlertCircle, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

export function InviteStaffForm() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<StaffRole>("developer");
    const [jobTitle, setJobTitle] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<{ type: "success" | "warning"; message: string } | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrorMessage(null);
        setFieldErrors({});
        setFeedback(null);
        setIsLoading(true);

        try {
            const res = await inviteStaff({
                name,
                email,
                role,
                jobTitle: jobTitle || null,
            });

            if (!res.ok) {
                setErrorMessage(res.error);
                if (res.fieldErrors) {
                    setFieldErrors(res.fieldErrors);
                }
            } else {
                if (res.emailSent) {
                    setFeedback({
                        type: "success",
                        message: "Invite sent",
                    });
                } else {
                    setFeedback({
                        type: "warning",
                        message: "Invite created but the email could not be sent. Use Resend.",
                    });
                }
                // Reset form inputs
                setName("");
                setEmail("");
                setJobTitle("");
            }
        } catch {
            setErrorMessage("An unexpected error occurred while sending the invite.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 max-w-xl space-y-6">
            {feedback && (
                <div
                    className={`p-4 rounded-lg flex items-start gap-3 border ${
                        feedback.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    }`}
                >
                    {feedback.type === "success" ? (
                        <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    )}
                    <div className="text-sm font-medium">{feedback.message}</div>
                </div>
            )}

            {errorMessage && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Dennis Ocampo"
                        required
                        disabled={isLoading}
                        className={fieldErrors.name ? "border-destructive" : ""}
                    />
                    {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. dennis.ocampo@optrizo.ph"
                        required
                        disabled={isLoading}
                        className={fieldErrors.email ? "border-destructive" : ""}
                    />
                    {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as StaffRole)}
                        disabled={isLoading}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="sales">Sales</option>
                        <option value="manager">Project Manager</option>
                        <option value="developer">Developer</option>
                        <option value="content_editor">Content Editor</option>
                    </select>
                    <span className="text-xs text-muted-foreground block">
                        The role decides what they see after they sign in.
                    </span>
                    {fieldErrors.role && <p className="text-xs text-destructive">{fieldErrors.role}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job title (optional)</Label>
                    <Input
                        id="jobTitle"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Senior Frontend Engineer"
                        disabled={isLoading}
                        className={fieldErrors.jobTitle ? "border-destructive" : ""}
                    />
                    {fieldErrors.jobTitle && <p className="text-xs text-destructive">{fieldErrors.jobTitle}</p>}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    We email a link so they set their own password. It works for 48 hours. Until then the account shows as Invited.
                </p>

                <div className="flex items-center gap-3 pt-2">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-[#0e6b7e] hover:bg-[#0e6b7e]/90 text-white font-semibold"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending invite...
                            </>
                        ) : (
                            "Send invite"
                        )}
                    </Button>
                    <Link href="/dashboard/team">
                        <Button type="button" variant="outline" disabled={isLoading}>
                            Cancel
                        </Button>
                    </Link>
                </div>
            </form>
        </div>
    );
}
