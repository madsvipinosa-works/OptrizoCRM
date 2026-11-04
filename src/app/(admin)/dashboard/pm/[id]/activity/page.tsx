import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { agencyProjects, leads } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
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
    <div className="space-y-4 w-full max-w-full min-w-0 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="hover:bg-muted text-foreground shrink-0"
          >
            <Link href={`/dashboard/pm/${projectRow.id}`} title="Back to board">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Business name: {businessName || "—"} · Client name: {clientName || "—"}
            </p>
            <h2
              className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate"
              title={projectRow.title}
            >
              Project name: {projectRow.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Project view switcher"
            className="inline-flex rounded-lg border border-border overflow-hidden text-xs sm:text-sm"
          >
            <Link
              href={`/dashboard/pm/${projectRow.id}`}
              className="px-3 py-1.5 bg-card text-foreground hover:bg-muted transition-colors font-medium"
            >
              Board
            </Link>
            <Link
              href={`/dashboard/pm/${projectRow.id}/timeline`}
              className="px-3 py-1.5 bg-card text-foreground hover:bg-muted transition-colors font-medium border-l border-border"
            >
              Timeline
            </Link>
            <span className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold border-l border-border">
              Activity
            </span>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/pm/${projectRow.id}/payments`}>Payments</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/pm/${projectRow.id}/complete`}>Completion</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
        <span>Project audit trail (read-only)</span>
        <span>Newest first · saved automatically</span>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 px-4 text-center text-sm text-muted-foreground">
            No activity yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-4 whitespace-nowrap w-[160px]">
                    When (Asia/Manila)
                  </th>
                  <th className="py-2.5 px-4 whitespace-nowrap w-[200px]">Who</th>
                  <th className="py-2.5 px-4 whitespace-nowrap w-[180px]">Action</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {dayGroups.map((group) => (
                  <FragmentGroup key={group.dayKey} group={group} />
                ))}
              </tbody>
            </table>
          </div>
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

function FragmentGroup({
  group,
}: {
  group: {
    dayKey: string;
    dayLabel: string;
    rows: ProjectActivityItem[];
  };
}) {
  return (
    <>
      <tr className="bg-muted/25 border-b border-border/70">
        <td
          colSpan={4}
          className="py-1.5 px-4 text-xs font-semibold text-muted-foreground"
        >
          {group.dayLabel}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr
          key={row.id}
          className="border-b border-border/60 last:border-b-0 hover:bg-muted/20 transition-colors"
        >
          <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
            {formatManilaTime(row.createdAt)}
          </td>
          <td className="py-2.5 px-4 text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
            {formatActorDisplay(row.user)}
          </td>
          <td className="py-2.5 px-4 whitespace-nowrap">
            <Badge variant="secondary" className="text-xs font-semibold">
              {formatActivityActionLabel(row.action, row.entity)}
            </Badge>
          </td>
          <td className="py-2.5 px-4 text-xs sm:text-sm text-foreground">
            {row.details || "—"}
          </td>
        </tr>
      ))}
    </>
  );
}
