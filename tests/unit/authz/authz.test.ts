import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));

import { auth } from "@/auth";
import { db } from "@/db";
import { authorizeProject, authorizeTask, fileBelongsToProject, requireRoles, requireSession } from "@/lib/authz";
import { ROLES, signInAs } from "../../helpers/mock-auth";
import type { MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;

beforeEach(() => {
  mockDb.resetMocks();
  signInAs(auth, null);
});

describe("requireSession / requireRoles", () => {
  it("rejects when nobody is signed in", async () => {
    expect(await requireSession()).toEqual({ ok: false, reason: "UNAUTHENTICATED" });
    expect(await requireRoles(["manager"])).toEqual({ ok: false, reason: "UNAUTHENTICATED" });
  });

  it("allows only the listed roles", async () => {
    for (const role of ROLES) {
      signInAs(auth, role);
      const res = await requireRoles(["manager", "sales"]);
      expect(res.ok).toBe(role === "manager" || role === "sales");
    }
  });
});

describe("authorizeProject", () => {
  it("rejects an anonymous caller", async () => {
    expect(await authorizeProject("p1", "read")).toEqual({ ok: false, reason: "UNAUTHENTICATED" });
  });

  it.each(["sales", "content_editor", "superadmin"] as const)("%s never gets project access", async (role) => {
    signInAs(auth, role);
    expect(await authorizeProject("p1", "read")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
    expect(await authorizeProject("p1", "write")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("lets a manager read and write any project", async () => {
    signInAs(auth, "manager");
    expect((await authorizeProject("p1", "read")).ok).toBe(true);
    expect((await authorizeProject("p1", "write")).ok).toBe(true);
  });

  it("lets a developer read only a project where they have an assigned task", async () => {
    signInAs(auth, "developer", "dev-1");
    mockDb.setSelectRows([{ taskId: "t1" }]);
    expect((await authorizeProject("p1", "read")).ok).toBe(true);
    expect(await authorizeProject("p1", "write")).toMatchObject({ ok: false, reason: "FORBIDDEN" });

    mockDb.setSelectRows([]);
    expect(await authorizeProject("p1", "read")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
  });

  it("lets a client in only when they are a stakeholder or own the originating lead", async () => {
    signInAs(auth, "client", "client-1");

    mockDb.query.projectStakeholders.findFirst.mockResolvedValue({ projectId: "p1", userId: "client-1" });
    expect((await authorizeProject("p1", "write")).ok).toBe(true);

    mockDb.query.projectStakeholders.findFirst.mockResolvedValue(undefined);
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({ leadId: "lead-1" });
    mockDb.query.leads.findFirst.mockResolvedValue({ id: "lead-1" });
    expect((await authorizeProject("p1", "read")).ok).toBe(true);

    mockDb.query.leads.findFirst.mockResolvedValue(undefined);
    expect(await authorizeProject("p2", "read")).toMatchObject({ ok: false, reason: "FORBIDDEN" });

    mockDb.query.agencyProjects.findFirst.mockResolvedValue({ leadId: null });
    expect(await authorizeProject("p3", "read")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
  });

  it("treats an empty project id as forbidden", async () => {
    signInAs(auth, "manager");
    expect(await authorizeProject("", "read")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
  });
});

describe("authorizeTask", () => {
  it("rejects an anonymous caller", async () => {
    expect(await authorizeTask("t1")).toEqual({ ok: false, reason: "UNAUTHENTICATED" });
  });

  it.each(["client", "sales", "content_editor", "superadmin"] as const)("%s has no task access", async (role) => {
    signInAs(auth, role);
    expect(await authorizeTask("t1")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
  });

  it("lets a manager in, and a developer only on their own task", async () => {
    signInAs(auth, "manager");
    expect((await authorizeTask("t1")).ok).toBe(true);

    signInAs(auth, "developer", "dev-1");
    mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "t1", userId: "dev-1" });
    expect((await authorizeTask("t1")).ok).toBe(true);

    mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);
    expect(await authorizeTask("t2")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
  });
});

describe("fileBelongsToProject", () => {
  const raw = "https://abc.public.blob.vercel-storage.com/tenants/u1/spec.pdf";

  it("matches a raw document URL and a private-file proxy URL", async () => {
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      documents: [{ id: "d1", url: `/api/private-file?blobUrl=${encodeURIComponent(raw)}&projectId=p1` }],
    });
    expect(await fileBelongsToProject("p1", raw)).toBe(true);

    mockDb.query.agencyProjects.findFirst.mockResolvedValue({ documents: [{ id: "d1", url: raw }] });
    expect(await fileBelongsToProject("p1", raw)).toBe(true);
  });

  it("matches a task proof link", async () => {
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({ documents: [] });
    mockDb.query.tasks.findMany.mockResolvedValue([{ proofLinks: [{ label: "Spec", url: raw }] }]);
    expect(await fileBelongsToProject("p1", raw)).toBe(true);
  });

  it("does not match a file that belongs to another project", async () => {
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      documents: [{ id: "d1", url: "https://abc.public.blob.vercel-storage.com/tenants/u2/other.pdf" }],
    });
    mockDb.query.tasks.findMany.mockResolvedValue([]);
    expect(await fileBelongsToProject("p1", raw)).toBe(false);
  });
});
