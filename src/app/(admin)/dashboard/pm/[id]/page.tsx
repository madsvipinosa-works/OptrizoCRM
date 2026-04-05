import { db } from "@/db";
import { agencyProjects } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/features/pm/components/KanbanBoard";
import { ProjectSettingsModal } from "@/features/pm/components/ProjectSettingsModal";

export default async function KanbanBoardPage(props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        redirect("/");
    }

    const { id } = await props.params;

    // Trigger deadline checks on load
    const { checkAndNotifyOverdueTasks } = await import("@/features/pm/actions");
    await checkAndNotifyOverdueTasks();

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, id),
        with: {
            stakeholders: { with: { user: true } },
            milestones: {
                orderBy: (m, { asc }) => [asc(m.order)],
                with: {
                    feedback: {
                        orderBy: (f, { desc }) => [desc(f.createdAt)]
                    }
                }
            },
            tasks: true,
            lead: true
        }
    });

    if (!project) notFound();

    // Fetch team for assignment
    const teamMembers = await db.query.users.findMany({
        where: (users, { inArray }) => inArray(users.role, ["admin", "editor", "user"])
    });

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="hover:bg-white/10">
                        <Link href="/dashboard/pm">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-glow-sm">{project.title}</h2>
                        <p className="text-sm text-muted-foreground hidden sm:flex items-center gap-2">
                            {project.stakeholders?.[0]?.user?.name || "Unknown Client"} • Status: <span className="text-white">{project.status}</span>
                        </p>
                    </div>
                </div>
                <ProjectSettingsModal project={project} />
            </div>

            {/* The Kanban Board gets the rest of the height */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <KanbanBoard project={project as unknown as React.ComponentProps<typeof KanbanBoard>['project']} teamMembers={teamMembers as unknown as React.ComponentProps<typeof KanbanBoard>['teamMembers']} currentUserId={session.user.id} currentUserRole={session.user.role} />
            </div>
        </div>
    );
}
