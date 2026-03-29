"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, Loader2 } from "lucide-react";
import { archiveLead } from "@/features/crm/actions";
import { toast } from "sonner"; // Using Sonner which LeadCard uses natively

export function LeadArchiveButton({ leadId }: { leadId: string }) {
    const [loading, setLoading] = useState(false);

    async function handleArchive() {
        if (!confirm("Are you sure you want to archive this lead? It will be hidden from the main Kanban pipelines.")) return;
        
        setLoading(true);
        const res = await archiveLead(leadId);
        setLoading(false);

        if (!res.success) {
            toast.error(res.message);
        } else {
            toast.success(res.message);
        }
    }

    return (
        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/20 text-red-500/80 hover:text-red-500 shrink-0" onClick={handleArchive} disabled={loading} title="Archive Lead">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
        </Button>
    );
}
