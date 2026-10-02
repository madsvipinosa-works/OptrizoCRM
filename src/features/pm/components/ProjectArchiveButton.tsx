"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { archiveProject, unarchiveProject } from "@/features/pm/actions";

export function ProjectArchiveButton({ projectId, isArchived = false }: { projectId: string, isArchived?: boolean }) {
    const [loading, setLoading] = useState(false);

    async function handleArchive() {
        const confirmMsg = isArchived
            ? "Are you sure you want to restore this project? It will be moved back to the active delivery board."
            : "Are you sure you want to archive this project? It will be hidden from active views.";
        
        if (!confirm(confirmMsg)) return;
        
        setLoading(true);
        const res = isArchived ? await unarchiveProject(projectId) : await archiveProject(projectId);
        setLoading(false);

        if (!res.success) alert(res.message);
    }

    return (
        <Button size="sm" variant="ghost" className={`h-8 hover:bg-muted ${isArchived ? 'text-primary/80 hover:text-primary' : 'text-red-500/80 hover:text-red-500'}`} onClick={handleArchive} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : (
                isArchived ? <ArchiveRestore className="w-3 h-3 mr-1.5" /> : <Archive className="w-3 h-3 mr-1.5" />
            )}
            {isArchived ? "Restore" : "Archive"}
        </Button>
    );
}
