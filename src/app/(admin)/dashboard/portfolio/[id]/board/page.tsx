import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getColumns } from "@/features/pm/actions";
import { Board } from "@/features/pm/components/Board";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Project Board | Optrizo",
};

export default async function ProjectBoardPage({ params }: { params: { id: string } }) {
    const project = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
    });

    if (!project) return notFound();

    const columns = await getColumns(project.id);

    // Transform columns to match Board Props (drizzle returns strict types, need to ensure compatibility)
    const formattedColumns = columns.map(col => ({
        id: col.id,
        title: col.title,
        projectId: project.id,
        tasks: col.tasks.map(t => ({
            id: t.id,
            title: t.title,
            columnId: t.columnId,
            priority: t.priority as "Low" | "Medium" | "High" | "Urgent",
            assignee: t.assignee ? {
                name: t.assignee.name,
                image: t.assignee.image
            } : null
        }))
    }));


    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between border-b border-white/10 p-4 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/projects">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold">{project.title}</h1>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Kanban Board</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Add Filter/Member controls here later */}
                    <div className="flex -space-x-2">
                        {/* Placeholder for members */}
                        <div className="h-8 w-8 rounded-full bg-primary/20 border border-black flex items-center justify-center text-xs">JH</div>
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 border border-black flex items-center justify-center text-xs">AB</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-4">
                <Board projectId={project.id} initialColumns={formattedColumns} />
            </div>
        </div>
    );
}
