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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-primary" />
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Proposals &amp; Statements of Work
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
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
                <Card className="glass-card border-border shadow-xs">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-mono font-semibold text-muted-foreground">Total Proposals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{allProposals.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">{draftCount} Drafts, {sentCount} Sent</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border shadow-xs">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-mono font-semibold text-muted-foreground">Total SOW Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 font-mono">${totalValue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all authoring stages</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border shadow-xs">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-mono font-semibold text-muted-foreground">Approved Contracts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-primary">{approvedCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Executed client contracts</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border shadow-xs">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase font-mono font-semibold text-muted-foreground">Approval Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">
                            {allProposals.length > 0 ? `${Math.round((approvedCount / allProposals.length) * 100)}%` : "0%"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Win rate across issued SOWs</p>
                    </CardContent>
                </Card>
            </div>

            {/* Proposals Table */}
            <div className="rounded-xl border border-border glass-card overflow-hidden shadow-xs">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow className="border-border">
                            <TableHead className="text-muted-foreground">SOW Code</TableHead>
                            <TableHead className="text-muted-foreground">Client / Opportunity</TableHead>
                            <TableHead className="text-muted-foreground">Status</TableHead>
                            <TableHead className="text-muted-foreground">Total ($)</TableHead>
                            <TableHead className="text-muted-foreground">Timeline</TableHead>
                            <TableHead className="text-muted-foreground">Created</TableHead>
                            <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allProposals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                                    No proposals created yet. Create a deal in the sales pipeline to generate a proposal.
                                </TableCell>
                            </TableRow>
                        ) : (
                            allProposals.map((proposal) => {
                                const clientName = proposal.lead?.businessName || proposal.lead?.contactName || proposal.lead?.client?.name || "Unnamed Opportunity";
                                return (
                                    <TableRow key={proposal.id} className="border-border hover:bg-muted/40 transition-colors">
                                        <TableCell className="font-mono text-xs font-semibold text-primary">
                                            {proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-foreground text-xs">{clientName}</span>
                                                <span className="text-[11px] text-muted-foreground">{proposal.lead?.contactEmail || proposal.lead?.client?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={getStatusBadge(proposal.status)}>
                                                {proposal.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-emerald-500 dark:text-emerald-400">
                                            ${(Number(proposal.total) || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {proposal.timeline || "4-6 Weeks"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
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
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-xs border border-border transition-colors"
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
            return "bg-muted text-muted-foreground border-border text-[10px]";
        case "Sent":
            return "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30 text-[10px]";
        case "Approved":
            return "bg-primary/10 text-primary border-primary/30 text-[10px]";
        case "Rejected":
            return "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30 text-[10px]";
        default:
            return "bg-muted text-muted-foreground border-border text-[10px]";
    }
}
