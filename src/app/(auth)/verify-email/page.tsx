import { verifyEmail } from "@/features/auth/actions";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    const { token } = await searchParams;

    if (!token) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-md glass-card rounded-2xl border border-border p-8 text-center space-y-4 shadow-lg">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
                        Missing Verification Token
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        The verification link is invalid or incomplete. Sign up again with the same email to get a new verification link.
                    </p>
                    <div className="pt-2">
                        <Button asChild className="w-full">
                            <Link href="/login">Return to Sign In</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const result = await verifyEmail(token);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md glass-card rounded-2xl border border-border p-8 text-center space-y-5 shadow-lg animate-in fade-in zoom-in-95 duration-500">
                {result.success ? (
                    <>
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="space-y-1.5">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
                                Email Verified!
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {result.message || "Your client account is now active. You can now sign in to access your projects and proposals."}
                            </p>
                        </div>
                        <div className="pt-3">
                            <Button asChild className="w-full font-semibold">
                                <Link href="/login?verified=true">
                                    Sign In to Client Portal <ArrowRight className="w-4 h-4 ml-1.5" />
                                </Link>
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="space-y-1.5">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
                                Verification Failed
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {result.message || "This verification link is invalid or has already expired. Sign up again with the same email to get a new verification link."}
                            </p>
                        </div>
                        <div className="pt-3 space-y-2">
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/login">Return to Sign In</Link>
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
