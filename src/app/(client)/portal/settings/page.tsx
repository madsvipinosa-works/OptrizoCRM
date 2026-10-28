import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ClientAccountSettings } from "@/features/client-portal/components/ClientAccountSettings";

export const dynamic = "force-dynamic";

export default async function ClientSettingsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login?callbackUrl=/portal/settings");
    return (
        <div className="space-y-6">
            <header>
                <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary">Your account</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Account settings</h1>
                <p className="mt-2 text-sm text-muted-foreground">Manage your profile and sign-in details.</p>
            </header>
            <ClientAccountSettings name={session.user.name ?? ""} email={session.user.email ?? ""} />
        </div>
    );
}
