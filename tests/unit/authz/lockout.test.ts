import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: vi.fn() }));
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  resetRateLimit: vi.fn().mockResolvedValue(undefined),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
  formatRetryAfter: vi.fn((s: number) => `${s}s`),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitError: class RateLimitError extends Error {
    retryAfterSeconds: number;
    constructor(message: string, retryAfterSeconds: number) {
      super(message);
      this.name = "RateLimitError";
      this.retryAfterSeconds = retryAfterSeconds;
    }
  },
}));

import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import { resetRateLimit } from "@/lib/rate-limit";
import { isSessionValid } from "@/lib/account-status";
import { expectNoWrites, type MockDb } from "../../helpers/mock-db";
import bcrypt from "bcryptjs";

const mockDb = db as unknown as MockDb;
const userId = "33333333-3333-4333-a333-333333333333";
const userEmail = "lockout-test@example.com";
const correctPassword = "CorrectPassword123!";
const wrongPassword = "WrongPassword999!";

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

describe("Account lockout and auto-lock management (Session 10 / STOP 3)", () => {
  let hashedPassword = "";

  beforeEach(async () => {
    mockDb.resetMocks();
    vi.clearAllMocks();
    if (!hashedPassword) {
      hashedPassword = await bcrypt.hash(correctPassword, 10);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("5th wrong password locks account (status 'locked', lockedUntil set) and logs action", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "active",
      failedLogins: 4,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    const lockExpiry = new Date(Date.now() + 15 * 60 * 1000);
    mockDb.setWriteRows([
      {
        id: userId,
        status: "locked",
        failedLogins: 5,
        lockedUntil: lockExpiry,
      },
    ]);

    const result = await authorizeUser({
      email: userEmail,
      password: wrongPassword,
    });

    expect(result).toBeNull();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      "UPDATE",
      "user",
      "auto-lock after 5 failed sign-ins",
      userId
    );
  });

  it("failures 1-4 increment failed_logins without locking account or logging auto-lock", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "active",
      failedLogins: 2,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    mockDb.setWriteRows([
      {
        id: userId,
        status: "active",
        failedLogins: 3,
        lockedUntil: null,
      },
    ]);

    const result = await authorizeUser({
      email: userEmail,
      password: wrongPassword,
    });

    expect(result).toBeNull();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(logAction).not.toHaveBeenCalled();
  });

  it("successful sign-in resets failedLogins counter from > 0 to 0", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "active",
      failedLogins: 3,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    const result = await authorizeUser({
      email: userEmail,
      password: correctPassword,
    });

    expect(result).toEqual({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
    });
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(resetRateLimit).toHaveBeenCalledWith("loginEmail", userEmail);
  });

  it("successful sign-in does NOT execute an update write when failedLogins is already 0", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "active",
      failedLogins: 0,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    const result = await authorizeUser({
      email: userEmail,
      password: correctPassword,
    });

    expect(result).toEqual({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
    });
    expectNoWrites(mockDb);
  });

  it("expired auto-lock clears atomically and signs in with correct password", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    const pastLock = new Date(Date.now() - 60 * 1000);
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "locked",
      failedLogins: 5,
      lockedUntil: pastLock,
      isActive: true,
      deletedAt: null,
    });

    mockDb.update.mockReturnValueOnce(
      mockQueryChain([
        {
          id: userId,
          status: "active",
          failedLogins: 0,
          lockedUntil: null,
          isActive: true,
        },
      ])
    );

    const result = await authorizeUser({
      email: userEmail,
      password: correctPassword,
    });

    expect(result).toEqual({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
    });
    // 1 update to clear the expired lock (failedLogins was reset to 0 in that update, so no secondary reset)
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("expired auto-lock with wrong password clears lock and increments failure to 1 against active account", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    const pastLock = new Date(Date.now() - 60 * 1000);
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "locked",
      failedLogins: 5,
      lockedUntil: pastLock,
      isActive: true,
      deletedAt: null,
    });

    // 1st update: clearing the expired auto-lock
    // 2nd update: counting failure 1 on the newly active account
    mockDb.update
      .mockReturnValueOnce(
        mockQueryChain([
          {
            id: userId,
            status: "active",
            failedLogins: 0,
            lockedUntil: null,
            isActive: true,
          },
        ])
      )
      .mockReturnValueOnce(
        mockQueryChain([
          {
            id: userId,
            status: "active",
            failedLogins: 1,
            lockedUntil: null,
          },
        ])
      );

    const result = await authorizeUser({
      email: userEmail,
      password: wrongPassword,
    });

    expect(result).toBeNull();
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(logAction).not.toHaveBeenCalled();
  });

  it("manual lock (lockedUntil null) persists even with correct password and shows lock message", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "locked",
      failedLogins: 0,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    await expect(
      authorizeUser({
        email: userEmail,
        password: correctPassword,
      })
    ).rejects.toThrow("Account is locked. Please try again later or contact your administrator.");

    expectNoWrites(mockDb);
  });

  it("unexpired auto-lock refuses sign-in with correct password and shows lock message", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    const futureLock = new Date(Date.now() + 10 * 60 * 1000);
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      name: "Lockout User",
      role: "developer",
      password: hashedPassword,
      status: "locked",
      failedLogins: 5,
      lockedUntil: futureLock,
      isActive: true,
      deletedAt: null,
    });

    await expect(
      authorizeUser({
        email: userEmail,
        password: correctPassword,
      })
    ).rejects.toThrow("Account is locked. Please try again later or contact your administrator.");

    expectNoWrites(mockDb);
  });

  it("wrong password on locked, deactivated, invited, or unknown user returns null without incrementing counter", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    // Locked user with unexpired lock
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      password: hashedPassword,
      status: "locked",
      failedLogins: 5,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      isActive: true,
      deletedAt: null,
    });

    let res = await authorizeUser({ email: userEmail, password: wrongPassword });
    expect(res).toBeNull();
    expectNoWrites(mockDb);

    // Locked user with manual lock
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      password: hashedPassword,
      status: "locked",
      failedLogins: 0,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    res = await authorizeUser({ email: userEmail, password: wrongPassword });
    expect(res).toBeNull();
    expectNoWrites(mockDb);

    // Deactivated user
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      password: hashedPassword,
      status: "deactivated",
      failedLogins: 0,
      lockedUntil: null,
      isActive: false,
      deletedAt: null,
    });

    res = await authorizeUser({ email: userEmail, password: wrongPassword });
    expect(res).toBeNull();
    expectNoWrites(mockDb);

    // Invited user
    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      password: hashedPassword,
      status: "invited",
      failedLogins: 0,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    res = await authorizeUser({ email: userEmail, password: wrongPassword });
    expect(res).toBeNull();
    expectNoWrites(mockDb);

    // Unknown user
    mockDb.query.users.findFirst.mockResolvedValueOnce(undefined);

    res = await authorizeUser({ email: "unknown@example.com", password: wrongPassword });
    expect(res).toBeNull();
    expectNoWrites(mockDb);
  });

  it("user without password is not counted and returns null", async () => {
    const { authorizeUser } = await vi.importActual<typeof import("@/auth")>("@/auth");

    mockDb.query.users.findFirst.mockResolvedValueOnce({
      id: userId,
      email: userEmail,
      password: null,
      status: "active",
      failedLogins: 0,
      lockedUntil: null,
      isActive: true,
      deletedAt: null,
    });

    const result = await authorizeUser({
      email: userEmail,
      password: wrongPassword,
    });

    expect(result).toBeNull();
    expectNoWrites(mockDb);
  });

  it("auto-locked account's existing session stays valid per isSessionValid, while manual lock terminates it", () => {
    const autoLockedUser = {
      status: "locked",
      isActive: true,
      deletedAt: null,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    };
    expect(isSessionValid(autoLockedUser)).toBe(true);

    const manualLockedUser = {
      status: "locked",
      isActive: true,
      deletedAt: null,
      lockedUntil: null,
    };
    expect(isSessionValid(manualLockedUser)).toBe(false);
  });
});
