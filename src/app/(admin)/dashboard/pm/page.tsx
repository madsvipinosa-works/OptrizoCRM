import { db } from "@/db";
import { agencyProjects } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { projectState, type ProjectTone } from "@/features/pm/project-state";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Projects | Optrizo",
    description: "Created automatically when a client signs a proposal.",
};

const TONE: Record<ProjectTone, string> = {
    new: "bg-destructive/10 text-destructive",
    late: "bg-stage-negotiation/15 text-foreground",
    ok: "bg-brand-soft text-brand-deep",
    done: "bg-muted text-muted-foreground",
};

const FILTERS = [
    ["all", "All"],
    ["active", "Active"],
    ["completed", "Completed"],
] as const;
type Filter = (typeof FILTERS)[number][0];

/** Projects list (mockup step 21). PM sees every project; a developer sees the ones they are on. */
export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<{ filter?: string }> }) {
    const session = await auth();
    if (!hasRole(session, ["manager", "developer"])) redirect("/");

    const isManager = hasRole(session, ["manager"]);
    const isDeveloper = session?.user?.role === "developer";
    const currentUserId = session?.user?.id;
    const params = await searchParams;
    const filter: Filter = FILTERS.some(([v]) => v === params?.filter) ? (params?.filter as Filter) : "all";

    const allProjects = await db.query.agencyProjects.findMany({
        where: eq(agencyProjects.isArchived, false),
        with: {
            lead: { columns: { businessName: true } },
            stakeholders: { with: { user: { columns: { name: true } } } },
            milestones: { columns: { title: true, status: true, order: true, deletedAt: true } },
            tasks: {
                where: (tasks, { isNull }) => isNull(tasks.deletedAt),
                columns: { status: true, dueDate: true },
            },
        },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    // Developer sees projects they are a team member of
    let developerProjectIds = new Set<string>();
    if (isDeveloper && currentUserId) {
        const teamRows = await db.query.projectTeamMembers.findMany({
            where: (ptm, { eq }) => eq(ptm.userId, currentUserId),
            columns: { projectId: true },
        });
        developerProjectIds = new Set(teamRows.map((r) => r.projectId));
    }

    const projects = (isDeveloper ? allProjects.filter((p) => developerProjectIds.has(p.id)) : allProjects).map((p) => ({
        ...p,
        business: p.lead?.businessName || p.stakeholders?.[0]?.user?.name || "Not linked",
        state: projectState(p),
    }));
    const shown = projects.filter((p) => (filter === "all" ? true : filter === "completed" ? p.state.tone === "done" : p.state.tone !== "done"));
    // The newest project still without tasks gets the mockup's "New project" note.
    const fresh = isManager ? projects.find((p) => p.state.tone === "new") : undefined;

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-[min(100%,22rem)] flex-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Created automatically when a client signs a proposal.</p>
                </div>
                {isManager && (
                    <Button asChild variant="outline" className="gap-1.5 bg-card active:scale-[0.97]">
                        <Link href="/dashboard/pm/archives">
                            <Archive className="size-4" aria-hidden="true" />
                            Archived
                        </Link>
                    </Button>
                )}
            </div>

            {fresh && (
                <p className="rounded-xl border border-brand-deep/20 bg-brand-soft px-4 py-3 text-sm text-foreground">
                    <span className="font-semibold">New project:</span> {fresh.title} was created when {fresh.business} signed. Open it to add and assign tasks.
                </p>
            )}

            <nav aria-label="Filter projects" className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                {FILTERS.map(([value, label]) => {
                    const active = filter === value;
                    return (
                        <Link
                            key={value}
                            href={value === "all" ? "/dashboard/pm" : `/dashboard/pm?filter=${value}`}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                                active ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {label}
                        </Link>
                    );
                })}
            </nav>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] table-fixed text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                                <th scope="col" className="w-[28%] px-5 py-2.5 font-medium">Project name</th>
                                <th scope="col" className="w-[20%] px-3 py-2.5 font-medium">Business name</th>
                                <th scope="col" className="w-[17%] px-3 py-2.5 font-medium">Current milestone</th>
                                <th scope="col" className="w-[18%] px-3 py-2.5 font-medium">Progress</th>
                                <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((p) => {
                                const percent = Math.max(0, Math.min(100, p.progressPercentage ?? 0));
                                return (
                                    <tr key={p.id} className="border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-muted/50">
                                        <td className="px-5 py-3">
                                            <Link
                                                href={`/dashboard/pm/${p.id}`}
                                                className="block truncate rounded-sm font-semibold text-foreground outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                                title={p.title}
                                            >
                                                {p.title}
                                            </Link>
                                        </td>
                                        <td className="truncate px-3 py-3 text-foreground">{p.business}</td>
                                        <td className="truncate px-3 py-3 text-foreground">{p.state.milestone}</td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    role="progressbar"
                                                    aria-valuenow={percent}
                                                    aria-valuemin={0}
                                                    aria-valuemax={100}
                                                    aria-label={`${p.title} progress`}
                                                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                                                >
                                                    <div className="h-full rounded-full bg-brand-deep" style={{ width: `${percent}%` }} />
                                                </div>
                                                <span className="w-9 text-right tabular-nums text-muted-foreground">{percent}%</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[p.state.tone])}>
                                                {p.state.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {shown.length === 0 && (
                    <div className="px-5 py-14 text-center text-sm">
                        <p className="font-medium text-foreground">{filter === "completed" ? "No completed projects yet." : "No projects yet."}</p>
                        <p className="mt-1 text-muted-foreground">A project appears here when a client signs a proposal.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
