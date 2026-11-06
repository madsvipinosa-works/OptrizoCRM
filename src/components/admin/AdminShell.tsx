"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE } from "@/components/admin/sidebar-cookie";

/**
 * Owns the sidebar width and moves the page with it.
 * Open: the panel is 232px and the page starts at 256px. Collapsed: an icon rail of 62px, page at 86px.
 * Only the toggle button changes it. The choice is a cookie so the server draws the right width on first paint.
 */
export function AdminShell({
    user,
    initialExpanded,
    children,
}: {
    user?: { name?: string | null; email?: string | null; image?: string | null; role?: string | null };
    initialExpanded: boolean;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(initialExpanded);

    const toggleExpanded = () => {
        const next = !expanded;
        setExpanded(next);
        document.cookie = `${SIDEBAR_COOKIE}=${next ? "expanded" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
    };

    return (
        <TooltipProvider>
            <AdminSidebar user={user} expanded={expanded} onToggleExpanded={toggleExpanded} />
            <main
                className={cn(
                    "relative z-10 min-h-screen min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pb-8 pt-24 sm:px-8 md:pt-8",
                    "transition-[margin-left] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    expanded ? "md:ml-64" : "md:ml-[86px]",
                    "print:ml-0 print:p-0"
                )}
            >
                {children}
            </main>
        </TooltipProvider>
    );
}
