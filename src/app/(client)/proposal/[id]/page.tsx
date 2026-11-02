import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals, proposalMessages } from "@/db/schema";
import { and, eq, gt, inArray, ne, or } from "drizzle-orm";
import { ProposalClientView } from "@/features/proposals/components/ProposalClientView";
import { PricingLineItem } from "@/features/proposals/components/ProposalDocumentSheet";
import { getSiteSettings } from "@/features/cms/actions";
import { getWhatChanged } from "@/features/proposals/utils/whatChanged";

export const metadata = {
    title: "Project Proposal | Optrizo",
    description: "Review, download, and digitally sign your project proposal.",
};

export const dynamic = 'force-dynamic';

export default async function ProposalPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-md p-8 rounded-xl border border-border bg-card shadow-lg">
                    <h1 className="text-2xl font-serif font-bold">Authentication Required</h1>
                    <p className="text-sm text-muted-foreground">You must sign in to review and execute this project proposal.</p>
                </div>
            </div>
        );
    }

    const proposal = await db.query.proposals.findFirst({
        where: or(eq(proposals.id, id), eq(proposals.proposalCode, id)),
        with: {
            milestones: true,
            paymentScheduleItems: true,
            lead: {
                with: {
                    client: true,
                },
            },
        },
    });

    if (!proposal) {
        notFound();
    }

    // Strictly redirect staff to dashboard read-only proposal view per Session 1 rules
    if (hasRole(session, ["manager", "sales"])) {
        redirect(`/dashboard/proposals/${proposal.id}`);
    }

    // Access Control: /proposal is client only, no staff fallback
    if (!hasRole(session, ["client"])) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-md bg-destructive/10 border border-destructive/20 p-8 rounded-xl">
                    <h1 className="text-2xl font-bold text-destructive font-serif">Access Denied</h1>
                    <p className="text-foreground/80 text-sm">You do not have permission to view this proposal.</p>
                </div>
            </div>
        );
    }

    const isOwner =
        proposal.lead &&
        (session.user.id === proposal.lead.clientId ||
         session.user.email === proposal.lead.client?.email ||
         session.user.email === proposal.lead.contactEmail);

    if (!isOwner) {
        notFound();
    }

    // Clients see proposals only in active sent/discussion/signed/declined statuses. 404 on draft and replaced.
    if (proposal.status === "draft" || proposal.status === "replaced") {
        notFound();
    }


    // Parse the JSON data safely
    let parsedDeliverables: string[] = [];
    let parsedPricing: { items: PricingLineItem[]; total: number; subtotal?: number; discount?: number; tax?: number } = {
        items: [],
        total: proposal.total || 0,
        subtotal: proposal.subtotal || proposal.total || 0,
        discount: proposal.discount || 0,
        tax: proposal.tax || 0,
    };

    try {
        if (proposal.deliverables) {
            let raw = proposal.deliverables;
            if (typeof raw === "string") {
                try { raw = JSON.parse(raw); } catch { raw = [raw]; }
            }
            if (Array.isArray(raw)) {
                parsedDeliverables = raw.map((d: any) => {
                    if (typeof d === "string") return d;
                    if (d && typeof d === "object") {
                        return d.title ? (d.description ? `${d.title}: ${d.description}` : d.title) : (d.description || JSON.stringify(d));
                    }
                    return String(d || "");
                }).filter((s) => typeof s === "string" && s.trim() !== "");
            }
        }
        if (proposal.pricingStructure) {
            let raw = proposal.pricingStructure;
            if (typeof raw === "string") {
                try { raw = JSON.parse(raw); } catch { /* ignore */ }
            }
            if (typeof raw === "object" && raw !== null && "items" in raw && Array.isArray((raw as any).items)) {
                raw = (raw as any).items;
            }
            if (Array.isArray(raw)) {
                parsedPricing.items = raw.map((i: any) => {
                    const name = i.name || i.title || i.description || "Service Item";
                    const description = i.description || "";
                    const quantity = Number(i.quantity) || 1;
                    const unitPrice = Number(i.unitPrice ?? i.amount ?? i.price) || 0;
                    const total = Number(i.total) || quantity * unitPrice;
                    return { name, description, quantity, unitPrice, total };
                });
            }
        }
    } catch (e) {
        console.error("Error parsing proposal data:", e);
    }

    const settings = await getSiteSettings();

    // Query previous version to compute what changed if version > 1
    let previousProposal = null;
    if (proposal.leadId && proposal.version > 1) {
        previousProposal = await db.query.proposals.findFirst({
            where: and(
                eq(proposals.leadId, proposal.leadId),
                eq(proposals.version, proposal.version - 1)
            ),
            with: {
                milestones: true,
                paymentScheduleItems: true,
            },
        });
    }

    const whatChanged = previousProposal
        ? getWhatChanged(proposal, previousProposal)
        : [];

    // Check if this proposal is the current latest non-replaced version
    const higherVersion = proposal.leadId
        ? await db.query.proposals.findFirst({
            where: and(
                eq(proposals.leadId, proposal.leadId),
                gt(proposals.version, proposal.version),
                ne(proposals.status, "draft")
            ),
        })
        : null;
    const isCurrent = !higherVersion;

    // Load proposal messages (only kinds change_request, message, reply; NOT outside_discussion)
    const messages = await db.query.proposalMessages.findMany({
        where: and(
            eq(proposalMessages.proposalId, proposal.id),
            inArray(proposalMessages.kind, ["change_request", "message", "reply"])
        ),
        with: {
            author: {
                columns: {
                    id: true,
                    name: true,
                    role: true,
                    email: true,
                },
            },
        },
        orderBy: (msg, { asc }) => [asc(msg.createdAt)],
    });

    return (
        <div className="min-h-screen bg-muted/20 text-foreground selection:bg-primary/30 py-8 md:py-14 px-4 sm:px-6 lg:px-8 print:min-h-0 print:bg-white print:p-0 print:m-0 print:w-full">
            <div className="max-w-4xl mx-auto print:max-w-none print:w-full print:m-0 print:p-0">
                <ProposalClientView 
                    proposal={proposal} 
                    parsedDeliverables={parsedDeliverables}
                    parsedPricing={parsedPricing}
                    isPreview={!isOwner}
                    isCurrent={isCurrent}
                    whatChanged={whatChanged}
                    messages={messages}
                    settings={settings ? {
                        logoUrl: settings.logoUrl,
                        logoDarkUrl: settings.logoDarkUrl,
                        faviconUrl: settings.faviconUrl,
                        heroTitle: settings.heroTitle,
                    } : null}
                />
            </div>
        </div>
    );
}
