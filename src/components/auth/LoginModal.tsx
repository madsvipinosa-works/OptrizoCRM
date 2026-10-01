"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  googleSignIn,
  signInWithEmail,
  signUpWithEmail,
  requestPasswordReset,
} from "@/features/auth/actions";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  Code2,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LoginModalProps {
  children?: React.ReactNode;
  defaultRedirect?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  customTitle?: string;
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
}

export function LoginModal({
  children,
  defaultRedirect,
  open,
  onOpenChange,
  logoUrl,
  logoDarkUrl,
}: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  function reset() {
    setError(null);
    setSuccessMessage(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    reset();

    const formData = new FormData(e.currentTarget);
    if (defaultRedirect) formData.append("callbackUrl", defaultRedirect);

    try {
      if (isResetting) {
        const result = await requestPasswordReset(null, formData);
        if (!result.success) setError(result.message || "An error occurred");
        else setSuccessMessage(result.message);
      } else {
        const result = isLogin
          ? await signInWithEmail(null, formData)
          : await signUpWithEmail(null, formData);

        if (!result.success) {
          setError(result.message || "An error occurred");
        } else if (result.redirect) {
          router.push(defaultRedirect || result.redirect);
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

  async function handleGoogle() {
    setIsGoogleLoading(true);
    try {
      await googleSignIn();
    } catch {
      setIsGoogleLoading(false);
    }
  }

  const title = isResetting
    ? "Reset Password"
    : isLogin
    ? "Welcome Back"
    : "Create Account";
  const subtitle = isResetting
    ? "We\u2019ll send a secure reset link to your email."
    : isLogin
    ? "Sign in to access your project dashboard."
    : "Join to track your projects and proposals.";

  const hasLogo = logoUrl || logoDarkUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}

      <DialogContent
        className={cn(
          "bg-background border-border",
          "backdrop-blur-xl shadow-2xl",
          "rounded-2xl sm:max-w-[420px] p-0 overflow-hidden"
        )}
      >
        {/* Top accent gradient bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

        {/* Subtle background glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-primary opacity-[0.06] blur-[50px] pointer-events-none" />

        <div className="relative px-7 pt-6 pb-7">
          {/* Logo + Title */}
          <div className="flex flex-col items-center text-center mb-5">
            {hasLogo ? (
              <div className="relative h-10 w-32 mb-4">
                {logoUrl && (
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    fill
                    className={cn(
                      "object-contain",
                      logoDarkUrl ? "dark:hidden" : ""
                    )}
                  />
                )}
                {logoDarkUrl && (
                  <Image
                    src={logoDarkUrl}
                    alt="Logo"
                    fill
                    className={cn(
                      "object-contain",
                      logoUrl ? "hidden dark:block" : ""
                    )}
                  />
                )}
              </div>
            ) : (
              <div className="h-10 w-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                <Code2 className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <DialogTitle className="text-xl font-bold text-foreground">
              {title}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Success banner */}
          {successMessage && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/25 text-primary rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <p>{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-3">
            {!isLogin && !isResetting && (
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-name"
                  className="text-[11px] font-medium text-muted-foreground block"
                >
                  Full Name
                </label>
                <input
                  id="modal-name"
                  name="name"
                  type="text"
                  placeholder="Jane Doe"
                  required
                  className={inputCls}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="modal-email"
                className="text-[11px] font-medium text-muted-foreground block"
              >
                Email Address
              </label>
              <input
                id="modal-email"
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                className={inputCls}
              />
            </div>

            {!isResetting && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="modal-password"
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetting(true);
                        reset();
                      }}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="modal-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className={cn(inputCls, "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Primary action button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full flex items-center justify-center gap-2 mt-1",
                "py-2.5 px-5 rounded-xl text-sm font-semibold",
                "bg-primary text-primary-foreground",
                "hover:brightness-110 active:scale-[0.98] transition-all duration-150",
                "shadow-lg shadow-primary/20",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isResetting
                    ? "Send Reset Link"
                    : isLogin
                    ? "Sign In"
                    : "Create Account"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle auth mode */}
          <p className="text-center text-[11px] text-muted-foreground mt-4">
            {isResetting ? (
              <button
                type="button"
                onClick={() => {
                  setIsResetting(false);
                  setIsLogin(true);
                  reset();
                }}
                className="text-primary hover:brightness-110 font-semibold transition-all"
              >
                ← Back to Log in
              </button>
            ) : isLogin ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    reset();
                  }}
                  className="text-primary hover:brightness-110 font-semibold transition-all"
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    reset();
                  }}
                  className="text-primary hover:brightness-110 font-semibold transition-all"
                >
                  Log in
                </button>
              </>
            )}
          </p>

          {/* Divider + Google */}
          {!isResetting && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                    or continue with
                  </span>
                </div>
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isGoogleLoading}
                className={cn(
                  "w-full flex items-center justify-center gap-2.5",
                  "py-2.5 px-5 rounded-xl text-sm font-medium text-foreground",
                  "bg-secondary/60 border border-border",
                  "hover:bg-secondary hover:border-border active:scale-[0.98]",
                  "transition-all duration-150",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
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
                    Continue with Google
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Theme-aware input class — uses CSS variables so it auto-adapts to light/dark
const inputCls = cn(
  "w-full px-4 py-2.5 rounded-xl text-sm text-foreground placeholder-muted-foreground/50",
  "bg-secondary/40 border border-border",
  "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/60",
  "transition-all duration-200"
);
