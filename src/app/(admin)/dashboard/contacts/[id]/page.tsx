import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agencyProjects, leads } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { ContactProfile, type ContactProfileData } from "@/features/crm/components/ContactProfile";

export const dynamic = "force-dynamic";

/**
 * Contact profile (Claude Design sample "SalesContactProfile").
 * The contact is the person behind a lead; the id is the lead id.
 * Same visibility as the pipeline, checked on the server: the lead must be
 * assigned to this Sales user or still unassigned.
 */
export default async function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    if (!hasRole(session, ["sales"])) redirect("/dashboard");
    const { id } = await params;
    const userId = session.user.id;

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, id),
        columns: {
            id: true,
            businessName: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            contactPreference: true,
            roleInCompany: true,
            industry: true,
            clientType: true,
            source: true,
            otherServiceText: true,
            urgency: true,
            status: true,
            lastContactedAt: true,
            createdAt: true,
            closedWonAt: true,
        },
        with: {
            client: { columns: { name: true, email: true } },
            service: { columns: { title: true } },
            assignees: { columns: { userId: true } },
            activityLogs: {
                columns: { id: true, activityType: true, content: true, createdAt: true },
                with: { author: { columns: { name: true, role: true } } },
                orderBy: (log, { desc }) => [desc(log.createdAt)],
            },
            proposals: {
                columns: { id: true, version: true, status: true, totalPrice: true, currency: true, sentAt: true, signedAt: true },
                where: (proposal, { isNull: isNullOp }) => isNullOp(proposal.deletedAt),
                orderBy: (proposal, { desc }) => [desc(proposal.version)],
            },
        },
    });
    if (!lead) notFound();
    const visible = lead.assignees.length === 0 || lead.assignees.some((a) => a.userId === userId);
    if (!visible) notFound();

    const [project] = await db
        .select({
            title: agencyProjects.title,
            status: agencyProjects.status,
            progress: agencyProjects.progressPercentage,
            completedAt: agencyProjects.completedAt,
        })
        .from(agencyProjects)
        .where(and(eq(agencyProjects.leadId, lead.id), isNull(agencyProjects.deletedAt)))
        .limit(1);

    const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
    const latestLog = lead.activityLogs[0];

    const data: ContactProfileData = {
        id: lead.id,
        name: lead.contactName || lead.client?.name || "Name not given",
        business: lead.businessName,
        email: lead.contactEmail || lead.client?.email || null,
        phone: lead.contactPhone,
        preferredContact: lead.contactPreference,
        role: lead.roleInCompany,
        industry: lead.industry,
        clientType: lead.clientType,
        source: lead.source,
        createdAt: lead.createdAt.toISOString(),
        clientSince: iso(lead.closedWonAt),
        lastContactAt: iso(lead.lastContactedAt ?? latestLog?.createdAt),
        type: project?.completedAt ? "past_client" : lead.status === "Closed Won" || project ? "client" : "lead",
        stage: lead.status,
        service: lead.service?.title || lead.otherServiceText || null,
        urgency: lead.urgency,
        proposals: lead.proposals.map((p) => ({
            id: p.id,
            version: p.version,
            status: p.status,
            totalPrice: p.totalPrice,
            currency: p.currency,
            sentAt: iso(p.sentAt),
            signedAt: iso(p.signedAt),
        })),
        project: project
            ? { title: project.title, status: project.status, progress: project.progress, completedAt: iso(project.completedAt) }
            : null,
        history: lead.activityLogs.map((log) => ({
            id: log.id,
            type: log.activityType,
            content: log.content,
            createdAt: log.createdAt.toISOString(),
            by: log.author?.name ?? null,
        })),
    };

    return <ContactProfile data={data} />;
}
