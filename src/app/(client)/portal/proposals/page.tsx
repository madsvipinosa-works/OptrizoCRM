import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { FileText, ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function ClientProposalsPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/portal/proposals");
    }

    if (!hasRole(session, ["client"])) {
        redirect("/dashboard");
    }

    // Fetch client's leads and non-draft proposals
    const clientLeads = await db.query.leads.findMany({
        where: eq(leads.clientId, session.user.id),
        with: {
            proposals: {
                where: (p, { notInArray }) => notInArray(p.status, ["draft", "replaced"]),
                orderBy: (p, { desc }) => [desc(p.createdAt)],
            },
        },
    });

    const clientProposals = clientLeads.flatMap((l) =>
        l.proposals.map((p) => ({
            ...p,
            title: l.businessName || p.proposalCode || "Proposal",
            leadBusinessName: l.businessName,
            leadContactName: l.contactName,
        }))
    );

    return (
        <div className="space-y-6 max-w-6xl">
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Project Proposals
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    Review scopes of work, pricing schedules, and digitally execute proposals for your projects.
                </p>
            </div>

            {clientProposals.length === 0 ? (
                <div className="rounded-xl bg-card border border-border p-12 text-center space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/60" />
                    <h3 className="font-semibold text-foreground text-lg">No proposals available</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        When an engagement scope or proposal is prepared for your inquiry, it will appear here for your review and signature.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Proposal / Code</th>
                                <th className="px-4 py-3 font-semibold">Total Price</th>
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {clientProposals.map((p) => {
                                const isActionRequired =
                                    p.status === "sent" ||
                                    p.status === "pricing_meeting_requested" ||
                                    p.status === "changes_requested";

                                return (
                                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="font-semibold text-foreground">{p.title}</div>
                                            <div className="text-xs tabular-nums text-muted-foreground mt-0.5">
                                                {p.proposalCode || "PROPOSAL"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 tabular-nums font-medium text-foreground">
                                            {p.totalPrice !== null ? `PHP ${p.totalPrice.toLocaleString()}` : "Custom Scope"}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                                            {formatDate(p.createdAt)}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    p.status === "signed"
                                                        ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs"
                                                        : isActionRequired
                                                        ? "border-primary/30 text-primary bg-primary/10 text-xs"
                                                        : "text-muted-foreground text-xs"
                                                }
                                            >
                                                {p.status.replace(/_/g, " ")}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3.5 text-right space-x-2">
                                            {p.signedFileUrl && (
                                                <Button variant="ghost" size="sm" asChild className="h-8 text-xs text-primary">
                                                    <a
                                                        href={p.signedFileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" /> Signed Copy
                                                    </a>
                                                </Button>
                                            )}
                                            <Button size="sm" variant={isActionRequired ? "default" : "outline"} asChild className="h-8 text-xs font-semibold">
                                                <Link href={`/proposal/${p.id}`}>
                                                    {p.status === "signed" ? "View Proposal" : "Review & Sign"}
                                                    <ArrowRight className="w-3 h-3 ml-1" />
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
