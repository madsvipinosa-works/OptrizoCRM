import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProposalBuilderStudio } from "@/features/proposals/components/ProposalBuilderStudio";

export const metadata = {
    title: "Proposal Studio | Optrizo",
    description: "Author and customize client project proposals with live preview.",
};

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

    if (!hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"])) {
        redirect("/dashboard");
    }

    const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, id),
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

    return <ProposalBuilderStudio proposal={proposal} />;
}
