"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithEmail, signUpWithEmail } from "@/features/auth/actions";
import { Loader2, AlertCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface LoginPageProps {
    searchParams: Promise<{
        callbackUrl?: string;
        reason?: string;
    }>;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
    const params = use(searchParams);
    const callbackUrl = params.callbackUrl || "/dashboard";
    const isProposalReason = params.reason === "proposal_auth";

    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        formData.append("callbackUrl", callbackUrl);

        try {
            const result = isLogin
                ? await signInWithEmail(null, formData)
                : await signUpWithEmail(null, formData);

            if (!result.success) {
                setError(result.message || "Authentication failed");
            } else if (result.redirect) {
                router.push(result.redirect);
                router.refresh();
            }
        } catch (err) {
            console.error(err);
            setError("An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[75vh]">
            {isProposalReason && (
                <div className="max-w-md w-full mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <span className="font-bold block mb-0.5">Account Required to Request Proposal</span>
                        <span>To avail a service and request a proposal, please log in or create an account below. Your request will be directly submitted to your client dashboard.</span>
                    </div>
                </div>
            )}

            <Card className="max-w-md w-full glass-card border-primary/20 bg-black/90 shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold tracking-tight text-primary text-glow">
                        {isLogin ? "Sign In to Optrizo" : "Create an Account"}
                    </CardTitle>
                    <CardDescription>
                        {isLogin
                            ? "Enter your details to access your account & project dashboard."
                            : "Create an account to submit intake forms and track proposals."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="John Doe"
                                    required
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="you@company.com"
                                required
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary text-black font-bold hover:bg-primary/90 mt-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : isLogin ? (
                                "Sign In"
                            ) : (
                                "Create Account & Continue"
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-400">
                        {isLogin ? (
                            <p>
                                Don&apos;t have an account?{" "}
                                <button
                                    onClick={() => {
                                        setIsLogin(false);
                                        setError(null);
                                    }}
                                    className="text-primary hover:underline font-semibold ml-1"
                                >
                                    Sign Up
                                </button>
                            </p>
                        ) : (
                            <p>
                                Already have an account?{" "}
                                <button
                                    onClick={() => {
                                        setIsLogin(true);
                                        setError(null);
                                    }}
                                    className="text-primary hover:underline font-semibold ml-1"
                                >
                                    Log In
                                </button>
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
