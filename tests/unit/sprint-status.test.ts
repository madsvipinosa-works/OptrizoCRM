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


