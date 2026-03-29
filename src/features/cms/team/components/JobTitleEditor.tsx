"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { updateUserJobTitle } from "@/features/cms/team/actions";

export function JobTitleEditor({ userId, currentTitle, isAdmin }: { userId: string, currentTitle: string | null, isAdmin: boolean }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(currentTitle || "");
    const [isLoading, setIsLoading] = useState(false);

    if (!isAdmin) {
        return <div className="text-sm text-gray-400">{currentTitle || "No Title assigned"}</div>;
    }

    if (!isEditing) {
        return (
            <div 
                className="flex items-center gap-1.5 group cursor-pointer transition-colors hover:bg-white/5 py-0.5 px-2 -ml-2 rounded" 
                onClick={() => setIsEditing(true)}
            >
                <span className="text-sm text-yellow-500/80 font-medium">
                    {currentTitle || "Set Job Title..."}
                </span>
                <Pencil className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        );
    }

    async function handleSave() {
        if (title === currentTitle) {
            setIsEditing(false);
            return;
        }
        
        setIsLoading(true);
        const res = await updateUserJobTitle(userId, title);
        setIsLoading(false);
        
        if (res.success) {
            setIsEditing(false);
        } else {
            alert(res.message);
        }
    }

    return (
        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-md border border-white/10 shadow-xl backdrop-blur-md relative z-20">
            <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="h-7 text-xs w-36 bg-white/5 border-white/10 text-white focus-visible:ring-1 focus-visible:ring-primary/50"
                placeholder="e.g. Lead Designer"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSave()}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-400 hover:bg-green-500/10" onClick={handleSave} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => { setIsEditing(false); setTitle(currentTitle || ""); }}>
                <X className="w-3.5 h-3.5" />
            </Button>
        </div>
    );
}
