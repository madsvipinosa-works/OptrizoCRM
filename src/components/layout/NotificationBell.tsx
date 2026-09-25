"use client";

import { useState, useEffect } from "react";
import { 
    Bell, 
    Check, 
    Loader2, 
    FileText, 
    CheckCircle2, 
    Paperclip, 
    Briefcase, 
    ShieldCheck, 
    ExternalLink,
    Sparkles
} from "lucide-react";
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
import { cn } from "@/lib/utils";

type Notification = {
    id: string;
    message: string;
    type: string | null;
    link: string | null;
    createdAt: Date;
    read: boolean;
};

function getNotificationTypeIcon(type: string | null) {
    switch (type) {
        case "proposal":
            return <FileText className="h-4 w-4" />;
        case "milestone":
            return <CheckCircle2 className="h-4 w-4" />;
        case "document":
            return <Paperclip className="h-4 w-4" />;
        case "project":
            return <Briefcase className="h-4 w-4" />;
        case "task":
            return <ShieldCheck className="h-4 w-4" />;
        default:
            return <Bell className="h-4 w-4" />;
    }
}

function getNotificationBadgeStyle(type: string | null) {
    switch (type) {
        case "proposal":
            return "bg-purple-500/15 text-purple-500 border-purple-500/30";
        case "milestone":
            return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
        case "document":
            return "bg-blue-500/15 text-blue-500 border-blue-500/30";
        case "project":
            return "bg-amber-500/15 text-amber-500 border-amber-500/30";
        case "task":
            return "bg-cyan-500/15 text-cyan-500 border-cyan-500/30";
        default:
            return "bg-primary/15 text-primary border-primary/30";
    }
}

export function NotificationBell() {
    const [mounted, setMounted] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchNotifications = async () => {
        try {
            const data = await getUnreadNotifications();
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

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="relative hover:bg-muted shrink-0 text-foreground rounded-xl">
                <Bell className="h-5 w-5 text-muted-foreground" />
            </Button>
        );
    }

    const unreadCount = notifications.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative hover:bg-muted shrink-0 text-foreground rounded-xl transition-all"
                    aria-label={`Notifications (${unreadCount} unread)`}
                >
                    <Bell className="h-5 w-5 text-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-extrabold flex items-center justify-center border-2 border-background animate-in zoom-in shadow-xs">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
                align="end" 
                className="w-84 sm:w-96 bg-card/95 backdrop-blur-xl border-border text-card-foreground shadow-2xl p-2 rounded-2xl animate-in fade-in-50 zoom-in-95 duration-200 z-50"
            >
                <div className="flex items-center justify-between px-3 py-2 mb-1">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground">Notifications</h4>
                        {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer" 
                            onClick={handleMarkAllRead}
                        >
                            <Check className="h-3 w-3 mr-1 text-primary" /> Mark all read
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator className="bg-border" />
                
                <div className="max-h-[360px] overflow-y-auto mt-1 space-y-1 pr-0.5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-8 gap-2">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">Checking updates...</span>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center p-8 space-y-2">
                            <div className="h-10 w-10 rounded-full bg-muted/60 mx-auto flex items-center justify-center text-muted-foreground">
                                <Sparkles className="h-5 w-5 opacity-60" />
                            </div>
                            <p className="text-xs font-semibold text-foreground">All caught up!</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
                                You have no unread notifications. Updates to your proposals and projects will appear here.
                            </p>
                        </div>
                    ) : (
                        notifications.map((notif) => {
                            const badgeStyle = getNotificationBadgeStyle(notif.type);
                            const icon = getNotificationTypeIcon(notif.type);

                            return (
                                <DropdownMenuItem 
                                    key={notif.id} 
                                    className="flex items-start gap-3 p-2.5 cursor-pointer focus:bg-muted/80 rounded-xl text-foreground transition-all group border border-transparent hover:border-border/50"
                                    onClick={() => handleRead(notif.id, notif.link)}
                                >
                                    <div className={cn("p-2 rounded-xl shrink-0 mt-0.5 border", badgeStyle)}>
                                        {icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                                            {notif.message}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                                            </span>
                                            {notif.link && (
                                                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                    View <ExternalLink className="h-2.5 w-2.5" />
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            );
                        })
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
