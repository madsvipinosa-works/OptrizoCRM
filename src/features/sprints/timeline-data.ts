import "server-only";

import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  agencyProjects,
  leads,
  meetings,
  milestones,
  proposals,
  sprints,
  tasks,
} from "@/db/schema";
import {
  deriveSprintStatus,
  todayInManila,
} from "@/features/sprints/sprint-status";
import type {
  GanttKeyDateInput,
  GanttMilestoneInput,
  GanttSprintInput,
} from "@/features/sprints/gantt-layout";

export type TimelineProjectData = {
  project: {
    id: string;
    title: string;
    status: string;
    businessName: string | null;
    clientName: string | null;
  };
  milestones: GanttMilestoneInput[];
  sprints: GanttSprintInput[];
  keyDates: GanttKeyDateInput[];
  today: string;
};

function toManilaDateOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return todayInManila(dt);
}

/**
 * Loads explicit columns needed to build the Gantt timeline for `projectId`:
 * - Non-deleted milestones with done/total task counts (ignoring `backlog` and soft-deleted tasks).
 * - Sprints with derived status and done/total task counts (ignoring `backlog` and soft-deleted tasks).
 * - Key dates (omitted when null):
 *   1. `signing`: the signed proposal's `signedAt` (`proposals.signedAt`).
 *   2. `testing_day`: the project's `uat` meeting `startsAt` (`meetings.startsAt`).
 *   3. `completion_sign_off`: `agencyProjects.signedOffAt`.
 *
 * NOTE: This helper performs NO authorization check itself.
 * Callers MUST authorize first (`requireRole(["manager"])` + `authorizeProject(projectId, "read").ok`).
 */
export async function getTimelineData(
  projectId: string,
): Promise<TimelineProjectData | null> {
  if (!projectId) return null;

  const today = todayInManila();

  // 1. Project header + signedOffAt + leadId (explicit columns only)
  const [projectRow] = await db
    .select({
      id: agencyProjects.id,
      title: agencyProjects.title,
      status: agencyProjects.status,
      leadId: agencyProjects.leadId,
      signedOffAt: agencyProjects.signedOffAt,
    })
    .from(agencyProjects)
    .where(and(eq(agencyProjects.id, projectId), isNull(agencyProjects.deletedAt)));

  if (!projectRow) return null;

  let businessName: string | null = null;
  let clientName: string | null = null;
  let proposalSignedDate: string | null = null;

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

    const [signedProposal] = await db
      .select({
        signedAt: proposals.signedAt,
        acceptedAt: proposals.acceptedAt,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.leadId, projectRow.leadId),
          eq(proposals.status, "signed"),
          isNull(proposals.deletedAt),
        ),
      )
      .orderBy(desc(proposals.signedAt), desc(proposals.createdAt));

    if (signedProposal) {
      proposalSignedDate = toManilaDateOrNull(
        signedProposal.signedAt ?? signedProposal.acceptedAt,
      );
    }
  }

  // 2. Non-deleted milestones (explicit columns only)
  const milestoneRows = await db
    .select({
      id: milestones.id,
      name: milestones.name,
      title: milestones.title,
      status: milestones.status,
      startDate: milestones.startDate,
      endDate: milestones.endDate,
      order: milestones.order,
    })
    .from(milestones)
    .where(and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)))
    .orderBy(asc(milestones.order));

  // 3. Sprints (explicit columns only)
  const sprintRows = await db
    .select({
      id: sprints.id,
      name: sprints.name,
      startDate: sprints.startDate,
      endDate: sprints.endDate,
    })
    .from(sprints)
    .where(eq(sprints.projectId, projectId))
    .orderBy(asc(sprints.startDate), asc(sprints.createdAt));

  // 4. Non-deleted, non-backlog tasks for done/total counts per milestone and per sprint
  const taskRows = await db
    .select({
      id: tasks.id,
      milestoneId: tasks.milestoneId,
      sprintId: tasks.sprintId,
      status: tasks.status,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        isNull(tasks.deletedAt),
        ne(tasks.status, "backlog"),
      ),
    );

  const milestoneCounts = new Map<string, { done: number; total: number }>();
  for (const m of milestoneRows) {
    milestoneCounts.set(m.id, { done: 0, total: 0 });
  }

  const sprintCounts = new Map<string, { done: number; total: number }>();
  for (const sp of sprintRows) {
    sprintCounts.set(sp.id, { done: 0, total: 0 });
  }

  for (const t of taskRows) {
    if (t.status === "backlog") continue;
    const isDone = t.status === "done";

    const mc = milestoneCounts.get(t.milestoneId);
    if (mc) {
      mc.total += 1;
      if (isDone) mc.done += 1;
    }

    if (t.sprintId) {
      const sc = sprintCounts.get(t.sprintId);
      if (sc) {
        sc.total += 1;
        if (isDone) sc.done += 1;
      }
    }
  }

  // 5. UAT meeting startsAt (explicit columns only)
  const [uatMeeting] = await db
    .select({
      startsAt: meetings.startsAt,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.projectId, projectId),
        eq(meetings.type, "uat"),
        ne(meetings.status, "cancelled"),
      ),
    )
    .orderBy(desc(meetings.startsAt));

  const testingDayDate = toManilaDateOrNull(uatMeeting?.startsAt);
  const completionSignOffDate = toManilaDateOrNull(projectRow.signedOffAt);

  const keyDates: GanttKeyDateInput[] = [];
  if (proposalSignedDate) {
    keyDates.push({
      kind: "signing",
      label: "Signed",
      date: proposalSignedDate,
    });
  }
  if (testingDayDate) {
    keyDates.push({
      kind: "testing_day",
      label: "Testing day",
      date: testingDayDate,
    });
  }
  if (completionSignOffDate) {
    keyDates.push({
      kind: "completion_sign_off",
      label: "Completion sign-off",
      date: completionSignOffDate,
    });
  }

  const mappedMilestones: GanttMilestoneInput[] = milestoneRows.map((m) => {
    const counts = milestoneCounts.get(m.id) ?? { done: 0, total: 0 };
    return {
      id: m.id,
      name: m.title || m.name || "Milestone",
      status: m.status,
      startDate: toManilaDateOrNull(m.startDate),
      endDate: toManilaDateOrNull(m.endDate),
      order: m.order,
      doneTasks: counts.done,
      totalTasks: counts.total,
    };
  });

  const mappedSprints: GanttSprintInput[] = sprintRows.map((sp) => {
    const counts = sprintCounts.get(sp.id) ?? { done: 0, total: 0 };
    return {
      id: sp.id,
      name: sp.name,
      startDate: sp.startDate,
      endDate: sp.endDate,
      status: deriveSprintStatus(sp.startDate, sp.endDate, today),
      doneTasks: counts.done,
      totalTasks: counts.total,
    };
  });

  return {
    project: {
      id: projectRow.id,
      title: projectRow.title,
      status: projectRow.status,
      businessName,
      clientName,
    },
    milestones: mappedMilestones,
    sprints: mappedSprints,
    keyDates,
    today,
  };
}

