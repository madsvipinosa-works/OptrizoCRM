"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE } from "@/components/admin/sidebar-cookie";

/**
 * Owns the sidebar width and moves the page with it.
 * Open: the panel is 232px and the page starts at 256px. Collapsed: an icon rail of 62px, page at 86px.
 * The toggle button or Ctrl/Cmd+B changes it. The choice is a cookie so the server draws the right width on first paint.
 */
export function AdminShell({
    user,
    initialExpanded,
    logoUrl,
    logoDarkUrl,
    children,
}: {
    user?: { name?: string | null; email?: string | null; image?: string | null; role?: string | null };
    initialExpanded: boolean;
    /** The website logo from site settings, light and dark versions (shown in the phone header). */
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(initialExpanded);
    // A keyboard toggle switches instantly; the slide is only for the button (keyboard actions never animate).
    const [instant, setInstant] = useState(false);

    const toggleExpanded = (fromKeyboard = false) => {
        setInstant(fromKeyboard);
        setExpanded((prev) => {
            const next = !prev;
            document.cookie = `${SIDEBAR_COOKIE}=${next ? "expanded" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
            return next;
        });
    };

    // Ctrl/Cmd+B, as in Linear, Vercel and VS Code. Left alone while typing: in a text field it means bold.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== "b" || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
            e.preventDefault();
            toggleExpanded(true);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    return (
        <TooltipProvider>
            <AdminSidebar user={user} expanded={expanded} instant={instant} onToggleExpanded={() => toggleExpanded(false)} logoUrl={logoUrl} logoDarkUrl={logoDarkUrl} />
            <main
                className={cn(
                    "relative z-10 min-h-screen min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pb-8 pt-24 sm:px-8 md:pt-8",
                    instant ? "transition-none" : "transition-[margin-left] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    expanded ? "md:ml-64" : "md:ml-[86px]",
                    "print:ml-0 print:p-0"
                )}
            >
                {children}
            </main>
        </TooltipProvider>
    );
}
