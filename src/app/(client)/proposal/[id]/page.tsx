import { notFound } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { ProposalClientView } from "@/features/proposals/components/ProposalClientView";
import { PricingLineItem } from "@/features/proposals/components/ProposalDocumentSheet";
import { getSiteSettings } from "@/features/cms/actions";

export const metadata = {
    title: "Project Proposal | Optrizo",
    description: "Review, download, and digitally sign your project proposal.",
};

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

    // Access Control: 
    // Strictly block internal production/marketing roles from financial proposal data
    const userRole = (session.user as any)?.role;
    if (["editor", "developer", "content_editor"].includes(userRole)) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-md bg-destructive/10 border border-destructive/20 p-8 rounded-xl">
                    <h1 className="text-2xl font-bold text-destructive font-serif">Access Denied</h1>
                    <p className="text-foreground/80 text-sm">Forbidden: Insufficient permissions to view financial proposal agreements.</p>
                </div>
            </div>
        );
    }

    const isStaff = hasRole(session, ["superadmin", "manager", "sales"]);
    const isOwner =
        proposal.lead &&
        (session.user.id === proposal.lead.clientId ||
         session.user.email === proposal.lead.client?.email ||
         session.user.email === proposal.lead.contactEmail);

    if (userRole === "client") {
        if (!isOwner) {
            return (
                <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                    <div className="text-center space-y-4 max-w-md bg-destructive/10 border border-destructive/20 p-8 rounded-xl">
                        <h1 className="text-2xl font-bold text-destructive font-serif">Access Denied</h1>
                        <p className="text-foreground/80 text-sm">Forbidden: You do not own this proposal.</p>
                    </div>
                </div>
            );
        }
    } else if (!isStaff) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-md bg-destructive/10 border border-destructive/20 p-8 rounded-xl">
                    <h1 className="text-2xl font-bold text-destructive font-serif">Access Denied</h1>
                    <p className="text-foreground/80 text-sm">You do not have permission to view this proposal.</p>
                    <div className="bg-background/80 p-3 rounded-lg text-xs text-left font-mono mt-4 space-y-1 text-muted-foreground">
                        <p><strong>Signed in as:</strong> {session.user.email}</p>
                    </div>
                </div>
            </div>
        );
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

    return (
        <div className="min-h-screen bg-muted/20 text-foreground selection:bg-primary/30 py-8 md:py-14 px-4 sm:px-6 lg:px-8 print:min-h-0 print:bg-white print:p-0 print:m-0 print:w-full">
            <div className="max-w-4xl mx-auto print:max-w-none print:w-full print:m-0 print:p-0">
                <ProposalClientView 
                    proposal={proposal} 
                    parsedDeliverables={parsedDeliverables}
                    parsedPricing={parsedPricing}
                    isPreview={!isOwner}
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
