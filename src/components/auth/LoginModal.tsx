"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { googleSignIn, signInWithEmail, signUpWithEmail, requestPasswordReset } from "@/features/auth/actions";
import { Chrome, Loader2, AlertCircle, CheckCircle } from "lucide-react";

export function LoginModal({ children }: { children: React.ReactNode }) {
    const [isLogin, setIsLogin] = useState(true);
    const [isResetting, setIsResetting] = useState(false); // New state flag
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const router = useRouter();

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        
        const formData = new FormData(e.currentTarget);
        
        try {
            if (isResetting) {
                const result = await requestPasswordReset(null, formData);
                if (!result.success) {
                    setError(result.message || "An error occurred");
                } else {
                    setSuccessMessage(result.message);
                }
            } else {
                const result = isLogin 
                    ? await signInWithEmail(null, formData)
                    : await signUpWithEmail(null, formData);
                    
                if (!result.success) {
                    setError(result.message || "An error occurred");
                } else if (result.redirect) {
                    // On success, redirect to dashboard and refresh to update session
                    router.push(result.redirect);
                    router.refresh();
                }
            }
        } catch (err) {
            console.error(err);
            setError("A network error occurred.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-primary/20 bg-black/95 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-center text-primary text-glow">
                        {isResetting ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {isResetting ? "Enter your email to receive a secure reset link." : isLogin ? "Sign in to access your dashboard and projects." : "Enter your details to register."}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Flags */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-md text-sm flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            <p>{successMessage}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={onSubmit} className="space-y-4">
                        {!isLogin && !isResetting && (
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                                <Input 
                                    id="name" 
                                    name="name" 
                                    placeholder="John Doe" 
                                    required 
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-primary/50" 
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                            <Input 
                                id="email" 
                                name="email" 
                                type="email" 
                                placeholder="you@example.com" 
                                required 
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-primary/50" 
                            />
                        </div>
                        
                        {!isResetting && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-gray-300">Password</Label>
                                    {isLogin && (
                                        <button 
                                            type="button" 
                                            onClick={() => { setIsResetting(true); setError(null); setSuccessMessage(null); }} 
                                            className="text-xs text-primary hover:underline"
                                        >
                                            Forgot password?
                                        </button>
                                    )}
                                </div>
                                <Input 
                                    id="password" 
                                    name="password" 
                                    type="password" 
                                    required 
                                    minLength={6}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-primary/50" 
                                />
                            </div>
                        )}

                        <Button type="submit" disabled={isLoading} className="w-full h-11 text-base font-semibold">
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                isResetting ? "Send Reset Link" : isLogin ? "Sign In" : "Register"
                            )}
                        </Button>
                    </form>

                    {/* Toggle Auth Mode */}
                    <div className="text-center text-sm text-gray-400 mt-2">
                        {isResetting ? (
                            <button 
                                type="button" 
                                onClick={() => { setIsResetting(false); setIsLogin(true); setError(null); setSuccessMessage(null); }}
                                className="text-primary hover:underline font-medium"
                            >
                                Back to Log in
                            </button>
                        ) : (
                            <>
                                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                                <button 
                                    type="button" 
                                    onClick={() => { setIsLogin(!isLogin); setError(null); setSuccessMessage(null); }}
                                    className="text-primary hover:underline font-medium"
                                >
                                    {isLogin ? "Sign up" : "Log in"}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-black/95 px-2 text-muted-foreground">Or continue with</span>
                        </div>
                    </div>

                    {/* Google OAuth alternative */}
                    <form action={googleSignIn}>
                        <Button
                            variant="outline"
                            className="w-full relative h-11 border-white/10 hover:bg-white/5 hover:text-white"
                            type="submit"
                        >
                            <Chrome className="mr-2 h-4 w-4" />
                            Google
                        </Button>
                    </form>

                </div>
            </DialogContent>
        </Dialog>
    );
}
