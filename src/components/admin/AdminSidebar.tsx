"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Briefcase, Settings, Star, Layers, Mail, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/leads", label: "Leads", icon: Mail },
    { href: "/dashboard/posts", label: "Posts", icon: FileText },
    { href: "/dashboard/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/dashboard/services", label: "Services", icon: Layers },
    { href: "/dashboard/testimonials", label: "Testimonials", icon: Star },
    { href: "/dashboard/team", label: "Team", icon: Users },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ userRole = "user" }: { userRole?: string }) {
    const pathname = usePathname();

    const filteredNavItems = navItems.filter(item => {
        if (item.label === "Settings" || item.label === "Team") {
            return userRole === "admin";
        }
        return true;
    });

    return (
        <aside className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl h-screen fixed left-0 top-0 pt-20 hidden md:block">
            <div className="px-4 py-2">
                <div className="mb-8 px-4">
                    <h2 className="text-lg font-bold tracking-tight text-white mb-2">Optrizo Admin</h2>
                    <p className="text-xs text-muted-foreground">Manage your digital empire</p>
                </div>
                <nav className="space-y-1">
                    {filteredNavItems.map((item) => {
                        const isActive = item.href === "/dashboard"
                            ? pathname === "/dashboard"
                            : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:bg-white/5 hover:text-primary"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}
