import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { ProposalClientView } from "@/features/proposals/components/ProposalClientView";

export const metadata = {
    title: "Project Proposal | Optrizo",
    description: "Review and approve your project proposal.",
};

export default async function ProposalPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id || session.user.role !== "client") {
        notFound();
    }

    const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, id),
        with: {
            lead: true,
        },
    });

    if (!proposal) {
        notFound();
    }

    // Client ownership: only the client tied to this lead's email can view/act on the proposal.
    // (Proposals are login-only per your decision; no public proposal access.)
    if (!proposal.lead || session.user.email !== proposal.lead.email) {
        notFound();
    }

    // Parse the JSON data safely
    let parsedDeliverables: string[] = [];
    let parsedPricing: { items: { name: string; price: number }[]; total: number } = { items: [], total: 0 };

    try {
        if (proposal.deliverables) {
            parsedDeliverables = JSON.parse(proposal.deliverables);
        }
        if (proposal.pricingStructure) {
            parsedPricing = JSON.parse(proposal.pricingStructure);
        }
    } catch (e) {
        console.error("Failed to parse proposal JSON", e);
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary/30 py-12 md:py-24 px-4 sm:px-6 lg:px-8 bg-[url('/grid.svg')] bg-center backdrop-blur-3xl">
            <div className="max-w-4xl mx-auto space-y-8 relative">
                
                {/* Background glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] -z-10 pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] -z-10 pointer-events-none" />

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                                <span className="font-bold text-xl text-primary flex items-center mb-0.5">O</span>
                            </div>
                            <span className="text-xl font-bold tracking-tight text-white">Optrizo</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">Project Proposal</h1>
                        <p className="text-muted-foreground">Prepared for <span className="text-white font-medium">{proposal.lead?.name}</span></p>
                    </div>
                    <div className="text-left md:text-right text-sm text-muted-foreground bg-white/5 border border-white/10 p-4 rounded-xl">
                        <p className="font-medium text-white mb-1">Proposal Details</p>
                        <p>ID: {proposal.id.split('-')[0].toUpperCase()}</p>
                        <p>Date: {format(new Date(proposal.createdAt), "MMMM d, yyyy")}</p>
                        <p>Status: <span className={proposal.status === "Approved" ? "text-green-400" : "text-yellow-400"}>{proposal.status}</span></p>
                    </div>
                </div>

                <ProposalClientView 
                    proposal={proposal} 
                    parsedDeliverables={parsedDeliverables}
                    parsedPricing={parsedPricing}
                />
            </div>
        </div>
    );
}
