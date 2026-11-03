import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
  notifyAllAdmins: vi.fn(),
  notifyProjectClients: vi.fn(),
  notifyLeadClient: vi.fn(),
  notifyLeadPms: vi.fn(),
  createSystemNotification: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({
  sendPaymentDueEmail: vi.fn(),
  sendProjectCompleteEmail: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { uploadPaymentProof, confirmPayment, rejectPaymentProof } from "@/features/payments/actions";
import { addHandoverFile, recordSignOff, completeProject } from "@/features/pm/completion-actions";
import { submitProjectFeedback } from "@/features/client-portal/feedback-actions";
import { updateProjectDetails, updateProjectStatus } from "@/features/pm/actions";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import type { MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const rolesExcept = (...allowed: Role[]) => ROLES.filter((role) => !allowed.includes(role));

beforeEach(() => {
  mockDb.resetMocks();
  signInAs(auth, null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("uploadPaymentProof", () => {
  it("rejects unauthenticated callers", async () => {
    const res = await uploadPaymentProof("pay-1", "/uploads/proof.pdf");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it.each(rolesExcept("client"))("rejects %s callers", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await uploadPaymentProof("pay-1", "/uploads/proof.pdf");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });
});

describe("confirmPayment", () => {
  it("rejects unauthenticated callers", async () => {
    const res = await confirmPayment("pay-1", {
      method: "cash",
      orNumber: "OR-1001",
      receivedAt: new Date(),
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it.each(rolesExcept("manager"))("rejects %s callers", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await confirmPayment("pay-1", {
      method: "cash",
      orNumber: "OR-1001",
      receivedAt: new Date(),
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it("rejects missing OR number", async () => {
    signInAs(auth, "manager", "pm-1");
    const res = await confirmPayment("pay-1", {
      method: "cash",
      orNumber: "",
      receivedAt: new Date(),
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/official receipt.*required/i);
  });

  it("rejects cheque payment when bank name or cheque number is missing", async () => {
    signInAs(auth, "manager", "pm-1");
    const res = await confirmPayment("pay-1", {
      method: "cheque",
      bankName: "BDO",
      chequeNumber: "",
      orNumber: "OR-1002",
      receivedAt: new Date(),
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cheque payment requires both bank name and cheque number/i);
  });
});

describe("rejectPaymentProof", () => {
  it("rejects unauthenticated callers", async () => {
    const res = await rejectPaymentProof("pay-1", "Image is unreadable");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it.each(rolesExcept("manager"))("rejects %s callers", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await rejectPaymentProof("pay-1", "Image is unreadable");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it("rejects empty or whitespace reason", async () => {
    signInAs(auth, "manager", "pm-1");
    const res = await rejectPaymentProof("pay-1", "  ");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/rejection reason must be at least 3 characters/i);
  });
});

describe("addHandoverFile and recordSignOff", () => {
  it.each(rolesExcept("manager"))("addHandoverFile rejects %s", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await addHandoverFile("proj-1", {
      title: "Design System",
      fileName: "design.fig",
      fileUrl: "/uploads/design.fig",
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it.each(rolesExcept("manager"))("recordSignOff rejects %s", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await recordSignOff("proj-1", {
      signOffFileUrl: "/uploads/signoff.pdf",
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it("recordSignOff rejects future sign-off date", async () => {
    signInAs(auth, "manager", "pm-1");
    const futureDate = new Date(Date.now() + 86400000 * 2);
    const res = await recordSignOff("proj-1", {
      signOffFileUrl: "/uploads/signoff.pdf",
      signedOffAt: futureDate,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/sign-off date cannot be in the future/i);
  });
});

describe("completeProject", () => {
  it.each(rolesExcept("manager"))("completeProject rejects %s", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await completeProject("proj-1");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });
});

describe("submitProjectFeedback", () => {
  it.each(rolesExcept("client"))("submitProjectFeedback rejects %s", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await submitProjectFeedback("proj-1", { rating: 5, comment: "Great work!" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it("rejects invalid rating values (< 1 or > 5 or non-integer)", async () => {
    signInAs(auth, "client", "client-1");
    const resTooLow = await submitProjectFeedback("proj-1", { rating: 0 });
    expect(resTooLow.success).toBe(false);
    expect(resTooLow.error).toMatch(/rating must be an integer between 1 and 5/i);

    const resTooHigh = await submitProjectFeedback("proj-1", { rating: 6 });
    expect(resTooHigh.success).toBe(false);
    expect(resTooHigh.error).toMatch(/rating must be an integer between 1 and 5/i);

    const resDecimal = await submitProjectFeedback("proj-1", { rating: 4.5 });
    expect(resDecimal.success).toBe(false);
    expect(resDecimal.error).toMatch(/rating must be an integer between 1 and 5/i);
  });

  it("rejects feedback comment exceeding 2000 characters", async () => {
    signInAs(auth, "client", "client-1");
    const longComment = "a".repeat(2001);
    const res = await submitProjectFeedback("proj-1", { rating: 5, comment: longComment });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/comment cannot exceed 2000 characters/i);
  });
});

describe("Completed project guards in pm actions", () => {
  it("updateProjectDetails rejects setting status directly to Completed", async () => {
    signInAs(auth, "manager", "pm-1");
    const res = await updateProjectDetails("proj-1", {
      title: "Project",
      status: "Completed",
    });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/projects can only be marked completed via the project completion flow/i);
  });

  it("updateProjectStatus rejects setting status directly to Completed", async () => {
    signInAs(auth, "manager", "pm-1");
    const res = await updateProjectStatus("proj-1", "Completed");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/projects can only be marked completed via the project completion flow/i);
  });
});
