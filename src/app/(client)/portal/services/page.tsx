import { db } from "@/db";
import { auth, hasRole } from "@/auth";
import { projectStakeholders, leads, agencyProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Layers, ArrowUpRight, Clock, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AvailedServicesPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/api/auth/signin");
    }

    if (!hasRole(session, ["client", "superadmin", "manager", "sales", "developer", "content_editor"])) {
        redirect("/api/auth/signin");
    }

    const isAdminOrStaff = hasRole(session, ["superadmin", "manager", "sales", "developer", "content_editor"]);

    // 1. Fetch user's leads (Service Inquiries & Proposals)
    let clientLeads = await db.query.leads.findMany({
        where: eq(leads.clientId, session.user.id),
        with: {
            service: true,
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
            with: { service: true },
            orderBy: (leads, { desc }) => [desc(leads.createdAt)],
        });
    }

    const getLeadBadgeColor = (status: string) => {
        switch (status) {
            case "New Lead":
                return "bg-blue-500/10 text-blue-400 border-blue-500/30";
            case "Discovery & Qualifying":
                return "bg-purple-500/10 text-purple-400 border-purple-500/30";
            case "Proposal Sent":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            case "In Negotiation":
                return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
            case "Closed Won":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
            case "Closed Lost":
                return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
            default:
                return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
        }
    };

    const getProjectBadgeColor = (status: string) => {
        switch (status) {
            case "Kickoff":
                return "bg-blue-500/10 text-blue-400 border-blue-500/30";
            case "In Progress":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            case "In Review":
                return "bg-purple-500/10 text-purple-400 border-purple-500/30";
            case "Completed":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
            default:
                return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Minimalist SaaS Header */}
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Availed Services
                </h1>
                <p className="text-sm text-zinc-400 mt-1">
                    Manage and review your active service engagements, project contracts, and pending proposals.
                </p>
            </div>

            {/* Section 1: Active Engagements & Projects */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-white flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        Active Engagements & Projects ({clientProjects.length})
                    </h2>
                </div>

                {clientProjects.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-8 text-center">
                        <Layers className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
                        <h3 className="text-base font-medium text-zinc-300">No active projects</h3>
                        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
                            Once your service inquiry or proposal is accepted, your active project will appear here for full delivery tracking.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {clientProjects.map((project) => (
                            <div
                                key={project.id}
                                className="group relative rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-900/40 backdrop-blur-sm"
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <h3 className="font-semibold text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                                            {project.title}
                                            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </h3>
                                        {project.description && (
                                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                                                {project.description}
                                            </p>
                                        )}
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={getProjectBadgeColor(project.status)}
                                    >
                                        {project.status}
                                    </Badge>
                                </div>

                                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 text-zinc-500" />
                                        Started {project.createdAt.toLocaleDateString()}
                                    </span>
                                    <Link
                                        href="/portal"
                                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
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
                    <h2 className="text-lg font-medium text-white flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-400" />
                        Service Inquiries & Proposals ({clientLeads.length})
                    </h2>
                </div>

                {clientLeads.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-8 text-center">
                        <AlertCircle className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
                        <h3 className="text-base font-medium text-zinc-300">No service inquiries</h3>
                        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
                            Submit an inquiry on our Services page to request a custom proposal or technical consultation.
                        </p>
                        <Link
                            href="/services"
                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-zinc-800 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                        >
                            Browse Available Services
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {clientLeads.map((lead) => (
                            <div
                                key={lead.id}
                                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 backdrop-blur-sm space-y-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-semibold text-white">
                                            {lead.service?.title || lead.businessName || "Custom Service Request"}
                                        </h3>
                                        {lead.goals && (
                                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
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

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 text-zinc-400 border-t border-zinc-800/60">
                                    {lead.budget && (
                                        <div>
                                            <span className="text-zinc-500 block">Budget</span>
                                            <span className="font-medium text-zinc-300">{lead.budget}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-zinc-500 block">Submitted</span>
                                        <span className="font-medium text-zinc-300">
                                            {lead.createdAt.toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
