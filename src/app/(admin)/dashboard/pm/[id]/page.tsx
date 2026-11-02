import { db } from "@/db";
import { agencyProjects, projectTeamMembers, tasks, taskAssignees } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { eq, and, ne, isNull, sql } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/features/pm/components/KanbanBoard";
import { ProjectSettingsModal } from "@/features/pm/components/ProjectSettingsModal";
import { ProjectResourcesSidebar } from "@/features/pm/components/ProjectResourcesSidebar";
import { ProjectProgressCard } from "@/components/projects/weighted-progress-bar";
import { ProjectArchiveButton } from "@/features/pm/components/ProjectArchiveButton";
import { authorizeProject } from "@/lib/authz";

export default async function KanbanBoardPage(props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ view?: string; taskId?: string }>;
}) {
    const session = await auth();
    if (!hasRole(session, ["manager", "developer"])) {
        redirect("/");
    }

    const { id } = await props.params;
    const searchParams = await props.searchParams;
    const viewAll = searchParams?.view === "all";

    // Authorize project read access
    const hasReadAccess = await authorizeProject(id, "read");
    if (!hasReadAccess) {
        notFound();
    }

    const isManager = hasRole(session, ["manager"]);

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
                        orderBy: (f, { desc }) => [desc(f.createdAt)],
                    },
                },
            },
            tasks: {
                where: (tasks, { isNull }) => isNull(tasks.deletedAt),
                with: {
                    assignees: {
                        with: { user: true },
                    },
                },
            },
            lead: true,
        },
    });

    if (!project) notFound();

    // Query project team members (developers on this project)
    const teamMemberRecords = await db.query.projectTeamMembers.findMany({
        where: eq(projectTeamMembers.projectId, id),
        with: {
            user: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    jobTitle: true,
                },
            },
        },
    });

    // Team members formatted for AssigneeCombobox
    const teamMemberOptions = teamMemberRecords.map((r) => ({
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        image: r.user.image,
        role: r.user.role,
        jobTitle: r.user.jobTitle,
    }));

    // Available developers for PM to add to project team
    const availableDevelopers = isManager
        ? await db.query.users.findMany({
              where: (users, { eq, and, isNull }) =>
                  and(
                      eq(users.role, "developer"),
                      eq(users.isActive, true),
                      isNull(users.deletedAt)
                  ),
              columns: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  role: true,
                  jobTitle: true,
              },
          })
        : [];

    // Compute open task counts server-side in ONE grouped query (no per-row queries)
    // Open = status != 'done' and deletedAt is null
    const openTaskRows = await db
        .select({
            userId: taskAssignees.userId,
            projectId: tasks.projectId,
            count: sql<number>`count(*)::int`,
        })
        .from(taskAssignees)
        .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
        .where(and(ne(tasks.status, "done"), isNull(tasks.deletedAt)))
        .groupBy(taskAssignees.userId, tasks.projectId);

    const projectTaskCountsByUser = new Map<string, number>();
    const allProjectsTaskCountsByUser = new Map<string, number>();

    for (const row of openTaskRows) {
        const cnt = Number(row.count) || 0;
        allProjectsTaskCountsByUser.set(
            row.userId,
            (allProjectsTaskCountsByUser.get(row.userId) || 0) + cnt
        );
        if (row.projectId === id) {
            projectTaskCountsByUser.set(
                row.userId,
                (projectTaskCountsByUser.get(row.userId) || 0) + cnt
            );
        }
    }

    const projectTeamRecordsWithCounts = teamMemberRecords.map((r) => ({
        projectId: r.projectId,
        userId: r.userId,
        user: r.user,
        openTaskCount: projectTaskCountsByUser.get(r.userId) || 0,
    }));

    const availableDevelopersWithCounts = availableDevelopers.map((dev) => ({
        ...dev,
        allOpenTasksCount: allProjectsTaskCountsByUser.get(dev.id) || 0,
    }));

    const clientStakeholder = project.stakeholders?.find((s) => s.user?.role === "client");
    const clientName = clientStakeholder?.user?.name || project.lead?.contactName || "Client";
    const clientBusiness = clientStakeholder?.user?.companyName || project.lead?.businessName || "Client Business";
    const clientInfo = {
        name: clientName,
        businessName: clientBusiness,
    };

    return (
        <div className="space-y-3 min-h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between gap-2.5 sm:gap-4 shrink-0">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <Button variant="ghost" size="icon" asChild className="hover:bg-muted text-foreground shrink-0">
                        <Link href="/dashboard/pm">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate" title={project.title}>
                            {project.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 truncate">
                            {project.stakeholders?.[0]?.user?.name || project.lead?.contactName || "Unknown Client"} • Status:{" "}
                            <span className="text-foreground font-semibold font-mono">{project.status}</span>
                        </p>
                    </div>
                </div>

                {/* Hide resources sidebar and settings modal for developer */}
                {isManager && (
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <ProjectResourcesSidebar project={project} />
                        <ProjectSettingsModal project={project} />
                    </div>
                )}
            </div>

            {project.status === "Completed" && !project.isArchived && isManager && (
                <div className="shrink-0 bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-primary">
                        This project is marked as Completed. Would you like to archive it to clear it from the active delivery board?
                    </p>
                    <ProjectArchiveButton projectId={project.id} isArchived={project.isArchived} />
                </div>
            )}

            {/* Real-time Weighted Progress Engine Card */}
            <div className="shrink-0">
                <ProjectProgressCard projectId={project.id} />
            </div>

            {/* The Kanban Board gets the rest of the height */}
            {project.isArchived ? (
                <div className="flex-1 min-h-0 flex items-center justify-center border border-dashed border-border rounded-xl bg-muted/20">
                    <div className="text-center space-y-4 max-w-md">
                        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                            <Lock className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold">Project Archived</h3>
                        <p className="text-muted-foreground text-sm">
                            This project is archived and its Kanban board is locked. You cannot manage tasks or milestones in an archived project.
                        </p>
                        {isManager && (
                            <div className="pt-4 flex justify-center">
                                <ProjectArchiveButton projectId={project.id} isArchived={project.isArchived} />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <KanbanBoard
                        project={project as unknown as React.ComponentProps<typeof KanbanBoard>["project"]}
                        teamMembers={teamMemberOptions as unknown as React.ComponentProps<typeof KanbanBoard>["teamMembers"]}
                        availableDevelopers={availableDevelopersWithCounts}
                        projectTeamRecords={projectTeamRecordsWithCounts}
                        currentUserId={session.user.id}
                        currentUserRole={session.user.role}
                        viewAll={viewAll}
                        clientInfo={clientInfo}
                    />
                </div>
            )}
        </div>
    );
}
