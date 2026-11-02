import { db } from "@/db";
import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import { MyTasksList, MyTaskItem } from "@/features/pm/components/MyTasksList";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    if (!hasRole(session, ["developer", "manager"])) {
        redirect("/");
    }

    const currentUserId = session.user.id;

    // Fetch all non-deleted tasks assigned to the current user in non-archived projects
    const rawTasks = await db.query.tasks.findMany({
        where: (tasks, { isNull }) => isNull(tasks.deletedAt),
        with: {
            assignees: true,
            project: {
                columns: {
                    id: true,
                    title: true,
                    isArchived: true,
                    deletedAt: true,
                },
            },
            milestone: {
                columns: {
                    id: true,
                    title: true,
                    order: true,
                },
            },
        },
        orderBy: (tasks, { asc }) => [asc(tasks.dueDate)],
    });

    const userTasks: MyTaskItem[] = rawTasks
        .filter(
            (t) =>
                t.project &&
                !t.project.isArchived &&
                !t.project.deletedAt &&
                t.assignees?.some((a) => a.userId === currentUserId)
        )
        .map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            reviewNote: t.reviewNote,
            dueDate: t.dueDate,
            projectId: t.projectId,
            projectTitle: t.project?.title || "Untitled Project",
            milestoneId: t.milestoneId,
            milestoneTitle: t.milestone?.title || "Milestone",
        }));

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                    My tasks
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Every task assigned to you, soonest due first. Click a task to open it on its project board.
                </p>
            </div>

            <MyTasksList tasks={userTasks} />
        </div>
    );
}
