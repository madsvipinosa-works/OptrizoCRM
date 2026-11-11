"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Bell,
    BriefcaseBusiness,
    CalendarDays,
    CheckCircle2,
    FileText,
    Layers,
    ListChecks,
    Loader2,
    MessageSquare,
    Paperclip,
    UserRound,
    Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/features/notifications/actions";
import { useRouter, usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Notification = {
    id: string;
    message: string;
    type: string | null;
    link: string | null;
    createdAt: Date;
    read: boolean;
};

/** The bell shows the first sentence (who, what, when); the rest ("Open Appointments to…") is what the click does. */
function summary(message: string) {
    const first = message.match(/^[\s\S]*?[.!?](?=\s+[A-Z]|$)/)?.[0];
    return first && first.length >= 20 ? first : message;
}

// One neutral icon per kind of update, so the list can be scanned without reading every line.
const TYPE_ICONS: Record<string, typeof Bell> = {
    meeting: CalendarDays,
    proposal: FileText,
    project: BriefcaseBusiness,
    milestone: CheckCircle2,
    task: ListChecks,
    payment: Wallet,
    document: Paperclip,
    file: Paperclip,
    service: Layers,
    lead: UserRound,
    feedback: MessageSquare,
};

export function NotificationBell() {
    const [mounted, setMounted] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    // Staff have a full notifications page; the client portal does not (yet), so no link there.
    const seeAllHref = pathname?.startsWith("/dashboard") ? "/dashboard/notifications" : null;

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchNotifications = async () => {
        try {
            // Recent read notifications stay listed (dimmed); only showing unread hid them for good once opened.
            const data = await getAllNotifications(20);
            setNotifications(data.map(n => ({ ...n, createdAt: new Date(n.createdAt) })));
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();

        const onFocus = () => fetchNotifications();
        window.addEventListener("focus", onFocus);

        const interval = setInterval(fetchNotifications, 15000);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
        };
    }, [pathname]);

    const handleRead = async (id: string, link: string | null) => {
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
        await markNotificationAsRead(id);

        if (link) {
            router.push(link);
        }
    };

    const handleMarkAllRead = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await markAllNotificationsAsRead();
    };

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative hover:bg-muted shrink-0 text-foreground rounded-xl">
                <Bell className="h-5 w-5 text-muted-foreground" />
            </Button>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;
    const badgeText = unreadCount > 9 ? "9+" : unreadCount > 0 ? `${unreadCount}` : "";
    const accessibleLabel = unreadCount > 0 ? `Notifications, ${badgeText} unread` : "Notifications";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative hover:bg-muted shrink-0 text-foreground rounded-xl transition-colors"
                    aria-label={accessibleLabel}
                >
                    <Bell className="h-5 w-5 text-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                            {badgeText}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            {/* Width fits a phone with an 8px gutter each side; each row shows the first sentence, up to 3 lines. */}
            <DropdownMenuContent
                align="end"
                collisionPadding={8}
                className="w-[min(24rem,calc(100vw-1rem))] rounded-xl p-0 shadow-lg"
            >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">
                        Notifications
                        {unreadCount > 0 && <span className="ml-2 font-normal text-muted-foreground">{unreadCount} new</span>}
                    </p>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="-my-1 rounded-md px-2 py-1 text-sm font-medium text-brand-deep transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            Mark all read
                        </button>
                    )}
                </div>

                <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1.5">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                            <p className="text-sm font-medium text-foreground">No notifications yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">Updates to your proposals and projects will appear here.</p>
                        </div>
                    ) : (
                        notifications.map((notif) => {
                            const Icon = TYPE_ICONS[notif.type ?? ""] ?? Bell;
                            return (
                                <DropdownMenuItem
                                    key={notif.id}
                                    className="flex cursor-pointer items-start gap-3 rounded-lg p-2.5 focus:bg-muted"
                                    onClick={() => handleRead(notif.id, notif.link)}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                                            notif.read ? "bg-muted text-muted-foreground" : "bg-brand-soft text-brand-deep"
                                        )}
                                    >
                                        <Icon className="size-4" strokeWidth={1.75} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={cn("block text-sm leading-snug line-clamp-3", notif.read ? "text-muted-foreground" : "text-foreground")}>
                                            {!notif.read && <span className="sr-only">Unread: </span>}
                                            {summary(notif.message)}
                                        </span>
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                                        </span>
                                    </span>
                                    {!notif.read && <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-brand-deep" />}
                                </DropdownMenuItem>
                            );
                        })
                    )}
                </div>

                {seeAllHref && (
                    <div className="border-t border-border p-1.5">
                        <DropdownMenuItem asChild className="justify-center rounded-lg py-2 text-sm font-medium text-brand-deep focus:bg-muted">
                            <Link href={seeAllHref}>See all notifications</Link>
                        </DropdownMenuItem>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
