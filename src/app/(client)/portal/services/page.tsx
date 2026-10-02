import { db } from "@/db";
import { auth, hasRole } from "@/auth";
import { projectStakeholders, leads, agencyProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Layers, ArrowUpRight, Clock, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getClientFacingProjectStatus } from "@/features/client-portal/utils/status-labels";

export const dynamic = "force-dynamic";

export default async function AvailedServicesPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/portal/services");
    }

    if (!hasRole(session, ["client", "superadmin", "manager", "sales", "developer", "content_editor"])) {
        redirect("/login?callbackUrl=/portal/services");
    }

    const isAdminOrStaff = hasRole(session, ["superadmin", "manager", "sales", "developer", "content_editor"]);

    // 1. Fetch user's leads (Service Inquiries & Proposals)
    let clientLeads = await db.query.leads.findMany({
        where: eq(leads.clientId, session.user.id),
        with: {
            service: true,
            proposals: {
                orderBy: (proposals, { desc }) => [desc(proposals.createdAt)],
            },
        },
        orderBy: (leads, { desc }) => [desc(leads.createdAt)],
    });

    // 2. Fetch user's active projects via stakeholders
    const userStakeholderRecords = await db.query.projectStakeholders.findMany({
        where: eq(projectStakeholders.userId, session.user.id),
        with: {
            project: true,
        },
    });

    let clientProjects = userStakeholderRecords
        .map((record) => record.project)
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Admin preview fallback if empty
    if (clientProjects.length === 0 && clientLeads.length === 0 && isAdminOrStaff) {
        clientProjects = await db.query.agencyProjects.findMany({
            limit: 5,
            orderBy: (agencyProjects, { desc }) => [desc(agencyProjects.createdAt)],
        });
        clientLeads = await db.query.leads.findMany({
            limit: 5,
            with: { 
                service: true,
                proposals: {
                    orderBy: (proposals, { desc }) => [desc(proposals.createdAt)],
                },
            },
            orderBy: (leads, { desc }) => [desc(leads.createdAt)],
        });
    }

    const getLeadBadgeColor = (status: string) => {
        switch (status) {
            case "New Lead":
                return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono";
            case "Discovery & Qualifying":
                return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-mono";
            case "Proposal Sent":
                return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono";
            case "In Negotiation":
                return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 font-mono";
            case "Closed Won":
                return "bg-primary/10 text-primary border-primary/30 font-mono font-bold";
            case "Closed Lost":
                return "bg-destructive/10 text-destructive border-destructive/30 font-mono";
            default:
                return "bg-muted text-muted-foreground border-border font-mono";
        }
    };

    const getProjectBadgeColor = (status: string) => {
        switch (status) {
            case "Kickoff":
                return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono";
            case "In Progress":
                return "bg-primary/10 text-primary border-primary/30 font-mono font-bold";
            case "In Review":
                return "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30 font-mono";
            case "Completed":
                return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono";
            default:
                return "bg-muted text-muted-foreground border-border font-mono";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Minimalist SaaS Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Availed Services
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage and review your active service engagements, project contracts, and pending proposals.
                </p>
            </div>

            {/* Section 1: Active Engagements & Projects */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        Active Engagements & Projects ({clientProjects.length})
                    </h2>
                </div>

                {clientProjects.length === 0 ? (
                    <div className="glass-card rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
                        <Layers className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold text-foreground">No active projects</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                            Once your service inquiry or proposal is accepted, your active project will appear here for full delivery tracking.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {clientProjects.map((project) => (
                            <div
                                key={project.id}
                                className="group relative rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md backdrop-blur-sm shadow-xs"
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                            {project.title}
                                            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                        </h3>
                                        {project.description && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                                {project.description}
                                            </p>
                                        )}
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={getProjectBadgeColor(project.status)}
                                    >
                                        {getClientFacingProjectStatus(project.status)}
                                    </Badge>
                                </div>

                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 font-mono text-[11px]">
                                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                        Started {project.createdAt.toLocaleDateString()}
                                    </span>
                                    <Link
                                        href="/portal"
                                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                    >
                                        View Dashboard &rarr;
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Section 2: Service Inquiries & Proposals */}
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Service Inquiries & Proposals ({clientLeads.length})
                    </h2>
                </div>

                {clientLeads.length === 0 ? (
                    <div className="glass-card rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
                        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold text-foreground">No service inquiries</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                            Submit an inquiry on our Services page to request a custom proposal or technical consultation.
                        </p>
                        <Link
                            href="/services"
                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-primary text-xs font-semibold text-black hover:bg-primary/90 transition-all shadow-xs"
                        >
                            Browse Available Services
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {clientLeads.map((lead: any) => {
                            const activeProposal = lead.proposals?.[0];
                            return (
                                <div
                                    key={lead.id}
                                    className="rounded-2xl border border-border bg-card p-5 backdrop-blur-sm space-y-4 shadow-xs hover:border-primary/50 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-semibold text-foreground">
                                                {lead.service?.title || lead.businessName || "Custom Service Request"}
                                            </h3>
                                            {lead.goals && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                                    Goals: {lead.goals}
                                                </p>
                                            )}
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={getLeadBadgeColor(lead.status)}
                                        >
                                            {lead.status}
                                        </Badge>
                                    </div>

                                    {/* Direct Proposal Access Card */}
                                    {activeProposal && (
                                        <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-primary" />
                                                    <span className="font-semibold text-xs text-foreground font-mono">
                                                        {activeProposal.proposalCode || "Statement of Work"}
                                                    </span>
                                                </div>
                                                <Badge variant="outline" className={`text-[10px] py-0 font-mono ${
                                                    activeProposal.status === "Approved"
                                                        ? "border-primary/40 text-primary bg-primary/10"
                                                        : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                                                }`}>
                                                    {activeProposal.status === "Approved" ? "Executed Contract" : "Ready for Review"}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 text-xs">
                                                <span className="font-mono text-emerald-400 font-bold">
                                                    Investment: ${(Number(activeProposal.total) || 0).toLocaleString()}
                                                </span>
                                                <Link
                                                    href={`/proposal/${activeProposal.id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-black text-xs font-bold transition-all shadow-xs"
                                                >
                                                    {activeProposal.status === "Approved" ? "View Agreement" : "Review & Sign"} &rarr;
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 text-muted-foreground border-t border-border">
                                        {lead.budget && (
                                            <div>
                                                <span className="text-muted-foreground block text-[10px] font-mono uppercase">Budget</span>
                                                <span className="font-semibold text-foreground font-mono">{lead.budget}</span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-muted-foreground block text-[10px] font-mono uppercase">Submitted</span>
                                            <span className="font-semibold text-foreground font-mono">
                                                {lead.createdAt.toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
