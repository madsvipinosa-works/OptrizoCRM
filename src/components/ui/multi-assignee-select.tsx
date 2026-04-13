import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AssignableUser {
    id: string;
    name: string | null;
    image?: string | null;
    jobTitle?: string | null;
}

export function MultiAssigneeSelect({
    users,
    selectedIds,
    onSelectionChange,
    triggerClassName,
    placeholder = "Unassigned"
}: {
    users: AssignableUser[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    triggerClassName?: string;
    placeholder?: string;
}) {
    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            onSelectionChange([...selectedIds, id]);
        } else {
            onSelectionChange(selectedIds.filter(v => v !== id));
        }
    };

    const displayText = selectedIds.length === 0 
        ? placeholder 
        : selectedIds.length === 1 
            ? users.find(u => u.id === selectedIds[0])?.name || "1 Selected"
            : `${selectedIds.length} Assigned`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-between font-normal bg-black/50 border-white/10 hover:bg-white/10 hover:text-white", triggerClassName)}>
                    {displayText}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px] bg-black border-white/10 text-white" align="start">
                <DropdownMenuLabel>Assign Team Members</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {users.map(user => (
                    <DropdownMenuCheckboxItem
                        key={user.id}
                        checked={selectedIds.includes(user.id)}
                        onCheckedChange={(checked) => handleSelect(user.id, checked)}
                        className="flex items-center gap-2 cursor-pointer focus:bg-white/10"
                    >
                        <span className="truncate flex-1 font-medium">{user.name || "Unknown"}</span>
                        {user.jobTitle && (
                            <Badge variant="outline" className="h-4 text-[9px] px-1 py-0 border-white/20 text-muted-foreground shrink-0 uppercase tracking-widest">
                                {user.jobTitle}
                            </Badge>
                        )}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
