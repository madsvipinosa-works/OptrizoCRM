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
import { getLatestTaskSubmission, polishDeliveryNotes, submitTaskForVerification } from "@/actions/task-quality-gate";
import { getClientUsers, getTaskAuditReport } from "@/features/pm/actions";
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
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
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

describe("submitTaskForVerification", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true }));
  });

  it("rejects an anonymous caller before reading the task or fetching the proof URL", async () => {
    expect(await submitTaskForVerification(validSubmission)).toEqual({ success: false, error: "Unauthorized" });
    expect(mockDb.query.tasks.findFirst).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expectNoWrites(mockDb);
  });

  it.each(rolesExcept("manager", "developer"))("rejects %s", async (role) => {
    signInAs(auth, role);
    expect(await submitTaskForVerification(validSubmission)).toEqual({ success: false, error: "Unauthorized" });
    expect(fetch).not.toHaveBeenCalled();
    expectNoWrites(mockDb);
  });

  it("rejects a developer who is not assigned to the task", async () => {
    signInAs(auth, "developer", "dev-2");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);
    expect(await submitTaskForVerification(validSubmission)).toEqual({ success: false, error: "Unauthorized" });
    expect(fetch).not.toHaveBeenCalled();
    expectNoWrites(mockDb);
  });

  it("lets the assigned developer submit", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: "task-1",
      projectId: "p1",
      title: "Build the login form",
      description: "Login form with validation",
      milestone: { title: "Development" },
    });
    mockDb.setWriteRows([{ id: "s1" }]);

    const result = await submitTaskForVerification(validSubmission);
    expect(result.success).toBe(true);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("getLatestTaskSubmission", () => {
  it("returns nothing to an anonymous caller and never queries", async () => {
    expect(await getLatestTaskSubmission("task-1")).toBeNull();
    expect(mockDb.query.taskSubmissions.findFirst).not.toHaveBeenCalled();
  });

  it.each(rolesExcept("manager", "developer"))("returns nothing to %s", async (role) => {
    signInAs(auth, role);
    expect(await getLatestTaskSubmission("task-1")).toBeNull();
    expect(mockDb.query.taskSubmissions.findFirst).not.toHaveBeenCalled();
  });

  it("returns nothing to a developer who is not assigned", async () => {
    signInAs(auth, "developer", "dev-2");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);
    expect(await getLatestTaskSubmission("task-1")).toBeNull();
    expect(mockDb.query.taskSubmissions.findFirst).not.toHaveBeenCalled();
  });

  it("returns the submission to the manager and to the assigned developer", async () => {
    mockDb.query.taskSubmissions.findFirst.mockResolvedValue({ id: "s1", taskId: "task-1" });

    signInAs(auth, "manager");
    expect(await getLatestTaskSubmission("task-1")).toEqual({ id: "s1", taskId: "task-1" });

    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "task-1", userId: "dev-1" });
    expect(await getLatestTaskSubmission("task-1")).toEqual({ id: "s1", taskId: "task-1" });
  });
});

describe("getTaskAuditReport", () => {
  it("returns nothing to an anonymous caller", async () => {
    expect(await getTaskAuditReport("task-1")).toBeNull();
    expect(mockDb.query.taskSubmissions.findFirst).not.toHaveBeenCalled();
  });

  it.each(rolesExcept("manager", "developer"))("returns nothing to %s", async (role) => {
    signInAs(auth, role);
    expect(await getTaskAuditReport("task-1")).toBeNull();
    expect(mockDb.query.taskSubmissions.findFirst).not.toHaveBeenCalled();
  });

  it("returns nothing to a developer who is not assigned", async () => {
    signInAs(auth, "developer", "dev-2");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);
    expect(await getTaskAuditReport("task-1")).toBeNull();
    expect(mockDb.query.taskSubmissions.findFirst).not.toHaveBeenCalled();
  });

  it("returns the report to the manager", async () => {
    signInAs(auth, "manager");
    mockDb.query.taskSubmissions.findFirst.mockResolvedValue({ id: "s1" });
    expect(await getTaskAuditReport("task-1")).toEqual({ id: "s1" });
  });
});

describe("polishDeliveryNotes", () => {
  const input = { taskTitle: "Build the login form", rawNotes: "added validation and error states" };

  it("rejects an anonymous caller", async () => {
    expect(await polishDeliveryNotes(input)).toEqual({ success: false, error: "Unauthorized" });
  });

  it.each(rolesExcept("manager", "developer"))("rejects %s", async (role) => {
    signInAs(auth, role);
    expect(await polishDeliveryNotes(input)).toEqual({ success: false, error: "Unauthorized" });
  });

  it("rejects a developer polishing notes for a task that is not theirs", async () => {
    signInAs(auth, "developer", "dev-2");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);
    expect(await polishDeliveryNotes({ ...input, taskId: "task-1" })).toEqual({ success: false, error: "Unauthorized" });
  });

  it("lets a developer and the manager polish notes", async () => {
    signInAs(auth, "developer", "dev-1");
    expect((await polishDeliveryNotes(input)).success).toBe(true);

    signInAs(auth, "manager");
    expect((await polishDeliveryNotes(input)).success).toBe(true);
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
