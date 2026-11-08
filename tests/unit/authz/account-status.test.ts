import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import util from "util";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: vi.fn() }));
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
  notifyAllAdmins: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { notFound } from "next/navigation";
import TeamPage from "@/app/(admin)/dashboard/team/page";
import TeamMemberDetailPage from "@/app/(admin)/dashboard/team/[id]/page";
import { lockUser, unlockUser, deactivateUser, reactivateUser } from "@/features/users/actions";
import { changeAccountStatus, type DbTransaction } from "@/features/users/account-status";
import { updateUserRole } from "@/features/cms/team/actions";
import { canSignIn, isSessionValid } from "@/lib/account-status";
import { ROLES, signInAs } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const nonSuperadminRoles = ROLES.filter((role) => role !== "superadmin");

const targetUuid = "11111111-1111-4111-a111-111111111111";
const superadminUuid = "22222222-2222-4222-a222-222222222222";

function mockQueryChain(rows: unknown) {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve, reject);
        }
        return () => proxy;
      },
    }
  );
  return proxy;
}

beforeEach(() => {
  mockDb.resetMocks();
  signInAs(auth, null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("canSignIn truth table", () => {
  it("returns true only if status === 'active' && isActive && !deletedAt", () => {
    expect(canSignIn({ status: "active", isActive: true, deletedAt: null })).toBe(true);
    expect(canSignIn({ status: "active", isActive: false, deletedAt: null })).toBe(false);
    expect(canSignIn({ status: "active", isActive: true, deletedAt: new Date() })).toBe(false);
    expect(canSignIn({ status: "deactivated", isActive: false, deletedAt: null })).toBe(false);
    expect(canSignIn({ status: "locked", isActive: true, deletedAt: null })).toBe(false);
    expect(canSignIn({ status: "invited", isActive: true, deletedAt: null })).toBe(false);
    expect(canSignIn(null)).toBe(false);
    expect(canSignIn(undefined)).toBe(false);
  });
});

describe("isSessionValid truth table", () => {
  it("evaluates session validity according to specification", () => {
    // Active accounts with isActive=true and no deletedAt are valid
    expect(isSessionValid({ status: "active", isActive: true, deletedAt: null })).toBe(true);
    expect(isSessionValid({ status: "active", isActive: false, deletedAt: null })).toBe(false);
    expect(isSessionValid({ status: "active", isActive: true, deletedAt: new Date() })).toBe(false);

    // Deactivated and invited accounts are never valid
    expect(isSessionValid({ status: "deactivated", isActive: false, deletedAt: null })).toBe(false);
    expect(isSessionValid({ status: "invited", isActive: true, deletedAt: null })).toBe(false);

    // Manual lock (lockedUntil is null) terminates sessions
    expect(isSessionValid({ status: "locked", isActive: true, deletedAt: null, lockedUntil: null })).toBe(false);

    // Automatic lock (lockedUntil is set) does NOT terminate existing sessions
    expect(isSessionValid({ status: "locked", isActive: true, deletedAt: null, lockedUntil: new Date(Date.now() + 60000) })).toBe(true);

    // Soft-deleted user
    expect(isSessionValid({ status: "locked", isActive: true, deletedAt: new Date(), lockedUntil: new Date() })).toBe(false);

    // Null/undefined
    expect(isSessionValid(null)).toBe(false);
    expect(isSessionValid(undefined)).toBe(false);
  });
});

describe("Account status actions authorization & guards", () => {
  const actions = [
    { name: "lockUser", fn: lockUser },
    { name: "unlockUser", fn: unlockUser },
    { name: "deactivateUser", fn: deactivateUser },
    { name: "reactivateUser", fn: reactivateUser },
  ];

  for (const { name, fn } of actions) {
    describe(name, () => {
      it("rejects anonymous callers with NO db writes", async () => {
        signInAs(auth, null);
        const res = await fn(targetUuid);
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/unauthorized/i);
        expectNoWrites(mockDb);
      });

      it.each(nonSuperadminRoles)("rejects %s callers with NO db writes", async (role) => {
        signInAs(auth, role, `${role}-user-1`);
        const res = await fn(targetUuid);
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/unauthorized/i);
        expectNoWrites(mockDb);
      });

      it("rejects self-target", async () => {
        signInAs(auth, "superadmin", superadminUuid);
        const res = await fn(superadminUuid);
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/cannot change your own/i);
      });
    });
  }
});

describe("changeAccountStatus domain logic", () => {
  const actor = { id: superadminUuid, role: "superadmin" };

  it("protects the last active Super Admin from lock or deactivation", async () => {
    // Only 1 active superadmin exists (the target)
    mockDb.select
      .mockReturnValueOnce(mockQueryChain([{ id: targetUuid }]))
      .mockReturnValueOnce(mockQueryChain([{ id: targetUuid, role: "superadmin", status: "active", isActive: true, password: "hash" }]));

    const lockResult = await changeAccountStatus(mockDb as unknown as DbTransaction, actor, targetUuid, "locked");
    expect(lockResult.ok).toBe(false);
    if (!lockResult.ok) {
      expect(lockResult.error).toMatch(/last active super admin/i);
    }

    mockDb.select
      .mockReturnValueOnce(mockQueryChain([{ id: targetUuid }]))
      .mockReturnValueOnce(mockQueryChain([{ id: targetUuid, role: "superadmin", status: "active", isActive: true, password: "hash" }]));

    const deactivateResult = await changeAccountStatus(mockDb as unknown as DbTransaction, actor, targetUuid, "deactivated");
    expect(deactivateResult.ok).toBe(false);
    if (!deactivateResult.ok) {
      expect(deactivateResult.error).toMatch(/last active super admin/i);
    }
  });

  it("rejects deactivated -> active when target password is null", async () => {
    mockDb.select
      .mockReturnValueOnce(mockQueryChain([{ id: superadminUuid }, { id: "other-sa" }]))
      .mockReturnValueOnce(mockQueryChain([{ id: targetUuid, role: "developer", status: "deactivated", isActive: false, password: null }]));

    const result = await changeAccountStatus(mockDb as unknown as DbTransaction, actor, targetUuid, "active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/without a password/i);
    }
  });

  it("allows valid transitions and updates status and isActive correctly", async () => {
    // active -> locked
    mockDb.select
      .mockReturnValueOnce(mockQueryChain([{ id: superadminUuid }, { id: "sa-2" }]))
      .mockReturnValueOnce(mockQueryChain([{ id: targetUuid, role: "developer", status: "active", isActive: true, password: "hash" }]));

    const lockResult = await changeAccountStatus(mockDb as unknown as DbTransaction, actor, targetUuid, "locked");
    expect(lockResult.ok).toBe(true);
    if (lockResult.ok) {
      expect(lockResult.previousStatus).toBe("active");
    }
    expect(mockDb.update).toHaveBeenCalled();

    // locked -> active
    mockDb.select
      .mockReturnValueOnce(mockQueryChain([{ id: superadminUuid }, { id: "sa-2" }]))
      .mockReturnValueOnce(mockQueryChain([{ id: targetUuid, role: "developer", status: "locked", isActive: true, password: "hash" }]));

    const unlockResult = await changeAccountStatus(mockDb as unknown as DbTransaction, actor, targetUuid, "active");
    expect(unlockResult.ok).toBe(true);
  });
});

describe("updateUserRole hardening", () => {
  it("rejects unauthenticated and non-superadmin callers with NO db writes", async () => {
    signInAs(auth, null);
    const anonRes = await updateUserRole(targetUuid, "developer");
    expect(anonRes.success).toBe(false);
    expect(anonRes.message).toMatch(/unauthorized/i);
    expectNoWrites(mockDb);

    for (const role of nonSuperadminRoles) {
      signInAs(auth, role, `${role}-user-1`);
      const res = await updateUserRole(targetUuid, "developer");
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/unauthorized/i);
      expectNoWrites(mockDb);
    }
  });

  it("rejects self-target", async () => {
    signInAs(auth, "superadmin", superadminUuid);
    const res = await updateUserRole(superadminUuid, "developer");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cannot change your own role/i);
  });

  it("rejects promotion to superadmin or client (only sales, manager, developer, content_editor allowed)", async () => {
    signInAs(auth, "superadmin", superadminUuid);

    const superadminRes = await updateUserRole(targetUuid, "superadmin");
    expect(superadminRes.success).toBe(false);
    expect(superadminRes.message).toMatch(/invalid role/i);

    const clientRes = await updateUserRole(targetUuid, "client");
    expect(clientRes.success).toBe(false);
    expect(clientRes.message).toMatch(/invalid role/i);
  });

  it("rejects modifying a Super Admin target", async () => {
    signInAs(auth, "superadmin", superadminUuid);
    mockDb.setSelectRows([{ id: targetUuid, role: "superadmin", name: "Target Admin" }]);

    const res = await updateUserRole(targetUuid, "developer");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cannot modify a super admin/i);
  });

  it("rejects modifying a client account target", async () => {
    signInAs(auth, "superadmin", superadminUuid);
    mockDb.setSelectRows([{ id: targetUuid, role: "client", name: "Target Client" }]);

    const res = await updateUserRole(targetUuid, "developer");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cannot change the role of a client/i);
  });
});

describe("authorizeUser password check on deactivated accounts", () => {
  it("wrong password on a deactivated user returns null without revealing account status", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash("RealPassword123!", 10);

    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: "deactivated-user-1",
      email: "deactivated@example.com",
      password: hashedPassword,
      isActive: false,
      status: "deactivated",
      deletedAt: null,
      role: "developer",
      name: "Deactivated Dev",
    });

    const result = await authorizeUser({
      email: "deactivated@example.com",
      password: "WrongPassword999!",
    });

    // Must return null without throwing an error that reveals account status
    expect(result).toBeNull();
  });
});

describe("team pages source-text authorization guard (requireRole before DB queries)", () => {
  const root = path.resolve(__dirname, "../../..");

  it("team/page.tsx calls requireRole(['superadmin']) before executing queries", () => {
    const filePath = path.join(root, "src/app/(admin)/dashboard/team/page.tsx");
    const src = fs.readFileSync(filePath, "utf8");

    // Must import requireRole from @/lib/authz
    expect(src).toMatch(/import\s*\{[^}]*requireRole[^}]*\}\s*from\s*["']@\/lib\/authz["']/);

    // Find positions of requireRole and db queries
    const requireRoleIdx = src.indexOf("requireRole(");
    const dbQueryIdx = src.indexOf("db.");

    expect(requireRoleIdx).toBeGreaterThan(-1);
    expect(dbQueryIdx).toBeGreaterThan(-1);
    expect(requireRoleIdx).toBeLessThan(dbQueryIdx);

    // Must check for superadmin
    expect(src).toMatch(/requireRole\(\s*\[\s*["']superadmin["']\s*\]\s*\)/);

    // Must redirect to /dashboard on failure
    expect(src).toMatch(/redirect\(["']\/dashboard["']\)/);
  });

  it("team/new/page.tsx calls requireRole before querying when present", () => {
    const filePath = path.join(root, "src/app/(admin)/dashboard/team/new/page.tsx");
    if (!fs.existsSync(filePath)) {
      // team/new/page.tsx is scheduled for later stop
      return;
    }
    const src = fs.readFileSync(filePath, "utf8");
    const requireRoleIdx = src.indexOf("requireRole(");
    const dbQueryIdx = src.indexOf("db.");

    expect(requireRoleIdx).toBeGreaterThan(-1);
    if (dbQueryIdx !== -1) {
      expect(requireRoleIdx).toBeLessThan(dbQueryIdx);
    }
    expect(src).toMatch(/requireRole\(\s*\[\s*["']superadmin["']\s*\]\s*\)/);
  });

  it("team/[id]/page.tsx calls requireRole(['superadmin']) before any db/query call", () => {
    const filePath = path.join(root, "src/app/(admin)/dashboard/team/[id]/page.tsx");
    const src = fs.readFileSync(filePath, "utf8");

    expect(src).toMatch(/import\s*\{[^}]*requireRole[^}]*\}\s*from\s*["']@\/lib\/authz["']/);

    const requireRoleIdx = src.indexOf("requireRole(");
    const dbQueryIdx = src.indexOf("db.");

    expect(requireRoleIdx).toBeGreaterThan(-1);
    expect(dbQueryIdx).toBeGreaterThan(-1);
    expect(requireRoleIdx).toBeLessThan(dbQueryIdx);
    expect(src).toMatch(/requireRole\(\s*\[\s*["']superadmin["']\s*\]\s*\)/);
  });

  it("list and detail queries never select the password column", () => {
    const listPath = path.join(root, "src/app/(admin)/dashboard/team/page.tsx");
    const detailPath = path.join(root, "src/app/(admin)/dashboard/team/[id]/page.tsx");

    const listSrc = fs.readFileSync(listPath, "utf8");
    const detailSrc = fs.readFileSync(detailPath, "utf8");

    expect(listSrc).not.toMatch(/password/i);
    expect(detailSrc).not.toMatch(/password/i);
  });

  it("roles/page.tsx calls requireRole(['superadmin']) before any db/query call", () => {
    const filePath = path.join(root, "src/app/(admin)/dashboard/roles/page.tsx");
    const src = fs.readFileSync(filePath, "utf8");

    expect(src).toMatch(/import\s*\{[^}]*requireRole[^}]*\}\s*from\s*["']@\/lib\/authz["']/);

    const requireRoleIdx = src.indexOf("requireRole(");
    const dbQueryIdx = src.indexOf("db.");

    expect(requireRoleIdx).toBeGreaterThan(-1);
    if (dbQueryIdx !== -1) {
      expect(requireRoleIdx).toBeLessThan(dbQueryIdx);
    }
    expect(src).toMatch(/requireRole\(\s*\[\s*["']superadmin["']\s*\]\s*\)/);
    expect(src).toMatch(/redirect\(["']\/dashboard["']\)/);
  });

  it("middleware.ts allows only superadmin on /dashboard/roles", () => {
    const middlewarePath = path.join(root, "middleware.ts");
    const src = fs.readFileSync(middlewarePath, "utf8");

    // Source-text check: /dashboard/roles is in the superadmin block
    expect(src).toMatch(/cleanPath\s*===\s*["']\/dashboard\/roles["']/);
    expect(src).toMatch(/cleanPath\.startsWith\(["']\/dashboard\/roles\/["']\)/);

    // Extract and evaluate isAllowedOnDashboardPath across all roles
    const fnMatch = src.match(/function isAllowedOnDashboardPath\([^)]*\)[^{]*\{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0]
      .replace(/:\s*string/g, "")
      .replace(/:\s*boolean/g, "");
    const checkPath = new Function(`${fnBody}; return isAllowedOnDashboardPath;`)() as (
      pathname: string,
      role: string
    ) => boolean;

    expect(checkPath("/dashboard/roles", "superadmin")).toBe(true);
    expect(checkPath("/dashboard/roles/sub", "superadmin")).toBe(true);

    for (const role of nonSuperadminRoles) {
      expect(checkPath("/dashboard/roles", role)).toBe(false);
      expect(checkPath("/dashboard/roles/sub", role)).toBe(false);
    }
  });
});

describe("team list and detail runtime behavior (Session 10 / STOP 5)", () => {
  it("invalid id format on team/[id]/page.tsx calls notFound() without querying DB", async () => {
    signInAs(auth, "superadmin", superadminUuid);
    vi.mocked(notFound).mockClear();

    await TeamMemberDetailPage({
      params: Promise.resolve({ id: "not-a-valid-uuid" }),
    });

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(mockDb.query.users.findFirst).not.toHaveBeenCalled();
  });

  it("missing or soft-deleted user on team/[id]/page.tsx calls notFound()", async () => {
    signInAs(auth, "superadmin", superadminUuid);
    vi.mocked(notFound).mockClear();

    // Missing user
    mockDb.query.users.findFirst.mockResolvedValueOnce(undefined);
    await TeamMemberDetailPage({
      params: Promise.resolve({ id: targetUuid }),
    });
    expect(notFound).toHaveBeenCalledTimes(1);

    // Soft-deleted user
    vi.mocked(notFound).mockClear();
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: targetUuid,
      name: "Deleted User",
      email: "del@optrizo.ph",
      role: "developer",
      status: "deactivated",
      isActive: false,
      jobTitle: null,
      lockedUntil: null,
      deletedAt: new Date(),
    });
    await TeamMemberDetailPage({
      params: Promise.resolve({ id: targetUuid }),
    });
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("team/page.tsx filters ignore invalid enum values and apply valid enum values", async () => {
    signInAs(auth, "superadmin", superadminUuid);

    mockDb.query.users.findMany.mockResolvedValue([]);

    // 1. Invalid enum values are ignored
    await TeamPage({
      searchParams: Promise.resolve({
        role: "not_a_role",
        status: "not_a_status",
      }),
    });

    expect(mockDb.query.users.findMany).toHaveBeenCalledTimes(1);
    const invalidCallArg = mockDb.query.users.findMany.mock.calls[0][0];
    expect(invalidCallArg.columns).not.toHaveProperty("password");
    expect(invalidCallArg.limit).toBe(10); // 10 per page
    expect(invalidCallArg.offset).toBe(0);
    const invalidWhereStr = util.inspect(invalidCallArg.where, { depth: 8 });
    expect(invalidWhereStr).not.toContain("not_a_role");
    expect(invalidWhereStr).not.toContain("not_a_status");

    // 2. Valid enum values are applied
    mockDb.query.users.findMany.mockClear();
    await TeamPage({
      searchParams: Promise.resolve({
        role: "developer",
        status: "locked",
      }),
    });

    expect(mockDb.query.users.findMany).toHaveBeenCalledTimes(1);
    const validCallArg = mockDb.query.users.findMany.mock.calls[0][0];
    const validWhereStr = util.inspect(validCallArg.where, { depth: 8 });
    expect(validWhereStr).toContain("developer");
    expect(validWhereStr).toContain("locked");
  });
});
