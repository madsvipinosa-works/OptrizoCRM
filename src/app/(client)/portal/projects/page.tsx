import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import { getClientProjects } from "@/features/client-portal/queries";
import Link from "next/link";
import { Layers, ArrowRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ClientProjectsPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/portal/projects");
    }

    if (!hasRole(session, ["client"])) {
        redirect("/dashboard");
    }

    const projects = await getClientProjects(session.user.id);

    return (
        <div className="space-y-6 max-w-6xl">
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Projects
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    Track the milestone progress, deliverables, and warranty of all your agency projects.
                </p>
            </div>

            {projects.length === 0 ? (
                <div className="rounded-xl bg-card border border-border p-12 text-center space-y-2">
                    <Layers className="w-10 h-10 mx-auto text-muted-foreground/60" />
                    <h3 className="font-semibold text-foreground text-lg">No active projects</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Your provisioned projects will be listed here with live milestone updates as delivery begins.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {projects.map((p) => {
                        const completedPercent = p.stats.total > 0
                            ? Math.round((p.stats.completed / p.stats.total) * 100)
                            : p.progressPercentage ?? 0;

                        const isCompleted = p.status === "Completed";

                        return (
                            <div
                                key={p.id}
                                className="rounded-xl bg-card border border-border p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-semibold text-foreground text-base line-clamp-1">
                                            {p.title}
                                        </h3>
                                        <Badge
                                            variant="outline"
                                            className={
                                                isCompleted
                                                    ? "border-brand-deep/30 text-brand-deep bg-brand-soft text-xs"
                                                    : "text-foreground text-xs"
                                            }
                                        >
                                            {p.status}
                                        </Badge>
                                    </div>

                                    {p.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {p.description}
                                        </p>
                                    )}

                                    {isCompleted && p.warrantyEndsAt && (
                                        <div className="flex items-center gap-1.5 text-xs text-brand-deep font-medium pt-1">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>Warranty active until {new Date(p.warrantyEndsAt).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Milestone Progress Bar */}
                                <div className="space-y-1.5 pt-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground font-medium">
                                            Milestones ({p.stats.completed}/{p.stats.total})
                                        </span>
                                        <span className="tabular-nums font-semibold text-foreground">
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
                                        Started {new Date(p.createdAt).toLocaleDateString()}
                                    </span>
                                    <Button size="sm" asChild className="h-8 text-xs font-semibold">
                                        <Link href={`/portal/projects/${p.id}`}>
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
    );
}
