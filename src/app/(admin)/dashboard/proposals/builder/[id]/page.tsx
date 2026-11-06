import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { getSiteSettings } from "@/features/cms/actions";
import { todayInManila } from "@/features/sprints/sprint-status";
import { DEFAULT_PROPOSAL_MILESTONES } from "@/features/proposals/constants";
import { toDateInput, type MilestoneDraft, type ScheduleDraftItem } from "@/features/proposals/draft-logic";
import { ProposalDraftEditor, type ProposalDraftEditorData } from "@/features/proposals/components/ProposalDraftEditor";
import type { ContractSettings } from "@/features/proposals/actions";
import type { PricingLineItem } from "@/features/proposals/components/ProposalDocumentSheet";

export const metadata = {
    title: "Proposal | Optrizo",
    description: "Write and send a client proposal.",
};

export const dynamic = "force-dynamic";

function parseDeliverables(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
                const d = item as { title?: string; description?: string };
                return d.title || d.description || "";
            }
            return "";
        })
        .filter((value) => value.trim() !== "");
}

function parsePricing(raw: unknown): PricingLineItem[] {
    const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
          ? (raw as { items: unknown[] }).items
          : [];
    return list.map((entry) => {
        const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
        const quantity = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice ?? item.amount ?? item.price) || 0;
        return {
            name: String(item.name || item.title || item.description || "Item"),
            description: item.description ? String(item.description) : "",
            quantity,
            unitPrice,
            total: Number(item.total) || quantity * unitPrice,
        };
    });
}

export default async function ProposalBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        if (authz.reason === "UNAUTHENTICATED") redirect("/login");
        redirect("/dashboard/proposals");
    }

    // The id is a proposal id, or a lead id (then the lead's newest proposal).
    let proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, id),
        with: {
            milestones: true,
            paymentScheduleItems: true,
            lead: {
                with: {
                    client: true,
                    discoveryForms: {
                        orderBy: (df, { desc }) => [desc(df.submittedAt)],
                        limit: 1,
                    },
                },
            },
        },
    });
    if (!proposal) {
        proposal = await db.query.proposals.findFirst({
            where: eq(proposals.leadId, id),
            orderBy: (p, { desc }) => [desc(p.createdAt)],
            with: {
            milestones: true,
            paymentScheduleItems: true,
            lead: {
                with: {
                    client: true,
                    discoveryForms: {
                        orderBy: (df, { desc }) => [desc(df.submittedAt)],
                        limit: 1,
                    },
                },
            },
        },
        });
    }
    if (!proposal) notFound();

    const settings = await getSiteSettings();
    const lead = proposal.lead;
    const discovery = lead?.discoveryForms?.[0] ?? null;

    const needsGoals = proposal.needsGoals as { needs?: string; goals?: string } | string | null;
    const needs = typeof needsGoals === "object" && needsGoals !== null ? needsGoals.needs ?? "" : typeof needsGoals === "string" ? needsGoals : "";
    const goals = typeof needsGoals === "object" && needsGoals !== null ? needsGoals.goals ?? "" : "";

    const milestoneByName = new Map((proposal.milestones ?? []).map((m) => [m.name, m]));
    const milestones: MilestoneDraft[] = DEFAULT_PROPOSAL_MILESTONES.map((def) => ({
        key: def.key,
        title: def.title,
        description: def.description,
        startDate: toDateInput(milestoneByName.get(def.name)?.startDate),
        endDate: toDateInput(milestoneByName.get(def.name)?.endDate),
    }));

    const schedule: ScheduleDraftItem[] = [...(proposal.paymentScheduleItems ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
            id: item.id,
            label: item.label,
            percent: Number(item.percent) || 0,
            trigger: item.trigger,
            sortOrder: item.sortOrder,
        }));

    const data: ProposalDraftEditorData = {
        proposalId: proposal.id,
        leadId: proposal.leadId,
        status: proposal.status,
        version: proposal.version,
        proposalCode: proposal.proposalCode || `OPT-${proposal.id.slice(0, 8)}`,
        businessName: lead?.businessName || lead?.contactName || "Client",
        clientName: lead?.contactName || lead?.client?.name || "",
        clientType: discovery?.clientType ?? lead?.clientType ?? null,
        fields: {
            projectName: proposal.projectName ?? "",
            overview: proposal.scope ?? "",
            solution: proposal.technicalApproach ?? "",
            exclusions: proposal.exclusions ?? "",
            needs,
            goals,
            priceMode: proposal.priceMode,
            currency: proposal.currency,
            totalPrice: proposal.totalPrice ?? null,
            validUntil: toDateInput(proposal.validUntil),
            terms: proposal.terms ?? "",
        },
        milestones,
        schedule,
        today: todayInManila(),
        document: {
            deliverables: parseDeliverables(proposal.deliverables),
            pricingStructure: parsePricing(proposal.pricingStructure),
            timeline: proposal.timeline,
            contractSettings: (proposal.contractSettings as ContractSettings | null) ?? null,
            createdAt: proposal.createdAt.toISOString(),
            agencyLogoUrl: settings?.logoUrl ?? null,
            agencyFaviconUrl: settings?.faviconUrl ?? null,
        },
    };

    // Remount when the saved version or status changes (after Send or Create new version).
    return <ProposalDraftEditor key={`${proposal.id}-${proposal.status}-${proposal.updatedAt.getTime()}`} data={data} />;
}
