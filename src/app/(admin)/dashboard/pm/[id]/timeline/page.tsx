import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GanttTimeline } from "@/features/pm/components/GanttTimeline";
import { buildGanttLayout } from "@/features/sprints/gantt-layout";
import { applyEndedSprints } from "@/features/sprints/sprint-end";
import { getTimelineData } from "@/features/sprints/timeline-data";
import { authorizeProject, requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function PmProjectTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  // 3. Lazy sprint-end cleanup
  await applyEndedSprints(id);

  // 4. Load timeline data and build pure Gantt layout
  const data = await getTimelineData(id);
  if (!data) {
    notFound();
  }

  const layout = buildGanttLayout({
    milestones: data.milestones,
    sprints: data.sprints,
    keyDates: data.keyDates,
    today: data.today,
  });

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
            <Link href={`/dashboard/pm/${data.project.id}`} title="Back to board">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Business name: {data.project.businessName || "—"} · Client name:{" "}
              {data.project.clientName || "—"}
            </p>
            <h2
              className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate"
              title={data.project.title}
            >
              Project name: {data.project.title}
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
              href={`/dashboard/pm/${data.project.id}`}
              className="px-3 py-1.5 bg-card text-foreground hover:bg-muted transition-colors font-medium"
            >
              Board
            </Link>
            <span className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold">
              Timeline
            </span>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/pm/${data.project.id}/payments`}>Payments</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/pm/${data.project.id}/complete`}>Completion</Link>
          </Button>
        </div>
      </div>

      <GanttTimeline layout={layout} />
    </div>
  );
}

