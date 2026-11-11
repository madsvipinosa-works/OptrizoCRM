"use client";

import { useState } from "react";
import { lockUser, unlockUser, deactivateUser, reactivateUser } from "@/features/users/actions";
import { resendStaffInvite, cancelStaffInvite } from "@/features/users/invite-actions";
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
    userRole?: string;
    mode?: "full" | "invite-only";
}

export function UserActiveToggle({
    userId,
    isActive = true,
    status,
    isAdmin = true,
    userName,
    userRole,
    mode = "full",
}: UserActiveToggleProps) {
    const [loading, setLoading] = useState(false);

    const effectiveStatus: "active" | "locked" | "deactivated" | "invited" =
        status || (isActive ? "active" : "deactivated");

    const badgeStyle = {
        active: "bg-brand-soft text-brand-deep border-brand-deep/30",
        locked: "bg-stage-negotiation/10 text-stage-negotiation border-stage-negotiation/30",
        deactivated: "bg-destructive/10 text-destructive border-destructive/30",
        invited: "bg-stage-negotiation/10 text-stage-negotiation border-stage-negotiation/30",
    }[effectiveStatus];

    const statusLabel = {
        active: "Active",
        locked: "Locked",
        deactivated: "Deactivated",
        invited: "Invited",
    }[effectiveStatus];

    const isInvitedStaff = effectiveStatus === "invited" && userRole !== "client";

    if (!isAdmin || (mode === "invite-only" && !isInvitedStaff)) {
        return (
            <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center capitalize ${badgeStyle}`}
            >
                {statusLabel}
            </span>
        );
    }

    async function handleAction(actionType: "lock" | "unlock" | "deactivate" | "reactivate" | "resend" | "cancel") {
        const displayName = userName || "this user";

        if (actionType === "lock") {
            const confirmed = window.confirm(
                `Lock account for ${displayName}?\n\nThe user will not be able to sign in until unlocked.`
            );
            if (!confirmed) return;
        }

        if (actionType === "deactivate") {
            const confirmed = window.confirm(
                `Deactivate ${displayName}?\n\n${displayName} can no longer sign in. Their history stays in the audit log. Open tasks stay as they are, and the Project Manager is told to reassign them.\n\nYou can turn the account back on later.`
            );
            if (!confirmed) return;
        }

        if (actionType === "cancel") {
            const confirmed = window.confirm(
                `Cancel staff invitation for ${displayName}?\n\nThis will revoke the invitation link and delete the pending user account.`
            );
            if (!confirmed) return;
        }

        setLoading(true);
        try {
            let res: { success?: boolean; ok?: boolean; message?: string; error?: string };
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
                case "resend":
                    res = await resendStaffInvite(userId);
                    break;
                case "cancel":
                    res = await cancelStaffInvite(userId);
                    break;
            }

            const isOk = res.success !== undefined ? res.success : res.ok;
            if (!isOk) {
                toast.error(res.message || res.error || "Action failed.");
            } else {
                toast.success(res.message || (actionType === "resend" ? "Invitation email resent." : "Account updated."));
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
                            className="text-destructive focus:text-destructive"
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
                            className="text-destructive focus:text-destructive"
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
                    <>
                        {userRole !== "client" && (
                            <>
                                <DropdownMenuItem onClick={() => handleAction("resend")}>
                                    Resend invite
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleAction("cancel")}
                                    className="text-destructive focus:text-destructive"
                                >
                                    Cancel invite
                                </DropdownMenuItem>
                            </>
                        )}
                        {mode === "full" && (
                            <DropdownMenuItem
                                onClick={() => handleAction("deactivate")}
                                className="text-destructive focus:text-destructive"
                            >
                                Deactivate account
                            </DropdownMenuItem>
                        )}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
