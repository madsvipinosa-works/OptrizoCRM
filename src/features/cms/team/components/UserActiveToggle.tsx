"use client";

import { useState } from "react";
import { lockUser, unlockUser, deactivateUser, reactivateUser } from "@/features/users/actions";
import { ChevronDown, Loader2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export interface UserActiveToggleProps {
    userId: string;
    isActive?: boolean;
    status?: "active" | "locked" | "deactivated" | "invited";
    isAdmin?: boolean;
    userName?: string;
}

export function UserActiveToggle({
    userId,
    isActive = true,
    status,
    isAdmin = true,
    userName,
}: UserActiveToggleProps) {
    const [loading, setLoading] = useState(false);

    const effectiveStatus: "active" | "locked" | "deactivated" | "invited" =
        status || (isActive ? "active" : "deactivated");

    const badgeStyle = {
        active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        locked: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        deactivated: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        invited: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    }[effectiveStatus];

    const statusLabel = {
        active: "Active",
        locked: "Locked",
        deactivated: "Deactivated",
        invited: "Invited",
    }[effectiveStatus];

    if (!isAdmin) {
        return (
            <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center capitalize ${badgeStyle}`}
            >
                {statusLabel}
            </span>
        );
    }

    async function handleAction(actionType: "lock" | "unlock" | "deactivate" | "reactivate") {
        const displayName = userName || "this user";

        if (actionType === "lock") {
            const confirmed = window.confirm(
                `Lock account for ${displayName}?\n\nThe user will not be able to sign in until unlocked.`
            );
            if (!confirmed) return;
        }

        if (actionType === "deactivate") {
            const confirmed = window.confirm(
                `Deactivate account for ${displayName}?\n\nThey will no longer be able to sign in. Any open tasks will remain for Project Manager reassignment.`
            );
            if (!confirmed) return;
        }

        setLoading(true);
        try {
            let res: { success: boolean; message?: string };
            switch (actionType) {
                case "lock":
                    res = await lockUser(userId);
                    break;
                case "unlock":
                    res = await unlockUser(userId);
                    break;
                case "deactivate":
                    res = await deactivateUser(userId);
                    break;
                case "reactivate":
                    res = await reactivateUser(userId);
                    break;
            }

            if (!res.success) {
                toast.error(res.message || "Failed to update account status.");
            } else {
                toast.success(res.message || "Account status updated.");
            }
        } catch (err) {
            console.error("Status action error:", err);
            toast.error("An unexpected error occurred while updating status.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={loading}>
                <button
                    type="button"
                    disabled={loading}
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${badgeStyle}`}
                >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    <span>{statusLabel}</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
                {effectiveStatus === "active" && (
                    <>
                        <DropdownMenuItem onClick={() => handleAction("lock")}>
                            Lock account
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleAction("deactivate")}
                            className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                        >
                            Deactivate account
                        </DropdownMenuItem>
                    </>
                )}
                {effectiveStatus === "locked" && (
                    <>
                        <DropdownMenuItem onClick={() => handleAction("unlock")}>
                            Unlock account
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleAction("deactivate")}
                            className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                        >
                            Deactivate account
                        </DropdownMenuItem>
                    </>
                )}
                {effectiveStatus === "deactivated" && (
                    <DropdownMenuItem onClick={() => handleAction("reactivate")}>
                        Reactivate account
                    </DropdownMenuItem>
                )}
                {effectiveStatus === "invited" && (
                    <DropdownMenuItem
                        onClick={() => handleAction("deactivate")}
                        className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                    >
                        Deactivate account
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
