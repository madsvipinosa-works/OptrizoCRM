import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { deriveSprintStatus, todayInManila } from "@/features/sprints/sprint-status";
import {
  pickDefaultSprint,
  filterBoardTasks,
  excludeBacklogTasks,
  isTaskCarriedOver,
  isDevelopmentMilestone,
} from "@/features/sprints/task-filters";
import { buildGanttLayout } from "@/features/sprints/gantt-layout";

const { insertValuesMock, insertMock, authMock } = vi.hoisted(() => {
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn(() => ({ values: insertValuesMock }));
  const authMock = vi.fn();
  return { insertValuesMock, insertMock, authMock };
});

vi.mock("@/db", () => ({
  db: {
    insert: insertMock,
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

import { logAction } from "@/features/audit/log";
import { auditLogs } from "@/db/schema";

describe("deriveSprintStatus", () => {
  const start = "2026-11-10";
  const end = "2026-11-23";

  it("returns 'planned' the day before start", () => {
    expect(deriveSprintStatus(start, end, "2026-11-09")).toBe("planned");
  });

  it("returns 'active' on the start day", () => {
    expect(deriveSprintStatus(start, end, "2026-11-10")).toBe("active");
  });

  it("returns 'active' on a middle day", () => {
    expect(deriveSprintStatus(start, end, "2026-11-16")).toBe("active");
  });

  it("returns 'active' on the end day", () => {
    expect(deriveSprintStatus(start, end, "2026-11-23")).toBe("active");
  });

  it("returns 'ended' the day after end", () => {
    expect(deriveSprintStatus(start, end, "2026-11-24")).toBe("ended");
  });
});

describe("todayInManila", () => {
  it("converts 2026-11-05T16:30:00Z (00:30+08:00 next day) to '2026-11-06'", () => {
    expect(todayInManila(new Date("2026-11-05T16:30:00Z"))).toBe("2026-11-06");
  });

  it("converts an earlier-in-day UTC timestamp (2026-11-05T08:00:00Z = 16:00+08:00) to '2026-11-05'", () => {
    expect(todayInManila(new Date("2026-11-05T08:00:00Z"))).toBe("2026-11-05");
  });
});

describe("logAction optional projectId parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("passes projectId to audit_log insert when given", async () => {
    await logAction("CREATE", "Sprint", "Planned Sprint 1", "user-pm", "proj-123");

    expect(insertMock).toHaveBeenCalledWith(auditLogs);
    expect(insertValuesMock).toHaveBeenCalledWith({
      userId: "user-pm",
      action: "CREATE",
      entity: "Sprint",
      details: "Planned Sprint 1",
      projectId: "proj-123",
    });
  });

  it("omits projectId when not given (existing 3-arg and 4-arg call sites unchanged)", async () => {
    await logAction("UPDATE", "Task", "Started task");

    expect(insertMock).toHaveBeenCalledWith(auditLogs);
    const passed = insertValuesMock.mock.calls[0]?.[0];
    expect(passed).toEqual({
      userId: "user-1",
      action: "UPDATE",
      entity: "Task",
      details: "Started task",
    });
    expect("projectId" in passed).toBe(false);
  });
});

describe("task-filters pure helpers (STOP 3 commit B)", () => {
  it("pickDefaultSprint picks active first, else nearest planned, else latest ended, else null", () => {
    expect(pickDefaultSprint([])).toBeNull();

    const sEndedOld = { id: "s1", startDate: "2026-10-01", endDate: "2026-10-14", status: "ended" as const };
    const sEndedLatest = { id: "s2", startDate: "2026-10-15", endDate: "2026-10-28", status: "ended" as const };
    const sActive = { id: "s3", startDate: "2026-11-01", endDate: "2026-11-14", status: "active" as const };
    const sPlannedNear = { id: "s4", startDate: "2026-11-15", endDate: "2026-11-28", status: "planned" as const };
    const sPlannedFar = { id: "s5", startDate: "2026-12-01", endDate: "2026-12-14", status: "planned" as const };

    // 1. Active wins when present
    expect(pickDefaultSprint([sEndedOld, sPlannedFar, sActive, sPlannedNear])?.id).toBe("s3");

    // 2. When no active, nearest planned by startDate ASC wins
    expect(pickDefaultSprint([sEndedLatest, sPlannedFar, sPlannedNear])?.id).toBe("s4");

    // 3. When only ended, latest ended by endDate DESC wins
    expect(pickDefaultSprint([sEndedOld, sEndedLatest])?.id).toBe("s2");
  });

  it("filterBoardTasks filters by selected sprint in Development and excludes backlog everywhere", () => {
    const sampleTasks = [
      { id: "t-backlog", status: "backlog", sprintId: null, carriedOver: false },
      { id: "t-s1-todo", status: "to_do", sprintId: "s1", carriedOver: false },
      { id: "t-s1-carried", status: "in_progress", sprintId: "s1", carriedOver: true },
      { id: "t-s2-todo", status: "to_do", sprintId: "s2", carriedOver: false },
      { id: "t-nosprint-todo", status: "to_do", sprintId: null, carriedOver: false },
    ];

    // Development with s1 selected: only s1 non-backlog tasks
    expect(
      filterBoardTasks(sampleTasks, { isDevelopment: true, selectedSprintId: "s1" }).map(
        (t) => t.id,
      ),
    ).toEqual(["t-s1-todo", "t-s1-carried"]);

    // Development with no sprint selected: empty board
    expect(
      filterBoardTasks(sampleTasks, { isDevelopment: true, selectedSprintId: null }),
    ).toEqual([]);

    // Non-Development milestone: all non-backlog tasks unaffected by sprintId
    expect(
      filterBoardTasks(sampleTasks, { isDevelopment: false, selectedSprintId: "s1" }).map(
        (t) => t.id,
      ),
    ).toEqual(["t-s1-todo", "t-s1-carried", "t-s2-todo", "t-nosprint-todo"]);
  });

  it("excludeBacklogTasks removes backlog tasks from developer lists", () => {
    const tasks = [
      { id: "1", status: "backlog" },
      { id: "2", status: "to_do" },
      { id: "3", status: "in_progress" },
      { id: "4", status: "done" },
    ];
    expect(excludeBacklogTasks(tasks).map((t) => t.id)).toEqual(["2", "3", "4"]);
  });

  it("isTaskCarriedOver and isDevelopmentMilestone identify carried-over tasks and Development milestone", () => {
    expect(isTaskCarriedOver({ carriedOver: true })).toBe(true);
    expect(isTaskCarriedOver({ carriedOver: false })).toBe(false);
    expect(isTaskCarriedOver({ carriedOver: null })).toBe(false);

    expect(isDevelopmentMilestone({ name: "development", title: "Development" })).toBe(true);
    expect(isDevelopmentMilestone({ name: null, title: "Full-Stack Development" })).toBe(true);
    expect(isDevelopmentMilestone({ name: "design", title: "UI/UX Design" })).toBe(false);
  });

  it("source-text guard: pm/[id]/page.tsx loads getBacklog and passes backlogTasks only inside a manager-only branch", () => {
    // Limit of this static source-text check: it verifies the structure of page.tsx
    // (that `getBacklog` is called inside `if (isManager)` and `backlogTasks` is gated by `isManager ? ... : undefined`),
    // rather than executing a full Next.js server-component render.
    const pagePath = path.resolve(
      __dirname,
      "../../src/app/(admin)/dashboard/pm/[id]/page.tsx",
    );
    const src = fs.readFileSync(pagePath, "utf8");
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(stripped).toMatch(/if\s*\(\s*isManager\s*\)\s*\{[\s\S]*?await\s+getBacklog\s*\(\s*id\s*\)/);
    expect(stripped).toMatch(/backlogTasks=\{isManager\s*\?\s*managerBacklogTasks\s*:\s*undefined\}/);
  });
});

describe("gantt-layout pure helpers & timeline source-text guards (STOP 4)", () => {
  it("handles empty project with no milestones, sprints, or key dates without crashing", () => {
    const layout = buildGanttLayout({
      milestones: [],
      sprints: [],
      keyDates: [],
      today: "2026-11-10",
    });

    expect(layout.chartRange).toBeNull();
    expect(layout.rows).toEqual([]);
    expect(layout.todayPosition).toEqual({
      date: "2026-11-10",
      leftPercent: null,
      inRange: false,
    });
    expect(layout.keyDates).toEqual([]);
    expect(layout.monthMarkers).toEqual([]);
  });

  it("produces a 'No dates' row when a milestone has null dates without crashing", () => {
    const layout = buildGanttLayout({
      milestones: [
        {
          id: "m-req",
          name: "Requirements",
          status: "Completed",
          startDate: "2026-11-01",
          endDate: "2026-11-10",
          order: 1,
          doneTasks: 3,
          totalTasks: 3,
        },
        {
          id: "m-nodates",
          name: "Handover",
          status: "Pending",
          startDate: null,
          endDate: null,
          order: 2,
          doneTasks: 0,
          totalTasks: 0,
        },
      ],
      sprints: [],
      keyDates: [],
      today: "2026-11-05",
    });

    expect(layout.rows).toHaveLength(2);
    const noDatesRow = layout.rows[1]!;
    expect(noDatesRow.id).toBe("m-nodates");
    expect(noDatesRow.hasDates).toBe(false);
    expect(noDatesRow.noDatesLabel).toBe("No dates");
    expect(noDatesRow.leftPercent).toBe(0);
    expect(noDatesRow.widthPercent).toBe(0);
    expect(noDatesRow.progressPercent).toBe(0);
  });

  it("computes accurate left% and width% math for known dates", () => {
    // Milestone spans 2026-11-03..2026-11-08 (6 days).
    // With 2-day padding on each side: chartRange is 2026-11-01..2026-11-10 (10 days total).
    // Start offset = 2 days -> leftPercent = (2 / 10) * 100 = 20%.
    // Duration = 6 days -> widthPercent = (6 / 10) * 100 = 60%.
    const layout = buildGanttLayout({
      milestones: [
        {
          id: "m-1",
          name: "Requirements",
          status: "In Progress",
          startDate: "2026-11-03",
          endDate: "2026-11-08",
          order: 1,
          doneTasks: 2,
          totalTasks: 4,
        },
      ],
      sprints: [],
      keyDates: [],
      today: "2026-11-05",
    });

    expect(layout.chartRange).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-10",
      totalDays: 10,
    });

    const row = layout.rows[0]!;
    expect(row.leftPercent).toBe(20);
    expect(row.widthPercent).toBe(60);
    expect(row.progressPercent).toBe(50);
  });

  it("enforces minimum visible width for a one-day sprint on a wide timeline", () => {
    // Wide milestone spanning 200 days so a 1-day sprint raw width is ~0.49% (< 2% min width)
    const layout = buildGanttLayout({
      milestones: [
        {
          id: "m-dev",
          name: "Development",
          status: "In Progress",
          startDate: "2026-01-01",
          endDate: "2026-07-20",
          order: 1,
          doneTasks: 1,
          totalTasks: 10,
        },
      ],
      sprints: [
        {
          id: "s-oneday",
          name: "Hotfix Sprint",
          startDate: "2026-03-15",
          endDate: "2026-03-15",
          status: "ended",
          doneTasks: 1,
          totalTasks: 1,
        },
      ],
      keyDates: [],
      today: "2026-04-01",
    });

    const sprintRow = layout.rows.find((r) => r.kind === "sprint" && r.id === "s-oneday");
    expect(sprintRow).toBeDefined();
    expect(sprintRow!.widthPercent).toBeGreaterThanOrEqual(2);
  });

  it("nests sprints as indented rows directly under the Development milestone", () => {
    const layout = buildGanttLayout({
      milestones: [
        {
          id: "m-design",
          name: "Design",
          status: "Completed",
          startDate: "2026-11-01",
          endDate: "2026-11-05",
          order: 1,
          doneTasks: 2,
          totalTasks: 2,
        },
        {
          id: "m-dev",
          name: "Full-Stack Development",
          status: "In Progress",
          startDate: "2026-11-06",
          endDate: "2026-11-25",
          order: 2,
          doneTasks: 3,
          totalTasks: 6,
        },
        {
          id: "m-uat",
          name: "UAT and testing",
          status: "Pending",
          startDate: "2026-11-26",
          endDate: "2026-11-30",
          order: 3,
          doneTasks: 0,
          totalTasks: 2,
        },
      ],
      sprints: [
        {
          id: "s-2",
          name: "Sprint 2",
          startDate: "2026-11-16",
          endDate: "2026-11-25",
          status: "planned",
          doneTasks: 0,
          totalTasks: 3,
        },
        {
          id: "s-1",
          name: "Sprint 1",
          startDate: "2026-11-06",
          endDate: "2026-11-15",
          status: "active",
          doneTasks: 3,
          totalTasks: 3,
        },
      ],
      keyDates: [],
      today: "2026-11-10",
    });

    expect(layout.rows.map((r) => ({ id: r.id, kind: r.kind, indented: r.indented }))).toEqual([
      { id: "m-design", kind: "milestone", indented: false },
      { id: "m-dev", kind: "milestone", indented: false },
      { id: "s-1", kind: "sprint", indented: true },
      { id: "s-2", kind: "sprint", indented: true },
      { id: "m-uat", kind: "milestone", indented: false },
    ]);
  });

  it("computes todayPosition inside range vs outside range (null with inRange=false)", () => {
    const baseInput = {
      milestones: [
        {
          id: "m-1",
          name: "Development",
          status: "In Progress",
          startDate: "2026-11-10",
          endDate: "2026-11-20",
          order: 1,
          doneTasks: 1,
          totalTasks: 2,
        },
      ],
      sprints: [],
      keyDates: [],
    };

    const inside = buildGanttLayout({
      ...baseInput,
      today: "2026-11-15",
    });
    expect(inside.todayPosition.inRange).toBe(true);
    expect(inside.todayPosition.leftPercent).not.toBeNull();
    expect(inside.todayPosition.leftPercent).toBeGreaterThan(0);
    expect(inside.todayPosition.leftPercent).toBeLessThan(100);

    const outside = buildGanttLayout({
      ...baseInput,
      today: "2026-12-25",
    });
    expect(outside.todayPosition).toEqual({
      date: "2026-12-25",
      leftPercent: null,
      inRange: false,
    });
  });

  it("computes progressPercent as 0 when totalTasks is 0 and omits null/empty key dates", () => {
    const layout = buildGanttLayout({
      milestones: [
        {
          id: "m-zero",
          name: "Requirements",
          status: "Pending",
          startDate: "2026-11-01",
          endDate: "2026-11-10",
          order: 1,
          doneTasks: 0,
          totalTasks: 0,
        },
      ],
      sprints: [],
      keyDates: [
        { kind: "signing", label: "Signed", date: "2026-11-01" },
        { kind: "testing_day", label: "Testing day", date: "" },
      ],
      today: "2026-11-05",
    });

    expect(layout.rows[0]!.progressPercent).toBe(0);
    expect(layout.keyDates).toHaveLength(1);
    expect(layout.keyDates[0]!.kind).toBe("signing");
  });

  it("source-text guard: timeline/page.tsx calls requireRole before any db/query call and checks authorizeProject(...).ok", () => {
    const timelinePagePath = path.resolve(
      __dirname,
      "../../src/app/(admin)/dashboard/pm/[id]/timeline/page.tsx",
    );
    const src = fs.readFileSync(timelinePagePath, "utf8");
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    const requireRoleIdx = stripped.indexOf("requireRole(");
    const authorizeIdx = stripped.indexOf("authorizeProject(");
    const applyEndedIdx = stripped.indexOf("applyEndedSprints(");
    const getTimelineIdx = stripped.indexOf("getTimelineData(");

    expect(requireRoleIdx).toBeGreaterThan(-1);
    expect(authorizeIdx).toBeGreaterThan(requireRoleIdx);
    expect(applyEndedIdx).toBeGreaterThan(authorizeIdx);
    expect(getTimelineIdx).toBeGreaterThan(authorizeIdx);

    expect(stripped).toMatch(
      /const\s+access\s*=\s*await\s+authorizeProject\s*\(\s*id\s*,\s*["']read["']\s*\)\s*;[\s\S]*?if\s*\(\s*!access\.ok\s*\)/,
    );
  });

  it("source-text guard: no timeline file imports recharts", () => {
    const timelineFiles = [
      path.resolve(__dirname, "../../src/features/sprints/gantt-layout.ts"),
      path.resolve(__dirname, "../../src/features/sprints/timeline-data.ts"),
      path.resolve(__dirname, "../../src/features/pm/components/GanttTimeline.tsx"),
      path.resolve(__dirname, "../../src/app/(admin)/dashboard/pm/[id]/timeline/page.tsx"),
    ];

    for (const file of timelineFiles) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/recharts/i);
    }
  });
});



