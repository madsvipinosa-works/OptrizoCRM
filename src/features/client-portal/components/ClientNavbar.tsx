"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, LogOut, Settings } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";

const subscribeNoop = () => () => {};

const LINKS = [
    { href: "/portal", label: "Home", exact: true },
    { href: "/portal/proposals", label: "Proposals" },
    { href: "/portal/projects", label: "Projects" },
    { href: "/portal/appointments", label: "Appointments" },
    { href: "/portal/documents", label: "Documents" },
];

/**
 * Client portal top bar (mockup 089): wordmark with "Client portal", the five sections with the current one
 * underlined, and the client's name and company on the right. Replaces the public navbar and the old sidebar.
 */
export function ClientNavbar({
    name,
    company,
    email,
    logoUrl,
    logoDarkUrl,
}: {
    name: string;
    company?: string | null;
    email?: string | null;
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
}) {
    const pathname = usePathname();
    const [logoutOpen, setLogoutOpen] = useState(false);
    // The menu mounts after hydration: Radix ids generated during SSR did not match the browser here.
    const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
    const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-card print:hidden">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-6">
                <Link href="/portal" className="flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {/* The same logo as the website (site settings), light and dark versions. */}
                    {logoUrl || logoDarkUrl ? (
                        <span className="relative block h-8 w-28">
                            {logoUrl && <Image src={logoUrl} alt="Optrizo" fill priority sizes="112px" className={cn("object-contain object-left", logoDarkUrl && "dark:hidden")} />}
                            {logoDarkUrl && <Image src={logoDarkUrl} alt="Optrizo" fill priority sizes="112px" className={cn("object-contain object-left", logoUrl && "hidden dark:block")} />}
                        </span>
                    ) : (
                        <span className="text-base font-semibold tracking-tight text-foreground">Optrizo</span>
                    )}
                    <span className="hidden text-sm text-muted-foreground lg:inline">Client portal</span>
                </Link>

                <nav aria-label="Client portal" className="hidden h-full flex-1 items-stretch justify-center gap-1 md:flex">
                    {LINKS.map((l) => {
                        const active = isActive(l.href, l.exact);
                        return (
                            <Link
                                key={l.href}
                                href={l.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "relative flex items-center px-3 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                    active ? "font-semibold text-brand-deep" : "font-medium text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {l.label}
                                {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-deep" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="ml-auto flex items-center gap-1 md:ml-0">
                    <NotificationBell />
                    <ThemeToggle variant="icon" />
                    {/* Account pill, as on the public navbar: initials, name, and a menu. */}
                    {mounted ? (
                    <DropdownMenu>
                            <DropdownMenuTrigger className="ml-1 flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card pl-1.5 pr-2.5 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted">
                                <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                                    {initials}
                                </span>
                                <span className="hidden max-w-36 truncate text-sm font-semibold text-foreground sm:inline">{name}</span>
                                <span className="sr-only sm:hidden">Account menu for {name}</span>
                                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                                <DropdownMenuLabel className="font-normal">
                                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                                    {company && <p className="truncate text-sm text-muted-foreground">{company}</p>}
                                    {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/portal/settings">
                                        <Settings className="size-4" strokeWidth={1.75} aria-hidden="true" /> Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/">
                                        <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden="true" /> Back to website
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
                                    <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" /> Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <span className="ml-1 flex h-10 items-center gap-2 rounded-xl border border-border bg-card pl-1.5 pr-2.5 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted">
                            <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                                {initials}
                            </span>
                            <span className="hidden max-w-36 truncate text-sm font-semibold text-foreground sm:inline">{name}</span>
                            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                    )}
                </div>
            </div>

            {/* Phones: the sections scroll sideways under the bar. */}
            <nav aria-label="Client portal" className="flex gap-1 overflow-x-auto border-t border-border px-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                {LINKS.map((l) => {
                    const active = isActive(l.href, l.exact);
                    return (
                        <Link
                            key={l.href}
                            href={l.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "relative flex h-11 shrink-0 items-center px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                active ? "font-semibold text-brand-deep" : "font-medium text-muted-foreground"
                            )}
                        >
                            {l.label}
                            {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-deep" />}
                        </Link>
                    );
                })}
            </nav>

            <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} email={email} />
        </header>
    );
}
