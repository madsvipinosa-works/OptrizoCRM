import { auth, hasRole } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getClientProject } from "@/features/client-portal/queries";
import Link from "next/link";
import {
    ArrowLeft,
    CreditCard,
    CheckCircle2,
    Clock,
    Circle,
    ShieldCheck,
    Award,
    ExternalLink,
    } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AcceptanceCard } from "@/features/client-portal/components/AcceptanceCard";
import { acceptanceState } from "@/features/pm/acceptance-state";

export const dynamic = "force-dynamic";

export default async function ClientProjectDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect(`/login?callbackUrl=/portal/projects/${id}`);
    }

    if (!hasRole(session, ["client"])) {
        redirect("/dashboard");
    }

    const project = await getClientProject(id, session.user.id);
    if (!project) notFound();

    const isCompleted = project.status === "Completed";
    const completedPercent = project.stats.total > 0
        ? Math.round((project.stats.completed / project.stats.total) * 100)
        : project.progressPercentage ?? 0;

    // Only http(s) links are rendered, so a bad value saved by staff can never become a script link.
    const previewUrls = (project.stagingUrls ?? []).filter((u) => /^https?:\/\//i.test(u));
    const duePaymentCount = project.payments.filter((p) => p.status === "due").length;

    return (
        <div className="space-y-6 max-w-5xl mx-auto py-2">
            {/* Top Bar Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/portal/projects">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                {project.title}
                            </h1>
                            <Badge
                                variant="outline"
                                className={
                                    isCompleted
                                        ? "border-brand-deep/30 text-brand-deep bg-brand-soft text-xs"
                                        : "text-foreground text-xs"
                                }
                            >
                                {project.status}
                            </Badge>
                        </div>
                        {project.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {project.description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button variant="outline" size="sm" asChild className="h-9 text-xs font-semibold">
                        <Link href={`/portal/projects/${project.id}/payments`}>
                            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                            Payments & Invoices
                            {duePaymentCount > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-stage-negotiation text-white tabular-nums text-xs">
                                    {duePaymentCount} due
                                </span>
                            )}
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Post-Completion Banner */}
            {isCompleted && (
                <div className="rounded-2xl border border-brand-deep/30 bg-brand-soft p-5 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-soft text-brand-deep flex items-center justify-center shrink-0">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-foreground">Project Successfully Delivered</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                This project has completed all delivery milestones, final payment, and formal handover.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="bg-card rounded-xl border border-border p-3 text-xs space-y-0.5">
                            <span className="text-muted-foreground tabular-nums text-xs">Completion Date</span>
                            <div className="font-semibold text-foreground">
                                {project.completedAt ? new Date(project.completedAt).toLocaleDateString() : "N/A"}
                            </div>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-3 text-xs space-y-0.5">
                            <span className="text-muted-foreground tabular-nums text-xs flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-brand-deep" /> Active Warranty Until
                            </span>
                            <div className="font-semibold text-foreground tabular-nums">
                                {project.warrantyEndsAt ? new Date(project.warrantyEndsAt).toLocaleDateString() : "N/A"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback sits right under the completion banner so it is not missed */}
            {isCompleted && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">How did we do?</h3>
                        <p className="text-sm text-muted-foreground">
                            {project.userFeedback ? "Thank you. Your feedback was sent." : "A short survey, about 2 minutes."}
                        </p>
                    </div>
                    <Button asChild variant={project.userFeedback ? "outline" : "default"}>
                        <Link href={`/portal/projects/${project.id}/feedback`}>{project.userFeedback ? "Feedback sent" : "Give feedback"}</Link>
                    </Button>
                </div>
            )}

            {!isCompleted && acceptanceState(project) === "awaiting" && (
                <AcceptanceCard projectId={project.id} documents={project.handoverDocuments} />
            )}

            {/* Preview links the PM shared (the "New preview links" notification points here) */}
            {previewUrls.length > 0 && (
                <div className="rounded-xl bg-card border border-border p-5 space-y-3">
                    <h3 className="text-base font-bold text-foreground">Preview your project</h3>
                    <div className="divide-y divide-border/60">
                        {previewUrls.map((url) => (
                            <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 py-2 text-sm text-primary hover:underline"
                            >
                                <span className="truncate">{url}</span>
                                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Milestone Progress Bar Card */}
            <div className="rounded-xl bg-card border border-border p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                        <div className="font-semibold text-foreground text-sm">Delivery Milestones</div>
                        <div className="text-muted-foreground">
                            {project.stats.completed} of {project.stats.total} milestones completed
                        </div>
                    </div>
                    <span className="text-lg tabular-nums font-semibold text-brand-deep">
                        {completedPercent}%
                    </span>
                </div>

                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${completedPercent}%` }}
                    />
                </div>
            </div>

            {/* Milestone Breakdown List */}
            <div className="rounded-xl bg-card border border-border p-5 space-y-4">
                <h3 className="text-base font-semibold text-foreground">Milestone Breakdown</h3>
                <div className="space-y-3">
                    {project.milestones.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-4 text-center">
                            No milestones configured for this project.
                        </div>
                    ) : (
                        project.milestones.map((m: { id: string; title: string; status: string; endDate?: Date | string | null; completedAt?: Date | string | null }, idx: number) => {
                            const isDone = m.status === "Completed";
                            const isInProgress = m.status === "In Progress";

                            return (
                                <div
                                    key={m.id}
                                    className="p-3.5 rounded-xl border border-border/80 bg-background/50 flex items-start gap-3.5"
                                >
                                    <div className="mt-0.5 shrink-0">
                                        {isDone ? (
                                            <CheckCircle2 className="w-5 h-5 text-brand-deep" />
                                        ) : isInProgress ? (
                                            <Clock className="w-5 h-5 text-brand-deep" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-muted-foreground/40" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-sm font-semibold text-foreground">
                                                {idx + 1}. {m.title}
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    isDone
                                                        ? "border-brand-deep/30 text-brand-deep bg-brand-soft text-xs"
                                                        : isInProgress
                                                        ? "border-primary/30 text-brand-deep bg-primary/10 text-xs"
                                                        : "text-muted-foreground text-xs"
                                                }
                                            >
                                                {m.status}
                                            </Badge>
                                        </div>

                                        <div className="text-xs text-muted-foreground pt-1 flex items-center gap-3">
                                            {m.endDate && (
                                                <span>Target: {new Date(m.endDate).toLocaleDateString()}</span>
                                            )}
                                            {isDone && m.completedAt && (
                                                <span className="text-brand-deep font-medium">
                                                    Completed on {new Date(m.completedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Handover Documents (Unlocked on Completion) */}
            {isCompleted && (
                <div className="rounded-xl bg-card border border-border p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">Handover files</h3>
                    </div>
                    {project.handoverDocuments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No handover documents attached.</p>
                    ) : (
                        <div className="divide-y divide-border/60">
                            {project.handoverDocuments.map((doc: { id: string; title: string; fileName: string; fileUrl: string }) => (
                                <div
                                    key={doc.id}
                                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                                >
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-foreground">{doc.title}</div>
                                        <div className="text-muted-foreground text-xs">{doc.fileName}</div>
                                    </div>
                                    <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                                        <a
                                            href={doc.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1"
                                        >
                                            Download <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
