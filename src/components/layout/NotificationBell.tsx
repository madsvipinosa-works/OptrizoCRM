"use client";

import { useState, useEffect } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/features/notifications/actions";
import { useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

type Notification = {
    id: string;
    message: string;
    type: string | null;
    link: string | null;
    createdAt: Date;
    read: boolean;
};

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const pathname = usePathname();

    const fetchNotifications = async () => {
        try {
            const data = await getUnreadNotifications();
            // ensure date objects
            setNotifications(data.map(n => ({ ...n, createdAt: new Date(n.createdAt) })));
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchNotifications();

        // Fetch when window regains focus (e.g. switching tabs from Client Portal back to Admin)
        const onFocus = () => fetchNotifications();
        window.addEventListener("focus", onFocus);

        // Poll every 15 seconds
        const interval = setInterval(fetchNotifications, 15000);
        
        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
        };
    }, [pathname]); // Also fetch when navigating around the dashboard

    const handleRead = async (id: string, link: string | null) => {
        // Optimistic UI update
        setNotifications(prev => prev.filter(n => n.id !== id));
        
        await markNotificationAsRead(id);
        
        if (link) {
            router.push(link);
        }
    };

    const handleMarkAllRead = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setNotifications([]);
        await markAllNotificationsAsRead();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-white/10 shrink-0">
                    <Bell className="h-5 w-5 text-white/80" />
                    {notifications.length > 0 && (
                        <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-zinc-950 animate-in zoom-in" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 glass-card border-white/10 p-2">
                <div className="flex items-center justify-between px-2 py-2 mb-1">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {notifications.length > 0 && (
                        <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-white/5" onClick={handleMarkAllRead}>
                            <Check className="h-3 w-3 mr-1" /> Mark all read
                        </Badge>
                    )}
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                
                <div className="max-h-[300px] overflow-y-auto mt-1 space-y-1">
                    {isLoading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center p-4 text-sm text-muted-foreground">
                            You have no new notifications.
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <DropdownMenuItem 
                                key={notif.id} 
                                className="flex flex-col items-start gap-1 p-3 cursor-pointer focus:bg-white/5 rounded-lg"
                                onClick={() => handleRead(notif.id, notif.link)}
                            >
                                <p className="text-sm font-medium leading-tight line-clamp-2">
                                    {notif.message}
                                </p>
                                <span className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                                </span>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
