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
                        "w-full justify-between bg-background border-border hover:bg-muted text-foreground font-normal shadow-xs transition-colors",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedMembers.length === 0 ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <UserPlus className="w-4 h-4" />
                                <span>{placeholder}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                                    {selectedMembers.slice(0, 3).map((m) => (
                                        <Avatar key={m.id} className="w-5 h-5 border border-border ring-1 ring-border/50">
                                            {m.image && <AvatarImage src={m.image} alt={m.name || "Member"} />}
                                            <AvatarFallback className="text-[9px] bg-primary text-black font-bold">
                                                {m.name ? m.name.substring(0, 2).toUpperCase() : "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                </div>
                                <span className="text-xs font-medium text-foreground truncate">
                                    {selectedMembers.length === 1
                                        ? selectedMembers[0].name
                                        : `${selectedMembers.length} Assignees`}
                                </span>
                            </div>
                        )}
                    </div>
                    <Users className="w-4 h-4 shrink-0 text-muted-foreground ml-2" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 bg-card border-border text-foreground shadow-xl" align="start">
                <div className="p-2 border-b border-border">
                    <div className="relative flex items-center">
                        <Search className="w-4 h-4 absolute left-2.5 text-muted-foreground" />
                        <Input
                            placeholder="Filter staff by name or role..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
                    {filteredMembers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
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
                                            ? "bg-primary/15 text-primary font-medium"
                                            : "hover:bg-muted text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Avatar className="w-6 h-6 border border-border shrink-0">
                                            {member.image && <AvatarImage src={member.image} alt={member.name || "Member"} />}
                                            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-medium">
                                                {member.name ? member.name.substring(0, 2).toUpperCase() : "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col truncate">
                                            <span className="font-medium text-foreground leading-none truncate">
                                                {member.name || "Unknown"}
                                            </span>
                                            {(member.jobTitle || member.role) && (
                                                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate uppercase font-mono">
                                                    {member.jobTitle || member.role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {selectedIds.length > 0 && (
                    <div className="p-2 border-t border-border bg-card flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium">
                            {selectedIds.length} selected
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectionChange([])}
                            className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            Clear All
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
