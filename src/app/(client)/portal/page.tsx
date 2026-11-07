import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import { getClientHome, getClientRequests } from "@/features/client-portal/queries";
import { ClientRequests } from "@/features/client-portal/components/ClientRequests";
import { NeedsYourAction } from "@/features/client-portal/components/NeedsYourAction";
import Link from "next/link";
import {
    Layers,
    ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/portal");
    }

    if (!hasRole(session, ["client"])) {
        redirect("/dashboard");
    }

    const [{ pendingProposals, activeProjects, duePayments, recentNotifications, newFiles }, requests] = await Promise.all([
        getClientHome(session.user.id),
        getClientRequests(session.user.id, session.user.email),
    ]);

    return (
        <div className="space-y-8">
            {/* Greeting Header */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Welcome back, {session.user.name?.split(" ")[0] || "Client"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Here is everything about your work with Optrizo.
                </p>
            </div>

            <NeedsYourAction proposals={pendingProposals} payments={duePayments} files={newFiles} />

            <ClientRequests requests={requests} />

            {/* Active Projects Overview */}
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">Your projects</h2>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
                        <Link href="/portal/projects">View all</Link>
                    </Button>
                </div>

                {activeProjects.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
                        <Layers className="w-8 h-8 mx-auto text-muted-foreground/60" />
                        <h3 className="font-semibold text-foreground">No active projects yet</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Once your proposal is accepted and provisioned, your delivery progress and milestones will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeProjects.map((project) => {
                            const completedPercent = project.stats.total > 0
                                ? Math.round((project.stats.completed / project.stats.total) * 100)
                                : project.progressPercentage ?? 0;

                            return (
                                <div
                                    key={project.id}
                                    className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between space-y-4 hover:border-brand-deep/40 transition-colors"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-base font-semibold text-foreground line-clamp-1">
                                                {project.title}
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    project.status === "Completed"
                                                        ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs"
                                                        : "text-foreground text-xs"
                                                }
                                            >
                                                {project.status}
                                            </Badge>
                                        </div>

                                        {project.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {project.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Milestone Progress Bar */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground font-medium">
                                                Milestones ({project.stats.completed}/{project.stats.total})
                                            </span>
                                            <span className="font-semibold tabular-nums text-foreground">
                                                {completedPercent}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-500"
                                                style={{ width: `${completedPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 flex items-center justify-between border-t border-border/60">
                                        <span className="text-xs text-muted-foreground">
                                            Updated {new Date(project.updatedAt).toLocaleDateString()}
                                        </span>
                                        <Button size="sm" variant="ghost" asChild className="h-8 text-xs text-primary font-semibold">
                                            <Link href={`/portal/projects/${project.id}`}>
                                                Open Project <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Recent Notifications */}
            {recentNotifications.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">Recent activity</h3>
                    </div>
                    <div className="divide-y divide-border/60">
                        {recentNotifications.map((n) => (
                            <div key={n.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                                <div className="space-y-0.5">
                                    <p className="text-foreground">{n.message}</p>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(n.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                {n.link && (
                                    <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary shrink-0">
                                        <Link href={n.link}>View</Link>
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
