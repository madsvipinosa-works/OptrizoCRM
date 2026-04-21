"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Plus, X, Copy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addProjectTeamMember, removeProjectTeamMember, updateProjectSettings } from "@/features/pm/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type InternalUser = {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
    role: "user" | "admin" | "editor" | "client";
};

type ProjectTeamMember = {
    userId: string;
    roleInProject: string | null;
    user: InternalUser | null;
};

export function ProjectSettingsModal({
    project,
    internalUsers,
    projectTeamMembers,
}: {
    project: { id: string, stagingUrls: string[] | null, leadId: string | null, lead: { files: string[] | null } | null };
    internalUsers: InternalUser[];
    projectTeamMembers: ProjectTeamMember[];
}) {
    const [open, setOpen] = useState(false);
    const [stagingUrls, setStagingUrls] = useState<string[]>(project.stagingUrls || []);
    const [files, setFiles] = useState<string[]>(project.lead?.files || []);
    const [isSaving, setIsSaving] = useState(false);
    const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>(projectTeamMembers || []);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [searchUserTerm, setSearchUserTerm] = useState<string>("");
    const [roleInProject, setRoleInProject] = useState<string>("");
    const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);

    const existingMemberIds = new Set(teamMembers.map((member) => member.userId));
    const availableUsers = internalUsers.filter((user) => !existingMemberIds.has(user.id));
    const filteredAvailableUsers = availableUsers.filter((user) => {
        const q = searchUserTerm.trim().toLowerCase();
        if (!q) return true;
        const haystack = `${user.name || ""} ${user.email} ${user.role}`.toLowerCase();
        return haystack.includes(q);
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        // Clean up empty strings
        const cleanUrls = stagingUrls.filter(u => u.trim() !== "");
        const cleanFiles = files.filter(f => f.trim() !== "");

        const res = await updateProjectSettings(project.id, project.leadId, cleanUrls, cleanFiles);
        setIsSaving(false);
        if (res.success) {
            toast.success("Project settings updated.");
            setOpen(false);
        } else {
            toast.error(res.message || "Failed to save.");
        }
    };

    const handleAddTeamMember = async () => {
        if (!selectedUserId) {
            toast.error("Select a team member first.");
            return;
        }
        setIsUpdatingTeam(true);
        const res = await addProjectTeamMember(project.id, selectedUserId, roleInProject);
        if (res.success) {
            const addedUser = internalUsers.find((user) => user.id === selectedUserId) || null;
            setTeamMembers((prev) => [...prev, { userId: selectedUserId, roleInProject: roleInProject || null, user: addedUser }]);
            setSelectedUserId("");
            setSearchUserTerm("");
            setRoleInProject("");
            toast.success("Team member added.");
        } else {
            toast.error(res.message || "Failed to add team member.");
        }
        setIsUpdatingTeam(false);
    };

    const handleRemoveTeamMember = async (userId: string) => {
        setIsUpdatingTeam(true);
        const res = await removeProjectTeamMember(project.id, userId);
        if (res.success) {
            setTeamMembers((prev) => prev.filter((member) => member.userId !== userId));
            toast.success("Team member removed.");
        } else {
            toast.error(res.message || "Failed to remove team member.");
        }
        setIsUpdatingTeam(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-white/10 hover:bg-white/10">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-6 pt-4">

                    <div className="space-y-3">
                        <Label>Client Portal Access</Label>
                        <p className="text-xs text-muted-foreground">Share this link with your client so they can access their dashboard and documents.</p>
                        <div className="flex gap-2">
                            <Input
                                className="bg-black/50 border-white/10 font-mono text-xs"
                                readOnly
                                value={typeof window !== "undefined" ? `${window.location.origin}/portal` : ""}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="border-white/10 hover:bg-white/10 shrink-0"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/portal`);
                                    toast.success("Portal link copied to clipboard");
                                }}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Project Team</Label>
                        <p className="text-xs text-muted-foreground">Only this roster appears in task assignee dropdowns for this project.</p>
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input
                                    className="bg-black/50 border-white/10 pl-9"
                                    value={searchUserTerm}
                                    onChange={(e) => setSearchUserTerm(e.target.value)}
                                    placeholder={availableUsers.length > 0 ? "Search by name, email, or role" : "All internal users are already included"}
                                    disabled={availableUsers.length === 0}
                                />
                            </div>
                            <div className="max-h-52 overflow-y-auto rounded-md border border-white/10 bg-black/30 p-1">
                                {filteredAvailableUsers.length === 0 ? (
                                    <p className="px-2 py-2 text-xs text-muted-foreground">
                                        {availableUsers.length === 0 ? "No available internal users left to add." : "No matching users found."}
                                    </p>
                                ) : (
                                    filteredAvailableUsers.map((user) => {
                                        const isSelected = selectedUserId === user.id;
                                        return (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => setSelectedUserId(user.id)}
                                                className={`w-full text-left flex items-start gap-3 rounded-md p-2 border transition-colors ${isSelected ? "border-primary/70 bg-primary/15" : "border-transparent hover:border-white/10 hover:bg-white/5"}`}
                                            >
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
                                                    <AvatarFallback className="bg-white/10 text-xs">
                                                        {(user.name || user.email).slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm whitespace-normal break-words">{user.name || "Unnamed User"}</p>
                                                    <p className="text-xs text-muted-foreground whitespace-normal break-all">{user.email}</p>
                                                    <p className="text-[11px] uppercase tracking-wide text-primary/90 mt-0.5">{user.role}</p>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                className="bg-black/50 border-white/10"
                                value={roleInProject}
                                onChange={(e) => setRoleInProject(e.target.value)}
                                placeholder="Role tag (optional)"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="border-white/10 hover:bg-white/10"
                                disabled={isUpdatingTeam || availableUsers.length === 0 || !selectedUserId}
                                onClick={handleAddTeamMember}
                            >
                                Add
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {teamMembers.length === 0 ? (
                                <p className="text-xs text-amber-300/90 border border-amber-300/20 bg-amber-300/10 rounded-md px-3 py-2">
                                    No project team members yet. Add members to enable assignee selection in tasks.
                                </p>
                            ) : (
                                teamMembers.map((member) => (
                                    <div key={member.userId} className="flex items-start justify-between gap-2 border border-white/10 rounded-md px-3 py-2 bg-black/30">
                                        <div className="min-w-0">
                                            <p className="text-sm whitespace-normal break-words">{member.user?.name || member.user?.email || member.userId}</p>
                                            <p className="text-[11px] text-muted-foreground">{member.roleInProject || "No project role tag"}</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                            disabled={isUpdatingTeam}
                                            onClick={() => handleRemoveTeamMember(member.userId)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Staging & Preview URLs</Label>
                        <p className="text-xs text-muted-foreground">Add links to your deployment previews or live staging sites so the client can review them.</p>
                        {stagingUrls.map((url, i) => (
                            <div key={i} className="flex gap-2">
                                <Input
                                    className="bg-black/50 border-white/10"
                                    value={url}
                                    onChange={e => {
                                        const newUrls = [...stagingUrls];
                                        newUrls[i] = e.target.value;
                                        setStagingUrls(newUrls);
                                    }}
                                    placeholder="https://"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => setStagingUrls(stagingUrls.filter((_, idx) => idx !== i))}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => setStagingUrls([...stagingUrls, ""])} className="w-full text-xs py-1 h-8 bg-white/5 border-white/10 hover:bg-white/10">
                            <Plus className="h-3 w-3 mr-1" /> Add URL
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <Label>Document Hub Links</Label>
                        <p className="text-xs text-muted-foreground">Add Google Docs, PDFs, Figma Links, or any file links directly to the client portal document hub.</p>
                        {files.map((file, i) => (
                            <div key={i} className="flex gap-2">
                                <Input
                                    className="bg-black/50 border-white/10"
                                    value={file}
                                    onChange={e => {
                                        const newFiles = [...files];
                                        newFiles[i] = e.target.value;
                                        setFiles(newFiles);
                                    }}
                                    placeholder="https://"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => setFiles([...files, ""])} className="w-full text-xs py-1 h-8 bg-white/5 border-white/10 hover:bg-white/10">
                            <Plus className="h-3 w-3 mr-1" /> Add Document Link
                        </Button>
                    </div>

                    <div className="pt-2">
                        <Button type="submit" disabled={isSaving} className="w-full bg-primary text-black hover:bg-primary/90">
                            {isSaving ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
