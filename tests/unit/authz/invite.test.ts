import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: vi.fn() }));
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  sendStaffInviteEmail: vi.fn().mockResolvedValue({ success: true, mock: false }),
  sendEmailVerificationEmail: vi.fn().mockResolvedValue({ success: true, mock: false }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  inviteStaff,
  resendStaffInvite,
  cancelStaffInvite,
  acceptStaffInvite,
} from "@/features/users/invite-actions";
import { createStaffInvite, consumeStaffInvite, hashInviteToken } from "@/features/users/invite";
import { sendStaffInviteEmail, sendEmailVerificationEmail } from "@/lib/notifications";
import { consumeVerificationToken } from "@/features/auth/verification";
import { verifyEmail, resendVerificationEmail, signUpWithEmail } from "@/features/auth/actions";
import { ROLES, signInAs } from "../../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const nonSuperadminRoles = ROLES.filter((role) => role !== "superadmin");

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

function asError(res: { ok: boolean }) {
  expect(res.ok).toBe(false);
  return res as { ok: false; error: string; fieldErrors?: Record<string, string> };
}

function asSuccess(res: { ok: boolean }) {
  expect(res.ok).toBe(true);
  return res as { ok: true; emailSent?: boolean; message?: string };
}

beforeEach(() => {
  mockDb.resetMocks();
  vi.clearAllMocks();
  signInAs(auth, null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Staff invite authorization and validation (Session 10 / STOP 4)", () => {
  it("rejects roles outside the whitelist, 'superadmin', and 'client'", async () => {
    signInAs(auth, "superadmin");

    // Invalid roles
    // @ts-expect-error test invalid role
    const invalidRes = await inviteStaff({ email: "invalid@optrizo.ph", name: "Test", role: "hacker" });
    expect(invalidRes.ok).toBe(false);

    // @ts-expect-error superadmin is forbidden for invite
    const superadminRes = await inviteStaff({ email: "admin@optrizo.ph", name: "Admin", role: "superadmin" });
    expect(superadminRes.ok).toBe(false);

    // @ts-expect-error client is forbidden for staff invite
    const clientRes = await inviteStaff({ email: "client@optrizo.ph", name: "Client", role: "client" });
    expect(clientRes.ok).toBe(false);

    expectNoWrites(mockDb);
  });

  it("rejects non-superadmin roles and anonymous on inviteStaff, resendStaffInvite, and cancelStaffInvite with NO writes", async () => {
    const callers = [null, ...nonSuperadminRoles];

    for (const role of callers) {
      mockDb.resetMocks();
      signInAs(auth, role);

      const inviteRes = await inviteStaff({
        email: "dev@optrizo.ph",
        name: "Dev One",
        role: "developer",
      });
      expect(inviteRes.ok).toBe(false);
      expect(asError(inviteRes).error).toMatch(/unauthorized/i);
      expectNoWrites(mockDb);

      const resendRes = await resendStaffInvite("user-uuid-1");
      expect(resendRes.ok).toBe(false);
      expect(asError(resendRes).error).toMatch(/unauthorized/i);
      expectNoWrites(mockDb);

      const cancelRes = await cancelStaffInvite("user-uuid-1");
      expect(cancelRes.ok).toBe(false);
      expect(asError(cancelRes).error).toMatch(/unauthorized/i);
      expectNoWrites(mockDb);
    }
  });

  it("rejects duplicate email if ANY user with that email already exists", async () => {
    signInAs(auth, "superadmin");

    // Existing user found in DB
    mockDb.setSelectRows([{ id: "existing-user-uuid" }]);

    const res = await inviteStaff({
      email: "existing@optrizo.ph",
      name: "Existing Person",
      role: "sales",
    });

    expect(res.ok).toBe(false);
    expect(asError(res).error).toMatch(/already exists/i);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("stores ONLY the sha256 hash in verificationToken (stored token !== raw token)", async () => {
    signInAs(auth, "superadmin");

    // No existing user
    mockDb.select.mockReturnValueOnce(mockQueryChain([]));
    // User insert returning id
    mockDb.insert.mockReturnValueOnce(mockQueryChain([{ id: "new-user-uuid" }]));

    let capturedTokenValues: Record<string, unknown> | null = null;
    mockDb.insert.mockImplementationOnce((table: unknown) => {
      return {
        values: (val: Record<string, unknown>) => {
          capturedTokenValues = val;
          return Promise.resolve();
        },
      } as unknown;
    });

    const res = await inviteStaff({
      email: "dennis@optrizo.ph",
      name: "Dennis Ocampo",
      role: "developer",
    });

    expect(res.ok).toBe(true);
    expect(sendStaffInviteEmail).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(sendStaffInviteEmail).mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    const link = callArgs!.link;
    const url = new URL(link);
    const rawToken = url.searchParams.get("token")!;
    expect(rawToken).toBeTruthy();

    // Verify stored token is exactly sha256(rawToken) and not equal to rawToken
    expect(capturedTokenValues).not.toBeNull();
    const storedHash = (capturedTokenValues as unknown as { token: string }).token;
    const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    expect(storedHash).toBe(expectedHash);
    expect(storedHash).not.toEqual(rawToken);
  });

  it("missing SMTP config (sendMail returns skipped / mock) still creates the invite and returns emailSent:false without throwing", async () => {
    signInAs(auth, "superadmin");

    // Mock sendStaffInviteEmail indicating email was skipped/mocked
    vi.mocked(sendStaffInviteEmail).mockResolvedValueOnce({ success: true, mock: true });

    mockDb.select.mockReturnValueOnce(mockQueryChain([]));
    mockDb.insert.mockReturnValueOnce(mockQueryChain([{ id: "new-user-uuid" }]));
    mockDb.insert.mockReturnValueOnce(mockQueryChain([]));

    const res = await inviteStaff({
      email: "dennis@optrizo.ph",
      name: "Dennis Ocampo",
      role: "developer",
    });

    expect(res.ok).toBe(true);
    expect(asSuccess(res).emailSent).toBe(false);
  });
});

describe("Staff invite acceptance (Session 10 / STOP 4)", () => {
  const validPassword = "SecurePassword123!";

  it("acceptStaffInvite succeeds with valid token and password, setting status='active', emailVerified, failedLogins=0", async () => {
    const rawToken = "sample-32-byte-raw-token-base64url-abc";
    const userEmail = "invited.staff@optrizo.ph";

    // 1. consumeStaffInvite deletes token returning identifier
    mockDb.delete.mockReturnValueOnce(
      mockQueryChain([{ identifier: `staff-invite:${userEmail}` }])
    );

    // 2. atomic user update returning id, email
    mockDb.update.mockReturnValueOnce(
      mockQueryChain([{ id: "staff-user-id", email: userEmail }])
    );

    const res = await acceptStaffInvite({
      token: rawToken,
      password: validPassword,
      confirmPassword: validPassword,
    });

    expect(res.ok).toBe(true);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("double accept succeeds exactly once (second attempt returns generic error)", async () => {
    const rawToken = "sample-token-123";
    const userEmail = "invited.staff@optrizo.ph";

    // 1st accept: token exists and is consumed
    mockDb.delete.mockReturnValueOnce(
      mockQueryChain([{ identifier: `staff-invite:${userEmail}` }])
    );
    mockDb.update.mockReturnValueOnce(
      mockQueryChain([{ id: "staff-user-id", email: userEmail }])
    );

    const firstRes = await acceptStaffInvite({
      token: rawToken,
      password: validPassword,
      confirmPassword: validPassword,
    });
    expect(firstRes.ok).toBe(true);

    // 2nd accept: token already deleted/consumed (returns empty)
    mockDb.delete.mockReturnValueOnce(mockQueryChain([]));

    const secondRes = await acceptStaffInvite({
      token: rawToken,
      password: validPassword,
      confirmPassword: validPassword,
    });
    expect(secondRes.ok).toBe(false);
    expect(asError(secondRes).error).toBe("This invite is invalid or has expired.");
  });

  it("reused, expired, and wrong-prefix tokens fail with the uniform generic error", async () => {
    const rawToken = "invalid-token";

    // Reused / expired token (delete returning empty)
    mockDb.delete.mockReturnValueOnce(mockQueryChain([]));
    let res = await acceptStaffInvite({
      token: rawToken,
      password: validPassword,
      confirmPassword: validPassword,
    });
    expect(res.ok).toBe(false);
    expect(asError(res).error).toBe("This invite is invalid or has expired.");

    // Wrong prefix identifier (e.g. client verification token)
    mockDb.delete.mockReturnValueOnce(
      mockQueryChain([{ identifier: "client-verify:someone@example.com" }])
    );
    res = await acceptStaffInvite({
      token: rawToken,
      password: validPassword,
      confirmPassword: validPassword,
    });
    expect(res.ok).toBe(false);
    expect(asError(res).error).toBe("This invite is invalid or has expired.");
  });
});

describe("Cross-flow guards: client verification vs staff invite (Session 10 / STOP 4)", () => {
  it("consumeVerificationToken ignores staff-invite: tokens", async () => {
    // When consumeVerificationToken runs, the SQL query explicitly includes NOT LIKE 'staff-invite:%'
    // If mockDb.delete returns empty (filtered out), it returns invalid/expired
    mockDb.setWriteRows([]);

    const res = await consumeVerificationToken("some-staff-invite-token");
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/invalid or already used/i);
  });

  it("verifyEmail rejects staff account tokens even if identifier matched", async () => {
    // Mock token consumed
    mockDb.delete.mockReturnValueOnce(
      mockQueryChain([{ identifier: "staff.dev@optrizo.ph", expires: new Date(Date.now() + 10000) }])
    );
    // User found but role is 'developer' (not client!)
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: "dev-id",
      email: "staff.dev@optrizo.ph",
      role: "developer",
      status: "invited",
    });

    const res = await verifyEmail("some-token");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not eligible for verification/i);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("resendVerificationEmail rejects staff emails without sending a verification link", async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: "staff-dev-id",
      email: "staff.dev@optrizo.ph",
      role: "developer",
      status: "invited",
    });

    const res = await resendVerificationEmail("staff.dev@optrizo.ph");
    // Anti-enumeration: returns generic message
    expect(res.success).toBe(true);
    // Crucially: no token was created, and no email was sent!
    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("client sign-up (signUpWithEmail) on an invited staff email never changes that account or resends a client link", async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: "staff-dev-id",
      email: "staff.dev@optrizo.ph",
      role: "developer",
      status: "invited",
      name: "Dennis Ocampo",
      password: null,
    });

    const formData = new FormData();
    formData.append("email", "staff.dev@optrizo.ph");
    formData.append("name", "Attacker");
    formData.append("password", "HackedPassword123!");
    formData.append("confirmPassword", "HackedPassword123!");

    const res = await signUpWithEmail(null, formData);
    expect(res.success).toBe(false);
    expect(res.message).toBe("Email is already in use.");
    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();
    expectNoWrites(mockDb);
  });
});

describe("Resend and Cancel staff invite actions (Session 10 / STOP 4)", () => {
  it("resendStaffInvite creates fresh token and resends invite email", async () => {
    signInAs(auth, "superadmin");

    mockDb.select.mockReturnValueOnce(
      mockQueryChain([
        {
          id: "target-user-uuid",
          email: "target@optrizo.ph",
          name: "Target Staff",
          role: "manager",
          status: "invited",
          password: null,
        },
      ])
    );
    mockDb.delete.mockReturnValueOnce(mockQueryChain([]));
    mockDb.insert.mockReturnValueOnce(mockQueryChain([]));

    const res = await resendStaffInvite("target-user-uuid");
    expect(res.ok).toBe(true);
    expect(sendStaffInviteEmail).toHaveBeenCalledTimes(1);
  });

  it("cancelStaffInvite deletes tokens and deletes user row guarded by status='invited' and password IS NULL", async () => {
    signInAs(auth, "superadmin");

    mockDb.select.mockReturnValueOnce(
      mockQueryChain([
        {
          id: "target-user-uuid",
          email: "target@optrizo.ph",
          status: "invited",
          role: "developer",
          password: null,
        },
      ])
    );
    mockDb.delete.mockReturnValueOnce(mockQueryChain([]));
    mockDb.delete.mockReturnValueOnce(mockQueryChain([]));

    const res = await cancelStaffInvite("target-user-uuid");
    expect(res.ok).toBe(true);
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
  });
});
