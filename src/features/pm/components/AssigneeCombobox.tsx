"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Check, Search, Users, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TeamMemberItem {
    id: string;
    name: string | null;
    image?: string | null;
    jobTitle?: string | null;
    email?: string | null;
    role?: string | null;
}

interface AssigneeComboboxProps {
    teamMembers: TeamMemberItem[];
    selectedIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function AssigneeCombobox({
    teamMembers,
    selectedIds,
    onSelectionChange,
    placeholder = "Assign staff...",
    disabled = false,
    className,
}: AssigneeComboboxProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredMembers = teamMembers.filter((member) => {
        const query = searchQuery.toLowerCase();
        const nameMatch = member.name?.toLowerCase().includes(query);
        const titleMatch = member.jobTitle?.toLowerCase().includes(query);
        const emailMatch = member.email?.toLowerCase().includes(query);
        const roleMatch = member.role?.toLowerCase().includes(query);
        return nameMatch || titleMatch || emailMatch || roleMatch;
    });

    const toggleMember = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((itemId) => itemId !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const selectedMembers = teamMembers.filter((m) => selectedIds.includes(m.id));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between bg-zinc-900/90 border-zinc-800 hover:bg-zinc-800/80 hover:text-zinc-100 text-zinc-300 font-normal shadow-sm transition-colors",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedMembers.length === 0 ? (
                            <div className="flex items-center gap-1.5 text-zinc-500">
                                <UserPlus className="w-4 h-4" />
                                <span>{placeholder}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                                    {selectedMembers.slice(0, 3).map((m) => (
                                        <Avatar key={m.id} className="w-5 h-5 border border-zinc-900 ring-1 ring-zinc-800">
                                            {m.image && <AvatarImage src={m.image} alt={m.name || "Member"} />}
                                            <AvatarFallback className="text-[9px] bg-indigo-600 text-white font-semibold">
                                                {m.name ? m.name.substring(0, 2).toUpperCase() : "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                </div>
                                <span className="text-xs font-medium text-zinc-200 truncate">
                                    {selectedMembers.length === 1
                                        ? selectedMembers[0].name
                                        : `${selectedMembers.length} Assignees`}
                                </span>
                            </div>
                        )}
                    </div>
                    <Users className="w-4 h-4 shrink-0 text-zinc-500 ml-2" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 bg-zinc-950 border-zinc-800 text-zinc-100 shadow-xl" align="start">
                <div className="p-2 border-b border-zinc-800/80">
                    <div className="relative flex items-center">
                        <Search className="w-4 h-4 absolute left-2.5 text-zinc-500" />
                        <Input
                            placeholder="Filter staff by name or role..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800 focus:ring-indigo-500/20 text-zinc-200 placeholder:text-zinc-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 text-zinc-500 hover:text-zinc-300"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto p-1 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800">
                    {filteredMembers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-500">
                            No matching team members found.
                        </div>
                    ) : (
                        filteredMembers.map((member) => {
                            const isSelected = selectedIds.includes(member.id);
                            return (
                                <div
                                    key={member.id}
                                    onClick={() => toggleMember(member.id)}
                                    className={cn(
                                        "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors select-none",
                                        isSelected
                                            ? "bg-indigo-500/15 text-indigo-200"
                                            : "hover:bg-zinc-900 text-zinc-300"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Avatar className="w-6 h-6 border border-zinc-800 shrink-0">
                                            {member.image && <AvatarImage src={member.image} alt={member.name || "Member"} />}
                                            <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300 font-medium">
                                                {member.name ? member.name.substring(0, 2).toUpperCase() : "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col truncate">
                                            <span className="font-medium text-zinc-200 leading-none truncate">
                                                {member.name || "Unknown"}
                                            </span>
                                            {(member.jobTitle || member.role) && (
                                                <span className="text-[10px] text-zinc-500 leading-tight mt-0.5 truncate uppercase">
                                                    {member.jobTitle || member.role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {selectedIds.length > 0 && (
                    <div className="p-2 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400 font-medium">
                            {selectedIds.length} selected
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectionChange([])}
                            className="h-6 text-[10px] px-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        >
                            Clear All
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
