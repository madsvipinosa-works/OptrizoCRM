import Link from "next/link";
import { LayoutDashboard, FileText, Briefcase, Settings, Star, Layers, Mail } from "lucide-react";

const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/posts", label: "Posts", icon: FileText },
    { href: "/dashboard/projects", label: "Projects", icon: Briefcase },
    { href: "/dashboard/services", label: "Services", icon: Layers },
    { href: "/dashboard/testimonials", label: "Testimonials", icon: Star },
    { href: "/dashboard/leads", label: "Leads", icon: Mail },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
    return (
        <aside className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl h-screen fixed left-0 top-0 pt-20 hidden md:block">
            <div className="px-4 py-2">
                <div className="mb-8 px-4">
                    <h2 className="text-lg font-bold tracking-tight text-white mb-2">CMS Admin</h2>
                    <p className="text-xs text-muted-foreground">Manage your content</p>
                </div>
                <nav className="space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground rounded-md hover:bg-white/5 hover:text-primary transition-colors"
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </aside>
    );
}
