import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProposalBuilderStudio } from "@/features/proposals/components/ProposalBuilderStudio";
import { getSiteSettings } from "@/features/cms/actions";

export const metadata = {
    title: "Proposal Studio | Optrizo",
    description: "Author and customize client project proposals with live preview.",
};

export const dynamic = 'force-dynamic';

export default async function ProposalBuilderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    if (!hasRole(session, ["manager"])) {
        redirect("/dashboard/proposals");
    }

    // 1. Try finding proposal directly by proposal ID
    let proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, id),
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

    // 2. If not found by proposal ID, check if ID matches a leadId with an existing proposal
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
                },
            },
        },
        });
    }

    if (!proposal) {
        notFound();
    }

    const settings = await getSiteSettings();

    return (
        <ProposalBuilderStudio
            proposal={proposal as any}
            settings={settings ? {
                logoUrl: settings.logoUrl,
                logoDarkUrl: settings.logoDarkUrl,
                faviconUrl: settings.faviconUrl,
                heroTitle: settings.heroTitle,
            } : null}
        />
    );
}
