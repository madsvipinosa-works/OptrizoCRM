import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserWidget({ user }: { user?: { name?: string | null; email?: string | null; image?: string | null; jobTitle?: string | null } }) {
    if (!user) return null;

    const initial = user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || "?";

    return (
        <div className="flex items-center gap-3 relative group">
            <Avatar className="w-10 h-10 shadow-sm border border-white/5 bg-transparent">
                <AvatarImage src={user.image || ""} alt={user.name || "Avatar"} />
                <AvatarFallback className="bg-gradient-to-br from-[#cce5ff] via-[#aad1d7] to-[#80c8ff] shadow-[inset_0_0px_10px_rgba(255,255,255,0.4)] text-black font-semibold">
                    {initial}
                </AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col min-w-0 flex-1 relative z-10">
                <p className="text-[15px] font-semibold text-white truncate leading-tight tracking-tight">
                    {user.name || "User"}
                </p>
                <div className="flex items-center text-[13px] text-[#A3A3A3] whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">
                    <span className="truncate capitalize">{user.jobTitle || "None"}</span>
                </div>
            </div>
        </div>
    );
}
