"use client";

import { updateUserRole } from "@/features/cms/team/actions";
import { useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UserRoleSelect({ userId, currentRole, currentUserId }: { userId: string, currentRole: string, currentUserId: string }) {
    const [role, setRole] = useState(currentRole);
    const [loading, setLoading] = useState(false);

    const handleRoleChange = async (newRole: "admin" | "editor" | "user") => {
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
        <Select value={role} onValueChange={handleRoleChange} disabled={loading || isSelf}>
            <SelectTrigger className="w-[120px] h-8 bg-black/20 border-white/10">
                <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
        </Select>
    );
}
