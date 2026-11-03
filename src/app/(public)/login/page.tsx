"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithEmail, signUpWithEmail, googleSignIn } from "@/features/auth/actions";
import { Loader2, AlertCircle, ShieldAlert, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [signupSuccess, setSignupSuccess] = useState<string | null>(null);
    const router = useRouter();
    const { update: updateSession } = useSession();

    function resetForm() {
        setError(null);
        setFieldErrors({});
        setSignupSuccess(null);
        setPasswordInput("");
        setConfirmPasswordInput("");
    }

    async function handleGoogle() {
        setIsGoogleLoading(true);
        setError(null);
        try {
            await googleSignIn(callbackUrl);
        } catch (err) {
            console.error(err);
            setIsGoogleLoading(false);
            setError("Google sign-in was canceled or failed.");
        }
    }

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (!isLogin && passwordInput !== confirmPasswordInput) {
            setFieldErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match." }));
            return;
        }

        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        formData.append("callbackUrl", callbackUrl);

        try {
            if (isLogin) {
                const result = await signInWithEmail(null, formData);
                if (!result.success) {
                    setError(result.message || "Authentication failed");
                } else if (result.redirect) {
                    try {
                        await updateSession();
                    } catch {
                        // Non-blocking session refresh
                    }
                    router.push(result.redirect);
                    router.refresh();
                }
            } else {
                const result = await signUpWithEmail(null, formData);
                if (!result.success) {
                    setError(result.message || "Registration failed");
                    if (result.fieldErrors) {
                        setFieldErrors(result.fieldErrors);
                    }
                } else {
                    // Dedicated "Check your email" state with returned message, do NOT sign in
                    setSignupSuccess(result.message || "Verification email sent. Please check your inbox to activate your account.");
                }
            }
        } catch (err) {
            console.error(err);
            setError("An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 py-24 overflow-hidden bg-background">
            {/* Ambient background glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

            {isProposalReason && (
                <div className="max-w-md w-full mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-start gap-3 shadow-sm z-10">
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <span className="font-bold block mb-0.5">Account Required to Request Proposal</span>
                        <span>To avail a service and request a proposal, please log in or create an account below. Your request will be directly submitted to your client dashboard.</span>
                    </div>
                </div>
            )}

            <Card className="max-w-md w-full glass-card border-border bg-card/90 backdrop-blur-xl shadow-2xl relative z-10 rounded-2xl">
                {/* Top decorative accent line */}
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-60 rounded-t-2xl" />

                <CardHeader className="text-center pt-8 pb-4">
                    <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                        {signupSuccess
                            ? "Check Your Email"
                            : isLogin
                            ? "Sign In to Optrizo"
                            : "Create an Account"}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                        {signupSuccess
                            ? "Please verify your email address to activate your account."
                            : isLogin
                            ? "Enter your details to access your account & project dashboard."
                            : "Create an account to submit intake forms and track proposals."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-6 sm:px-8 pb-8 space-y-5">
                    {/* Error banner */}
                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {signupSuccess ? (
                        <div className="py-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">
                                    Check your email
                                </h2>
                                <p className="text-sm text-muted-foreground leading-relaxed px-2">
                                    {signupSuccess}
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => {
                                    setIsLogin(true);
                                    resetForm();
                                }}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl py-5 shadow-md flex items-center justify-center gap-2 mt-4"
                            >
                                <span>Sign In to Your Account</span>
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Google OAuth Sign-In Button */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGoogle}
                                disabled={isGoogleLoading || isLoading}
                                className="w-full flex items-center justify-center gap-3 py-5 rounded-xl border border-border hover:bg-muted/80 bg-background text-foreground font-semibold shadow-xs transition-all duration-200"
                            >
                                {isGoogleLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                        <span>Continue with Google</span>
                                    </>
                                )}
                            </Button>

                            {/* Divider */}
                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-3 text-muted-foreground font-mono text-[10px] tracking-widest">
                                        Or continue with email
                                    </span>
                                </div>
                            </div>

                            {/* Email/Password Form */}
                            <form onSubmit={onSubmit} className="space-y-4">
                                {!isLogin && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="name" className="text-xs font-medium text-foreground">
                                            Full Name
                                        </Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            placeholder="John Doe"
                                            required
                                            className={cn("bg-background border-border text-foreground rounded-xl", fieldErrors.name && "border-destructive")}
                                        />
                                        {fieldErrors.name && (
                                            <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-xs font-medium text-foreground">
                                        Email Address
                                    </Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="you@company.com"
                                        required
                                        className={cn("bg-background border-border text-foreground rounded-xl", fieldErrors.email && "border-destructive")}
                                    />
                                    {fieldErrors.email && (
                                        <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-xs font-medium text-foreground">
                                            Password
                                        </Label>
                                        {isLogin && (
                                            <Link
                                                href="/reset-password"
                                                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                Forgot password?
                                            </Link>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            required
                                            minLength={8}
                                            value={passwordInput}
                                            onChange={(e) => setPasswordInput(e.target.value)}
                                            className={cn("bg-background border-border text-foreground pr-10 rounded-xl", fieldErrors.password && "border-destructive")}
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
                                    {fieldErrors.password && (
                                        <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                                    )}
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

                                {!isLogin && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                                            Confirm Password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="confirmPassword"
                                                name="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                required
                                                minLength={8}
                                                value={confirmPasswordInput}
                                                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                                                className={cn("bg-background border-border text-foreground pr-10 rounded-xl", fieldErrors.confirmPassword && "border-destructive")}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                aria-label="Toggle confirm password visibility"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {fieldErrors.confirmPassword && (
                                            <p className="text-xs text-destructive mt-1">{fieldErrors.confirmPassword}</p>
                                        )}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    disabled={isLoading || isGoogleLoading || (!isLogin && (passwordInput.length < 8 || !/[A-Z]/.test(passwordInput) || !/[^a-zA-Z]/.test(passwordInput) || passwordInput !== confirmPasswordInput))}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl py-5 shadow-md flex items-center justify-center gap-2 mt-2"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <span>{isLogin ? "Sign In" : "Create Account & Continue"}</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </form>

                            {/* Toggle Login / Signup */}
                            <div className="pt-2 text-center text-sm text-muted-foreground">
                                {isLogin ? (
                                    <p>
                                        Don&apos;t have an account?{" "}
                                        <button
                                            onClick={() => {
                                                setIsLogin(false);
                                                resetForm();
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
                                                resetForm();
                                            }}
                                            className="text-primary hover:underline font-semibold ml-1"
                                        >
                                            Log In
                                        </button>
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
