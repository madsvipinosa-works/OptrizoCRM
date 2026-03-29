"use client";

import { useState } from "react";
import { toggleUserAboutPage } from "@/features/cms/about-actions";
import { Eye, EyeOff } from "lucide-react";

export function UserAboutToggle({ userId, isPublic, isAdmin }: { userId: string, isPublic: boolean, isAdmin: boolean }) {
    const [loading, setLoading] = useState(false);

    if (!isAdmin) {
        return (
            <div className={`text-xs font-semibold px-2 py-1 flex items-center gap-1.5 rounded-full ${isPublic ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-500'}`}>
                {isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {isPublic ? 'Public' : 'Hidden'}
            </div>
        );
    }

    async function handleToggle() {
        setLoading(true);
        const res = await toggleUserAboutPage(userId, !isPublic);
        setLoading(false);
        
        if (!res.success) {
            alert(res.message);
        }
    }

    return (
        <div className="flex items-center gap-2 cursor-pointer group" onClick={e => e.stopPropagation()}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isPublic ? 'text-blue-500' : 'text-gray-500'}`}>
                {isPublic ? 'Public on Team' : 'Hidden from Team'}
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={handleToggle}
                disabled={loading}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 ${isPublic ? 'bg-blue-500' : 'bg-zinc-700'}`}
            >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-black shadow-lg ring-0 transition-transform ${isPublic ? 'translate-x-2' : '-translate-x-2'}`} />
            </button>
        </div>
    );
}
