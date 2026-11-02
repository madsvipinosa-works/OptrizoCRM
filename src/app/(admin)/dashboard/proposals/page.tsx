import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { desc, isNull } from "drizzle-orm";
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
import { FileText, Plus, Edit3, Eye } from "lucide-react";
import { format } from "date-fns";
import { PmProposalQueue } from "@/features/proposals/components/PmProposalQueue";
import { getProposalRequestsQueue } from "@/features/proposals/actions";

export const metadata = {
    title: "Proposals & SOWs | Optrizo",
    description: "Manage client statements of work, executive contracts, and digital proposals.",
};

export const dynamic = 'force-dynamic';

type ProposalRowWithExtras = {
    totalPrice?: number | string | null;
    currency?: string | null;
    version?: number | null;
};

export default async function ProposalsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const currentUserId = session.user.id;

    if (!hasRole(session, ["sales", "manager", "superadmin"])) {
        redirect("/dashboard");
    }

    const isManager = hasRole(session, ["manager"]);

    const rawProposals = await db.query.proposals.findMany({
        where: isNull(proposals.deletedAt),
        with: {
            lead: {
                with: {
                    client: true,
                    assignees: true,
                },
            },
        },
        orderBy: [desc(proposals.createdAt)],
    });

    const allProposals = isManager
        ? rawProposals
        : rawProposals.filter((p) => {
            if (!p.lead) return false;
            const assignees = p.lead.assignees || [];
            return assignees.length === 0 || assignees.some((a) => a.userId === currentUserId);
        });

    const queueItems = isManager ? await getProposalRequestsQueue() : [];

    const totalValue = allProposals.reduce((sum, p) => sum + (Number((p as unknown as ProposalRowWithExtras).totalPrice ?? p.total) || 0), 0);
    const approvedCount = allProposals.filter(p => p.status === "signed").length;
    const sentCount = allProposals.filter(p => p.status === "sent").length;
    const draftCount = allProposals.filter(p => p.status === "draft").length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
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
                        {isManager
                            ? "Review scoped requests, author technical SOWs, and track proposal lifecycles."
                            : "Track issued proposals and client statements of work."}
                    </p>
                </div>
                {isManager && (
                    <Link href="/dashboard/leads">
                        <Button className="bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5 shadow-lg shadow-primary/20">
                            <Plus className="h-4 w-4" /> New Proposal from Lead
                        </Button>
                    </Link>
                )}
            </div>

            {/* PM Step 9 Proposal Requests Queue */}
            {isManager && (
                <PmProposalQueue items={queueItems} currentUserId={currentUserId} />
            )}

            {/* Section Heading for All Proposals */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {isManager ? "All Proposals" : "My Assigned Proposals"}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {isManager
                                ? "Complete repository of active drafts, sent proposals, and executed contracts."
                                : "Proposals for leads assigned to you (read-only view)."}
                        </p>
                    </div>
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
                                <TableHead className="text-muted-foreground">Total</TableHead>
                                <TableHead className="text-muted-foreground">Timeline</TableHead>
                                <TableHead className="text-muted-foreground">Created</TableHead>
                                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allProposals.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                                        No proposals found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                allProposals.map((proposal) => {
                                    const clientName = proposal.lead?.businessName || proposal.lead?.contactName || proposal.lead?.client?.name || "Unnamed Opportunity";
                                    const rowExtras = proposal as unknown as ProposalRowWithExtras;
                                    const price = Number(rowExtras.totalPrice ?? proposal.total);
                                    const currencySymbol = rowExtras.currency === "PHP" ? "₱" : "$";
                                    const displayPrice = isNaN(price) || price === 0 ? "TBD" : `${currencySymbol}${price.toLocaleString()}`;

                                    return (
                                        <TableRow key={proposal.id} className="border-border hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-mono text-xs font-semibold text-primary">
                                                {proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`}
                                                {rowExtras.version ? ` (v${rowExtras.version})` : ""}
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
                                                {displayPrice}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {proposal.timeline || "4-6 Weeks"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {format(new Date(proposal.createdAt), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isManager && (
                                                        <Link
                                                            href={`/dashboard/proposals/builder/${proposal.id}`}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-colors"
                                                        >
                                                            <Edit3 className="h-3 w-3" /> Studio
                                                        </Link>
                                                    )}
                                                    <Link
                                                        href={`/dashboard/proposals/${proposal.id}`}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors"
                                                    >
                                                        <Eye className="h-3 w-3" /> View
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
        </div>
    );
}

function getStatusBadge(status: string) {
    const s = status.toLowerCase();
    switch (s) {
        case "draft":
            return "bg-muted text-muted-foreground border-border text-[10px]";
        case "sent":
            return "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/30 text-[10px]";
        case "pricing_meeting_requested":
            return "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30 text-[10px]";
        case "changes_requested":
            return "bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/30 text-[10px]";
        case "approved":
        case "signed":
            return "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 text-[10px]";
        case "rejected":
        case "declined":
            return "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30 text-[10px]";
        case "replaced":
            return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30 text-[10px]";
        default:
            return "bg-muted text-muted-foreground border-border text-[10px]";
    }
}
