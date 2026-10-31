import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import {
  completeCrmTask,
  createCrmTask,
  deleteCrmTask,
  updateCrmTask,
  updateCrmTaskStatus,
} from "@/actions/crm-tasks";
import {
  markInquiryHandled,
  markInquiryRead,
  updateInquiryAssignment,
  updateInquiryNextAction,
} from "@/features/inquiries/actions";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;

const ALLOWED: Role[] = ["sales"];
const blockedRoles = ROLES.filter((role) => !ALLOWED.includes(role));

beforeEach(() => {
  mockDb.resetMocks();
  signInAs(auth, null);
  vi.mocked(logAction).mockClear();
});

const crmTaskCalls: Record<string, () => Promise<unknown>> = {
  completeCrmTask: () => completeCrmTask("task-1"),
  updateCrmTaskStatus: () => updateCrmTaskStatus("task-1", "In Progress"),
  createCrmTask: () => createCrmTask({ leadId: "lead-1", title: "Call the client" }),
  updateCrmTask: () => updateCrmTask("task-1", { title: "New title" }),
  deleteCrmTask: () => deleteCrmTask("task-1"),
};

const inquiryCalls: Record<string, () => Promise<unknown>> = {
  updateInquiryAssignment: () => updateInquiryAssignment("inq-1", "sales-2"),
  updateInquiryNextAction: () => updateInquiryNextAction("inq-1", "Send the brochure"),
  markInquiryRead: () => markInquiryRead("inq-1"),
  markInquiryHandled: () => markInquiryHandled("inq-1", true),
};

describe.each(Object.entries({ ...crmTaskCalls, ...inquiryCalls }))("%s access", (_name, call) => {
  it("rejects an anonymous caller without writing or auditing", async () => {
    expect(await call()).toMatchObject({ success: false, message: "Unauthorized" });
    expectNoWrites(mockDb);
    expect(logAction).not.toHaveBeenCalled();
  });

  it.each(blockedRoles)("rejects %s without writing or auditing", async (role) => {
    signInAs(auth, role);
    expect(await call()).toMatchObject({ success: false, message: "Unauthorized" });
    expectNoWrites(mockDb);
    expect(logAction).not.toHaveBeenCalled();
  });
});

describe("CRM tasks: a sales user succeeds and every change is audited", () => {
  beforeEach(() => {
    signInAs(auth, "sales", "sales-1");
    mockDb.setWriteRows([{ id: "task-1" }]);
    mockDb.query.leads.findFirst.mockResolvedValue({ id: "lead-1" });
    mockDb.query.users.findFirst.mockResolvedValue({ id: "sales-2", role: "sales", isActive: true });
  });

  it.each([
    ["completeCrmTask", crmTaskCalls.completeCrmTask, "UPDATE"],
    ["updateCrmTaskStatus", crmTaskCalls.updateCrmTaskStatus, "UPDATE"],
    ["createCrmTask", crmTaskCalls.createCrmTask, "CREATE"],
    ["updateCrmTask", crmTaskCalls.updateCrmTask, "UPDATE"],
    ["deleteCrmTask", crmTaskCalls.deleteCrmTask, "DELETE"],
  ] as const)("%s", async (_name, call, action) => {
    expect(await call()).toMatchObject({ success: true });
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(action, "CRM Task", expect.any(String), "sales-1");
  });

  it("reports a task that does not exist and writes no audit row", async () => {
    mockDb.setWriteRows([]);
    expect(await completeCrmTask("missing")).toMatchObject({ success: false, message: "Task not found" });
    expect(await deleteCrmTask("missing")).toMatchObject({ success: false, message: "Task not found" });
    expect(logAction).not.toHaveBeenCalled();
  });

  it("refuses to create a task on a lead that does not exist", async () => {
    mockDb.query.leads.findFirst.mockResolvedValue(undefined);
    expect(await createCrmTask({ leadId: "nope", title: "Call" })).toMatchObject({ success: false, message: "Lead not found" });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });

  it("refuses to assign a task to someone who is not an active sales user", async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: "client-1", role: "client", isActive: true });
    expect(
      await createCrmTask({ leadId: "lead-1", title: "Call", assignedTo: "client-1" }),
    ).toMatchObject({ success: false });
    expect(await updateCrmTask("task-1", { assignedTo: "client-1" })).toMatchObject({ success: false });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("drops fields that updateCrmTask is not meant to change", async () => {
    const forged = { title: "Renamed", leadId: "other-lead", status: "Completed", id: "other-task" };
    expect(await updateCrmTask("task-1", forged as never)).toMatchObject({ success: true });
    expect(logAction).toHaveBeenCalledWith("UPDATE", "CRM Task", "Updated sales task task-1 (title)", "sales-1");
  });

  it("rejects an update with nothing allowed in it", async () => {
    expect(await updateCrmTask("task-1", { leadId: "x" } as never)).toMatchObject({ success: false, message: "Nothing to update" });
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

describe("Inquiries: a sales user succeeds and every change is audited", () => {
  beforeEach(() => {
    signInAs(auth, "sales", "sales-1");
    mockDb.setWriteRows([{ id: "inq-1" }]);
    mockDb.query.users.findFirst.mockResolvedValue({ id: "sales-2", role: "sales", isActive: true });
  });

  it.each(Object.entries(inquiryCalls))("%s", async (_name, call) => {
    expect(await call()).toMatchObject({ success: true });
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith("UPDATE", "Inquiry", expect.stringContaining("inq-1"), "sales-1");
  });

  it("does not audit a change that did not happen", async () => {
    mockDb.setWriteRows([]);
    expect(await updateInquiryNextAction("missing", "x")).toMatchObject({ success: false, message: "Inquiry not found" });
    expect(logAction).not.toHaveBeenCalled();
  });

  it("refuses to assign an inquiry to someone who is not an active sales user", async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: "dev-1", role: "developer", isActive: true });
    expect(await updateInquiryAssignment("inq-1", "dev-1")).toMatchObject({ success: false });
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });
});
