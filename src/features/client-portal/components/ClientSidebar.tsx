"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientSidebarProps {
    className?: string;
}

export function ClientSidebar({ className }: ClientSidebarProps) {
    const pathname = usePathname();

    const navItems = [
        {
            title: "Project Dashboard",
            href: "/portal",
            icon: LayoutDashboard,
            description: "Track active projects & milestones",
        },
        {
            title: "Availed Services",
            href: "/portal/services",
            icon: Layers,
            description: "View purchased services & proposals",
        },
    ];

    return (
        <aside className={cn("w-full md:w-64 shrink-0 space-y-6", className)}>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 backdrop-blur-md">
                <div className="mb-4 px-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Client Workspace
                    </h2>
                </div>
                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            item.href === "/portal"
                                ? pathname === "/portal"
                                : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-zinc-800/80 text-white shadow-sm border border-zinc-700/60"
                                        : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        className={cn(
                                            "h-4 w-4 transition-colors",
                                            isActive
                                                ? "text-primary"
                                                : "text-zinc-500 group-hover:text-zinc-300"
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
            </div>
        </aside>
    );
}
