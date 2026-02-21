"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateProjectSettings } from "@/features/pm/actions";

export function ProjectSettingsModal({ project }: { project: { id: string, stagingUrls: string[] | null, leadId: string | null, lead: { files: string[] | null } | null } }) {
    const [open, setOpen] = useState(false);
    const [stagingUrls, setStagingUrls] = useState<string[]>(project.stagingUrls || []);
    const [files, setFiles] = useState<string[]>(project.lead?.files || []);
    const [isSaving, setIsSaving] = useState(false);

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
