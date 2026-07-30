"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    FileText,
    Briefcase,
    Settings,
    Star,
    Layers,
    Mail,
    BarChart3,
    Users,
    KanbanSquare,
    Menu,
    ShieldAlert,
    LogOut,
    HelpCircle,
    Monitor,
    Search,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserWidget } from "@/components/admin/UserWidget";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { handleSignOut } from "@/features/auth/signout-action";

interface NavItem {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    allowedRoles: string[];
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        title: "Growth & CRM",
        items: [
            { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, allowedRoles: ["superadmin", "sales"] },
            { href: "/dashboard/inquiries", label: "Inquiries", icon: Mail, allowedRoles: ["superadmin", "sales"] },
            { href: "/dashboard/contacts", label: "Contacts", icon: Users, allowedRoles: ["superadmin", "sales"] },
            { href: "/dashboard/leads", label: "Sales Pipeline", icon: KanbanSquare, allowedRoles: ["superadmin", "sales"] },
        ],
    },
    {
        title: "Operations & Content",
        items: [
            { href: "/dashboard/pm", label: "Active Delivery", icon: KanbanSquare, allowedRoles: ["superadmin", "manager", "developer"] },
            { href: "/dashboard/cms", label: "Content Manager", icon: Monitor, allowedRoles: ["superadmin", "content_editor"] },
        ],
    },
    {
        title: "System Administration",
        items: [
            { href: "/dashboard/team", label: "Team", icon: Users, allowedRoles: ["superadmin"] },
            { href: "/dashboard/settings", label: "Settings", icon: Settings, allowedRoles: ["superadmin"] },
            { href: "/dashboard/audit", label: "Audit Logs", icon: ShieldAlert, allowedRoles: ["superadmin"] },
        ],
    },
];

export function AdminSidebar({ user }: { user?: { name?: string | null; email?: string | null; image?: string | null; role?: string | null } }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [cmdOpen, setCmdOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const userRole = user?.role || "user";

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Filter items and exclude empty groups dynamically based on RBAC
    const filteredNavGroups = navGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.allowedRoles.includes(userRole)),
        }))
        .filter((group) => group.items.length > 0);

    const renderNavContent = () => (
        <div className="px-3 py-6 h-full flex flex-col bg-[#050505] text-white">
            {/* Top User Widget */}
            <div className="mb-6 px-1 shrink-0 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                <UserWidget user={user} />
                <div className="hidden md:block shrink-0">
                    <NotificationBell />
                </div>
            </div>

            {/* Command Palette Trigger Button */}
            <div className="px-1 mb-4">
                <button
                    onClick={() => setCmdOpen(true)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white/60 hover:text-white hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                    <span className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-[#A3A3A3] group-hover:text-primary transition-colors" />
                        <span>Quick Search...</span>
                    </span>
                    <kbd className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/40 group-hover:text-white/70">
                        ⌘K
                    </kbd>
                </button>
            </div>

            {/* Categorized Navigation Groups */}
            <nav className="space-y-6 flex-1 overflow-y-auto override-scrollbar pr-1">
                {filteredNavGroups.map((group) => (
                    <div key={group.title} className="space-y-1">
                        <div className="px-3 mb-2 text-[10px] font-extrabold tracking-[0.15em] text-[#A3A3A3]/70 uppercase">
                            {group.title}
                        </div>
                        {group.items.map((item) => {
                            const isActive = item.href === "/dashboard"
                                ? pathname === "/dashboard"
                                : pathname.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3.5 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-all group border-l-2",
                                        isActive
                                            ? "border-primary bg-primary/10 text-white shadow-[inset_0_0_20px_rgba(57,255,20,0.03)]"
                                            : "border-transparent text-[#A3A3A3] hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "h-4 w-4 transition-colors",
                                            isActive
                                                ? "text-primary"
                                                : "text-[#A3A3A3] group-hover:text-white"
                                        )}
                                    />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Bottom Actions */}
            <div className="mt-auto shrink-0 space-y-1 pt-4 pb-2 border-t border-[#262626]/60 mx-1">
                <Link
                    href="/portal/services"
                    className="flex items-center gap-3.5 px-3.5 py-2.5 text-sm font-semibold text-[#A3A3A3] hover:text-white transition-colors group rounded-xl hover:bg-white/5 border-l-2 border-transparent"
                >
                    <HelpCircle className="h-4 w-4 text-[#A3A3A3] group-hover:text-white transition-colors" />
                    Client Portal
                </Link>
                <form action={handleSignOut}>
                    <button
                        type="submit"
                        className="flex w-full items-center gap-3.5 px-3.5 py-2.5 text-sm font-semibold text-[#A3A3A3] hover:text-red-400 transition-colors focus:outline-none group rounded-xl hover:bg-red-500/10 border-l-2 border-transparent"
                    >
                        <LogOut className="h-4 w-4 scale-x-[-1] text-[#A3A3A3] group-hover:text-red-400 transition-colors" />
                        Log Out
                    </button>
                </form>
            </div>
        </div>
    );

    return (
        <>
            {/* Command Palette Modal */}
            <CommandPalette open={cmdOpen} setOpen={setCmdOpen} userRole={userRole} />

            {/* Desktop Sidebar */}
            <aside className="w-64 border-r border-[#262626] bg-[#050505] h-screen fixed left-0 top-0 hidden md:block z-40">
                {renderNavContent()}
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 border-b border-[#262626] bg-[#050505] z-50 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <h2 className="text-base font-bold tracking-tight text-white">Optrizo CRM</h2>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    {isMounted ? (
                        <Sheet open={open} onOpenChange={setOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Toggle navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-64 p-0 bg-[#050505] border-r border-[#262626]">
                                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                {renderNavContent()}
                            </SheetContent>
                        </Sheet>
                    ) : (
                        <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle navigation menu</span>
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
