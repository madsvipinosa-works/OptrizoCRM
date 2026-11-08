'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Code2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { LoginModal } from '@/components/auth/LoginModal';
import { UserNav } from '@/components/auth/UserNav';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { NotificationBell } from '@/components/layout/NotificationBell';

export type HeaderProps = {
    session?: {
        user: {
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role?: string | null;
        };
    } | null;
    isAdmin?: boolean;
    settings: {
        logoUrl?: string | null;
        logoDarkUrl?: string | null;
    } | null;
    navLinks: { href: string; label: string }[];
    onSignOut?: () => Promise<void>;
    authSlot?: React.ReactNode;
    mobileAuthSlot?: React.ReactNode;
    mobileBellSlot?: React.ReactNode;
};

export function Header({
    session,
    isAdmin = false,
    settings,
    navLinks,
    onSignOut,
    authSlot,
    mobileAuthSlot,
    mobileBellSlot,
}: HeaderProps) {
    const [open, setOpen] = React.useState(false);
    const [logoutOpen, setLogoutOpen] = React.useState(false);
    const scrolled = useScroll(10);
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    // Current page: exact match for Home, prefix match for sections (e.g. /services/web-dev).
    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

    // Automatically close the mobile menu on route change
    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // The mobile menu only exists below md. If the screen widens while it is open, close it,
    // or the desktop bar keeps its square "menu open" shape and the page stays scroll-locked.
    React.useEffect(() => {
        const md = window.matchMedia('(min-width: 768px)');
        const close = () => md.matches && setOpen(false);
        close();
        md.addEventListener('change', close);
        return () => md.removeEventListener('change', close);
    }, []);

    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <header
            className={cn(
                'fixed top-0 z-50 left-0 right-0 mx-auto w-full transition-[max-width,top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] print:hidden',
                {
                    'max-w-[1400px] md:top-0': !scrolled,
                    'md:max-w-5xl md:top-4': scrolled && !open,
                },
            )}
        >
            {/* Plain bar in the client palette: no animated border, no glow. */}
            <div
                className={cn(
                    'w-full border border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 transition-[border-radius,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    {
                        'rounded-xl': !scrolled,
                        'rounded-2xl shadow-[0_8px_24px_-12px_rgba(11,15,20,0.18)]': scrolled && !open,
                        'rounded-none': open,
                    }
                )}
            >
                <nav
                    className={cn(
                        'flex w-full items-center justify-between px-4 md:px-6 transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                        {
                            'h-16 md:h-14': scrolled,
                            'h-16 md:h-20': !scrolled,
                        }
                    )}
                >
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2 group">
                        {settings?.logoUrl || settings?.logoDarkUrl ? (
                            <div className="relative h-9 w-28">
                                {settings.logoUrl && (
                                    <Image
                                        src={settings.logoUrl}
                                        alt="Logo"
                                        fill
                                        priority
                                        sizes="112px"
                                        quality={80}
                                        className={cn(
                                            "object-contain object-left",
                                            settings.logoDarkUrl
                                                ? "dark:hidden"
                                                : "dark:[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.95))_drop-shadow(0_0_4px_rgba(255,255,255,0.4))] transition-[filter] duration-300"
                                        )}
                                    />
                                )}
                                {settings.logoDarkUrl && (
                                    <Image
                                        src={settings.logoDarkUrl}
                                        alt="Logo Dark"
                                        fill
                                        priority
                                        sizes="112px"
                                        quality={80}
                                        className={cn(
                                            "object-contain object-left",
                                            settings.logoUrl ? "hidden dark:block" : ""
                                        )}
                                    />
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
                                    <Code2 className="h-5 w-5 text-primary-foreground" />
                                </div>
                                <span className="text-xl font-bold font-mono tracking-tight group-hover:opacity-80 transition-opacity">
                                    OPTRIZO
                                </span>
                            </>
                        )}
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden items-center gap-1 md:flex">
                        {navLinks.map((link) => {
                            const active = isActive(link.href);
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'relative rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring',
                                        active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {link.label}
                                    {/* Current-page marker: slides to the new link on navigation. */}
                                    {active && (
                                        <motion.span
                                            layoutId="nav-active-indicator"
                                            aria-hidden="true"
                                            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                            className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-deep"
                                        />
                                    )}
                                </Link>
                            );
                        })}

                        <div className="mx-2 h-6 w-px bg-border" />

                        <ThemeToggle variant="icon" />

                        {authSlot !== undefined ? (
                            authSlot
                        ) : session ? (
                            <div className="flex items-center gap-2">
                                <NotificationBell />
                                <UserNav
                                    user={session.user}
                                    isAdmin={isAdmin}
                                    onSignOut={async () => {
                                        if (onSignOut) await onSignOut();
                                    }}
                                />
                            </div>
                        ) : (
                            <>
                                <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                                    <Button
                                        variant="ghost"
                                        className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                                    >
                                        Login
                                    </Button>
                                </LoginModal>
                                <Button asChild className="h-9 rounded-lg px-4 text-sm font-semibold transition-[background-color,transform] duration-150 ease-out hover:bg-primary/90 active:scale-[0.97]">
                                    <Link href="/contact">Get Started</Link>
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Mobile Actions */}
                    <div className="flex items-center gap-2 md:hidden">
                        {mobileBellSlot !== undefined ? (
                            mobileBellSlot
                        ) : (
                            session && <NotificationBell />
                        )}
                        <ThemeToggle variant="icon" />
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={() => setOpen(!open)}
                            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
                            className="rounded-xl bg-transparent border-border/50"
                        >
                            <MenuToggleIcon open={open} className="size-5" />
                        </Button>
                    </div>
                </nav>
            </div>

            {/* Mobile menu. Always mounted so it can animate out too; inert and hidden when closed.
                Emil: 200ms ease-out, small travel, links follow in a short stagger, no motion when reduced. */}
            <div
                aria-hidden={!open}
                inert={!open}
                className={cn(
                    'fixed inset-x-0 top-[4.5rem] bottom-0 z-50 flex flex-col border-t border-border bg-background md:hidden',
                    'transition-[opacity,transform,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                    open ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible -translate-y-2 opacity-0',
                )}
            >
                <div className="flex h-full w-full flex-col justify-between gap-y-6 overflow-y-auto px-6 pt-6 pb-8">
                    <nav aria-label="Main" className="grid gap-y-1">
                        {navLinks.map((link, i) => {
                            const active = isActive(link.href);
                            return (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() => setOpen(false)}
                                    style={{ transitionDelay: open ? `${40 + i * 35}ms` : '0ms' }}
                                    className={cn(
                                        'flex h-14 items-center rounded-lg px-4 text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        'transition-[color,background-color,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                                        open ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
                                        active ? 'bg-brand-soft text-brand-deep' : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <div
                        style={{ transitionDelay: open ? `${40 + navLinks.length * 35}ms` : '0ms' }}
                        className={cn(
                            'flex flex-col gap-3 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                            open ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
                        )}
                        onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("a, button:not([data-nested])")) {
                                setOpen(false);
                            }
                        }}
                    >
                        {mobileAuthSlot !== undefined ? (
                            mobileAuthSlot
                        ) : session ? (
                            <>
                                <Button asChild variant="secondary" className="w-full rounded-lg h-12 font-semibold tracking-tight">
                                    <Link href="/portal" onClick={() => setOpen(false)}>My Dashboard</Link>
                                </Button>
                                <Button asChild variant="outline" className="w-full rounded-lg h-12 font-semibold tracking-tight border-border bg-card text-foreground">
                                    <Link href="/portal" onClick={() => setOpen(false)}>Availed Services</Link>
                                </Button>
                                {isAdmin && (
                                    <Button asChild variant="outline" className="w-full rounded-lg h-12 font-semibold tracking-tight">
                                        <Link href="/dashboard" onClick={() => setOpen(false)}>Admin Panel</Link>
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    className="w-full rounded-lg h-12 font-medium border-border"
                                    onClick={() => setLogoutOpen(true)}
                                >
                                    Log out
                                </Button>
                                <LogoutConfirmDialog
                                    open={logoutOpen}
                                    onOpenChange={setLogoutOpen}
                                    email={session.user?.email}
                                    onConfirm={async () => {
                                        if (onSignOut) await onSignOut();
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <LoginModal logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                                    <Button variant="outline" className="w-full rounded-lg h-12 font-semibold border-border bg-card">
                                        Login
                                    </Button>
                                </LoginModal>
                                <Button asChild className="w-full rounded-lg h-12 font-semibold tracking-tight">
                                    <Link href="/contact" onClick={() => setOpen(false)}>Get Started</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
