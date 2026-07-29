"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Archive, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { archiveProject } from "@/features/pm/actions";
import { useRouter } from "next/navigation";

export function ProjectSettingsModal({
    project,
}: {
    project: { id: string, title?: string };
}) {
    const [open, setOpen] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const router = useRouter();

    const handleArchive = async () => {
        if (!confirm("Are you sure you want to archive this project? It will be hidden from the active dashboard.")) return;
        
        setIsArchiving(true);
        const res = await archiveProject(project.id);
        setIsArchiving(false);
        
        if (res.success) {
            toast.success("Project archived.");
            setOpen(false);
            router.push("/dashboard/pm");
        } else {
            toast.error(res.message || "Failed to archive project.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-white/10 hover:bg-white/10 text-zinc-300">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 text-white max-w-sm">
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Configuration and lifecycle management for this project.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                    <div className="space-y-3 p-4 rounded-lg border border-rose-500/20 bg-rose-500/5">
                        <div className="flex items-center gap-2 text-rose-400">
                            <AlertTriangle className="h-4 w-4" />
                            <h4 className="text-sm font-semibold">Danger Zone</h4>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Archiving this project will hide it from the active active delivery board. You can restore it later from the archives.
                        </p>
                        <Button 
                            type="button" 
                            variant="destructive" 
                            className="w-full text-xs" 
                            onClick={handleArchive}
                            disabled={isArchiving}
                        >
                            <Archive className="h-3 w-3 mr-2" />
                            {isArchiving ? "Archiving..." : "Archive Project"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
