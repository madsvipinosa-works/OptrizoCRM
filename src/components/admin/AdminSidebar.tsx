"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Briefcase, Settings, Star, Layers, Mail, BarChart3, Users, KanbanSquare, Menu, ShieldAlert, LogOut, HelpCircle, ChevronDown, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserWidget } from "@/components/admin/UserWidget";
import { handleSignOut } from "@/features/auth/signout-action";

const mainNavItems = [
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/leads", label: "Leads", icon: Mail },
    { href: "/dashboard/pm", label: "Project Board", icon: KanbanSquare },
];

const contentNavItems = [
    { href: "/dashboard/posts", label: "Posts", icon: FileText },
    { href: "/dashboard/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/dashboard/services", label: "Services", icon: Layers },
    { href: "/dashboard/testimonials", label: "Testimonials", icon: Star },
    { href: "/dashboard/about", label: "About Page", icon: Users },
];

const bottomNavItems = [
    { href: "/dashboard/team", label: "Team", icon: Users },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
    { href: "/dashboard/audit", label: "Audit Logs", icon: ShieldAlert },
];

export function AdminSidebar({ user }: { user?: { name?: string | null; email?: string | null; image?: string | null; role?: string | null } }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const userRole = user?.role || "user";

    const isContentActive = contentNavItems.some(item => pathname.startsWith(item.href));
    const [contentOpen, setContentOpen] = useState(isContentActive);

    const filteredBottomNavItems = bottomNavItems.filter(item => {
        if (item.label === "Settings" || item.label === "Team" || item.label === "Audit Logs") {
            return userRole === "admin";
        }
        return true;
    });

    const renderNavContent = () => (
        <div className="px-3 py-8 h-full flex flex-col bg-[#050505]">
            {/* Top Widget */}
            <div className="mb-8 px-4 shrink-0">
                <UserWidget user={user} />
            </div>

            <nav className="space-y-1 flex-1 overflow-y-auto override-scrollbar pr-2">
                {mainNavItems.map((item) => {
                    const isActive = item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                                "flex items-center gap-4 px-4 py-3.5 text-[15px] font-semibold rounded-[1rem] transition-all group",
                                isActive
                                    ? "bg-[#262626] text-white"
                                    : "text-[#A3A3A3] hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("h-[20px] w-[20px] stroke-[2.2px]", isActive ? "text-white" : "text-[#A3A3A3] group-hover:text-white")} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}

                {/* Collapsible Content Section */}
                <div className="pt-2">
                    <button
                        onClick={() => setContentOpen(!contentOpen)}
                        className={cn(
                            "flex w-full items-center justify-between px-4 py-3.5 text-[15px] font-semibold rounded-[1rem] transition-all group",
                            isContentActive
                                ? "bg-[#262626] text-white"
                                : "text-[#A3A3A3] hover:text-white hover:bg-white/5"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <Monitor className={cn("h-[20px] w-[20px] stroke-[2.2px]", isContentActive ? "text-white" : "text-[#A3A3A3] group-hover:text-white")} />
                            <span>Website Content</span>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", contentOpen ? "rotate-180" : "rotate-0")} />
                    </button>
                    
                    <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", contentOpen ? "max-h-[300px] mt-1 opacity-100" : "max-h-0 opacity-0")}>
                        <div className="flex flex-col space-y-1 pl-11 pr-2 pb-2">
                            {contentNavItems.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "flex items-center py-2 text-[14px] font-medium transition-colors rounded-md px-3",
                                            isActive
                                                ? "text-white bg-white/5"
                                                : "text-[#A3A3A3] hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="my-4 border-t border-[#262626]/50 mx-4"></div>

                {filteredBottomNavItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                                "flex items-center gap-4 px-4 py-3.5 text-[15px] font-semibold rounded-[1rem] transition-all group",
                                isActive
                                    ? "bg-[#262626] text-white"
                                    : "text-[#A3A3A3] hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("h-[20px] w-[20px] stroke-[2.2px]", isActive ? "text-white" : "text-[#A3A3A3] group-hover:text-white")} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto shrink-0 space-y-1 pt-6 pb-2 border-t border-[#262626]/50 mx-2">
                <Link href="#" className="flex items-center gap-4 px-4 py-3.5 text-[15px] font-semibold text-[#A3A3A3] hover:text-white transition-colors group rounded-[1rem] hover:bg-white/5">
                    <HelpCircle className="h-[20px] w-[20px] stroke-[2.2px] text-[#A3A3A3] group-hover:text-white transition-colors" />
                    Help & Information
                </Link>
                <form action={handleSignOut}>
                    <button type="submit" className="flex w-full items-center gap-4 px-4 py-3.5 text-[15px] font-semibold text-[#A3A3A3] hover:text-white transition-colors focus:outline-none group rounded-[1rem] hover:bg-white/5">
                        <LogOut className="h-[20px] w-[20px] stroke-[2.2px] scale-x-[-1] text-[#A3A3A3] group-hover:text-white transition-colors" />
                        Log out
                    </button>
                </form>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="w-64 border-r border-[#262626] bg-[#050505] h-screen fixed left-0 top-0 hidden md:block z-40">
                {renderNavContent()}
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 border-b border-[#262626] bg-[#050505] z-50 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-white">Optrizo Admin</h2>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
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
                </div>
            </div>
        </>
    );
}
