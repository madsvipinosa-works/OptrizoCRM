import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { agencyProjects, meetings, proposalMessages, proposals } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { getSiteSettings } from "@/features/cms/actions";
import {
    ProposalDocumentSheet,
    ProposalDocumentData,
    PricingLineItem,
} from "@/features/proposals/components/ProposalDocumentSheet";
import type { ContractSettings } from "@/features/proposals/actions";
import { PricingMeetingPanel } from "@/features/proposals/components/PricingMeetingPanel";
import { BookPricingMeetingModal } from "@/features/meetings/components/BookPricingMeetingModal";
import { PaperSigningForm } from "@/features/proposals/components/PaperSigningForm";
import { SignedProposalSummary } from "@/features/proposals/components/SignedProposalSummary";
import { ProposalThread } from "@/features/proposals/components/ProposalThread";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviseProposalButton } from "@/features/proposals/components/ReviseProposalButton";
import { canCreateRevision, orderMilestones } from "@/features/proposals/draft-logic";
import { formatDateTime } from "@/lib/datetime";

export const metadata = {
    title: "Proposal | Optrizo",
    description: "A sent proposal, its negotiation thread and the next step.",
};

export const dynamic = "force-dynamic";

export default async function StaffProposalViewPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const openPricingBooking = resolvedSearchParams.book === "pricing";

    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    if (!hasRole(session, ["manager", "sales"])) {
        redirect("/dashboard");
    }

    const isManager = hasRole(session, ["manager"]);

    const proposal = await db.query.proposals.findFirst({
        where: or(eq(proposals.id, id), eq(proposals.proposalCode, id)),
        with: {
            milestones: true,
            paymentScheduleItems: true,
            lead: {
                with: {
                    client: true,
                    assignees: true,
                },
            },
        },
    });

    if (!proposal) {
        notFound();
    }

    // Sales sees only what the client received (mockup 038): a draft stays with the PM.
    if (!isManager && proposal.status === "draft") {
        redirect("/dashboard/proposals");
    }

    async function handleClosePricingBooking() {
        "use server";
        redirect(`/dashboard/proposals/${id}`);
    }

    async function handleOpenPricingBooking() {
        "use server";
        redirect(`/dashboard/proposals/${id}?book=pricing`);
    }

    const pricingMeeting = isManager
        ? await db.query.meetings.findFirst({
            where: and(
                eq(meetings.proposalId, proposal.id),
                eq(meetings.type, "budget_pricing")
            ),
            orderBy: [desc(meetings.createdAt)],
        })
        : null;

    const messages = isManager
        ? await db.query.proposalMessages.findMany({
            where: eq(proposalMessages.proposalId, proposal.id),
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
        })
        : [];

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
        projectName: proposal.projectName,
        exclusions: proposal.exclusions,
        scope: proposal.scope || "",
        technicalApproach: proposal.technicalApproach || "",
        deliverables: parsedDeliverables,
        timeline: proposal.timeline || null,
        version: proposal.version,
        priceMode: proposal.priceMode,
        currency: proposal.currency,
        totalPrice: proposal.totalPrice,
        needsGoals: proposal.needsGoals as ProposalDocumentData["needsGoals"],
        milestones: orderMilestones(proposal.milestones ?? []).map((m) => ({ ...m, startDate: m.startDate || null, endDate: m.endDate || null })),
        paymentScheduleItems: [...(proposal.paymentScheduleItems ?? [])]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item) => ({ id: item.id, label: item.label, percent: Number(item.percent) || 0, trigger: item.trigger })),
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

    const isSigned = proposal.status === "signed";
    const project = isSigned && proposal.leadId
        ? await db.query.agencyProjects.findFirst({
              where: eq(agencyProjects.leadId, proposal.leadId),
              orderBy: (p, { desc }) => [desc(p.createdAt)],
              columns: { id: true },
          })
        : null;
    const firstPayment = [...proposal.paymentScheduleItems].sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;

    const STATUS: Record<string, { label: string; tone: string }> = {
        draft: { label: "Draft", tone: "bg-muted text-muted-foreground" },
        sent: { label: "Sent", tone: "bg-stage-discovery/15 text-foreground" },
        pricing_meeting_requested: { label: "Pricing meeting requested", tone: "bg-stage-discovery/15 text-foreground" },
        changes_requested: { label: "Changes requested", tone: "bg-stage-negotiation/15 text-foreground" },
        signed: { label: "Signed", tone: "bg-brand-soft text-brand-deep" },
        declined: { label: "Declined", tone: "bg-destructive/10 text-destructive" },
        replaced: { label: "Replaced by a newer version", tone: "bg-muted text-muted-foreground" },
    };
    const status = STATUS[proposal.status] ?? { label: proposal.status, tone: "bg-muted text-muted-foreground" };
    const changesRequested = proposal.status === "changes_requested";
    const lastRequest = [...messages].reverse().find((m) => m.kind === "change_request");
    const canRevise = isManager && !!proposal.leadId && canCreateRevision(proposal.status);
    const business = proposal.lead?.businessName || proposal.lead?.contactName || "Not given";
    const client = proposal.lead?.contactName || proposal.lead?.client?.name || "Not given";

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            {/* Signed: the PM's signed view from main (SignedProposalSummary: details, PDF, next steps, Open project). */}
            {isSigned && (
                <SignedProposalSummary
                    proposalId={proposal.id}
                    proposalCode={proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`}
                    version={proposal.version}
                    businessName={proposal.lead?.businessName || proposal.lead?.contactName || "The client"}
                    clientName={proposal.lead?.client?.name || proposal.lead?.contactName || "The client"}
                    projectName={proposal.projectName}
                    signedBy={proposal.acceptedByName || proposal.signerName || "The client"}
                    signedAt={proposal.acceptedAt || proposal.signedAt}
                    online={!!proposal.signatureData}
                    total={proposal.total || 0}
                    currency={proposal.currency}
                    milestones={proposal.milestones}
                    firstPayment={firstPayment ? { label: firstPayment.label, percent: firstPayment.percent } : null}
                    projectId={project?.id ?? null}
                    showNextSteps={isManager}
                />
            )}

            {!isSigned && (
            <>
            <Link
                href="/dashboard/proposals"
                className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to proposals
            </Link>

            {/* Header (mockups 18d-18g): who it is for, then the project name and version as the title */}
            <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-[min(100%,22rem)] flex-1">
                    <p className="text-sm text-muted-foreground">
                        Business name: {business} · Client name: {client}
                    </p>
                    <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground">
                        Project name: {proposal.projectName || "Not named"} · v{proposal.version}
                    </h1>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                        <span className="tabular-nums">Proposal no. {proposal.proposalCode || proposal.id.slice(0, 8)}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button asChild variant="outline" className="bg-card active:scale-[0.97]">
                        <a href={`/api/proposals/${proposal.id}/pdf`} target="_blank" rel="noreferrer">
                            Download PDF
                        </a>
                    </Button>
                    {isManager && proposal.status === "draft" && (
                        <Button asChild className="font-semibold active:scale-[0.97]">
                            <Link href={`/dashboard/proposals/builder/${proposal.id}`}>Edit draft</Link>
                        </Button>
                    )}
                </div>
            </header>
            </>
            )}

            {/* The client asked for changes: say so, and offer the next step right away (mockup 18d). */}
            {isManager && changesRequested && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-foreground">
                    <p>
                        <span className="font-semibold text-destructive">
                            Client requested changes{lastRequest ? ` · ${formatDateTime(lastRequest.createdAt)}` : ""}.
                        </span>{" "}
                        The lead moved to Negotiation automatically. Reply, log any outside talk, then send a revised version.
                    </p>
                    {canRevise && <ReviseProposalButton leadId={proposal.leadId!} nextVersion={proposal.version + 1} />}
                </div>
            )}

            {isManager && proposal.leadId && (
                <div className="space-y-4">
                    <PricingMeetingPanel
                        proposalId={proposal.id}
                        leadId={proposal.leadId}
                        proposalStatus={proposal.status}
                        pricingMeeting={pricingMeeting ? {
                            id: pricingMeeting.id,
                            status: pricingMeeting.status as "awaiting_client" | "confirmed" | "reschedule_requested" | "done" | "cancelled",
                            startsAt: pricingMeeting.startsAt,
                            format: pricingMeeting.format,
                            agenda: pricingMeeting.agenda,
                            notes: pricingMeeting.notes,
                        } : null}
                        onBookMeeting={handleOpenPricingBooking}
                    />

                    {openPricingBooking && (
                        <BookPricingMeetingModal
                            isOpen={true}
                            onClose={handleClosePricingBooking}
                            proposalId={proposal.id}
                            proposalCode={proposal.proposalCode}
                            clientName={proposal.lead?.client?.name}
                            businessName={proposal.lead?.businessName}
                        />
                    )}

                    {/* Only when the server would accept it: a sent, priced version (signing.ts recordPaperSignature). */}
                    {proposal.status === "sent" && proposal.priceMode === "priced" && (
                    <PaperSigningForm
                        proposalId={proposal.id}
                        proposalStatus={proposal.status}
                        proposalCode={proposal.proposalCode}
                        clientName={proposal.lead?.client?.name || proposal.lead?.contactName}
                    />
                    )}
                </div>
            )}

            {/* PM: the document is the main column; the next step and the negotiation stay in view beside it.
                Sales: the document only (view only, mockup 038). */}
            {isManager ? (
                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
                    <div className="min-w-0">
                        <ProposalDocumentSheet data={documentData} agencyName={settings?.heroTitle || "Optrizo Digital Solutions"} />
                    </div>
                    <aside className="min-w-0 space-y-4 xl:sticky xl:top-6">
                        {canRevise && !changesRequested && (
                            <div className="space-y-3 rounded-xl border border-border bg-card px-5 py-4">
                                <p className="text-sm text-muted-foreground">Need to change scope, dates or price? Versions already sent stay saved.</p>
                                <ReviseProposalButton
                                    leadId={proposal.leadId!}
                                    nextVersion={proposal.version + 1}
                                    className="h-9 w-full gap-1.5 bg-card font-semibold text-foreground ring-1 ring-border hover:bg-muted active:scale-[0.97]"
                                />
                            </div>
                        )}
                        <section aria-labelledby="negotiation-heading" className="overflow-hidden rounded-xl border border-border bg-card">
                            <ProposalThread proposalId={proposal.id} messages={messages} userRole="manager" />
                        </section>
                    </aside>
                </div>
            ) : (
                <ProposalDocumentSheet data={documentData} agencyName={settings?.heroTitle || "Optrizo Digital Solutions"} />
            )}
        </div>
    );
}
