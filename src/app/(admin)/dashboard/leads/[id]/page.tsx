import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { LeadDetailView } from "@/features/crm/components/LeadDetailView";
import type { LeadItem } from "@/features/crm/components/LeadsDataTable";

export const dynamic = "force-dynamic";

/**
 * Lead detail page (mockup step 3, and steps 4–8 / 18j as the lead moves on).
 * Sales sees a lead when it is assigned to them or still unassigned, the same
 * rule as the pipeline. Leads assigned to someone else return 404.
 */
export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    if (!hasRole(session, ["sales"])) redirect("/dashboard");

    const { id } = await params;
    const currentUserId = session.user.id;

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, id),
        // Only the user columns the page shows: never send password hashes or
        // other account fields to the browser.
        with: {
            client: { columns: { name: true, email: true } },
            service: { columns: { id: true, title: true } },
            activityLogs: {
                with: { author: { columns: { name: true } } },
                orderBy: (logs, { desc }) => [desc(logs.createdAt)],
            },
            assignees: { with: { user: { columns: { id: true, name: true } } } },
        },
    });
    if (!lead) notFound();

    // Server-side visibility check (not only in the UI).
    const assignedToMe = await db.query.leadAssignees.findFirst({
        where: (la, { and }) => and(eq(la.leadId, lead.id), eq(la.userId, currentUserId)),
        columns: { leadId: true },
    });
    const isUnassigned = lead.assignees.length === 0;
    if (!assignedToMe && !isUnassigned) notFound();

    const serialized = {
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        lastContactedAt: lead.lastContactedAt ? lead.lastContactedAt.toISOString() : null,
        nextFollowUpDate: lead.nextFollowUpDate ? lead.nextFollowUpDate.toISOString() : null,
        stageChangedAt: lead.stageChangedAt ? lead.stageChangedAt.toISOString() : null,
        assignees: lead.assignees.map((a) => a.user),
    };

    return (
        <LeadDetailView lead={serialized as unknown as LeadItem} />
    );
}
