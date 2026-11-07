import Link from "next/link";
import { ProjectHeader } from "@/features/pm/components/ProjectHeader";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agencyProjects, leads } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  formatActivityActionLabel,
  getProjectActivity,
  type ProjectActivityItem,
} from "@/features/audit/project-activity";
import { authorizeProject, requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

function formatManilaDayHeader(dt: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

function formatManilaDayKey(dt: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);

  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function formatManilaTime(dt: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
}

// Display only: raw record ids mean nothing to the reader (the stored audit text is unchanged).
function readableDetails(details: string): string {
  return details.replace(/\s*(?:on project |for (?:payment|task) )?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "").trim();
}

function formatRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case "manager":
      return "Project Manager";
    case "developer":
      return "Developer";
    case "client":
      return "Client";
    case "sales":
      return "Sales";
    case "superadmin":
      return "Super Admin";
    case "content_editor":
      return "Content Editor";
    default:
      return role || "System";
  }
}

function formatActorDisplay(user: ProjectActivityItem["user"]): string {
  if (!user) return "System";
  const name = user.name?.trim();
  const roleLabel = formatRoleLabel(user.role);
  if (name && user.role) {
    return `${name} (${roleLabel})`;
  }
  if (name) return name;
  return roleLabel;
}

export default async function PmProjectActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ before?: string }>;
}) {
  // 1. Strict manager-only guard FIRST before any DB or query call
  const authz = await requireRole(["manager"]);
  if (!authz.ok) {
    redirect("/");
  }

  const { id } = await params;

  // 2. Project read access check using .ok explicitly
  const access = await authorizeProject(id, "read");
  if (!access.ok) {
    notFound();
  }

  // 3. Load explicit project header columns
  const [projectRow] = await db
    .select({
      id: agencyProjects.id,
      title: agencyProjects.title,
      leadId: agencyProjects.leadId,
    })
    .from(agencyProjects)
    .where(and(eq(agencyProjects.id, id), isNull(agencyProjects.deletedAt)));

  if (!projectRow) {
    notFound();
  }

  let businessName: string | null = null;
  let clientName: string | null = null;
  if (projectRow.leadId) {
    const [leadRow] = await db
      .select({
        businessName: leads.businessName,
        contactName: leads.contactName,
      })
      .from(leads)
      .where(eq(leads.id, projectRow.leadId));
    if (leadRow) {
      businessName = leadRow.businessName;
      clientName = leadRow.contactName;
    }
  }

  const sp = await searchParams;
  const beforeCursor = typeof sp?.before === "string" ? sp.before : undefined;

  const { items, nextCursor } = await getProjectActivity(id, {
    limit: 50,
    before: beforeCursor,
  });

  // Group items by calendar day in Asia/Manila
  const dayGroups: {
    dayKey: string;
    dayLabel: string;
    rows: ProjectActivityItem[];
  }[] = [];

  for (const item of items) {
    const dayKey = formatManilaDayKey(item.createdAt);
    const dayLabel = formatManilaDayHeader(item.createdAt);
    const existing = dayGroups.find((g) => g.dayKey === dayKey);
    if (existing) {
      existing.rows.push(item);
    } else {
      dayGroups.push({
        dayKey,
        dayLabel,
        rows: [item],
      });
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-5 pb-12">
      <ProjectHeader
        projectId={projectRow.id}
        title={projectRow.title}
        businessName={businessName}
        clientName={clientName}
        current="activity"
      />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Activity</h2>
        <p className="text-sm text-muted-foreground">Newest first · saved automatically · read-only</p>
      </div>

      {/* Mockup Ref "PM project activity": one row per event, type chip, what happened, who. */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          dayGroups.map((group) => <DayGroup key={group.dayKey} group={group} />)
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {beforeCursor ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/pm/${projectRow.id}/activity`}>
              Back to newest
            </Link>
          </Button>
        ) : (
          <span />
        )}

        {nextCursor && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/dashboard/pm/${projectRow.id}/activity?before=${encodeURIComponent(
                nextCursor,
              )}`}
            >
              Load more
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// Colour by record type (status-indicator colour, as in the mockup).
function typeChip(entity: string): { label: string; tone: string } {
  const e = entity.toLowerCase();
  if (e.includes("payment")) return { label: "Payment", tone: "bg-stage-negotiation/15 text-stage-negotiation" };
  if (e.includes("milestone")) return { label: "Milestone", tone: "bg-brand-soft text-brand-deep" };
  if (e.includes("sprint")) return { label: "Sprint", tone: "bg-stage-discovery/15 text-stage-discovery" };
  if (e.includes("task")) return { label: "Task", tone: "bg-stage-discovery/15 text-stage-discovery" };
  if (e.includes("client") || e.includes("proposal") || e.includes("lead")) return { label: "Client", tone: "bg-stage-proposal/15 text-stage-proposal" };
  return { label: "Project", tone: "bg-muted text-muted-foreground" };
}

function DayGroup({
  group,
}: {
  group: {
    dayKey: string;
    dayLabel: string;
    rows: ProjectActivityItem[];
  };
}) {
  return (
    <section aria-label={group.dayLabel}>
      <h3 className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground">{group.dayLabel}</h3>
      <ul>
        {group.rows.map((row) => {
          const chip = typeChip(row.entity);
          return (
            <li
              key={row.id}
              className="grid grid-cols-[4.5rem_5.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-b border-border/60 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[4.5rem_5.5rem_minmax(0,1fr)_auto]"
            >
              <span className="pt-0.5 tabular-nums text-muted-foreground">{formatManilaTime(row.createdAt)}</span>
              <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${chip.tone}`}>{chip.label}</span>
              <p className="min-w-0 break-words text-foreground">
                <span className="font-medium">{formatActivityActionLabel(row.action, row.entity)}</span>
                {readableDetails(row.details) ? <span className="text-muted-foreground"> · {readableDetails(row.details)}</span> : null}
              </p>
              <span className="col-start-3 text-muted-foreground md:col-start-auto md:text-right">{formatActorDisplay(row.user)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
