import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Plain-language role names. "manager" is the Project Manager (PM).
const ROLE_LABEL: Record<string, string> = {
    superadmin: "Super admin",
    sales: "Sales",
    manager: "Project manager",
    developer: "Developer",
    content_editor: "Content editor",
    client: "Client",
};

export function getRoleLabel(role?: string | null) {
    return ROLE_LABEL[role ?? ""] ?? "Team member";
}

type WidgetUser = { name?: string | null; email?: string | null; image?: string | null; jobTitle?: string | null; role?: string | null };

export function UserWidget({ user, compact = false }: { user?: WidgetUser; compact?: boolean }) {
    if (!user) return null;

    const name = user.name || user.email || "User";
    const initial = name.charAt(0).toUpperCase();
    const roleLabel = getRoleLabel(user.role);

    const avatar = (
        <Avatar className="size-9 shrink-0 border border-border bg-brand-soft">
            <AvatarImage src={user.image || ""} alt="" referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-brand-soft text-sm font-semibold text-brand-deep">{initial}</AvatarFallback>
        </Avatar>
    );

    // Icon rail: the avatar alone. The name and role come from a tooltip on the wrapper.
    if (compact) {
        return (
            <div role="img" aria-label={`${name}, ${roleLabel}`}>
                {avatar}
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-1 items-center gap-2.5" title={user.email ?? undefined}>
            {avatar}
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5 text-foreground">{name}</p>
                {/* The role matters (Super admin only monitors), so it stays visible; the job title is the tooltip. */}
                <p className="truncate text-xs leading-4 text-muted-foreground" title={user.jobTitle ?? undefined}>
                    {roleLabel}
                </p>
            </div>
        </div>
    );
}
