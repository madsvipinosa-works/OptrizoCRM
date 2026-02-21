import { db } from "@/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const dynamic = 'force-dynamic';

export default async function PMEnginePage() {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        redirect("/");
    }

    const projects = await db.query.agencyProjects.findMany({
        with: {
            client: true,
            milestones: true,
            tasks: true
        },
        orderBy: (p, { desc }) => [desc(p.updatedAt)]
    });

    // Stats
    const totalActive = projects.filter(p => p.status !== "Completed").length;
    const blockedTasks = projects.flatMap(p => p.tasks).filter(t => t.status === "Blocked").length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-glow">Agency PM Engine</h2>
                    <p className="text-muted-foreground">Manage ongoing client projects, milestones, and tasks.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card border-white/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalActive}</div>
                    </CardContent>
                </Card>
                <Card className="glass-card border-red-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Blocked Tasks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-400">{blockedTasks}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => {
                    const progress = {
                        total: project.tasks.length,
                        completed: project.tasks.filter(t => t.status === "Done").length
                    };
                    const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
                    const hasBlocked = project.tasks.some(t => t.status === "Blocked");

                    return (
                        <Card key={project.id} className={`glass-card hover:bg-white/5 transition-all flex flex-col ${hasBlocked ? 'border-red-500/50' : 'border-white/5'}`}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant={project.status === "Completed" ? "default" : "outline"} className={`
                                        ${project.status === 'Completed' ? 'bg-green-500 text-black' : ''}
                                        ${project.status === 'In Progress' ? 'border-primary text-primary' : 'border-white/20'}
                                    `}>
                                        {project.status}
                                    </Badge>
                                    {hasBlocked && <Badge variant="destructive" className="h-5 px-1 text-[10px]">Blocked Tasks</Badge>}
                                </div>
                                <CardTitle className="text-lg line-clamp-1" title={project.title}>{project.title}</CardTitle>
                                <CardDescription className="flex items-center gap-1 text-xs">
                                    {project.client?.name || "Unknown Client"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Milestones</span>
                                            <span>{percent}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-4 border-t border-white/5 flex justify-between items-center text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                                </div>
                                <Button size="sm" variant="ghost" className="h-8 hover:bg-white/10" asChild>
                                    <Link href={`/dashboard/pm/${project.id}`}>
                                        Manage Board
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
                {projects.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg">
                        No active projects found. Mark a lead as &quot;Won&quot; to provision a project.
                    </div>
                )}
            </div>
        </div>
    );
}
