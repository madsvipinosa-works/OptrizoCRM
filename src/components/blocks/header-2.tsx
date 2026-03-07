'use client';

import React, { useTransition } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import Link from 'next/link';
import Image from 'next/image';
import { Code2 } from 'lucide-react';
import { LoginModal } from '@/components/auth/LoginModal';

import { ShineBorder } from '@/components/ui/shine-border';

export type HeaderProps = {
    session: {
        user: {
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role?: string | null;
        };
    } | null;
    isAdmin: boolean;
    settings: {
        logoUrl?: string | null;
    } | null;
    navLinks: { href: string; label: string }[];
    onSignOut: () => Promise<void>;
};

export function Header({ session, isAdmin, settings, navLinks, onSignOut }: HeaderProps) {
    const [open, setOpen] = React.useState(false);
    const scrolled = useScroll(10);
    const [isPending, startTransition] = useTransition();

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
                'fixed top-0 z-50 left-0 right-0 mx-auto w-full transition-all duration-500 ease-out',
                {
                    'max-w-[1400px] md:top-0': !scrolled,
                    'md:max-w-5xl md:top-4': scrolled && !open,
                },
            )}
        >
            <ShineBorder
                duration={8}
                borderWidth={3}
                color={["#39ff14", "#ffffff", "#39ff14"]} // Neon green with bright white center for extra glow
                className={cn(
                    'w-full bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl transition-all duration-500 ease-out p-0 border border-border/50',
                    {
                        'rounded-xl': !scrolled,
                        'rounded-2xl shadow-lg shadow-primary/5': scrolled && !open,
                        'rounded-none': open,
                    }
                )}
            >
                <nav
                    className={cn(
                        'flex w-full items-center justify-between px-4 md:px-6 transition-all duration-500 ease-out',
                        {
                            'h-16 md:h-14': scrolled,
                            'h-16 md:h-20': !scrolled,
                        }
                    )}
                >
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2 group">
                        {settings?.logoUrl ? (
                            <div className="relative h-9 w-28">
                                <Image
                                    src={settings.logoUrl}
                                    alt="Logo"
                                    fill
                                    className="object-contain object-left"
                                />
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
                    <div className="hidden items-center gap-2 md:flex">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                className={cn(buttonVariants({ variant: 'ghost' }), 'font-medium rounded-xl hover:bg-accent/80')}
                                href={link.href}
                            >
                                {link.label}
                            </Link>
                        ))}

                        <div className="w-px h-6 bg-border mx-2" />

                        {session ? (
                            <>
                                {isAdmin && (
                                    <Button asChild variant="secondary" className="font-semibold rounded-xl tracking-tight">
                                        <Link href="/dashboard">Dashboard</Link>
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    className="font-medium text-muted-foreground hover:text-red-500 rounded-xl hover:bg-red-950/20"
                                    onClick={() => startTransition(async () => {
                                        await onSignOut();
                                    })}
                                    disabled={isPending}
                                >
                                    {isPending ? 'Signing out...' : 'Sign Out'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <LoginModal>
                                    <Button variant="ghost" className="font-medium rounded-xl hover:bg-accent/80">
                                        Login
                                    </Button>
                                </LoginModal>
                                <Button asChild className="font-semibold tracking-tight rounded-xl shadow-sm hover:shadow-md hover:box-glow transition-all">
                                    <Link href="/contact">Get Started</Link>
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Mobile Toggle */}
                    <Button size="icon" variant="outline" onClick={() => setOpen(!open)} className="md:hidden rounded-xl bg-transparent border-border/50">
                        <MenuToggleIcon open={open} className="size-5" />
                    </Button>
                </nav>
            </ShineBorder>

            {/* Mobile Menu */}
            <div
                className={cn(
                    'bg-background/95 fixed inset-x-0 top-[4.5rem] bottom-0 z-50 flex flex-col overflow-hidden border-t md:hidden backdrop-blur-xl',
                    open ? 'block' : 'hidden',
                )}
            >
                <div
                    data-slot={open ? 'open' : 'closed'}
                    className={cn(
                        'data-[slot=open]:animate-in data-[slot=open]:slide-in-from-bottom-4 data-[slot=closed]:animate-out data-[slot=closed]:slide-out-to-bottom-4 ease-out',
                        'flex h-full w-full flex-col justify-between gap-y-4 p-6',
                    )}
                >
                    <div className="grid gap-y-2">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                className={cn(buttonVariants({
                                    variant: 'ghost',
                                }), 'justify-start text-lg font-semibold tracking-tight rounded-xl h-12')}
                                href={link.href}
                                onClick={() => setOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                    <div className="flex flex-col gap-3">
                        {session ? (
                            <>
                                {isAdmin && (
                                    <Button asChild variant="secondary" className="w-full rounded-xl h-12 font-semibold tracking-tight">
                                        <Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    className="w-full rounded-xl h-12 font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    onClick={() => startTransition(async () => {
                                        await onSignOut();
                                        setOpen(false);
                                    })}
                                    disabled={isPending}
                                >
                                    {isPending ? '...' : 'Sign Out'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <LoginModal>
                                    <Button variant="outline" className="w-full rounded-xl h-12 font-medium border-border/50">
                                        Login
                                    </Button>
                                </LoginModal>
                                <Button asChild className="w-full rounded-xl h-12 font-semibold tracking-tight shadow-md">
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
