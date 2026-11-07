"use client";

import React, { useState } from "react";
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
import { Loader2 } from "lucide-react";
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

export interface AvailableDeveloperUser extends TeamMemberUser {
    allOpenTasksCount?: number;
}

export interface ProjectTeamMemberRecord {
    projectId: string;
    userId: string;
    user: TeamMemberUser;
    openTaskCount?: number;
}

export interface ClientInfo {
    name: string;
    businessName: string;
}

interface ProjectTeamDrawerProps {
    projectId: string;
    projectTitle?: string;
    isOpen: boolean;
    onClose: () => void;
    teamMembers: ProjectTeamMemberRecord[];
    availableDevelopers: AvailableDeveloperUser[];
    clientInfo?: ClientInfo;
    isManager: boolean;
    onTeamUpdated?: () => void;
}

export function ProjectTeamDrawer({
    projectId,
    projectTitle,
    isOpen,
    onClose,
    teamMembers,
    availableDevelopers,
    clientInfo,
    isManager,
    onTeamUpdated,
}: ProjectTeamDrawerProps) {
    const [selectedDevId, setSelectedDevId] = useState<string>("");
    const [isAdding, setIsAdding] = useState(false);
    const [removingMember, setRemovingMember] = useState<{
        user: TeamMemberUser;
        count: number;
    } | null>(null);
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
            const res = await removeProjectTeamMember(projectId, removingMember.user.id);
            if (res.success) {
                toast.success(`Removed ${removingMember.user.name || removingMember.user.email} from project team`);
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
            <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
                <DialogContent className="sm:max-w-md max-w-[95vw] p-0 overflow-hidden gap-0">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-border bg-card">
                        <div>
                            <DialogTitle className="text-lg font-semibold text-foreground">
                                Project team
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Manage team members and view project assignments
                            </DialogDescription>
                        </div>
                        {projectTitle && (
                            <span
                                className="text-xs font-medium text-muted-foreground truncate max-w-[180px]"
                                title={projectTitle}
                            >
                                {projectTitle}
                            </span>
                        )}
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* Project Manager Section */}
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                                Project Manager
                            </h4>
                            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/40 border border-border/50 text-sm">
                                <span className="font-medium text-foreground">You</span>
                                <Badge variant="secondary" className="text-xs font-normal">
                                    PM
                                </Badge>
                            </div>
                        </div>

                        {/* Developers Section */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                                Developers
                            </h4>
                            {teamMembers.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic px-1">
                                    No developers on the team yet.
                                </p>
                            ) : (
                                <div className="space-y-1.5">
                                    {teamMembers.map((member) => {
                                        const count = member.openTaskCount || 0;
                                        return (
                                            <div
                                                key={member.userId}
                                                className="flex items-center justify-between py-2 px-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {member.user?.name || member.user?.email}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        · {count} open task{count === 1 ? "" : "s"}
                                                    </span>
                                                </div>
                                                {isManager && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setRemovingMember({
                                                                user: member.user,
                                                                count,
                                                            })
                                                        }
                                                        className="text-xs text-destructive hover:underline font-medium shrink-0 ml-2"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Add a developer (Managers only) */}
                        {isManager && (
                            <div className="space-y-2 pt-2 border-t border-border">
                                <h4 className="text-xs font-semibold text-muted-foreground">
                                    Add a developer
                                </h4>
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={selectedDevId}
                                        onValueChange={setSelectedDevId}
                                        disabled={isAdding || selectableDevelopers.length === 0}
                                    >
                                        <SelectTrigger className="flex-1 h-9 text-xs">
                                            <SelectValue
                                                placeholder={
                                                    selectableDevelopers.length === 0
                                                        ? "No more developers available"
                                                        : "Select developer..."
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectableDevelopers.map((dev) => {
                                                const count = dev.allOpenTasksCount || 0;
                                                const devName = dev.name || dev.email;
                                                return (
                                                    <SelectItem
                                                        key={dev.id}
                                                        value={dev.id}
                                                        className="text-xs"
                                                    >
                                                        {devName} · {count} open task{count === 1 ? "" : "s"}, available
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={handleAddMember}
                                        disabled={!selectedDevId || isAdding}
                                        size="sm"
                                        className="h-9 px-3 shrink-0 text-xs font-semibold"
                                    >
                                        {isAdding ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            "Add"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Read-only client line */}
                        <div className="space-y-1.5 pt-2 border-t border-border">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                                Client
                            </h4>
                            <div className="py-2 px-3 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                                <span className="truncate">
                                    {clientInfo?.name || "Client"} ({clientInfo?.businessName || "Client Business"}) · can see progress only
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Close button at bottom */}
                    <div className="flex justify-end p-4 border-t border-border bg-muted/20">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            className="h-8 px-4 text-xs font-medium"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Remove Confirmation Dialog */}
            <Dialog
                open={!!removingMember}
                onOpenChange={(open: boolean) => !open && setRemovingMember(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remove Developer from Team?</DialogTitle>
                        <DialogDescription className="space-y-2 pt-1 text-sm text-muted-foreground">
                            <span>
                                Are you sure you want to remove{" "}
                                <strong>
                                    {removingMember?.user?.name || removingMember?.user?.email}
                                </strong>{" "}
                                from this project team?
                            </span>
                            <span className="block font-medium text-foreground">
                                Reassigns {removingMember?.count || 0} open task{removingMember?.count === 1 ? "" : "s"} to you.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRemovingMember(null)}
                            disabled={isRemoving}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleConfirmRemove}
                            disabled={isRemoving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRemoving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : null}
                            Remove & Reassign
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
