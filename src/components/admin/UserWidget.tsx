import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserWidget({ user }: { user?: { name?: string | null; email?: string | null; image?: string | null; jobTitle?: string | null; role?: string | null } }) {
    if (!user) return null;

    const initial = user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || "?";
    const role = user.role?.toUpperCase() || "USER";

    return (
        <div className="flex items-center gap-2.5 relative group min-w-0 flex-1 overflow-hidden">
            <Avatar className="w-9 h-9 shadow-sm border border-white/5 bg-transparent shrink-0">
                <AvatarImage src={user.image || ""} alt={user.name || "Avatar"} referrerPolicy="no-referrer" />
                <AvatarFallback className="bg-gradient-to-br from-[#cce5ff] via-[#aad1d7] to-[#80c8ff] text-black font-semibold text-xs">
                    {initial}
                </AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col min-w-0 flex-1 relative z-10 overflow-hidden">
                <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight tracking-tight min-w-0 flex-1">
                        {user.name || "User"}
                    </p>
                    <span className={`text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-full uppercase border shrink-0 ${
                        role === "SUPERADMIN" ? "bg-primary/15 border-primary/30 text-primary" : 
                        role === "SALES" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
                        role === "MANAGER" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                        role === "DEVELOPER" ? "bg-purple-500/15 border-purple-500/30 text-purple-400" :
                        role === "CONTENT_EDITOR" ? "bg-blue-500/15 border-blue-500/30 text-blue-400" :
                        role === "CLIENT" ? "bg-sky-500/15 border-sky-500/30 text-sky-400" :
                        "bg-white/10 border-white/20 text-white/70"
                    }`}>
                        {role.replace("_", " ")}
                    </span>
                </div>
                <div className="flex items-center text-xs text-[#A3A3A3] whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 min-w-0">
                    <span className="truncate">{user.jobTitle || user.email || "Team Member"}</span>
                </div>
            </div>
        </div>
    );
}
