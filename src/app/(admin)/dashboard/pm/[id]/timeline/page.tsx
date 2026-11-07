import { ProjectHeader } from "@/features/pm/components/ProjectHeader";
import { notFound, redirect } from "next/navigation";
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
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-5 pb-12">
      <ProjectHeader
        projectId={data.project.id}
        title={data.project.title}
        businessName={data.project.businessName}
        clientName={data.project.clientName}
        current="timeline"
      />

      <GanttTimeline layout={layout} />
    </div>
  );
}

