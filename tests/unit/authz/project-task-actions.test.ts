import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
  notifyAllAdmins: vi.fn(),
  notifyProjectClients: vi.fn(),
  notifyLeadClient: vi.fn(),
  createSystemNotification: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { getProjectForLead } from "@/features/crm/actions";
import { getProjectProgress } from "@/actions/progress";
import { getClientUsers, submitTask } from "@/features/pm/actions";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;

const validSubmission = {
  taskId: "task-1",
  proofUrl: "https://github.com/optrizo/app/pull/42",
  submissionNotes: "Implemented the form, verified validation and tested the error states locally.",
};

/** Every role except those listed. */
const rolesExcept = (...allowed: Role[]) => ROLES.filter((role) => !allowed.includes(role));

beforeEach(() => {
  mockDb.resetMocks();
  signInAs(auth, null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getProjectForLead", () => {
  it("returns nothing to an anonymous caller and never queries", async () => {
    expect(await getProjectForLead("lead-1")).toBeNull();
    expect(mockDb.query.agencyProjects.findFirst).not.toHaveBeenCalled();
  });

  it.each(rolesExcept("manager", "sales"))("returns nothing to %s", async (role) => {
    signInAs(auth, role);
    expect(await getProjectForLead("lead-1")).toBeNull();
    expect(mockDb.query.agencyProjects.findFirst).not.toHaveBeenCalled();
  });

  it.each(["manager", "sales"] as const)("returns the project to %s", async (role) => {
    signInAs(auth, role);
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({ id: "p1", title: "Portal", status: "Kickoff" });
    expect(await getProjectForLead("lead-1")).toEqual({ id: "p1", title: "Portal", status: "Kickoff" });
  });
});

describe("getProjectProgress", () => {
  const progress = { totalWeight: 10, completedWeight: 5, percentage: 50 };

  it("throws for an anonymous caller and never runs the query", async () => {
    await expect(getProjectProgress("p1")).rejects.toThrow("Unauthorized");
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it.each(["sales", "content_editor", "superadmin"] as const)("throws for %s", async (role) => {
    signInAs(auth, role);
    await expect(getProjectProgress("p1")).rejects.toThrow("Unauthorized");
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it("throws for a developer with no task in the project", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.setSelectRows([]);
    await expect(getProjectProgress("p1")).rejects.toThrow("Unauthorized");
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it("throws for a client who is not on the project", async () => {
    signInAs(auth, "client", "client-1");
    mockDb.query.projectStakeholders.findFirst.mockResolvedValue(undefined);
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({ leadId: "lead-of-someone-else" });
    mockDb.query.leads.findFirst.mockResolvedValue(undefined);
    await expect(getProjectProgress("p1")).rejects.toThrow("Unauthorized");
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it("returns progress to the manager, an assigned developer and the project's client", async () => {
    mockDb.execute.mockResolvedValue({ rows: [{ progress }] });

    signInAs(auth, "manager");
    expect(await getProjectProgress("p1")).toEqual(progress);

    signInAs(auth, "developer", "dev-1");
    mockDb.setSelectRows([{ taskId: "t1" }]);
    expect(await getProjectProgress("p1")).toEqual(progress);

    signInAs(auth, "client", "client-1");
    mockDb.query.projectStakeholders.findFirst.mockResolvedValue({ projectId: "p1", userId: "client-1" });
    expect(await getProjectProgress("p1")).toEqual(progress);
  });
});

describe("submitTask", () => {
  const validInput = {
    taskId: "task-1",
    files: [],
    links: ["https://github.com/optrizo/app/pull/42"],
    note: "Completed and tested login form",
  };

  it("rejects an anonymous caller", async () => {
    expect(await submitTask(validInput)).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it.each(rolesExcept("developer"))("rejects non-developer role %s", async (role) => {
    signInAs(auth, role);
    expect(await submitTask(validInput)).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("rejects when no files and no links are provided", async () => {
    signInAs(auth, "developer", "dev-1");
    expect(await submitTask({ taskId: "task-1", files: [], links: [] })).toEqual({
      ok: false,
      error: "NEED_FILE_OR_LINK",
    });
  });

  it("rejects a developer who is not assigned to the task", async () => {
    signInAs(auth, "developer", "dev-2");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);
    expect(await submitTask(validInput)).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("rejects when task is in an invalid status", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: "task-1",
      status: "Done",
      milestone: { project: { id: "p1" } },
    });
    expect(await submitTask(validInput)).toEqual({ ok: false, error: "INVALID_STATUS" });
  });

  it("lets the assigned developer submit from In Progress", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: "task-1",
      status: "In Progress",
      milestone: { project: { id: "p1" } },
    });

    const result = await submitTask(validInput);
    expect(result).toEqual({ ok: true, status: "in_review" });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("getClientUsers", () => {
  it("returns an empty list to an anonymous caller and never queries", async () => {
    expect(await getClientUsers()).toEqual([]);
    expect(mockDb.query.users.findMany).not.toHaveBeenCalled();
  });

  it.each(rolesExcept("manager"))("returns an empty list to %s", async (role) => {
    signInAs(auth, role);
    expect(await getClientUsers()).toEqual([]);
    expect(mockDb.query.users.findMany).not.toHaveBeenCalled();
  });

  it("returns the client list to the manager", async () => {
    signInAs(auth, "manager");
    mockDb.query.users.findMany.mockResolvedValue([{ id: "c1", name: "Maria", email: "maria@example.com", image: null }]);
    expect(await getClientUsers()).toHaveLength(1);
  });
});
