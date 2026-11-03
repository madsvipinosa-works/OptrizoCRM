import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import { getClientHome } from "@/features/client-portal/queries";
import Link from "next/link";
import {
    CreditCard,
    FileText,
    Layers,
    ArrowRight,
    Bell,
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

    const { pendingProposals, activeProjects, duePayments, recentNotifications } =
        await getClientHome(session.user.id);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl">
            {/* Greeting Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Welcome back, {session.user.name?.split(" ")[0] || "Client"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Track project milestones, review contracts, and manage billing for your active engagements.
                </p>
            </div>

            {/* Action Required: Payment Due Banner */}
            {duePayments.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    Action Required: Payment Due ({duePayments.length})
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    You have milestone payment(s) awaiting verification or proof of payment submission.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-border/60 rounded-xl bg-background/60 border border-border/80">
                        {duePayments.map((p) => (
                            <div
                                key={p.id}
                                className="p-3 sm:px-4 flex items-center justify-between gap-4 text-xs"
                            >
                                <div>
                                    <div className="font-semibold text-foreground">
                                        {p.label} • {p.project?.title}
                                    </div>
                                    <div className="text-muted-foreground font-mono mt-0.5">
                                        {p.currency} {p.amount.toLocaleString()}
                                        {p.dueDate && ` • Due ${new Date(p.dueDate).toLocaleDateString()}`}
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" asChild className="h-8 text-xs shrink-0 font-semibold">
                                    <Link href={`/portal/projects/${p.projectId}/payments`}>
                                        {p.status === "proof_uploaded" ? "View Proof" : "Pay / Upload Proof"}
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending Proposals Section */}
            {pendingProposals.length > 0 && (
                <div className="glass-card rounded-2xl border border-border p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <h2 className="text-lg font-bold text-foreground">Proposals Awaiting Action</h2>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
                            <Link href="/portal/proposals">View all proposals</Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {pendingProposals.map((proposal) => (
                            <div
                                key={proposal.id}
                                className="p-4 rounded-xl border border-border bg-card/60 hover:border-primary/40 transition-colors flex flex-col justify-between space-y-3"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-mono text-muted-foreground">
                                            {proposal.proposalCode || "PROPOSAL"}
                                        </span>
                                        <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
                                            {proposal.status.replace(/_/g, " ")}
                                        </Badge>
                                    </div>
                                    <h3 className="font-semibold text-foreground text-sm">
                                        {proposal.title}
                                    </h3>
                                </div>

                                <Button size="sm" asChild className="w-full text-xs font-semibold">
                                    <Link href={`/proposal/${proposal.id}`}>
                                        Review & Sign <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Projects Overview */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Your Projects</h2>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
                        <Link href="/portal/projects">View all</Link>
                    </Button>
                </div>

                {activeProjects.length === 0 ? (
                    <div className="glass-card rounded-2xl border border-border p-8 text-center space-y-2">
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
                                    className="glass-card rounded-2xl border border-border p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-foreground text-base line-clamp-1">
                                                {project.title}
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    project.status === "Completed"
                                                        ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px]"
                                                        : "text-foreground text-[10px]"
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
                                            <span className="font-mono font-semibold text-foreground">
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
                                        <span className="text-[11px] text-muted-foreground">
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
                <div className="glass-card rounded-2xl border border-border p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" />
                        <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
                    </div>
                    <div className="divide-y divide-border/60">
                        {recentNotifications.map((n) => (
                            <div key={n.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                                <div className="space-y-0.5">
                                    <p className="text-foreground">{n.message}</p>
                                    <span className="text-[11px] text-muted-foreground">
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
