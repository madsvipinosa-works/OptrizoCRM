"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/features/auth/actions";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="w-full max-w-md p-8 bg-black/50 border border-white/10 rounded-xl backdrop-blur-xl text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Invalid Link</h2>
                    <p className="text-gray-400 mb-6">No reset token was provided in the URL.</p>
                    <Link href="/" className="text-primary hover:underline font-medium">
                        Return to Homepage
                    </Link>
                </div>
            </div>
        );
    }

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        const formData = new FormData(e.currentTarget);
        formData.append("token", token as string);
        
        try {
            const result = await resetPassword(null, formData);
            if (!result.success) {
                setError(result.message || "Failed to reset password");
            } else {
                setSuccess(true);
                setTimeout(() => {
                    router.push(result.redirect || "/");
                    router.refresh();
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            setError("A network error occurred.");
        } finally {
            setIsLoading(false);
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="w-full max-w-md p-8 bg-black/50 border border-white/10 rounded-xl backdrop-blur-xl text-center flex flex-col items-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
                    <p className="text-gray-400 mb-6">Your password has been successfully updated. Redirecting you to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md p-8 bg-black/80 border border-white/10 rounded-xl backdrop-blur-xl relative z-10 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 mb-2">Set New Password</h1>
                    <p className="text-gray-400">Please enter your strong new password below.</p>
                </div>

                {error && (
                    <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-gray-300">New Password</Label>
                        <Input 
                            id="password" 
                            name="password" 
                            type="password" 
                            required 
                            minLength={6}
                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-primary/50 h-12" 
                            placeholder="••••••••"
                        />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full h-12 text-base font-semibold transition-all hover:scale-[1.02]">
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                            "Update Password"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <ResetPasswordForm />
        </Suspense>
    );
}
