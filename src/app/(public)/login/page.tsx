"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithEmail, signUpWithEmail } from "@/features/auth/actions";
import { Loader2, AlertCircle, ShieldAlert, Eye, EyeOff } from "lucide-react";
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
    const [showPassword, setShowPassword] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
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

            <Card className="max-w-md w-full glass-card border-border bg-card shadow-2xl">
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
                                    className="bg-background border-border text-foreground"
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
                                className="bg-background border-border text-foreground"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    required
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    className="bg-background border-border text-foreground pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label="Toggle password visibility"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {!isLogin && (
                                <div className="mt-2 space-y-1">
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                                        <div className={`h-full flex-1 ${passwordInput.length > 0 ? (passwordInput.length >= 8 ? 'bg-green-500' : 'bg-red-500') : 'bg-transparent'}`}></div>
                                        <div className={`h-full flex-1 ${passwordInput.length >= 8 && /[A-Z]/.test(passwordInput) ? 'bg-green-500' : passwordInput.length >= 8 ? 'bg-yellow-500' : 'bg-transparent'}`}></div>
                                        <div className={`h-full flex-1 ${passwordInput.length >= 8 && /[A-Z]/.test(passwordInput) && /[^a-zA-Z]/.test(passwordInput) ? 'bg-green-500' : 'bg-transparent'}`}></div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {passwordInput.length === 0 ? "Enter a password" : 
                                         passwordInput.length < 8 ? "Too short (min 8 characters)" : 
                                         !(/[A-Z]/.test(passwordInput)) ? "Add an uppercase letter" :
                                         !(/[^a-zA-Z]/.test(passwordInput)) ? "Add a number or symbol" : "Strong password"}
                                    </p>
                                </div>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading || (!isLogin && (passwordInput.length < 8 || !/[A-Z]/.test(passwordInput) || !/[^a-zA-Z]/.test(passwordInput)))}
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

                    <div className="mt-6 text-center text-sm text-muted-foreground">
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
