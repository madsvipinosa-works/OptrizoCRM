import { db } from "@/db";
import { auth } from "@/auth";
import { agencyProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, LayoutTemplate, Clock, Link as LinkIcon } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function ClientPortalPage() {
    const session = await auth();
    // Assuming role guard handles unauth, but just in case:
    if (!session?.user?.id) return null;

    // Fetch the client's projects
    const projects = await db.query.agencyProjects.findMany({
        where: eq(agencyProjects.clientId, session.user.id),
        with: {
            milestones: {
                orderBy: (milestones, { asc }) => [asc(milestones.order)]
            },
            tasks: true,
            lead: true
        },
        orderBy: (agencyProjects, { desc }) => [desc(agencyProjects.createdAt)]
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-glow bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400">
                    Project Dashboard
                </h1>
                <p className="text-xl text-muted-foreground mt-2">
                    Track progress, access documents, and review staging links.
                </p>
            </div>

            {projects.length === 0 ? (
                <Card className="glass-card border-white/5 py-12 text-center">
                    <CardContent>
                        <LayoutTemplate className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Active Projects</h3>
                        <p className="text-muted-foreground">It looks like we are still preparing your project space.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-12">
                    {projects.map((project) => {
                        // Calculate Progress via Tasks
                        const totalTasks = project.tasks.length;
                        const completedTasks = project.tasks.filter(t => t.status === "Done").length;
                        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                        return (
                            <div key={project.id} className="space-y-6">
                                {/* Project Header Card */}
                                <Card className="glass-card border-white/10 relative overflow-hidden">
                                    <div
                                        className="absolute top-0 left-0 h-1 bg-primary transition-all duration-1000 ease-out"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                    <CardHeader>
                                        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                                            <div>
                                                <CardTitle className="text-2xl mb-1">{project.title}</CardTitle>
                                                <CardDescription>{project.description}</CardDescription>
                                            </div>
                                            <Badge variant={project.status === "Completed" ? "default" : "outline"} className={`
                                                ${project.status === 'Completed' ? 'bg-green-500 hover:bg-green-600' : 'border-white/20'}
                                                ${project.status === 'In Progress' ? 'border-primary text-primary' : ''}
                                            `}>
                                                {project.status}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="mb-2 flex justify-between text-sm">
                                            <span className="text-muted-foreground">Overall Progress</span>
                                            <span className="font-bold text-primary">{progressPercent}%</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Left Col: Milestones */}
                                    <div className="lg:col-span-2 space-y-4">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-primary" /> Roadmap & Milestones
                                        </h3>
                                        <div className="space-y-3">
                                            {project.milestones.map((milestone) => (
                                                <div key={milestone.id} className={`flex items-center gap-4 p-4 rounded-lg border ${milestone.status === "Completed" ? "bg-white/5 border-green-500/30 text-white" :
                                                    milestone.status === "In Progress" ? "bg-primary/10 border-primary/50 text-white" :
                                                        milestone.status === "Client Approval" ? "bg-yellow-500/10 border-yellow-500/50 text-white animate-pulse" :
                                                            "bg-black/50 border-white/5 text-muted-foreground"
                                                    }`}>
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${milestone.status === "Completed" ? "bg-green-500 text-black" :
                                                        milestone.status === "In Progress" ? "bg-primary text-black" :
                                                            "bg-white/10"
                                                        }`}>
                                                        {milestone.order}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-semibold">{milestone.title}</div>
                                                        <div className="text-xs opacity-70">Status: {milestone.status}</div>
                                                    </div>
                                                    {milestone.status === "Client Approval" && (
                                                        <Badge variant="outline" className="border-yellow-500 text-yellow-500 animate-none">
                                                            Action Required
                                                        </Badge>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Col: Docs & Links */}
                                    <div className="space-y-6">
                                        <Card className="glass-card border-white/5">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-md flex items-center gap-2">
                                                    <FileText className="h-4 w-4" /> Document Hub
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                                {project.lead?.files && project.lead.files.length > 0 ? (
                                                    project.lead.files.map((file, idx) => (
                                                        <a key={idx} href={file} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md hover:bg-white/10 transition-colors border border-white/5 border-dashed text-primary">
                                                            <FileText className="h-4 w-4 shrink-0" />
                                                            <span className="truncate">{file.split('/').pop()}</span>
                                                        </a>
                                                    ))
                                                ) : (
                                                    <p className="text-muted-foreground italic">No documents shared yet.</p>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card className="glass-card border-white/5">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-md flex items-center gap-2">
                                                    <LinkIcon className="h-4 w-4" /> Staging & Previews
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                                {project.stagingUrls && project.stagingUrls.length > 0 ? (
                                                    project.stagingUrls.map((url, idx) => (
                                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 rounded-md hover:bg-white/10 transition-colors border border-white/5">
                                                            <span className="truncate max-w-[80%] hover:underline">{new URL(url).hostname || url}</span>
                                                            <LinkIcon className="h-3 w-3 text-muted-foreground" />
                                                        </a>
                                                    ))
                                                ) : (
                                                    <p className="text-muted-foreground italic">Staging links will appear here when ready for review.</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
