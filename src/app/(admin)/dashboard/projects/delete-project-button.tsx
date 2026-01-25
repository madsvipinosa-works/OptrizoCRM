"use client";

import { deleteProject } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteProjectButton({ id }: { id: string }) {
    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this project?")) {
            await deleteProject(id);
            toast.success("Project deleted.");
        }
    };

    return (
        <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:text-red-500"
            onClick={handleDelete}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    );
}
