"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { UserNav } from "@/components/auth/UserNav";
import { LoginModal } from "@/components/auth/LoginModal";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import Link from "next/link";
import { LogoutConfirmDialog, signOutEverywhere } from "@/components/auth/LogoutConfirmDialog";

interface AuthProps {
    settings: {
        logoUrl?: string | null;
        logoDarkUrl?: string | null;
    } | null;
}

const ADMIN_ROLES = ["superadmin", "sales", "manager", "developer", "content_editor"];

export function NavbarAuthDesktop({ settings }: AuthProps) {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div className="flex items-center gap-2 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-muted/60" />
                <div className="w-24 h-9 rounded-xl bg-muted/60" />
            </div>
        );
    }

    if (session?.user) {
        const userRole = (session.user as any)?.role || "client";
        const isAdmin = ADMIN_ROLES.includes(userRole);

        return (
            <div className="flex items-center gap-2">
                <NotificationBell />
                <UserNav
                    user={session.user}
                    isAdmin={isAdmin}
                    onSignOut={signOutEverywhere}
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                <Button
                    variant="ghost"
                    className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
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

export function NavbarMobileBell() {
    const { data: session } = useSession();

    if (session?.user) {
        return <NotificationBell />;
    }

    return null;
}

export function NavbarAuthMobile({ settings }: AuthProps) {
    const { data: session, status } = useSession();
    const [logoutOpen, setLogoutOpen] = useState(false);

    if (status === "loading") {
        return (
            <div className="flex flex-col gap-3 animate-pulse">
                <div className="w-full h-12 rounded-lg bg-muted/50" />
                <div className="w-full h-12 rounded-lg bg-muted/50" />
            </div>
        );
    }

    if (session?.user) {
        const userRole = (session.user as any)?.role || "client";
        const isAdmin = ADMIN_ROLES.includes(userRole);

        return (
            <>
                <Button asChild variant="secondary" className="w-full rounded-lg h-12 font-semibold tracking-tight">
                    <Link href="/portal">My Dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-lg h-12 font-semibold tracking-tight border-border bg-card text-foreground">
                    <Link href="/portal">Availed Services</Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-lg h-12 font-semibold tracking-tight border-border bg-card text-foreground">
                    <Link href="/portal/settings">Account Settings</Link>
                </Button>
                {isAdmin && (
                    <Button asChild variant="outline" className="w-full rounded-lg h-12 font-semibold tracking-tight">
                        <Link href="/dashboard">Admin Panel</Link>
                    </Button>
                )}
                <Button
                    type="button"
                    onClick={() => setLogoutOpen(true)}
                    variant="outline"
                    className="w-full rounded-lg h-12 font-medium border-border"
                >
                    Log out
                </Button>
                <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} email={session.user.email} />
            </>
        );
    }

    return (
        <>
            <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                <Button variant="outline" className="w-full rounded-lg h-12 font-semibold border-border bg-card">
                    Login
                </Button>
            </LoginModal>
            <Button asChild className="w-full rounded-lg h-12 font-semibold tracking-tight">
                <Link href="/contact">Get Started</Link>
            </Button>
        </>
    );
}

export function NavbarAuthFallback({ settings, mobile }: { settings: AuthProps["settings"]; mobile?: boolean }) {
    if (mobile) {
        return (
            <div className="flex flex-col gap-3">
                <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                    <Button variant="outline" className="w-full rounded-lg h-12 font-semibold border-border bg-card">
                        Login
                    </Button>
                </LoginModal>
                <Button asChild className="w-full rounded-lg h-12 font-semibold tracking-tight">
                    <Link href="/contact">Get Started</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                <Button
                    variant="ghost"
                    className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
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
