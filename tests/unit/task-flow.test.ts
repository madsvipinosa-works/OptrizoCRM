import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/audit/error-logger", () => ({ logSystemError: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
  notifyAllAdmins: vi.fn(),
  notifyProjectClients: vi.fn(),
  createSystemNotification: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import {
  startTask,
  submitTask,
  approveTask,
  requestTaskChanges,
  markEmptyMilestoneDone,
  createTask,
} from "@/features/pm/actions";
import { closeMilestoneAndAdvance } from "@/features/pm/milestone-flow";
import { signInAs } from "../helpers/mock-auth";
import type { MockDb } from "../helpers/mock-db";

const mockDb = db as unknown as MockDb;

function createChainProxy(getRows: () => unknown): object {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve(getRows()).then(resolve);
        }
        return () => proxy;
      },
    }
  );
  return proxy;
}

function setSelectRows(rows: unknown[]) {
  mockDb.select.mockImplementation(() => createChainProxy(() => rows));
}

function setSelectSequence(sequence: unknown[][]) {
  const queue = [...sequence];
  mockDb.select.mockImplementation(() => {
    const next = queue.length > 0 ? queue.shift()! : [];
    return createChainProxy(() => next);
  });
}

function setUpdateRows(rows: unknown[]) {
  mockDb.update.mockImplementation(() => createChainProxy(() => rows));
}

beforeEach(() => {
  mockDb.resetMocks();
  setSelectRows([]);
  setUpdateRows([]);
  signInAs(auth, null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("startTask", () => {
  it("rejects an anonymous caller", async () => {
    const res = await startTask("task-1");
    expect(res).toEqual({ success: false, message: "Unauthorized: Only assigned developers can start tasks" });
  });

  it("rejects when developer is not assigned to the task", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);

    const res = await startTask("task-1");
    expect(res).toEqual({ success: false, message: "Unauthorized: Task not assigned to you" });
  });

  it("rejects when task is not in to_do status", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    setSelectRows([{ id: "task-1", status: "in_progress", milestoneId: "m1" }]);

    const res = await startTask("task-1");
    expect(res).toEqual({ success: false, message: "Only tasks in To Do status can be started" });
  });

  it("rejects when milestone is not In Progress", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    setSelectSequence([
      [{ id: "task-1", status: "to_do", milestoneId: "m1" }],
      [{ id: "m1", status: "Pending" }],
    ]);

    const res = await startTask("task-1");
    expect(res).toEqual({ success: false, message: "Cannot start task: Milestone is not In Progress" });
  });

  it("rejects when prerequisite task is not completed", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    setSelectSequence([
      [{ id: "task-1", status: "to_do", milestoneId: "m1", dependsOnTaskId: "task-0" }],
      [{ id: "m1", status: "In Progress" }],
      [{ id: "task-0", title: "Setup Database", status: "in_progress" }],
    ]);

    const res = await startTask("task-1");
    expect(res).toEqual({
      success: false,
      message: 'Prerequisite task "Setup Database" must be completed first',
    });
  });

  it("transitions to_do to in_progress successfully", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    setSelectSequence([
      [{ id: "task-1", status: "to_do", milestoneId: "m1", title: "Build Form", projectId: "p1" }],
      [{ id: "m1", status: "In Progress" }],
    ]);

    const res = await startTask("task-1");
    expect(res).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("submitTask", () => {
  it("clears reviewNote and sets in_review on successful submission", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: "task-1",
      title: "Task 1",
      status: "changes_requested",
      reviewNote: "Fix the alignment",
      milestone: { project: { id: "p1" } },
    });
    mockDb.query.tasks.findMany.mockResolvedValue([]);

    const res = await submitTask({
      taskId: "task-1",
      files: [],
      links: ["https://github.com/pr/42"],
      note: "Fixed alignment as requested",
    });

    expect(res).toEqual({ ok: true, status: "in_review" });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("approveTask", () => {
  it("rejects non-manager", async () => {
    signInAs(auth, "developer", "dev-1");
    const res = await approveTask("task-1");
    expect(res).toEqual({ success: false, message: "Unauthorized: Only managers can approve tasks" });
  });

  it("rejects when task is not in_review", async () => {
    signInAs(auth, "manager");
    setSelectRows([{ id: "task-1", status: "in_progress", milestoneId: "m1" }]);

    const res = await approveTask("task-1");
    expect(res).toEqual({ success: false, message: "Task must be in review to be approved" });
  });

  it("approves task to done and advances milestone when all tasks completed", async () => {
    signInAs(auth, "manager");
    setSelectSequence([
      // 1. Task in review
      [{ id: "task-1", title: "Task 1", status: "in_review", milestoneId: "m1", projectId: "p1" }],
      // 2. Remaining tasks in milestone (all done)
      [{ id: "task-2", status: "done" }],
      // 3. Current milestone in closeMilestoneAndAdvance
      [{ id: "m1", name: "requirements", title: "Requirements & Architecture", status: "In Progress", projectId: "p1", order: 0 }],
      // 4. Pending milestones (design next)
      [{ id: "m2", name: "design", title: "UI/UX Design", status: "Pending", projectId: "p1", order: 1 }],
      // 5. Payments matching trigger
      [],
      // 6. Assignees
      [{ userId: "dev-1" }],
    ]);
    setUpdateRows([
      [{ id: "m1", name: "requirements", title: "Requirements & Architecture", status: "Completed" }],
      [{ id: "m2", name: "design", title: "UI/UX Design", status: "In Progress" }],
    ]);

    const res = await approveTask("task-1");
    expect(res).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("requestTaskChanges", () => {
  it("rejects empty comment", async () => {
    signInAs(auth, "manager");
    const res = await requestTaskChanges("task-1", "   ");
    expect(res).toEqual({ success: false, message: "A comment explaining requested changes is required" });
  });

  it("updates task to changes_requested and sets reviewNote", async () => {
    signInAs(auth, "manager");
    setSelectSequence([
      [{ id: "task-1", title: "Task 1", status: "in_review", projectId: "p1" }],
      [{ userId: "dev-1" }],
    ]);

    const res = await requestTaskChanges("task-1", "Please update the responsive styles");
    expect(res).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("markEmptyMilestoneDone", () => {
  it("rejects non-manager", async () => {
    signInAs(auth, "developer", "dev-1");
    const res = await markEmptyMilestoneDone({ milestoneId: "m5", reason: "No handover tasks" });
    expect(res).toEqual({ success: false, message: "Unauthorized: Only managers can complete empty milestones" });
  });

  it("rejects empty reason", async () => {
    signInAs(auth, "manager");
    const res = await markEmptyMilestoneDone({ milestoneId: "m5", reason: "  " });
    expect(res).toEqual({ success: false, message: "Reason is required to mark an empty milestone as done" });
  });

  it("rejects when milestone has tasks", async () => {
    signInAs(auth, "manager");
    setSelectSequence([
      [{ id: "m5", status: "In Progress", projectId: "p1" }],
      [{ id: "t-existing" }],
    ]);

    const res = await markEmptyMilestoneDone({ milestoneId: "m5", reason: "Done" });
    expect(res).toEqual({ success: false, message: "Milestone has tasks and cannot be marked empty" });
  });

  it("completes empty milestone and records doneReason", async () => {
    signInAs(auth, "manager");
    setSelectSequence([
      // 1. Lock milestone in markEmptyMilestoneDone
      [{ id: "m5", name: "handover", title: "Final Handover & Deployment", status: "In Progress", projectId: "p1", order: 4 }],
      // 2. Count tasks in milestone (empty)
      [],
      // 3. Lock milestone in closeMilestoneAndAdvance
      [{ id: "m5", name: "handover", title: "Final Handover & Deployment", status: "In Progress", projectId: "p1", order: 4 }],
      // 4. Pending milestones (none)
      [],
      // 5. All remaining milestones to check completed
      [{ id: "m5", status: "Completed" }],
      // 6. Payments
      [],
    ]);
    setUpdateRows([
      [{ id: "m5", title: "Final Handover & Deployment", status: "Completed", doneReason: "Approved by client verbally" }],
    ]);

    const res = await markEmptyMilestoneDone({ milestoneId: "m5", reason: "Approved by client verbally" });
    expect(res).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("createTask hardening", () => {
  it("rejects adding task to a Completed milestone", async () => {
    signInAs(auth, "manager");
    mockDb.query.milestones.findFirst.mockResolvedValue({ id: "m1", status: "Completed" });

    const res = await createTask("p1", "m1", "New Task");
    expect(res).toEqual({ success: false, message: "Cannot add task to a completed milestone" });
  });

  it("rejects assignee who is not a project team member", async () => {
    signInAs(auth, "manager");
    mockDb.query.milestones.findFirst.mockResolvedValue({ id: "m1", status: "In Progress" });
    mockDb.query.projectTeamMembers.findFirst.mockResolvedValue(undefined);

    const res = await createTask("p1", "m1", "New Task", undefined, ["dev-stranger"]);
    expect(res).toEqual({ success: false, message: "Assigned user is not a member of the project team" });
  });
});

describe("closeMilestoneAndAdvance", () => {
  it("rejects closing Development milestone when backlog tasks exist", async () => {
    let callIndex = 0;
    const fakeTx = {
      select: vi.fn(() =>
        createChainProxy(() => {
          callIndex++;
          return callIndex === 1
            ? [{ id: "m3", name: "development", title: "Full-Stack Development", status: "In Progress", projectId: "p1" }]
            : [{ id: "task-backlog" }];
        })
      ),
      update: vi.fn(() => createChainProxy(() => [])),
    } as unknown as Parameters<typeof closeMilestoneAndAdvance>[0];

    await expect(closeMilestoneAndAdvance(fakeTx, "m3")).rejects.toThrow(
      "Cannot close Development milestone while tasks remain in backlog"
    );
  });
});
