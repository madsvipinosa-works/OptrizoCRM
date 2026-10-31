import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("fs/promises", () => ({ default: { readFile: vi.fn() } }));

import fs from "fs/promises";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { GET } from "@/app/api/private-file/route";
import { ROLES, signInAs, type Role } from "../../helpers/mock-auth";
import type { MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const rolesExcept = (...allowed: Role[]) => ROLES.filter((role) => !allowed.includes(role));

const blob = "https://abc123.public.blob.vercel-storage.com/tenants/u1/brief.pdf";

function get(params: Record<string, string>) {
  const url = new URL("http://localhost/api/private-file");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return GET(new NextRequest(url));
}

/** The project's documents contain the file, so it belongs to the project. */
function projectHasFile(fileRef: string) {
  mockDb.query.agencyProjects.findFirst.mockResolvedValue({
    leadId: "lead-1",
    documents: [{ id: "d1", url: `/api/private-file?blobUrl=${encodeURIComponent(fileRef)}&projectId=p1` }],
  });
}

function clientOnProject() {
  mockDb.query.projectStakeholders.findFirst.mockResolvedValue({ projectId: "p1", userId: "client-1" });
}

beforeEach(() => {
  mockDb.resetMocks();
  signInAs(auth, null);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "secret-blob-token");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("file-bytes", { status: 200, headers: { "content-type": "application/pdf" } })),
  );
  vi.mocked(fs.readFile).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/api/private-file access checks", () => {
  it("returns 401 with no session", async () => {
    const res = await get({ blobUrl: blob, projectId: "p1" });
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is named", async () => {
    signInAs(auth, "manager");
    expect((await get({ projectId: "p1" })).status).toBe(400);
  });

  it.each(ROLES)("returns 400 for %s when projectId is left out, never serving the file", async (role) => {
    signInAs(auth, role, "user-1");
    const res = await get({ blobUrl: blob });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it.each(rolesExcept("manager", "developer", "client"))("returns 403 for %s", async (role) => {
    signInAs(auth, role);
    projectHasFile(blob);
    const res = await get({ blobUrl: blob, projectId: "p1" });
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 403 for a developer with no task in the project", async () => {
    signInAs(auth, "developer", "dev-2");
    projectHasFile(blob);
    mockDb.setSelectRows([]);
    expect((await get({ blobUrl: blob, projectId: "p1" })).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 403 for a client who is not on the project", async () => {
    signInAs(auth, "client", "client-9");
    projectHasFile(blob);
    mockDb.query.projectStakeholders.findFirst.mockResolvedValue(undefined);
    mockDb.query.leads.findFirst.mockResolvedValue(undefined);
    expect((await get({ blobUrl: blob, projectId: "p1" })).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 403 when the file belongs to a different project than the one named", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    projectHasFile("https://abc123.public.blob.vercel-storage.com/tenants/u2/other-clients-file.pdf");
    const res = await get({ blobUrl: blob, projectId: "p1" });
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 403 for a local path traversal that is not one of the project's files", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    projectHasFile(blob);
    const res = await get({ local: "../../.env", projectId: "p1" });
    expect(res.status).toBe(403);
    expect(fs.readFile).not.toHaveBeenCalled();
  });
});

describe("/api/private-file serving", () => {
  it("never sends the storage token to a host that is not Vercel Blob", async () => {
    signInAs(auth, "manager");
    const evil = "https://evil.example.com/steal.pdf";
    projectHasFile(evil);
    const res = await get({ blobUrl: evil, projectId: "p1" });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a look-alike host that only ends with the blob domain as a prefix", async () => {
    signInAs(auth, "manager");
    const lookalike = "https://blob.vercel-storage.com.evil.example/x.pdf";
    projectHasFile(lookalike);
    expect((await get({ blobUrl: lookalike, projectId: "p1" })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("serves a project file from Vercel Blob to the client on the project, with the token", async () => {
    signInAs(auth, "client", "client-1");
    clientOnProject();
    projectHasFile(blob);
    const res = await get({ blobUrl: blob, projectId: "p1" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("file-bytes");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(calledUrl).toBe(blob);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-blob-token");
  });

  it("serves a local upload that belongs to the project to the manager", async () => {
    signInAs(auth, "manager");
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      leadId: null,
      documents: [{ id: "d1", url: "/uploads/abc-brief.pdf" }],
    });
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("local-bytes"));
    const res = await get({ blobUrl: "/uploads/abc-brief.pdf", projectId: "p1" });
    expect(res.status).toBe(200);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
  });
});
