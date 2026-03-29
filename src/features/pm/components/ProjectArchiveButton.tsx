"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, Loader2 } from "lucide-react";
import { archiveProject } from "@/features/pm/actions";

export function ProjectArchiveButton({ projectId }: { projectId: string }) {
    const [loading, setLoading] = useState(false);

    async function handleArchive() {
        if (!confirm("Are you sure you want to archive this project? It will be hidden from active views.")) return;
        
        setLoading(true);
        const res = await archiveProject(projectId);
        setLoading(false);

        if (!res.success) alert(res.message);
    }

    return (
        <Button size="sm" variant="ghost" className="h-8 hover:bg-red-500/20 text-red-500/80 hover:text-red-500" onClick={handleArchive} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Archive className="w-3 h-3 mr-1.5" />}
            Archive
        </Button>
    );
}
