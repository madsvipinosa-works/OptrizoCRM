import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Edit } from "lucide-react";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { DeleteProjectButton } from "@/features/cms/components/DeleteProjectButton";

export default async function ProjectsPage() {
    const allProjects = await db.query.projects.findMany({
        orderBy: [desc(projects.createdAt)],
    });

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects (Portfolio)</h1>
                    <p className="text-muted-foreground">Showcase your best work.</p>
                </div>
                <Button asChild className="bg-primary text-black font-bold">
                    <Link href="/dashboard/portfolio/new">
                        <Plus className="mr-2 h-4 w-4" /> New Project
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allProjects.map((project) => (
                    <Card key={project.id} className="bg-black/40 border-primary/20 flex flex-col justify-between">
                        <CardHeader>
                            <CardTitle className="line-clamp-2">{project.title}</CardTitle>
                            <div className="flex justify-between items-center mt-2">
                                <CardDescription className="text-xs uppercase tracking-wider text-primary">
                                    {project.clientName || "Unknown Client"}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardFooter className="flex justify-between border-t border-white/10 pt-4">
                            <div className="text-xs text-muted-foreground">
                                {project.status === 'published' ? (
                                    <span className="text-green-500 font-medium">Published</span>
                                ) : (
                                    <span className="text-yellow-500 font-medium">Draft</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                                    <Link href={`/dashboard/portfolio/${project.id}`}>
                                        <Edit className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <DeleteProjectButton id={project.id} />
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {allProjects.length === 0 && (
                    <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-lg">
                        <p className="text-muted-foreground">No projects yet. Add your first case study!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
