import { ProjectForm } from "@/features/cms/components/ProjectForm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: Props) {
    const { id } = await params;

    const project = await db.query.projects.findFirst({
        where: eq(projects.id, id),
    });

    if (!project) {
        notFound();
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Edit Project</h1>
                <p className="text-muted-foreground">Update case study details.</p>
            </div>
            <ProjectForm initialData={project} />
        </div>
    );
}
