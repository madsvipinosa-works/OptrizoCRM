import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
  createSystemNotification: vi.fn(),
  notifyAllAdmins: vi.fn(),
  notifyProjectClients: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import { createSystemNotification } from "@/features/notifications/send";
import { createTask, startTask, deleteTask } from "@/features/pm/actions";
import * as sprintActionsModule from "@/features/sprints/actions";
import { planSprint, moveTaskToSprint } from "@/features/sprints/actions";
import { applyEndedSprints } from "@/features/sprints/sprint-end";
import { getTimelineData } from "@/features/sprints/timeline-data";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const root = path.resolve(__dirname, "../../..");

const rolesExceptManager: Role[] = ROLES.filter((r) => r !== "manager");

function createChainProxy(getRows: () => unknown): object {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve().then(getRows).then(resolve, reject);
        }
        return () => proxy;
      },
    },
  );
  return proxy;
}

function setSelectSequence(sequence: unknown[][]) {
  const queue = [...sequence];
  mockDb.select.mockImplementation(() => {
    const next = queue.length > 0 ? queue.shift()! : [];
    return createChainProxy(() => next);
  });
}

beforeEach(() => {
  mockDb.resetMocks();
  vi.clearAllMocks();
  signInAs(auth, null);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T04:00:00Z")); // 2026-11-10 in Asia/Manila
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("source-text & export guards (STOP 2)", () => {
  it("sprint-end.ts contains no revalidatePath, redirect, or notFound", () => {
    const src = fs.readFileSync(path.join(root, "src/features/sprints/sprint-end.ts"), "utf8");
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\brevalidatePath\b/);
    expect(stripped).not.toMatch(/\bredirect\b/);
    expect(stripped).not.toMatch(/\bnotFound\b/);
  });

  it("src/features/sprints/actions.ts exports ONLY planSprint and moveTaskToSprint", () => {
    const exportedKeys = Object.keys(sprintActionsModule).sort();
    expect(exportedKeys).toEqual(["moveTaskToSprint", "planSprint"]);
  });
});

describe("planSprint RBAC", () => {
  const validPlanInput = {
    projectId: "proj-1",
    name: "Sprint 1",
    goal: "Core Auth & Setup",
    startDate: "2026-11-10",
    endDate: "2026-11-20",
    taskIds: ["task-1"],
  };

  it("rejects anonymous caller with NO writes", async () => {
    const res = await planSprint(validPlanInput);
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expectNoWrites(mockDb);
  });

  it.each(rolesExceptManager)("rejects %s role with NO writes", async (role) => {
    signInAs(auth, role, `user-${role}`);
    const res = await planSprint(validPlanInput);
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expectNoWrites(mockDb);
  });
});

describe("moveTaskToSprint RBAC", () => {
  const validMoveInput = {
    taskId: "task-1",
    sprintId: "sprint-1",
  };

  it("rejects anonymous caller with NO writes", async () => {
    const res = await moveTaskToSprint(validMoveInput);
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expectNoWrites(mockDb);
  });

  it.each(rolesExceptManager)("rejects %s role with NO writes", async (role) => {
    signInAs(auth, role, `user-${role}`);
    const res = await moveTaskToSprint(validMoveInput);
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expectNoWrites(mockDb);
  });
});

describe("planSprint validation, containment, overlap, and IDOR guards", () => {
  beforeEach(() => {
    signInAs(auth, "manager", "pm-1");
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      id: "proj-1",
      leadId: "lead-1",
      isArchived: false,
    });
    mockDb.query.leads.findFirst.mockResolvedValue({
      id: "lead-1",
      assignedPmId: "pm-1",
    });
  });

  it("rejects when endDate is before startDate", async () => {
    const res = await planSprint({
      projectId: "proj-1",
      name: "Sprint 1",
      startDate: "2026-11-20",
      endDate: "2026-11-15",
      taskIds: [],
    });
    expect(res).toEqual({ ok: false, error: "INVALID_DATE_RANGE" });
    expectNoWrites(mockDb);
  });

  it("rejects when sprint endDate is in the past (before todayInManila)", async () => {
    const res = await planSprint({
      projectId: "proj-1",
      name: "Past Sprint",
      startDate: "2026-11-01",
      endDate: "2026-11-09", // today is 2026-11-10
      taskIds: [],
    });
    expect(res).toEqual({ ok: false, error: "SPRINT_ALREADY_ENDED" });
    expectNoWrites(mockDb);
  });

  it("rejects when sprint dates fall outside Development milestone dates", async () => {
    setSelectSequence([
      // 1. applyEndedSprints pre-check (no ended sprints)
      [],
      // 2. tx: lock agency_project
      [{ id: "proj-1" }],
      // 3. tx: development milestone (Nov 10 to Nov 20 at UTC midnight -> Nov 10 to Nov 20 in Asia/Manila)
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-10T00:00:00.000Z"),
          endDate: new Date("2026-11-20T00:00:00.000Z"),
        },
      ],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "Sprint Out of Bounds",
      startDate: "2026-11-10",
      endDate: "2026-11-25", // past Nov 20
    taskIds: [],
    });

    expect(res).toEqual({ ok: false, error: "OUTSIDE_DEVELOPMENT_DATES" });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("accepts a sprint starting on the Development milestone's start day (UTC midnight timestamptz)", async () => {
    setSelectSequence([
      [],
      [{ id: "proj-1" }],
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-10T00:00:00.000Z"),
          endDate: new Date("2026-11-20T00:00:00.000Z"),
        },
      ],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "Start Edge Sprint",
      startDate: "2026-11-10", // exact start day
      endDate: "2026-11-15",
      taskIds: [],
    });

    expect(res.ok).toBe(true);
  });

  it("accepts a sprint ending on the Development milestone's end day (UTC midnight timestamptz)", async () => {
    setSelectSequence([
      [],
      [{ id: "proj-1" }],
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-10T00:00:00.000Z"),
          endDate: new Date("2026-11-20T00:00:00.000Z"),
        },
      ],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "End Edge Sprint",
      startDate: "2026-11-15",
      endDate: "2026-11-20", // exact end day (even when milestone.end_date is 2026-11-20T00:00:00Z)
      taskIds: [],
    });

    expect(res.ok).toBe(true);
  });

  it("rejects a sprint starting one day before the Development milestone's start day", async () => {
    setSelectSequence([
      [],
      [{ id: "proj-1" }],
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-15T00:00:00.000Z"),
          endDate: new Date("2026-11-25T00:00:00.000Z"),
        },
      ],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "One Day Before Start",
      startDate: "2026-11-14", // 1 day before Nov 15
      endDate: "2026-11-20",
      taskIds: [],
    });

    expect(res).toEqual({ ok: false, error: "OUTSIDE_DEVELOPMENT_DATES" });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("rejects a sprint ending one day after the Development milestone's end day", async () => {
    setSelectSequence([
      [],
      [{ id: "proj-1" }],
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-10T00:00:00.000Z"),
          endDate: new Date("2026-11-20T00:00:00.000Z"),
        },
      ],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "One Day After End",
      startDate: "2026-11-10",
      endDate: "2026-11-21", // 1 day after Nov 20
      taskIds: [],
    });

    expect(res).toEqual({ ok: false, error: "OUTSIDE_DEVELOPMENT_DATES" });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("allows sprint dates and returns warning 'no_development_dates' when Development milestone dates are null", async () => {
    setSelectSequence([
      // 1. applyEndedSprints pre-check
      [],
      // 2. tx: lock agency_project
      [{ id: "proj-1" }],
      // 3. tx: development milestone with null dates
      [{ id: "m-dev", startDate: null, endDate: null }],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "Sprint 1",
      startDate: "2026-11-10",
      endDate: "2026-11-20",
      taskIds: [],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.warning).toBe("no_development_dates");
      expect(res.sprintId).toBeTruthy();
    }
  });

  it("returns { ok: false, error: 'SPRINT_OVERLAP' } on SQLSTATE 23P01 exclusion violation", async () => {
    setSelectSequence([
      [],
      [{ id: "proj-1" }],
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-01T00:00:00+08:00"),
          endDate: new Date("2026-11-30T23:59:59+08:00"),
        },
      ],
    ]);

    mockDb.insert.mockImplementationOnce(() =>
      createChainProxy(() => {
        const err = new Error("conflicting key value violates exclusion constraint") as Error & {
          code?: string;
        };
        err.code = "23P01";
        throw err;
      }),
    );

    const res = await planSprint({
      projectId: "proj-1",
      name: "Overlapping Sprint",
      startDate: "2026-11-12",
      endDate: "2026-11-18",
      taskIds: [],
    });

    expect(res).toEqual({ ok: false, error: "SPRINT_OVERLAP" });
  });

  it("returns friendly error on duplicate sprint name (SQLSTATE 23505)", async () => {
    setSelectSequence([
      [],
      [{ id: "proj-1" }],
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-01T00:00:00+08:00"),
          endDate: new Date("2026-11-30T23:59:59+08:00"),
        },
      ],
    ]);

    mockDb.insert.mockImplementationOnce(() =>
      createChainProxy(() => {
        const err = new Error("duplicate key value violates unique constraint") as Error & {
          code?: string;
        };
        err.code = "23505";
        throw err;
      }),
    );

    const res = await planSprint({
      projectId: "proj-1",
      name: "Sprint 1",
      startDate: "2026-11-12",
      endDate: "2026-11-18",
      taskIds: [],
    });

    expect(res).toEqual({
      ok: false,
      error: "A sprint with this name already exists in this project.",
    });
  });

  it("rejects IDOR when a foreign task id (belonging to another project or missing) is passed", async () => {
    setSelectSequence([
      // 1. applyEndedSprints pre-check
      [],
      // 2. tx: lock agency_project
      [{ id: "proj-1" }],
      // 3. tx: development milestone
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-01T00:00:00+08:00"),
          endDate: new Date("2026-11-30T23:59:59+08:00"),
        },
      ],
      // 4. tx: existing sprints
      [],
      // 5. tx: candidate tasks matching projectId=proj-1 (only 1 found out of 2 requested)
      [
        {
          id: "task-own",
          projectId: "proj-1",
          milestoneId: "m-dev",
          status: "backlog",
          sprintId: null,
          carriedOver: false,
          dueDate: null,
        },
      ],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "Sprint 1",
      startDate: "2026-11-10",
      endDate: "2026-11-20",
      taskIds: ["task-own", "task-foreign-proj-2"],
    });

    expect(res).toEqual({ ok: false, error: "INVALID_TASKS" });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("converts backlog tasks to to_do and preserves carried tasks' status and carriedOver=true", async () => {
    const updateSetPayloads: Record<string, unknown>[] = [];
    mockDb.update.mockImplementation(() => ({
      set: (payload: Record<string, unknown>) => {
        updateSetPayloads.push(payload);
        return createChainProxy(() => []);
      },
    }));

    const existingDueDate = new Date("2026-11-15T00:00:00Z");

    setSelectSequence([
      // 1. applyEndedSprints pre-check
      [],
      // 2. tx: lock agency_project
      [{ id: "proj-1" }],
      // 3. tx: development milestone
      [
        {
          id: "m-dev",
          startDate: new Date("2026-11-01T00:00:00+08:00"),
          endDate: new Date("2026-11-30T23:59:59+08:00"),
        },
      ],
      // 4. tx: existing sprints (sprint-0 ended on 2026-11-05)
      [{ id: "sprint-0", startDate: "2026-11-01", endDate: "2026-11-05" }],
      // 5. tx: candidate tasks (1 backlog without dueDate, 1 in_progress in ended sprint-0 with existing dueDate)
      [
        {
          id: "task-backlog",
          projectId: "proj-1",
          milestoneId: "m-dev",
          status: "backlog",
          sprintId: null,
          carriedOver: false,
          dueDate: null,
        },
        {
          id: "task-carried",
          projectId: "proj-1",
          milestoneId: "m-dev",
          status: "in_progress",
          sprintId: "sprint-0",
          carriedOver: true,
          dueDate: existingDueDate,
        },
      ],
      // 6. tx: assignees
      [{ userId: "dev-1" }],
    ]);

    const res = await planSprint({
      projectId: "proj-1",
      name: "Sprint 2",
      startDate: "2026-11-10",
      endDate: "2026-11-20",
      taskIds: ["task-backlog", "task-carried"],
    });

    expect(res.ok).toBe(true);
    expect(updateSetPayloads).toHaveLength(2);

    // Backlog task -> status becomes 'to_do', carriedOver stays false, dueDate set to sprint end
    expect(updateSetPayloads[0]).toMatchObject({
      status: "to_do",
      carriedOver: false,
    });
    expect(updateSetPayloads[0].dueDate).toBeInstanceOf(Date);

    // Carried task -> keeps 'in_progress', carriedOver stays true, existing dueDate preserved
    expect(updateSetPayloads[1]).toMatchObject({
      status: "in_progress",
      carriedOver: true,
      dueDate: existingDueDate,
    });

    expect(createSystemNotification).toHaveBeenCalledWith(
      "dev-1",
      expect.stringContaining('Sprint "Sprint 2"'),
      "task",
      "/dashboard/pm/proj-1",
    );
    expect(logAction).toHaveBeenCalledWith(
      "CREATE",
      "Sprint",
      expect.stringContaining("[actorRole:manager]"),
      "pm-1",
      "proj-1",
    );
  });
});

describe("moveTaskToSprint IDOR & validation", () => {
  beforeEach(() => {
    signInAs(auth, "manager", "pm-1");
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      id: "proj-1",
      leadId: "lead-1",
      isArchived: false,
    });
    mockDb.query.leads.findFirst.mockResolvedValue({
      id: "lead-1",
      assignedPmId: "pm-1",
    });
  });

  it("rejects IDOR with a foreign sprintId belonging to another project", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: "task-1",
      projectId: "proj-1",
      milestoneId: "m-dev",
      title: "Task 1",
    });

    setSelectSequence([
      // 1. applyEndedSprints pre-check
      [],
      // 2. tx: lock agency_project
      [{ id: "proj-1" }],
      // 3. tx: targetSprint where id=sprint-foreign AND projectId=proj-1 -> none!
      [],
    ]);

    const res = await moveTaskToSprint({
      taskId: "task-1",
      sprintId: "sprint-foreign",
    });

    expect(res).toEqual({ ok: false, error: "SPRINT_NOT_FOUND" });
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

describe("applyEndedSprints idempotency", () => {
  it("returns to_do to backlog, marks active statuses carried_over=true, leaves done alone, and second call is a no-op", async () => {
    const updateSetCalls: Record<string, unknown>[] = [];
    mockDb.update.mockImplementation(() => ({
      set: (payload: Record<string, unknown>) => {
        updateSetCalls.push(payload);
        return {
          where: () => ({
            returning: () =>
              Promise.resolve(
                payload.status === "backlog"
                  ? [{ id: "t-todo", sprintId: null }]
                  : [{ id: "t-prog", sprintId: "s-ended" }],
              ),
          }),
        };
      },
    }));

    // First call: s-ended has 1 to_do, 1 in_progress (carriedOver: false), and 1 done
    setSelectSequence([
      // 1. Pre-check: ended sprints
      [{ id: "s-ended", name: "Sprint 1" }],
      // 2. Pre-check: tasks in ended sprints
      [
        { id: "t-todo", status: "to_do", carriedOver: false },
        { id: "t-prog", status: "in_progress", carriedOver: false },
        { id: "t-done", status: "done", carriedOver: false },
      ],
      // 3. tx: lock agency_project
      [{ id: "proj-1" }],
      // 4. tx: lock ended sprints
      [{ id: "s-ended", name: "Sprint 1" }],
    ]);

    const firstRun = await applyEndedSprints("proj-1");
    expect(firstRun).toEqual({ returned: 1, carried: 1 });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(updateSetCalls).toHaveLength(2);
    expect(updateSetCalls[0]).toMatchObject({ status: "backlog", sprintId: null });
    expect(updateSetCalls[1]).toMatchObject({ carriedOver: true });
    expect(logAction).toHaveBeenCalledWith(
      "UPDATE",
      "Sprint",
      expect.stringContaining('Sprint "Sprint 1" ended'),
      undefined,
      "proj-1",
    );

    // Second call: all to_do are now backlog (sprintId=null) and in_progress has carriedOver=true
    mockDb.transaction.mockClear();
    updateSetCalls.length = 0;
    vi.mocked(logAction).mockClear();

    setSelectSequence([
      // 1. Pre-check: ended sprints
      [{ id: "s-ended", name: "Sprint 1" }],
      // 2. Pre-check: tasks remaining in s-ended (only carried in_progress and done)
      [
        { id: "t-prog", status: "in_progress", carriedOver: true },
        { id: "t-done", status: "done", carriedOver: false },
      ],
    ]);

    const secondRun = await applyEndedSprints("proj-1");
    expect(secondRun).toEqual({ returned: 0, carried: 0 });
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(updateSetCalls).toHaveLength(0);
    expect(logAction).not.toHaveBeenCalled();
  });
});

describe("createTask and startTask sprint integration (STOP 2 commit 2)", () => {
  beforeEach(() => {
    signInAs(auth, "manager", "pm-1");
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      id: "proj-1",
      leadId: "lead-1",
      isArchived: false,
    });
    mockDb.query.leads.findFirst.mockResolvedValue({
      id: "lead-1",
      assignedPmId: "pm-1",
    });
  });

  it("createTask defaults to status 'backlog' with sprintId=null in Development milestone", async () => {
    const insertedValues: Record<string, unknown>[] = [];
    mockDb.insert.mockImplementation(() => ({
      values: (payload: Record<string, unknown>) => {
        insertedValues.push(payload);
        return {
          returning: () =>
            Promise.resolve([{ id: "new-task-1", ...payload }]),
        };
      },
    }));

    mockDb.query.milestones.findFirst.mockResolvedValue({
      id: "m-dev",
      projectId: "proj-1",
      name: "development",
      title: "Full-Stack Development",
      status: "In Progress",
    });

    const res = await createTask("proj-1", "m-dev", "Build API");
    expect(res.success).toBe(true);
    expect(insertedValues[0]).toMatchObject({
      projectId: "proj-1",
      milestoneId: "m-dev",
      status: "backlog",
      sprintId: null,
    });
  });

  it("createTask sets status 'to_do' and sprintId when a valid non-ended sprintId of the same project is given in Development", async () => {
    const insertedValues: Record<string, unknown>[] = [];
    mockDb.insert.mockImplementation(() => ({
      values: (payload: Record<string, unknown>) => {
        insertedValues.push(payload);
        return {
          returning: () =>
            Promise.resolve([{ id: "new-task-2", ...payload }]),
        };
      },
    }));

    mockDb.query.milestones.findFirst.mockResolvedValue({
      id: "m-dev",
      projectId: "proj-1",
      name: "development",
      title: "Full-Stack Development",
      status: "In Progress",
    });
    mockDb.query.sprints.findFirst.mockResolvedValue({
      id: "sprint-active",
      projectId: "proj-1",
      startDate: "2026-11-10",
      endDate: "2026-11-20",
    });

    const res = await createTask("proj-1", "m-dev", "Sprint Task", undefined, undefined, 1, undefined, {
      sprintId: "sprint-active",
    });
    expect(res.success).toBe(true);
    expect(insertedValues[0]).toMatchObject({
      projectId: "proj-1",
      milestoneId: "m-dev",
      status: "to_do",
      sprintId: "sprint-active",
    });
  });

  it("createTask defaults to status 'to_do' and ignores sprintId in non-Development milestones", async () => {
    const insertedValues: Record<string, unknown>[] = [];
    mockDb.insert.mockImplementation(() => ({
      values: (payload: Record<string, unknown>) => {
        insertedValues.push(payload);
        return {
          returning: () =>
            Promise.resolve([{ id: "new-task-3", ...payload }]),
        };
      },
    }));

    mockDb.query.milestones.findFirst.mockResolvedValue({
      id: "m-design",
      projectId: "proj-1",
      name: "design",
      title: "UI/UX Design",
      status: "In Progress",
    });

    const res = await createTask("proj-1", "m-design", "Wireframes", undefined, undefined, 1, undefined, {
      sprintId: "sprint-active",
      toBacklog: true,
    });
    expect(res.success).toBe(true);
    expect(insertedValues[0]).toMatchObject({
      projectId: "proj-1",
      milestoneId: "m-design",
      status: "to_do",
      sprintId: null,
    });
  });

  it("startTask calls applyEndedSprints before checking task status", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({
      taskId: "task-expired-sprint",
      userId: "dev-1",
    });
    mockDb.query.tasks.findFirst.mockResolvedValue({
      projectId: "proj-1",
    });

    const updateSetPayloads: Record<string, unknown>[] = [];
    mockDb.update.mockImplementation(() => ({
      set: (payload: Record<string, unknown>) => {
        updateSetPayloads.push(payload);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: "task-expired-sprint", sprintId: null }]),
          }),
        };
      },
    }));

    setSelectSequence([
      // 1. applyEndedSprints pre-check: ended sprint found
      [{ id: "s-ended", name: "Sprint 1" }],
      // 2. applyEndedSprints pre-check: task is to_do in ended sprint
      [{ id: "task-expired-sprint", status: "to_do", carriedOver: false }],
      // 3. applyEndedSprints tx: lock agency_project
      [{ id: "proj-1" }],
      // 4. applyEndedSprints tx: lock ended sprints
      [{ id: "s-ended", name: "Sprint 1" }],
      // 5. startTask tx: lock task -> now status is 'backlog' after applyEndedSprints returned it!
      [{ id: "task-expired-sprint", status: "backlog", milestoneId: "m-dev", projectId: "proj-1" }],
    ]);

    const res = await startTask("task-expired-sprint");
    expect(res).toEqual({
      success: false,
      message: "Only tasks in To Do status can be started",
    });
    // Verify applyEndedSprints ran its backlog return update before startTask checked the task status
    expect(updateSetPayloads[0]).toMatchObject({
      status: "backlog",
      sprintId: null,
    });
  });
});

describe("deleteTask guard (STOP 3 commit A)", () => {
  it("rejects anonymous caller with NO writes", async () => {
    const res = await deleteTask("task-1");
    expect(res).toEqual({ success: false, message: "Unauthorized" });
    expectNoWrites(mockDb);
  });

  it.each(rolesExceptManager)("rejects %s role with NO writes", async (role) => {
    signInAs(auth, role, `user-${role}`);
    const res = await deleteTask("task-1");
    expect(res).toEqual({ success: false, message: "Unauthorized" });
    expectNoWrites(mockDb);
  });

  it("rejects a task from another project when authorizeProject denies write access", async () => {
    signInAs(auth, "manager", "pm-1");
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: "task-foreign",
      projectId: "proj-other",
      status: "backlog",
      title: "Foreign Task",
    });

    const authzMod = await import("@/lib/authz");
    const spy = vi
      .spyOn(authzMod, "authorizeProject")
      .mockResolvedValueOnce({ ok: false, reason: "FORBIDDEN" });

    const res = await deleteTask("task-foreign");
    expect(spy).toHaveBeenCalledWith("proj-other", "write");
    expect(res).toEqual({ success: false, message: "Unauthorized" });
    expectNoWrites(mockDb);
    spy.mockRestore();
  });

  it.each(["in_progress", "in_review", "changes_requested", "done"] as const)(
    "rejects %s task with friendly message and NO writes",
    async (status) => {
      signInAs(auth, "manager", "pm-1");
      mockDb.query.tasks.findFirst.mockResolvedValue({
        id: `task-${status}`,
        projectId: "proj-1",
        status,
        title: `Task ${status}`,
      });
      mockDb.query.agencyProjects.findFirst.mockResolvedValue({
        id: "proj-1",
        leadId: "lead-1",
        isArchived: false,
      });
      mockDb.query.leads.findFirst.mockResolvedValue({
        id: "lead-1",
        assignedPmId: "pm-1",
      });

      const res = await deleteTask(`task-${status}`);
      expect(res).toEqual({
        success: false,
        message: "Only tasks that have not started can be deleted.",
      });
      expectNoWrites(mockDb);
    },
  );

  it.each(["backlog", "to_do"] as const)(
    "allows deleting a %s task and writes audit log with projectId",
    async (status) => {
      signInAs(auth, "manager", "pm-1");
      mockDb.query.tasks.findFirst.mockResolvedValue({
        id: `task-${status}`,
        projectId: "proj-1",
        status,
        title: `Task ${status}`,
      });
      mockDb.query.agencyProjects.findFirst.mockResolvedValue({
        id: "proj-1",
        leadId: "lead-1",
        isArchived: false,
      });
      mockDb.query.leads.findFirst.mockResolvedValue({
        id: "lead-1",
        assignedPmId: "pm-1",
      });

      const res = await deleteTask(`task-${status}`);
      expect(res).toEqual({ success: true, message: "Task deleted." });
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(logAction).toHaveBeenCalledWith(
        "DELETE",
        "Task",
        `Task task-${status} soft-deleted`,
        "pm-1",
        "proj-1",
      );
    },
  );
});

describe("getTimelineData query (STOP 4)", () => {
  it("loads milestones, sprints, done/total counts (excluding backlog), and omits null key dates", async () => {
    setSelectSequence([
      // 1. agency_project row (signedOffAt is null)
      [
        {
          id: "proj-1",
          title: "Delivery Tracking App",
          status: "In Progress",
          leadId: "lead-1",
          signedOffAt: null,
        },
      ],
      // 2. lead row
      [
        {
          businessName: "Santos Logistics",
          contactName: "Maria Santos",
        },
      ],
      // 3. signed proposal row (signedAt present)
      [
        {
          signedAt: new Date("2026-11-07T02:00:00Z"),
          acceptedAt: null,
        },
      ],
      // 4. milestones
      [
        {
          id: "m-dev",
          name: "development",
          title: "Development",
          status: "In Progress",
          startDate: new Date("2026-11-10T00:00:00Z"),
          endDate: new Date("2026-11-30T00:00:00Z"),
          order: 1,
        },
      ],
      // 5. sprints
      [
        {
          id: "s-1",
          name: "Sprint 1",
          startDate: "2026-11-10",
          endDate: "2026-11-20",
        },
      ],
      // 6. non-deleted tasks (even if a backlog row were returned, it is ignored)
      [
        { id: "t-1", milestoneId: "m-dev", sprintId: "s-1", status: "done" },
        { id: "t-2", milestoneId: "m-dev", sprintId: "s-1", status: "in_progress" },
        { id: "t-3", milestoneId: "m-dev", sprintId: null, status: "backlog" },
      ],
      // 7. uat meeting (none)
      [],
    ]);

    const data = await getTimelineData("proj-1");
    expect(data).not.toBeNull();
    expect(data!.project).toEqual({
      id: "proj-1",
      title: "Delivery Tracking App",
      status: "In Progress",
      businessName: "Santos Logistics",
      clientName: "Maria Santos",
    });
    expect(data!.milestones[0]).toMatchObject({
      id: "m-dev",
      name: "Development",
      doneTasks: 1,
      totalTasks: 2,
    });
    expect(data!.sprints[0]).toMatchObject({
      id: "s-1",
      name: "Sprint 1",
      status: "active",
      doneTasks: 1,
      totalTasks: 2,
    });
    // Only signing key date present; testing_day and completion_sign_off omitted when null
    expect(data!.keyDates).toEqual([
      {
        kind: "signing",
        label: "Signed",
        date: "2026-11-07",
      },
    ]);
  });
});




