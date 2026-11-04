import { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
    title: "Accept Staff Invitation - Optrizo",
    description: "Activate your Optrizo staff account and set your password.",
};

export default async function AcceptInvitePage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    // GET request: purely reads token from query parameters without database access or token consumption
    const params = await searchParams;
    const token = params.token;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <span className="text-xl font-bold tracking-tight text-[#0e6b7e]">OPTRIZO</span>
                    <h1 className="text-2xl font-bold text-foreground">Staff Account Setup</h1>
                    <p className="text-sm text-muted-foreground">
                        Set your password to accept your invitation and activate your staff account.
                    </p>
                </div>

                {!token ? (
                    <div className="bg-card border border-border rounded-xl p-8 shadow-xl text-center space-y-4">
                        <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-foreground">Missing Invitation Token</h2>
                        <p className="text-sm text-muted-foreground">
                            No invitation link token was found. Please check your invitation email and use the complete link provided.
                        </p>
                        <Link href="/login" className="inline-block text-primary text-sm font-semibold hover:underline">
                            Return to Sign In
                        </Link>
                    </div>
                ) : (
                    <AcceptInviteForm token={token} />
                )}
            </div>
        </div>
    );
}
