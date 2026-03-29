"use client";

import { updateUserRole } from "@/features/cms/team/actions";
import { useState } from "react";
import { toast } from "sonner";
import AnimatedDropdown from "@/components/ui/animated-dropdown";

export function UserRoleSelect({ userId, currentRole, currentUserId }: { userId: string, currentRole: string, currentUserId: string }) {
    const [role, setRole] = useState(currentRole);
    const [loading, setLoading] = useState(false);

    const handleRoleChange = async (newRole: "admin" | "editor" | "user" | "client") => {
        setLoading(true);
        // Optimistic UI
        const prevRole = role;
        setRole(newRole);

        try {
            const result = await updateUserRole(userId, newRole);
            if (result.success) {
                toast.success(`Role updated to ${newRole}`);
            } else {
                toast.error(result.message);
                setRole(prevRole); // Revert on failure
            }
        } catch {
            toast.error("Failed to update role");
            setRole(prevRole);
        } finally {
            setLoading(false);
        }
    };

    const isSelf = userId === currentUserId;

    return (
        <AnimatedDropdown
            text={role.charAt(0).toUpperCase() + role.slice(1)}
            triggerClassName="flex min-w-[120px] h-8 justify-between items-center rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            items={[
                { name: "User", onClick: () => { if (!loading && !isSelf) handleRoleChange("user"); } },
                { name: "Client", onClick: () => { if (!loading && !isSelf) handleRoleChange("client"); } },
                { name: "Editor", onClick: () => { if (!loading && !isSelf) handleRoleChange("editor"); } },
                { name: "Admin", onClick: () => { if (!loading && !isSelf) handleRoleChange("admin"); } },
            ]}
        />
    );
}
