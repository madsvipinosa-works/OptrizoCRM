"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getUnreadNotifications } from "@/features/notifications/actions";

/** The notifications page tells the sidebar when it marked things read, so the count updates at once. */
export const NOTIFICATIONS_CHANGED = "optrizo:notifications-changed";

/**
 * The "Notifications" row of the sidebar. It is a link to the page, like every other row,
 * with the unread count on the right (a dot on the icon in the rail).
 */
export function NotificationsNavLink({
    rail,
    active,
    scope,
    onNavigate,
    rowClass,
    idleClass,
}: {
    rail: boolean;
    active: boolean;
    scope: "desktop" | "mobile";
    onNavigate: () => void;
    rowClass: string;
    idleClass: string;
}) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const items = await getUnreadNotifications();
                if (!cancelled) setUnread(items.length);
            } catch {
                // Leave the last count in place; the next poll retries.
            }
        };
        load();
        window.addEventListener("focus", load);
        window.addEventListener(NOTIFICATIONS_CHANGED, load);
        const interval = setInterval(load, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
            window.removeEventListener("focus", load);
            window.removeEventListener(NOTIFICATIONS_CHANGED, load);
        };
    }, [pathname]);

    const countText = unread > 9 ? "9+" : String(unread);
    const label = unread > 0 ? `Notifications, ${countText} unread` : "Notifications";

    const link = (
        <Link
            href="/dashboard/notifications"
            aria-current={active ? "page" : undefined}
            aria-label={label}
            onClick={onNavigate}
            className={cn(rowClass, active ? "text-foreground" : idleClass)}
        >
            {active && (
                <motion.span
                    layoutId={`sidebar-active-${scope}`}
                    aria-hidden="true"
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 rounded-lg bg-brand-soft"
                />
            )}
            <span className="relative flex shrink-0">
                <Bell className={cn("size-4", active && "text-brand-deep")} strokeWidth={1.75} aria-hidden="true" />
                {rail && unread > 0 && (
                    <span aria-hidden="true" className="absolute -right-1 -top-1 size-2 rounded-full bg-brand-deep ring-2 ring-card" />
                )}
            </span>
            <span aria-hidden="true" className={cn("flex-1 truncate", rail ? "sr-only" : "relative")}>
                Notifications
            </span>
            {!rail && unread > 0 && (
                <span aria-hidden="true" className="relative min-w-5 rounded-full bg-brand-deep px-1.5 text-center text-xs font-semibold leading-5 text-background">
                    {countText}
                </span>
            )}
        </Link>
    );

    if (!rail) return link;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={20}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}
