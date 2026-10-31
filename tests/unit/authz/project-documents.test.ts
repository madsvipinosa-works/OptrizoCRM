import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/audit/error-logger", () => ({ logSystemError: vi.fn() }));
vi.mock("@/features/upload/actions", () => ({ deleteImage: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
  notifyAllAdmins: vi.fn(),
  notifyProjectClients: vi.fn(),
  notifyLeadClient: vi.fn(),
  createSystemNotification: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import { notifyAllAdmins, notifyProjectClients } from "@/features/notifications/send";
import { addProjectDocument, deleteProjectDocument } from "@/features/pm/actions";
import { addClientLeadDocument } from "@/features/client-portal/actions";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const rolesExcept = (...allowed: Role[]) => ROLES.filter((role) => !allowed.includes(role));

const doc = {
  id: "doc-1",
  title: "Brand guide",
  url: "https://example.public.blob.vercel-storage.com/brand.pdf",
  type: "pdf" as const,
  sizeBytes: 100,
};

/** Makes the signed-in client a stakeholder of the project. */
function clientOnProject() {
  mockDb.query.projectStakeholders.findFirst.mockResolvedValue({ projectId: "p1", userId: "client-1" });
}

/** Makes the signed-in client a stranger to the project. */
function clientNotOnProject() {
  mockDb.query.projectStakeholders.findFirst.mockResolvedValue(undefined);
  mockDb.query.leads.findFirst.mockResolvedValue(undefined);
}

beforeEach(() => {
  mockDb.resetMocks();
  signInAs(auth, null);
  vi.mocked(logAction).mockClear();
  vi.mocked(notifyAllAdmins).mockClear();
  vi.mocked(notifyProjectClients).mockClear();
  mockDb.query.agencyProjects.findFirst.mockResolvedValue({ id: "p1", title: "Portal", leadId: "lead-1", documents: [] });
});

describe("addProjectDocument", () => {
  it("rejects an anonymous caller", async () => {
    expect((await addProjectDocument("p1", doc)).success).toBe(false);
    expectNoWrites(mockDb);
    expect(logAction).not.toHaveBeenCalled();
  });

  it.each(rolesExcept("manager", "client"))("rejects %s", async (role) => {
    signInAs(auth, role);
    expect((await addProjectDocument("p1", doc)).success).toBe(false);
    expectNoWrites(mockDb);
    expect(logAction).not.toHaveBeenCalled();
  });

  it("rejects a client who is not on the project", async () => {
    signInAs(auth, "client", "client-1");
    clientNotOnProject();
    expect((await addProjectDocument("p1", doc)).success).toBe(false);
    expectNoWrites(mockDb);
  });

  it("rejects a file reference that is not an https, upload or private-file URL", async () => {
    signInAs(auth, "manager");
    expect((await addProjectDocument("p1", { ...doc, url: "javascript:alert(1)" })).success).toBe(false);
    expectNoWrites(mockDb);
  });

  it("lets the manager add a document, recorded as an agency upload", async () => {
    signInAs(auth, "manager", "pm-1");
    expect((await addProjectDocument("p1", doc)).success).toBe(true);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(notifyProjectClients).toHaveBeenCalledTimes(1);
    expect(notifyAllAdmins).not.toHaveBeenCalled();
  });

  it("ignores a forged uploader role from the caller", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    const forged = { ...doc, uploadedById: "pm-1", uploadedByName: "Agency PM", uploadedByRole: "agency" as const };
    expect((await addProjectDocument("p1", forged)).success).toBe(true);
    // Treated as a client upload: admins are told, the project's clients are not.
    expect(notifyAllAdmins).toHaveBeenCalledTimes(1);
    expect(notifyProjectClients).not.toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledWith("CREATE", "Project Document", expect.any(String), "client-1");
  });
});

describe("deleteProjectDocument", () => {
  const ownDoc = { id: "doc-1", title: "Mine", url: "https://x.example/a.pdf", uploadedById: "client-1" };
  const otherDoc = { id: "doc-2", title: "Theirs", url: "https://x.example/b.pdf", uploadedById: "pm-1" };

  beforeEach(() => {
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      id: "p1",
      title: "Portal",
      leadId: "lead-1",
      documents: [ownDoc, otherDoc],
    });
  });

  it("rejects an anonymous caller", async () => {
    expect((await deleteProjectDocument("p1", "doc-1")).success).toBe(false);
    expectNoWrites(mockDb);
  });

  it.each(rolesExcept("manager", "client"))("rejects %s", async (role) => {
    signInAs(auth, role);
    expect((await deleteProjectDocument("p1", "doc-1")).success).toBe(false);
    expectNoWrites(mockDb);
  });

  it("rejects a client from another project", async () => {
    signInAs(auth, "client", "client-9");
    clientNotOnProject();
    expect((await deleteProjectDocument("p1", "doc-1")).success).toBe(false);
    expectNoWrites(mockDb);
  });

  it("rejects a client deleting a document another user uploaded", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    expect((await deleteProjectDocument("p1", "doc-2")).success).toBe(false);
    expectNoWrites(mockDb);
  });

  it("lets a client delete their own upload, and the manager delete any document", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    expect((await deleteProjectDocument("p1", "doc-1")).success).toBe(true);

    signInAs(auth, "manager", "pm-1");
    expect((await deleteProjectDocument("p1", "doc-2")).success).toBe(true);
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });
});

describe("addClientLeadDocument", () => {
  const url = "https://example.public.blob.vercel-storage.com/uploads/brief.pdf";

  it("rejects an anonymous caller", async () => {
    expect((await addClientLeadDocument("p1", url)).success).toBe(false);
    expect(mockDb.query.agencyProjects.findFirst).not.toHaveBeenCalled();
    expectNoWrites(mockDb);
  });

  it.each(rolesExcept("manager", "client"))("rejects %s, who used to be allowed as staff", async (role) => {
    signInAs(auth, role);
    expect((await addClientLeadDocument("p1", url)).success).toBe(false);
    expectNoWrites(mockDb);
    expect(logAction).not.toHaveBeenCalled();
  });

  it("rejects a client who is neither a stakeholder nor the lead's owner", async () => {
    signInAs(auth, "client", "client-9");
    clientNotOnProject();
    expect((await addClientLeadDocument("p1", url)).success).toBe(false);
    expectNoWrites(mockDb);
    expect(logAction).not.toHaveBeenCalled();
  });

  it("gives the same answer for a missing project, so IDs cannot be probed", async () => {
    signInAs(auth, "client", "client-9");
    clientNotOnProject();
    const denied = await addClientLeadDocument("p1", url);

    mockDb.query.agencyProjects.findFirst.mockResolvedValue(undefined);
    const missing = await addClientLeadDocument("nope", url);
    expect(missing).toEqual(denied);
  });

  it("rejects a file reference that is not an upload or https URL", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    expect((await addClientLeadDocument("p1", "javascript:alert(1)")).success).toBe(false);
    expectNoWrites(mockDb);
  });

  it("lets a stakeholder client attach a document and tells the admins", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    expect((await addClientLeadDocument("p1", url)).success).toBe(true);
    expect(notifyAllAdmins).toHaveBeenCalledTimes(1);
  });

  it("links the client of the originating lead as a stakeholder on first upload", async () => {
    signInAs(auth, "client", "client-1");
    mockDb.query.projectStakeholders.findFirst.mockResolvedValue(undefined);
    mockDb.query.leads.findFirst.mockResolvedValue({ id: "lead-1" });
    expect((await addClientLeadDocument("p1", url)).success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("lets the manager attach a document and tells the project's clients", async () => {
    signInAs(auth, "manager", "pm-1");
    expect((await addClientLeadDocument("p1", url)).success).toBe(true);
    expect(notifyProjectClients).toHaveBeenCalledTimes(1);
    expect(notifyAllAdmins).not.toHaveBeenCalled();
  });
});
