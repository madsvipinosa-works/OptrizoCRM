import { db } from "@/db";
import { agencyProjects, projectTeamMembers, tasks, taskAssignees } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { eq, and, ne, isNull, sql } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { KanbanBoard } from "@/features/pm/components/KanbanBoard";
import { ProjectArchiveButton } from "@/features/pm/components/ProjectArchiveButton";
import { authorizeProject } from "@/lib/authz";
import { applyEndedSprints } from "@/features/sprints/sprint-end";
import { getSprints, getBacklog } from "@/features/sprints/queries";
import { excludeBacklogTasks, pickDefaultSprint } from "@/features/sprints/task-filters";

export default async function KanbanBoardPage(props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ view?: string; taskId?: string; sprint?: string }>;
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
    if (!hasReadAccess.ok) {
        notFound();
    }

    const isManager = hasRole(session, ["manager"]);

    // Lazy sprint-end cleanup and sprint loading (STOP 3)
    await applyEndedSprints(id);
    const projectSprints = await getSprints(id);

    const requestedSprintId =
        typeof searchParams?.sprint === "string" ? searchParams.sprint.trim() : "";
    const validatedSprint =
        projectSprints.find((s) => s.id === requestedSprintId) ??
        pickDefaultSprint(projectSprints);
    const selectedSprintId = validatedSprint?.id ?? null;

    // Trigger deadline checks on load
    const { checkAndNotifyOverdueTasks } = await import("@/features/pm/actions");
    await checkAndNotifyOverdueTasks();

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, id),
        with: {
            stakeholders: { with: { user: true } },
            milestones: {
                orderBy: (m, { asc }) => [asc(m.order)],
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

    // Managers only: load backlog and carried-over tasks. Developers NEVER receive backlog data.
    let managerBacklogTasks: React.ComponentProps<typeof KanbanBoard>["backlogTasks"] = undefined;
    if (isManager) {
        const rawBacklog = await getBacklog(id);
        const taskMap = new Map((project.tasks || []).map((t) => [t.id, t]));
        managerBacklogTasks = rawBacklog.map((b) => {
            const full = taskMap.get(b.id);
            return (full ?? { ...b, assignees: [] }) as unknown as NonNullable<
                React.ComponentProps<typeof KanbanBoard>["backlogTasks"]
            >[number];
        });
    }

    // Filter out backlog tasks so developers never receive backlog data and board columns only receive non-backlog tasks
    const boardProject = {
        ...project,
        tasks: excludeBacklogTasks(project.tasks || []),
    };

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
        <div className="flex w-full min-w-0 flex-col space-y-4">

            {project.status === "Completed" && !project.isArchived && isManager && (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-deep/20 bg-brand-soft px-4 py-3">
                    <p className="text-sm text-foreground">
                        This project is marked as Completed. Would you like to archive it to clear it from the active delivery board?
                    </p>
                    <ProjectArchiveButton projectId={project.id} isArchived={project.isArchived} />
                </div>
            )}

            {/* The Kanban Board gets the rest of the height */}
            {project.isArchived ? (
                <div className="flex-1 min-h-0 flex items-center justify-center border border-dashed border-border rounded-xl bg-muted/20">
                    <div className="text-center space-y-4 max-w-md">
                        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                            <Lock className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold">Project Archived</h3>
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
                <div className="flex flex-col">
                    <KanbanBoard
                        project={boardProject as unknown as React.ComponentProps<typeof KanbanBoard>["project"]}
                        teamMembers={teamMemberOptions as unknown as React.ComponentProps<typeof KanbanBoard>["teamMembers"]}
                        availableDevelopers={availableDevelopersWithCounts}
                        projectTeamRecords={projectTeamRecordsWithCounts}
                        currentUserId={session.user.id}
                        currentUserRole={session.user.role}
                        viewAll={viewAll}
                        clientInfo={clientInfo}
                        sprints={projectSprints}
                        selectedSprintId={selectedSprintId}
                        backlogTasks={isManager ? managerBacklogTasks : undefined}
                    />
                </div>
            )}
        </div>
    );
}
