import { redirect } from "next/navigation";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agencyProjects } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { ContactsTable, type ContactRow } from "@/features/crm/components/ContactsTable";

export const dynamic = "force-dynamic";

/**
 * Sales contacts (Claude Design sample "SalesContacts"): every lead and client
 * as one table. A contact is the person behind a lead. Same visibility as the
 * pipeline: leads assigned to this Sales user, plus unassigned ones.
 * Only the columns the table shows are loaded.
 */
export default async function ContactsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    if (!hasRole(session, ["sales"])) redirect("/dashboard");
    const userId = session.user.id;

    const leadsList = await db.query.leads.findMany({
        where: (lead, { isNull: isNullOp }) => isNullOp(lead.archivedAt),
        columns: {
            id: true,
            businessName: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            roleInCompany: true,
            clientType: true,
            source: true,
            otherServiceText: true,
            status: true,
            lastContactedAt: true,
            createdAt: true,
            isArchived: true,
        },
        with: {
            client: { columns: { name: true, email: true } },
            service: { columns: { title: true } },
            assignees: { columns: { userId: true } },
            activityLogs: {
                columns: { activityType: true, createdAt: true },
                orderBy: (log, { desc }) => [desc(log.createdAt)],
            },
        },
    });

    // Same rule as the pipeline (server-side): mine or unassigned.
    const visible = leadsList.filter(
        (lead) => !lead.isArchived && (lead.assignees.length === 0 || lead.assignees.some((a) => a.userId === userId))
    );

    const projects = visible.length
        ? await db
              .select({
                  leadId: agencyProjects.leadId,
                  title: agencyProjects.title,
                  status: agencyProjects.status,
                  completedAt: agencyProjects.completedAt,
              })
              .from(agencyProjects)
              .where(and(inArray(agencyProjects.leadId, visible.map((l) => l.id)), isNull(agencyProjects.deletedAt)))
        : [];
    const projectByLead = new Map(projects.map((p) => [p.leadId, p]));

    const rows: ContactRow[] = visible.map((lead) => {
        const project = projectByLead.get(lead.id);
        const latestLog = lead.activityLogs[0];
        const lastContact = lead.lastContactedAt ?? latestLog?.createdAt ?? null;
        const type: ContactRow["type"] = project?.completedAt
            ? "past_client"
            : lead.status === "Closed Won" || project
              ? "client"
              : "lead";

        return {
            id: lead.id,
            name: lead.contactName || lead.client?.name || "Name not given",
            business: lead.businessName,
            role: lead.roleInCompany,
            email: lead.contactEmail || lead.client?.email || null,
            phone: lead.contactPhone,
            clientType: lead.clientType,
            source: lead.source,
            service: project?.title || lead.service?.title || lead.otherServiceText || null,
            type,
            stage: lead.status,
            projectStatus: project?.status ?? null,
            completedAt: project?.completedAt ? project.completedAt.toISOString() : null,
            lastContactAt: lastContact ? new Date(lastContact).toISOString() : null,
            lastContactType: latestLog?.activityType ?? null,
            logCount: lead.activityLogs.length,
        };
    });

    return <ContactsTable rows={rows} />;
}
