"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Briefcase, Settings, Star, Layers, Mail, BarChart3, Users, KanbanSquare, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/leads", label: "Leads", icon: Mail },
    { href: "/dashboard/pm", label: "Project Board", icon: KanbanSquare },
    { href: "/dashboard/posts", label: "Posts", icon: FileText },
    { href: "/dashboard/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/dashboard/services", label: "Services", icon: Layers },
    { href: "/dashboard/testimonials", label: "Testimonials", icon: Star },
    { href: "/dashboard/team", label: "Team", icon: Users },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ userRole = "user" }: { userRole?: string }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const filteredNavItems = navItems.filter(item => {
        if (item.label === "Settings" || item.label === "Team") {
            return userRole === "admin";
        }
        return true;
    });

    const renderNavContent = () => (
        <div className="px-4 py-2 h-full flex flex-col">
            <div className="mb-8 px-4 mt-6 md:mt-0">
                <h2 className="text-lg font-bold tracking-tight text-white mb-2">Optrizo Admin</h2>
                <p className="text-xs text-muted-foreground">Manage your digital empire</p>
            </div>
            <nav className="space-y-1 flex-1 overflow-y-auto">
                {filteredNavItems.map((item) => {
                    const isActive = item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
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
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl h-screen fixed left-0 top-0 pt-20 hidden md:block z-40">
                {renderNavContent()}
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 border-b border-white/10 bg-black/80 backdrop-blur-xl z-50 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-white">Optrizo Admin</h2>
                </div>
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle navigation menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-0 bg-black/95 border-r border-white/10">
                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                        {renderNavContent()}
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
