"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Layers,
    Calendar,
    FolderOpen,
    ChevronRight,
    Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface ClientSidebarProps {
    className?: string;
}

export function ClientSidebar({ className }: ClientSidebarProps) {
    const pathname = usePathname();

    const navItems = [
        {
            title: "Home",
            href: "/portal",
            icon: LayoutDashboard,
            description: "Overview & action items",
            exact: true,
        },
        {
            title: "Proposals",
            href: "/portal/proposals",
            icon: FileText,
            description: "Review & sign proposals",
        },
        {
            title: "Projects",
            href: "/portal/projects",
            icon: Layers,
            description: "Track project milestones",
        },
        {
            title: "Appointments",
            href: "/portal/appointments",
            icon: Calendar,
            description: "Scheduled meetings",
        },
        {
            title: "Documents",
            href: "/portal/documents",
            icon: FolderOpen,
            description: "Contracts & handover files",
        },
    ];

    return (
        <aside className={cn("w-full md:w-64 shrink-0 space-y-4", className)}>
            <div className="glass-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="mb-4 px-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                            Client Workspace
                        </h2>
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_#00D639]" />
                    </div>
                    <NotificationBell />
                </div>
                <nav className="space-y-1.5">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 border-l-2",
                                    isActive
                                        ? "bg-primary/10 text-foreground border-primary shadow-xs"
                                        : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        className={cn(
                                            "h-4 w-4 transition-colors",
                                            isActive
                                                ? "text-primary"
                                                : "text-muted-foreground group-hover:text-foreground"
                                        )}
                                    />
                                    <span>{item.title}</span>
                                </div>
                                {isActive && (
                                    <ChevronRight className="h-3.5 w-3.5 text-primary opacity-80" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="pt-3 mt-4 border-t border-border space-y-2">
                    <Link
                        href="/portal/settings"
                        className={cn(
                            "group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 border-l-2",
                            pathname.startsWith("/portal/settings")
                                ? "bg-primary/10 text-foreground border-primary shadow-xs"
                                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Settings
                                className={cn(
                                    "h-4 w-4 transition-colors",
                                    pathname.startsWith("/portal/settings")
                                        ? "text-primary"
                                        : "text-muted-foreground group-hover:text-foreground"
                                )}
                            />
                            <span>Settings</span>
                        </div>
                        {pathname.startsWith("/portal/settings") && (
                            <ChevronRight className="h-3.5 w-3.5 text-primary opacity-80" />
                        )}
                    </Link>

                    <div className="pt-2 px-2">
                        <ThemeToggle variant="pill" />
                    </div>
                </div>
            </div>
        </aside>
    );
}
