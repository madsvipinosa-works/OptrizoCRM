"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    getAllNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from "@/features/notifications/actions";
import { NOTIFICATIONS_CHANGED } from "@/components/admin/NotificationsNavLink";

type Item = {
    id: string;
    message: string;
    type: string | null;
    link: string | null;
    createdAt: Date;
    read: boolean;
};

const TYPE_LABEL: Record<string, string> = {
    proposal: "Proposal",
    milestone: "Milestone",
    document: "Document",
    project: "Project",
    task: "Task",
    service: "Service",
};

const tellSidebar = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

/** Step Ref · notifications: updates from the system. Unread items have a dot. */
export default function NotificationsPage() {
    const router = useRouter();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await getAllNotifications(50);
            setItems(data.map((n) => ({ ...n, createdAt: new Date(n.createdAt) })));
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        window.addEventListener("focus", load);
        return () => window.removeEventListener("focus", load);
    }, [load]);

    const unreadCount = items.filter((n) => !n.read).length;

    const open = async (item: Item) => {
        if (!item.read) {
            setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
            await markNotificationAsRead(item.id);
            tellSidebar();
        }
        if (item.link) router.push(item.link);
    };

    const markAll = async () => {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        await markAllNotificationsAsRead();
        tellSidebar();
    };

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
                <p className="mt-1 text-sm text-muted-foreground">Updates from the system. A dot marks an unread update.</p>
            </div>

            {loading ? (
                <div className="space-y-px overflow-hidden rounded-xl border border-border bg-card" aria-busy="true" aria-label="Loading notifications">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-4">
                            <span className="size-2 rounded-full bg-muted" />
                            <div className="h-4 w-2/3 rounded bg-muted" />
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-14 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                        <Bell className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">You are all caught up</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                        When a lead moves, a client confirms a meeting or a proposal changes, it shows up here.
                    </p>
                </div>
            ) : (
                <>
                    <ul className="overflow-hidden rounded-xl border border-border bg-card">
                        {items.map((item) => (
                            <li key={item.id} className="border-b border-border last:border-b-0">
                                <button
                                    type="button"
                                    onClick={() => open(item)}
                                    className="flex w-full cursor-pointer items-start gap-3 px-5 py-3.5 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn("mt-[7px] size-2 shrink-0 rounded-full", item.read ? "bg-border" : "bg-brand-deep")}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className={cn("block text-sm leading-5 text-foreground", !item.read && "font-semibold")}>
                                            {item.message}
                                            {!item.read && <span className="sr-only"> (unread)</span>}
                                        </span>
                                        {item.type && TYPE_LABEL[item.type] && (
                                            <span className="mt-0.5 block text-xs text-muted-foreground">{TYPE_LABEL[item.type]}</span>
                                        )}
                                    </span>
                                    <time
                                        dateTime={item.createdAt.toISOString()}
                                        className="shrink-0 pt-0.5 text-xs text-muted-foreground"
                                        suppressHydrationWarning
                                    >
                                        {formatDistanceToNowStrict(item.createdAt, { addSuffix: true })}
                                    </time>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <Button variant="outline" onClick={markAll} disabled={unreadCount === 0} className="cursor-pointer">
                        Mark all as read
                    </Button>
                </>
            )}
        </div>
    );
}
