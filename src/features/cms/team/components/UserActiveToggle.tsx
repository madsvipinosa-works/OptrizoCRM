"use client";

import { useState } from "react";
import { toggleUserActiveStatus } from "@/features/cms/team/actions";
import { Power, PowerOff } from "lucide-react";

export function UserActiveToggle({ userId, isActive, isAdmin }: { userId: string, isActive: boolean, isAdmin: boolean }) {
    const [loading, setLoading] = useState(false);

    if (!isAdmin) {
        return (
            <div className={`text-xs font-semibold px-2 py-1 flex items-center gap-1.5 rounded-full ${isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {isActive ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                {isActive ? 'Active' : 'Deactivated'}
            </div>
        );
    }

    async function handleToggle() {
        setLoading(true);
        const res = await toggleUserActiveStatus(userId, isActive);
        setLoading(false);
        
        if (!res.success) {
            alert(res.message);
        }
    }

    return (
        <div className="flex items-center gap-2 cursor-pointer group" onClick={e => e.stopPropagation()}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-green-500' : 'text-red-500'}`}>
                {isActive ? 'Active' : 'Deactivated'}
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={handleToggle}
                disabled={loading}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 ${isActive ? 'bg-green-500' : 'bg-red-500'}`}
            >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-black shadow-lg ring-0 transition-transform ${isActive ? 'translate-x-2' : '-translate-x-2'}`} />
            </button>
        </div>
    );
}
