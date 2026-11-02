"use client";

import React, { useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Shield, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addProjectTeamMember, removeProjectTeamMember } from "@/features/pm/team-actions";

export interface TeamMemberUser {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
    role?: string | null;
    jobTitle?: string | null;
}

export interface ProjectTeamMemberRecord {
    projectId: string;
    userId: string;
    user: TeamMemberUser;
}

interface ProjectTeamDrawerProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    teamMembers: ProjectTeamMemberRecord[];
    availableDevelopers: TeamMemberUser[];
    isManager: boolean;
    onTeamUpdated?: () => void;
}

export function ProjectTeamDrawer({
    projectId,
    isOpen,
    onClose,
    teamMembers,
    availableDevelopers,
    isManager,
    onTeamUpdated,
}: ProjectTeamDrawerProps) {
    const [selectedDevId, setSelectedDevId] = useState<string>("");
    const [isAdding, setIsAdding] = useState(false);
    const [removingMember, setRemovingMember] = useState<TeamMemberUser | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    // Filter available developers to only those not already in the project team
    const teamUserIds = new Set(teamMembers.map((m) => m.userId));
    const selectableDevelopers = availableDevelopers.filter((dev) => !teamUserIds.has(dev.id));

    const handleAddMember = async () => {
        if (!selectedDevId) return;
        setIsAdding(true);
        try {
            const res = await addProjectTeamMember(projectId, selectedDevId);
            if (res.success) {
                toast.success("Developer added to project team");
                setSelectedDevId("");
                onTeamUpdated?.();
            } else {
                toast.error(res.message || "Failed to add team member");
            }
        } catch (error) {
            console.error("Add team member error:", error);
            toast.error("An error occurred while adding team member");
        } finally {
            setIsAdding(false);
        }
    };

    const handleConfirmRemove = async () => {
        if (!removingMember) return;
        setIsRemoving(true);
        try {
            const res = await removeProjectTeamMember(projectId, removingMember.id);
            if (res.success) {
                toast.success(`Removed ${removingMember.name || removingMember.email} from project team`);
                setRemovingMember(null);
                onTeamUpdated?.();
            } else {
                toast.error(res.message || "Failed to remove team member");
            }
        } catch (error) {
            console.error("Remove team member error:", error);
            toast.error("An error occurred while removing team member");
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
                <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
                    <SheetHeader className="p-6 border-b border-border">
                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Project Team
                        </SheetTitle>
                        <SheetDescription>
                            Developers assigned to this project team have read access and can work on tasks.
                        </SheetDescription>
                    </SheetHeader>

                    {/* Add Developer Form (Managers only) */}
                    {isManager && (
                        <div className="p-6 border-b border-border bg-muted/30">
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                <UserPlus className="h-4 w-4 text-primary" />
                                Add Developer to Team
                            </h4>
                            <div className="flex gap-2">
                                <Select
                                    value={selectedDevId}
                                    onValueChange={setSelectedDevId}
                                    disabled={isAdding || selectableDevelopers.length === 0}
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue
                                            placeholder={
                                                selectableDevelopers.length === 0
                                                    ? "No more developers available"
                                                    : "Select developer..."
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectableDevelopers.map((dev) => (
                                            <SelectItem key={dev.id} value={dev.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={dev.image || ""} />
                                                        <AvatarFallback className="text-[10px]">
                                                            {(dev.name || dev.email || "D")[0].toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span>{dev.name || dev.email}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={handleAddMember}
                                    disabled={!selectedDevId || isAdding}
                                    size="sm"
                                    className="shrink-0"
                                >
                                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Team Members List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Current Members ({teamMembers.length})
                        </h4>

                        {teamMembers.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-border rounded-xl">
                                <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">No developers on the team yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {teamMembers.map((member) => (
                                    <div
                                        key={member.userId}
                                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="h-9 w-9 shrink-0">
                                                <AvatarImage src={member.user?.image || ""} />
                                                <AvatarFallback className="font-semibold text-xs">
                                                    {(member.user?.name || member.user?.email || "U")[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground truncate">
                                                    {member.user?.name || member.user?.email}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {member.user?.email}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline" className="text-xs">
                                                Developer
                                            </Badge>
                                            {isManager && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => setRemovingMember(member.user)}
                                                    title="Remove from team"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Remove Confirmation Dialog */}
            <Dialog open={!!removingMember} onOpenChange={(open: boolean) => !open && setRemovingMember(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Developer from Team?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <strong>{removingMember?.name || removingMember?.email}</strong> from this project team?
                            <br /><br />
                            Any open (not done) tasks assigned to this developer in this project will be automatically reassigned to you.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemovingMember(null)} disabled={isRemoving}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmRemove}
                            disabled={isRemoving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            Remove & Reassign Tasks
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
