import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FileText, Plus, ExternalLink, Edit3, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";

export const metadata = {
    title: "Proposals & SOWs | Optrizo",
    description: "Manage client statements of work, executive contracts, and digital proposals.",
};

export const dynamic = 'force-dynamic';

export default async function ProposalsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    if (!hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"])) {
        redirect("/dashboard");
    }

    const allProposals = await db.query.proposals.findMany({
        with: {
            lead: {
                with: {
                    client: true,
                },
            },
        },
        orderBy: [desc(proposals.createdAt)],
    });

    const totalValue = allProposals.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const approvedCount = allProposals.filter(p => p.status === "Approved").length;
    const sentCount = allProposals.filter(p => p.status === "Sent").length;
    const draftCount = allProposals.filter(p => p.status === "Draft").length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                            Proposals &amp; Statements of Work
                        </h1>
                    </div>
                    <p className="text-sm text-zinc-400">
                        Create, customize, and track executive agency proposals and legal contracts.
                    </p>
                </div>
                <Link href="/dashboard/leads">
                    <Button className="bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5 shadow-lg shadow-primary/20">
                        <Plus className="h-4 w-4" /> New Proposal from Lead
                    </Button>
                </Link>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-black/40 border-white/10 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-semibold text-zinc-400">Total Proposals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{allProposals.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">{draftCount} Drafts, {sentCount} Sent</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/10 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-semibold text-zinc-400">Total SOW Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400 font-mono">${totalValue.toLocaleString()}</div>
                        <p className="text-xs text-zinc-500 mt-1">Across all authoring stages</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/10 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-semibold text-zinc-400">Approved Contracts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-400">{approvedCount}</div>
                        <p className="text-xs text-zinc-500 mt-1">Executed client contracts</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/10 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-semibold text-zinc-400">Approval Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {allProposals.length > 0 ? `${Math.round((approvedCount / allProposals.length) * 100)}%` : "0%"}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Win rate across issued SOWs</p>
                    </CardContent>
                </Card>
            </div>

            {/* Proposals Table */}
            <div className="rounded-xl border border-white/10 bg-zinc-950/80 overflow-hidden shadow-xl backdrop-blur-md">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10">
                            <TableHead className="text-zinc-400">SOW Code</TableHead>
                            <TableHead className="text-zinc-400">Client / Opportunity</TableHead>
                            <TableHead className="text-zinc-400">Status</TableHead>
                            <TableHead className="text-zinc-400">Total ($)</TableHead>
                            <TableHead className="text-zinc-400">Timeline</TableHead>
                            <TableHead className="text-zinc-400">Created</TableHead>
                            <TableHead className="text-right text-zinc-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allProposals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-zinc-500 text-xs">
                                    No proposals created yet. Create a deal in the sales pipeline to generate a proposal.
                                </TableCell>
                            </TableRow>
                        ) : (
                            allProposals.map((proposal) => {
                                const clientName = proposal.lead?.businessName || proposal.lead?.contactName || proposal.lead?.client?.name || "Unnamed Opportunity";
                                return (
                                    <TableRow key={proposal.id} className="border-white/10 hover:bg-white/5 transition-colors">
                                        <TableCell className="font-mono text-xs font-semibold text-primary">
                                            {proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-white text-xs">{clientName}</span>
                                                <span className="text-[11px] text-zinc-400">{proposal.lead?.contactEmail || proposal.lead?.client?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={getStatusBadge(proposal.status)}>
                                                {proposal.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-emerald-400">
                                            ${(Number(proposal.total) || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-xs text-zinc-300">
                                            {proposal.timeline || "4-6 Weeks"}
                                        </TableCell>
                                        <TableCell className="text-xs text-zinc-400">
                                            {format(new Date(proposal.createdAt), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/dashboard/proposals/builder/${proposal.id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-colors"
                                                >
                                                    <Edit3 className="h-3 w-3" /> Studio
                                                </Link>
                                                <Link
                                                    href={`/proposal/${proposal.id}`}
                                                    target="_blank"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-xs border border-white/10 transition-colors"
                                                >
                                                    <ExternalLink className="h-3 w-3" /> Client View
                                                </Link>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function getStatusBadge(status: string) {
    switch (status) {
        case "Draft":
            return "bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]";
        case "Sent":
            return "bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]";
        case "Approved":
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]";
        case "Rejected":
            return "bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]";
        default:
            return "bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]";
    }
}
