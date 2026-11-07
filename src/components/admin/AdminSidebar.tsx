"use client";

import { useState, useSyncExternalStore, type ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    CalendarDays,
    CheckCircle2,
    ContactRound,
    FileBarChart,
    FileText,
    Files,
    FolderGit2,
    FolderKanban,
    KanbanSquare,
    Layers,
    LayoutDashboard,
    LogOut,
    Mail,
    Menu,
    Monitor,
    PanelLeftClose,
    PanelLeftOpen,
    Settings,
    Shield,
    ScrollText,
    Users,
    type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { NotificationsNavLink } from "@/components/admin/NotificationsNavLink";
import { UserWidget, getRoleLabel } from "@/components/admin/UserWidget";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
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
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allowedRoles: ["superadmin", "sales", "manager"] },
            { href: "/dashboard/my-tasks", label: "My tasks", icon: CheckCircle2, allowedRoles: ["developer"] },
        ],
    },
    {
        title: "Growth & CRM",
        items: [
            { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, allowedRoles: ["superadmin"] },
            { href: "/dashboard/reports", label: "Reports", icon: FileBarChart, allowedRoles: ["superadmin"] },
            { href: "/dashboard/inquiries", label: "Inquiries", icon: Mail, allowedRoles: ["sales"] },
            { href: "/dashboard/contacts", label: "Contacts", icon: ContactRound, allowedRoles: ["sales"] },
            { href: "/dashboard/leads", label: "Sales Pipeline", icon: KanbanSquare, allowedRoles: ["sales"] },
            { href: "/dashboard/meetings", label: "Meetings", icon: CalendarDays, allowedRoles: ["sales", "manager"] },
            { href: "/dashboard/proposals", label: "Proposals", icon: FileText, allowedRoles: ["sales", "manager"] },
        ],
    },
    {
        title: "Operations & content",
        items: [
            { href: "/dashboard/pm", label: "Projects", icon: FolderKanban, allowedRoles: ["manager", "developer"] },
            { href: "/dashboard/cms", label: "Content Home", icon: Monitor, allowedRoles: ["content_editor"] },
            { href: "/dashboard/services", label: "Services", icon: Layers, allowedRoles: ["content_editor"] },
            { href: "/dashboard/portfolio", label: "Portfolio", icon: FolderGit2, allowedRoles: ["content_editor"] },
            { href: "/dashboard/pages", label: "Pages", icon: Files, allowedRoles: ["content_editor"] },
        ],
    },
    {
        title: "System administration",
        items: [
            { href: "/dashboard/team", label: "Users", icon: Users, allowedRoles: ["superadmin"] },
            { href: "/dashboard/roles", label: "Roles", icon: Shield, allowedRoles: ["superadmin"] },
            { href: "/dashboard/audit", label: "Audit Logs", icon: ScrollText, allowedRoles: ["superadmin"] },
        ],
    },
];

/** Account-level utilities live in the footer, beside dark mode and log out. */
const footerLinks: NavItem[] = [
    { href: "/dashboard/settings", label: "Settings", icon: Settings, allowedRoles: ["superadmin"] },
];

/** Menus this short show as one list with no headings. */
const FLAT_MENU_MAX = 5;
/** Flat-list order from the PM mockups: the day starts with proposals, then meetings, then delivery. */
const FLAT_ORDER = ["/dashboard", "/dashboard/my-tasks", "/dashboard/proposals", "/dashboard/meetings", "/dashboard/pm"];
const flatRank = (href: string) => {
    const i = FLAT_ORDER.indexOf(href);
    return i === -1 ? FLAT_ORDER.length : i;
};

const subscribeNoop = () => () => {};

/** Row styles shared by nav links, footer links and footer buttons. 44px on touch, 36px with a mouse. */
const rowBase =
    "relative flex h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] md:h-9";
const rowIdle = "text-muted-foreground hover:bg-muted hover:text-foreground";
/** The rail: a 36px square, centred. */
const rowRail = "md:mx-auto md:w-9 md:justify-center md:px-0";

/** A tooltip that only opens while the sidebar is a rail, where the label is hidden. */
function RailTip({ label, enabled, children }: { label: string; enabled: boolean; children: ReactElement }) {
    return (
        <Tooltip open={enabled ? undefined : false}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            {/* 20px: clears the panel's own 12px padding and border so the tooltip floats beside the rail. */}
            <TooltipContent side="right" sideOffset={20}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}

export function AdminSidebar({
    user,
    expanded = true,
    instant = false,
    onToggleExpanded,
    logoUrl,
    logoDarkUrl,
}: {
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
    /** True right after a keyboard toggle: the width changes without the slide. */
    instant?: boolean;
    user?: { name?: string | null; email?: string | null; image?: string | null; role?: string | null };
    /** Open (labels shown) or a narrow icon rail. Changed only by the toggle button; the page moves with it. */
    expanded?: boolean;
    onToggleExpanded?: () => void;
}) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    const [open, setOpen] = useState(false);
    // The palette stays mounted for its Ctrl/Cmd + K shortcut. The sidebar no longer has a button for it.
    const [cmdOpen, setCmdOpen] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const isMounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

    const userRole = user?.role || "user";
    // Only roles that receive hand-offs have a notification list. Super Admin only monitors and nothing is sent to the Content Editor.
    const hasNotifications = ["sales", "manager", "developer"].includes(userRole);

    // Filter items and exclude empty groups based on the role (the server enforces access too).
    const roleGroups = navGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.allowedRoles.includes(userRole)),
        }))
        .filter((group) => group.items.length > 0);
    // A short menu (PM, developer, content editor) is one flat list in the mockups' order: headings over
    // one or two links add more to read than they explain. Sales and Super Admin keep their groups.
    const roleItems = roleGroups.flatMap((group) => group.items);
    const flat = roleItems.length <= FLAT_MENU_MAX;
    const filteredNavGroups = flat
        ? [{ title: "", items: [...roleItems].sort((a, b) => flatRank(a.href) - flatRank(b.href)) }]
        : roleGroups;

    const shortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘B" : "Ctrl+B";

    // Whole path segments only: /dashboard/pm must not light up for /dashboard/pmx.
    const isActive = (href: string) =>
        href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

    /**
     * The panel's contents. `scope` keeps the sliding marker of the desktop and mobile copies apart.
     * Only the desktop copy can be a rail; the phone sheet is always full.
     */
    const renderNavContent = (scope: "desktop" | "mobile") => {
        const rail = scope === "desktop" && !expanded;
        const railRow = rail ? rowRail : "";

        return (
            <div className="flex h-full min-h-0 flex-col text-foreground">
                {/* The signed-in user stays at the top. The toggle sits beside it (Linear and Vercel keep theirs there); in the rail it drops under the avatar. */}
                <div className={cn("flex shrink-0 p-3 pb-4", rail ? "flex-col items-center gap-2" : "items-center gap-1")}>
                    {rail ? (
                        <RailTip label={`${user?.name || user?.email || "Account"} · ${getRoleLabel(user?.role)}`} enabled>
                            <div>
                                <UserWidget user={user} compact />
                            </div>
                        </RailTip>
                    ) : (
                        <UserWidget user={user} />
                    )}
                    {scope === "desktop" && onToggleExpanded && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={onToggleExpanded}
                                    aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
                                    className={cn("flex shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]", rail ? "size-9" : "size-8")}
                                >
                                    {expanded ? (
                                        <PanelLeftClose className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                    ) : (
                                        <PanelLeftOpen className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side={rail ? "right" : "bottom"} sideOffset={rail ? 20 : 4}>
                                {expanded ? "Collapse sidebar" : "Expand sidebar"}
                                <kbd className="ml-2 font-sans text-background/70">{shortcut}</kbd>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>

                <nav aria-label="Main" className="override-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
                    {/* Notifications sits first, unlabelled: one row does not need a heading. A count (a dot in the rail) shows when something is new. */}
                    {hasNotifications && (
                        <div>
                            {rail && <div aria-hidden="true" className="mx-2 mb-2 h-px bg-border" />}
                            <NotificationsNavLink
                                rail={rail}
                                active={isActive("/dashboard/notifications")}
                                scope={scope}
                                onNavigate={() => setOpen(false)}
                                rowClass={cn(rowBase, railRow)}
                                idleClass={rowIdle}
                            />
                        </div>
                    )}
                    {filteredNavGroups.map((group) => {
                        return (
                            <div key={group.title || "menu"}>
                                {rail ? (
                                    <div aria-hidden="true" className="mx-2 my-1.5 h-px bg-border" />
                                ) : group.title ? (
                                    <p className="px-2.5 pb-1.5 pt-4 text-xs font-medium text-muted-foreground">{group.title}</p>
                                ) : (
                                    <div aria-hidden="true" className="pt-2" />
                                )}
                                <div className={cn("space-y-0.5", rail && "pt-1")}>
                                    {group.items.map((item) => {
                                        const active = isActive(item.href);
                                        return (
                                            <RailTip key={item.href} label={item.label} enabled={rail}>
                                                <Link
                                                    href={item.href}
                                                    aria-current={active ? "page" : undefined}
                                                    onClick={() => setOpen(false)}
                                                    className={cn(rowBase, railRow, active ? "text-foreground" : rowIdle)}
                                                >
                                                    {/* The active tint takes the group's hue, like the stage chips on the board. It slides between rows. */}
                                                    {active && (
                                                        <motion.span
                                                            layoutId={`sidebar-active-${scope}`}
                                                            aria-hidden="true"
                                                            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                                            className="absolute inset-0 rounded-lg bg-brand-soft"
                                                        />
                                                    )}
                                                    <item.icon className={cn("relative size-4 shrink-0", active && "text-brand-deep")} strokeWidth={1.75} aria-hidden="true" />
                                                    {/* Hidden visually in the rail, but still the link's accessible name. */}
                                                    <span className={cn("truncate", rail ? "sr-only" : "relative")}>{item.label}</span>
                                                </Link>
                                            </RailTip>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="shrink-0 space-y-0.5 border-t border-border p-3">
                    {footerLinks
                        .filter((item) => item.allowedRoles.includes(userRole))
                        .map((item) => {
                            const active = isActive(item.href);
                            return (
                                <RailTip key={item.href} label={item.label} enabled={rail}>
                                    <Link
                                        href={item.href}
                                        aria-current={active ? "page" : undefined}
                                        onClick={() => setOpen(false)}
                                        className={cn(rowBase, railRow, active ? "text-foreground" : rowIdle)}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId={`sidebar-active-${scope}`}
                                                aria-hidden="true"
                                                transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                                className="absolute inset-0 rounded-lg bg-brand-soft"
                                            />
                                        )}
                                        <item.icon className={cn("relative size-4 shrink-0", active && "text-brand-deep")} strokeWidth={1.75} aria-hidden="true" />
                                        <span className={cn("truncate", rail ? "sr-only" : "relative")}>{item.label}</span>
                                    </Link>
                                </RailTip>
                            );
                        })}
                    <RailTip label="Dark mode" enabled={rail}>
                        <div className={cn(rail && "flex justify-center")}>
                            <ThemeToggle variant="row" compact={rail} />
                        </div>
                    </RailTip>
                    <RailTip label="Log out" enabled={rail}>
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setLogoutOpen(true);
                            }}
                            className={cn(rowBase, rowIdle, railRow, "cursor-pointer")}
                        >
                            <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                            <span className={cn("truncate", rail && "sr-only")}>Log out</span>
                        </button>
                    </RailTip>
                </div>
            </div>
        );
    };

    return (
        <>
            <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} email={user?.email} />

            {/* Command palette: opens with Ctrl/Cmd + K */}
            <CommandPalette open={cmdOpen} setOpen={setCmdOpen} userRole={userRole} />

            {/* Desktop: a panel inset 12px from the window. 232px open, 62px as an icon rail. The toggle button switches it. */}
            <aside
                aria-label="Sidebar"
                className={cn(
                    "fixed bottom-3 left-3 top-3 z-40 hidden overflow-hidden rounded-2xl border border-border bg-card md:block print:hidden",
                    instant ? "transition-none" : "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    expanded ? "w-[232px]" : "w-[62px]"
                )}
            >
                {renderNavContent("desktop")}
            </aside>

            {/* Mobile header */}
            <div className="fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border bg-card px-4 md:hidden print:hidden">
                {/* Same logo as the website and the client portal (site settings), light and dark versions. */}
                <Link href="/dashboard" aria-label="Optrizo CRM, dashboard" className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {logoUrl || logoDarkUrl ? (
                        <span className="relative block h-8 w-28 shrink-0">
                            {logoUrl && <Image src={logoUrl} alt="" fill priority sizes="112px" className={cn("object-contain object-left", logoDarkUrl && "dark:hidden")} />}
                            {logoDarkUrl && <Image src={logoDarkUrl} alt="" fill priority sizes="112px" className={cn("object-contain object-left", logoUrl && "hidden dark:block")} />}
                        </span>
                    ) : (
                        <span className="text-base font-semibold tracking-tight text-foreground">Optrizo</span>
                    )}
                </Link>
                <div className="flex items-center gap-1">
                    {hasNotifications && <NotificationBell />}
                    {isMounted ? (
                        <Sheet open={open} onOpenChange={setOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-11 shrink-0 text-foreground hover:bg-muted">
                                    <Menu className="size-5" />
                                    <span className="sr-only">Open navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72 border-r border-border bg-card p-0">
                                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                                {renderNavContent("mobile")}
                            </SheetContent>
                        </Sheet>
                    ) : (
                        <Button variant="ghost" size="icon" className="size-11 shrink-0 text-foreground hover:bg-muted">
                            <Menu className="size-5" />
                            <span className="sr-only">Open navigation menu</span>
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
