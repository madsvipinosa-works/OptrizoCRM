/** Row status and current milestone for the Projects list (mockup step 21). */

type Milestone = { title: string; status: string; order: number; deletedAt?: Date | null };
type Task = { status: string; dueDate: Date | null };

export type ProjectTone = "done" | "new" | "late" | "ok";

export function projectState(
    project: { status: string; milestones: Milestone[]; tasks: Task[] },
    now: Date = new Date()
): { label: string; tone: ProjectTone; milestone: string } {
    const milestones = project.milestones.filter((m) => !m.deletedAt).sort((a, b) => a.order - b.order);
    const current = milestones.find((m) => m.status !== "Completed") ?? milestones.at(-1);
    const milestone = current?.title ?? "Not set";

    if (project.status === "Completed") return { label: "Completed", tone: "done", milestone };
    if (project.tasks.length === 0) return { label: "New: assign tasks", tone: "new", milestone };
    const overdue = project.tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate.getTime() < now.getTime()).length;
    if (overdue > 0) return { label: `${overdue} ${overdue === 1 ? "task" : "tasks"} overdue`, tone: "late", milestone };
    return { label: "On track", tone: "ok", milestone };
}
