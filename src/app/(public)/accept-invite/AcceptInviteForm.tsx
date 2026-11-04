"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptStaffInvite } from "@/features/users/invite-actions";
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";

interface AcceptInviteFormProps {
    token: string;
}

export function AcceptInviteForm({ token }: AcceptInviteFormProps) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (!password) {
            setError("Password is required.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);

        try {
            const res = await acceptStaffInvite({
                token,
                password,
                confirmPassword,
            });

            if (!res.ok) {
                setError(res.error);
                if (res.fieldErrors) {
                    setFieldErrors(res.fieldErrors);
                }
            } else {
                setSuccessMessage("Password set successfully! Redirecting to sign in...");
                setTimeout(() => {
                    router.push("/login?accepted=true");
                }, 2000);
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    if (successMessage) {
        return (
            <div className="bg-card border border-border rounded-xl p-8 shadow-xl text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Welcome to Optrizo!</h3>
                <p className="text-sm text-muted-foreground">{successMessage}</p>
                <Link href="/login" className="inline-block text-primary text-sm font-semibold hover:underline">
                    Click here if you are not redirected
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
            <input type="hidden" name="token" value={token} />

            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="password">Set password</Label>
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className={fieldErrors.password ? "border-destructive pr-10" : "pr-10"}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                <p className="text-[12px] text-muted-foreground">
                    Must be at least 8 characters with at least one uppercase letter and one number or symbol.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className={fieldErrors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                    >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                {fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
                )}
            </div>

            <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0e6b7e] hover:bg-[#0e6b7e]/90 text-white font-semibold"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting password...
                    </>
                ) : (
                    "Set password & activate account"
                )}
            </Button>
        </form>
    );
}
