import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getSiteSettings } from "@/features/cms/actions";
import {
    ProposalDocumentSheet,
    ProposalDocumentData,
    PricingLineItem,
} from "@/features/proposals/components/ProposalDocumentSheet";
import type { ContractSettings } from "@/features/proposals/actions";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit3, Printer, Info } from "lucide-react";

export const metadata = {
    title: "Proposal Details | Optrizo",
    description: "Read-only staff proposal overview and specifications.",
};

export const dynamic = "force-dynamic";

export default async function StaffProposalViewPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    if (!hasRole(session, ["superadmin", "manager", "sales"])) {
        redirect("/dashboard/analytics");
    }

    const isManager = hasRole(session, ["manager", "superadmin"]);

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

    // Parse deliverables safely
    let parsedDeliverables: string[] = [];
    if (proposal.deliverables) {
        let raw = proposal.deliverables;
        if (typeof raw === "string") {
            try {
                raw = JSON.parse(raw);
            } catch {
                raw = [raw];
            }
        }
        if (Array.isArray(raw)) {
            parsedDeliverables = raw
                .map((d: unknown) => {
                    if (typeof d === "string") return d;
                    if (d && typeof d === "object") {
                        const obj = d as { title?: string; description?: string };
                        return obj.title
                            ? obj.description
                                ? `${obj.title}: ${obj.description}`
                                : obj.title
                            : obj.description || JSON.stringify(d);
                    }
                    return String(d || "");
                })
                .filter((s) => typeof s === "string" && s.trim() !== "");
        }
    }

    // Parse pricing items safely
    let parsedPricingItems: PricingLineItem[] = [];
    if (proposal.pricingStructure) {
        let raw: unknown = proposal.pricingStructure;
        if (typeof raw === "string") {
            try {
                raw = JSON.parse(raw);
            } catch {
                // ignore
            }
        }
        if (typeof raw === "object" && raw !== null && "items" in raw) {
            const container = raw as { items?: unknown };
            if (Array.isArray(container.items)) {
                raw = container.items;
            }
        }
        if (Array.isArray(raw)) {
            parsedPricingItems = raw.map((item: unknown) => {
                const i = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
                const name = String(i.name || i.title || i.description || "Service Item");
                const description = String(i.description || "");
                const quantity = Number(i.quantity) || 1;
                const unitPrice = Number(i.unitPrice ?? i.amount ?? i.price) || 0;
                const total = Number(i.total) || quantity * unitPrice;
                return { name, description, quantity, unitPrice, total };
            });
        }
    }

    const settings = await getSiteSettings();

    const documentData: ProposalDocumentData = {
        proposalCode: proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`,
        businessName: proposal.lead?.businessName || proposal.lead?.contactName || "Client Business",
        clientEmail: proposal.lead?.contactEmail || proposal.lead?.client?.email || "client@example.com",
        scope: proposal.scope || "",
        technicalApproach: proposal.technicalApproach || "",
        deliverables: parsedDeliverables,
        timeline: proposal.timeline || "4-6 Weeks",
        pricingStructure: parsedPricingItems,
        subtotal: proposal.subtotal || proposal.total || 0,
        discount: proposal.discount || 0,
        tax: proposal.tax || 0,
        total: proposal.total || 0,
        terms: proposal.terms || "",
        validUntil: proposal.validUntil,
        status: proposal.status,
        acceptedByName: proposal.acceptedByName,
        acceptedByTitle: proposal.acceptedByTitle,
        acceptedAt: proposal.acceptedAt,
        signatureData: proposal.signatureData,
        createdAt: proposal.createdAt,
        contractSettings: proposal.contractSettings as ContractSettings | null,
        agencyLogoUrl: settings?.logoUrl || null,
        agencyFaviconUrl: settings?.faviconUrl || null,
    };

    const statusBadgeClass =
        proposal.status === "Approved"
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            : proposal.status === "Sent"
            ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
            : proposal.status === "Rejected"
            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
            : "bg-muted text-muted-foreground border-border";

    return (
        <div className="space-y-6 pb-16 max-w-5xl mx-auto">
            {/* Top Bar with Navigation and Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/proposals"
                        className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Back to Proposals"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold font-serif text-foreground">
                                {proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`}
                            </h1>
                            <Badge variant="outline" className={statusBadgeClass}>
                                {proposal.status}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {proposal.lead?.businessName || proposal.lead?.contactName || "Client Opportunity"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <a
                        href={`/api/proposals/${proposal.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Export PDF</span>
                    </a>

                    {isManager && (
                        <Link
                            href={`/dashboard/proposals/builder/${proposal.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit in Studio</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* View-Only Informational Alert for Staff */}
            <div className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-3.5 text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold text-foreground">Staff Read-Only View:</span>{" "}
                    {isManager
                        ? "You are viewing the document specifications. Click 'Edit in Studio' to make changes."
                        : "The Project Manager writes, prices, and sends proposals. Use this view to review scope, deliverables, and financial terms with the client."}
                </div>
            </div>

            {/* Document Sheet */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden p-4 sm:p-8">
                <ProposalDocumentSheet
                    data={documentData}
                    agencyName={settings?.heroTitle || "Optrizo Digital Solutions"}
                />
            </div>
        </div>
    );
}
