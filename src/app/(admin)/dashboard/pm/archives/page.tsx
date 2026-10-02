import { db } from "@/db";
import { agencyProjects } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectArchiveButton } from "@/features/pm/components/ProjectArchiveButton";
import { Clock, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const dynamic = 'force-dynamic';

export default async function PMArchivesPage() {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        redirect("/");
    }

    const isSuperAdmin = hasRole(session, ["superadmin"]);

    const projects = await db.query.agencyProjects.findMany({
        where: eq(agencyProjects.isArchived, true),
        with: {
            stakeholders: { with: { user: true } },
            milestones: true,
            tasks: true
        },
        orderBy: (p, { desc }) => [desc(p.updatedAt)]
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="hover:bg-muted text-foreground">
                        <Link href="/dashboard/pm">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-foreground">Archived Projects</h2>
                        <p className="text-muted-foreground text-sm">Past projects that have been completed and archived.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => {
                    const percent = project.progressPercentage ?? 0;

                    return (
                        <Card key={project.id} className="glass-card transition-all flex flex-col border-border opacity-70 hover:opacity-100">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className="border-border">Archived</Badge>
                                </div>
                                <CardTitle className="text-lg font-bold text-foreground line-clamp-1" title={project.title}>{project.title}</CardTitle>
                                <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground">
                                    {project.stakeholders?.[0]?.user?.name || "Unknown Client"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground font-mono">
                                            <span>Milestones</span>
                                            <span>{percent}%</span>
                                        </div>
                                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-4 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                                </div>
                                <div className="flex gap-1.5">
                                    {isSuperAdmin && <ProjectArchiveButton projectId={project.id} isArchived={project.isArchived} />}
                                    <Button size="sm" variant="ghost" className="h-8 hover:bg-muted text-foreground" asChild>
                                        <Link href={`/dashboard/pm/${project.id}`}>
                                            View Snapshot
                                        </Link>
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    );
                })}
                {projects.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                        No archived projects found.
                    </div>
                )}
            </div>
        </div>
    );
}
