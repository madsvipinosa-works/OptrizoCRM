import { auth, signOut, hasRole } from "@/auth";
import { UserNav } from "@/components/auth/UserNav";
import { LoginModal } from "@/components/auth/LoginModal";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import Link from "next/link";

interface AuthProps {
    settings: {
        logoUrl?: string | null;
        logoDarkUrl?: string | null;
    } | null;
}

const handleSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
};

export async function NavbarAuthDesktop({ settings }: AuthProps) {
    let session = null;
    try {
        session = await auth();
    } catch {
        // Fallback to guest mode on any session read error
    }

    if (session?.user) {
        const isAdmin = hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"]);
        return (
            <div className="flex items-center gap-2">
                <NotificationBell />
                <UserNav
                    user={session.user}
                    isAdmin={isAdmin}
                    onSignOut={handleSignOut}
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                <Button
                    variant="ghost"
                    className="font-medium rounded-xl border border-transparent hover:border-[#34E513]/60 hover:text-foreground dark:hover:text-white hover:bg-[#34E513]/10 hover:shadow-[0_0_12px_rgba(52,229,19,0.4)] transition-all"
                >
                    Login
                </Button>
            </LoginModal>
            <Button asChild className="font-semibold tracking-tight rounded-xl shadow-sm hover:shadow-md hover:box-glow transition-all">
                <Link href="/contact">Get Started</Link>
            </Button>
        </div>
    );
}

export async function NavbarMobileBell() {
    let session = null;
    try {
        session = await auth();
    } catch {
        return null;
    }

    if (session?.user) {
        return <NotificationBell />;
    }

    return null;
}

export async function NavbarAuthMobile({ settings }: AuthProps) {
    let session = null;
    try {
        session = await auth();
    } catch {
        // Fallback to guest mode
    }

    if (session?.user) {
        const isAdmin = hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"]);
        return (
            <>
                <Button asChild variant="secondary" className="w-full rounded-xl h-12 font-semibold tracking-tight">
                    <Link href="/portal">My Dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-xl h-12 font-semibold tracking-tight border-border bg-card text-foreground">
                    <Link href="/portal/services">Availed Services</Link>
                </Button>
                {isAdmin && (
                    <Button asChild variant="outline" className="w-full rounded-xl h-12 font-semibold tracking-tight">
                        <Link href="/dashboard">Admin Panel</Link>
                    </Button>
                )}
                <form action={handleSignOut} className="w-full">
                    <Button
                        type="submit"
                        variant="outline"
                        className="w-full rounded-xl h-12 font-medium text-destructive hover:bg-destructive/10 border-border"
                    >
                        Log out
                    </Button>
                </form>
            </>
        );
    }

    return (
        <>
            <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                <Button variant="outline" className="w-full rounded-xl h-12 font-medium border-border/50">
                    Login
                </Button>
            </LoginModal>
            <Button asChild className="w-full rounded-xl h-12 font-semibold tracking-tight shadow-md">
                <Link href="/contact">Get Started</Link>
            </Button>
        </>
    );
}

export function NavbarAuthFallback({ settings, mobile }: { settings: AuthProps["settings"]; mobile?: boolean }) {
    if (mobile) {
        return (
            <>
                <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                    <Button variant="outline" className="w-full rounded-xl h-12 font-medium border-border/50">
                        Login
                    </Button>
                </LoginModal>
                <Button asChild className="w-full rounded-xl h-12 font-semibold tracking-tight shadow-md">
                    <Link href="/contact">Get Started</Link>
                </Button>
            </>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                <Button
                    variant="ghost"
                    className="font-medium rounded-xl border border-transparent hover:border-[#34E513]/60 hover:text-foreground dark:hover:text-white hover:bg-[#34E513]/10 hover:shadow-[0_0_12px_rgba(52,229,19,0.4)] transition-all"
                >
                    Login
                </Button>
            </LoginModal>
            <Button asChild className="font-semibold tracking-tight rounded-xl shadow-sm hover:shadow-md hover:box-glow transition-all">
                <Link href="/contact">Get Started</Link>
            </Button>
        </div>
    );
}
