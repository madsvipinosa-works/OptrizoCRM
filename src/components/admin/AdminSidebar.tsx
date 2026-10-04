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
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
        title: "Overview",
        items: [
            { href: "/dashboard", label: "Dashboard", icon: Sparkles, allowedRoles: ["superadmin", "sales", "manager", "developer"] },
        ],
    },
    {
        title: "Growth & CRM",
        items: [
            { href: "/dashboard/analytics", label: "Analytics & Reports", icon: BarChart3, allowedRoles: ["superadmin", "sales", "manager"] },
            { href: "/dashboard/inquiries", label: "Inquiries", icon: Mail, allowedRoles: ["superadmin", "sales"] },
            { href: "/dashboard/contacts", label: "Contacts", icon: Users, allowedRoles: ["superadmin", "sales"] },
            { href: "/dashboard/leads", label: "Sales Pipeline", icon: KanbanSquare, allowedRoles: ["superadmin", "sales"] },
            { href: "/dashboard/proposals", label: "Proposals & SOWs", icon: FileText, allowedRoles: ["superadmin", "sales"] },
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
        <div className="px-3 py-6 h-full flex flex-col bg-card dark:bg-[#070907] border-r border-border text-foreground transition-colors duration-300">
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
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span>Quick Search...</span>
                    </span>
                    <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground group-hover:text-foreground">
                        ⌘K
                    </kbd>
                </button>
            </div>

            {/* Categorized Navigation Groups */}
            <nav className="space-y-6 flex-1 overflow-y-auto override-scrollbar pr-1">
                {filteredNavGroups.map((group) => (
                    <div key={group.title} className="space-y-1">
                        <div className="px-3 mb-2 text-[10px] font-mono font-bold tracking-[0.18em] text-muted-foreground uppercase">
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
                                            ? "border-primary bg-primary/10 text-foreground shadow-[inset_0_0_20px_rgba(0,214,57,0.05)]"
                                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "h-4 w-4 transition-colors",
                                            isActive
                                                ? "text-primary"
                                                : "text-muted-foreground group-hover:text-foreground"
                                        )}
                                    />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Bottom Actions & Theme Switcher */}
            <div className="mt-auto shrink-0 space-y-1.5 pt-4 pb-2 border-t border-border mx-1">
                {/* Tactical Alabaster / Noir Theme Toggle */}
                <ThemeToggle variant="pill" className="mb-1" />

                <Link
                    href="/portal/services"
                    className="flex items-center gap-3.5 px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group rounded-xl hover:bg-muted/50 border-l-2 border-transparent"
                >
                    <HelpCircle className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    Client Portal
                </Link>
                <form action={handleSignOut}>
                    <button
                        type="submit"
                        className="flex w-full items-center gap-3.5 px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-red-500 transition-colors focus:outline-none group rounded-xl hover:bg-red-500/10 border-l-2 border-transparent cursor-pointer"
                    >
                        <LogOut className="h-4 w-4 scale-x-[-1] text-muted-foreground group-hover:text-red-500 transition-colors" />
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
            <aside className="w-64 border-r border-border bg-card dark:bg-[#070907] h-screen fixed left-0 top-0 hidden md:block z-40 transition-colors duration-300">
                {renderNavContent()}
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 border-b border-border bg-card dark:bg-[#070907] z-50 flex items-center px-4 justify-between transition-colors duration-300">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#00D639]" />
                    <h2 className="text-base font-bold tracking-tight text-foreground">Optrizo CRM</h2>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    {isMounted ? (
                        <Sheet open={open} onOpenChange={setOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0 text-foreground hover:bg-muted">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Toggle navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-64 p-0 bg-card dark:bg-[#070907] border-r border-border">
                                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                {renderNavContent()}
                            </SheetContent>
                        </Sheet>
                    ) : (
                        <Button variant="ghost" size="icon" className="shrink-0 text-foreground hover:bg-muted">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle navigation menu</span>
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
