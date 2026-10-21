import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  resetRateLimit,
  memoryLimit,
  getClientIp,
  normalizeEmail,
  formatRetryAfter,
  RATE_LIMIT_POLICIES,
  MEMORY_STORE_MAX_KEYS,
  __resetMemoryStoreForTests,
  __memoryStoreSizeForTests,
} from "@/lib/rate-limit";

function headersOf(values: Record<string, string>) {
  return new Headers(values);
}

describe("Rate limiting: in-memory sliding window", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    __resetMemoryStoreForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows requests up to the login-per-account limit, then blocks", async () => {
    const { limit } = RATE_LIMIT_POLICIES.loginEmail;
    for (let i = 0; i < limit; i++) {
      const res = await checkRateLimit("loginEmail", "victim@example.com");
      expect(res.success).toBe(true);
      expect(res.remaining).toBe(limit - i - 1);
    }
    const blocked = await checkRateLimit("loginEmail", "victim@example.com");
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates counters per identifier and per policy", async () => {
    const { limit } = RATE_LIMIT_POLICIES.loginEmail;
    for (let i = 0; i < limit; i++) await checkRateLimit("loginEmail", "a@example.com");

    expect((await checkRateLimit("loginEmail", "a@example.com")).success).toBe(false);
    expect((await checkRateLimit("loginEmail", "b@example.com")).success).toBe(true);
    // Same identifier under a different policy has its own bucket.
    expect((await checkRateLimit("passwordResetRequestEmail", "a@example.com")).success).toBe(true);
  });

  it("resetRateLimit clears the counter (used after a successful login)", async () => {
    const { limit } = RATE_LIMIT_POLICIES.loginEmail;
    for (let i = 0; i < limit; i++) await checkRateLimit("loginEmail", "user@example.com");
    expect((await checkRateLimit("loginEmail", "user@example.com")).success).toBe(false);

    await resetRateLimit("loginEmail", "user@example.com");
    expect((await checkRateLimit("loginEmail", "user@example.com")).success).toBe(true);
  });

  it("slides the window: old hits expire and capacity returns", () => {
    const config = { limit: 2, windowMs: 1000 };
    const t0 = 1_000_000;
    expect(memoryLimit("k", config, t0).success).toBe(true);
    expect(memoryLimit("k", config, t0 + 100).success).toBe(true);
    const blocked = memoryLimit("k", config, t0 + 200);
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);

    // First hit (t0) leaves the window at t0 + 1000.
    expect(memoryLimit("k", config, t0 + 1000).success).toBe(true);
    expect(memoryLimit("k", config, t0 + 1001).success).toBe(false);
  });

  it("does not count blocked requests toward the window", () => {
    const config = { limit: 1, windowMs: 1000 };
    const t0 = 2_000_000;
    memoryLimit("k2", config, t0);
    // Hammering while blocked must not extend the lockout.
    for (let i = 1; i <= 50; i++) memoryLimit("k2", config, t0 + i * 10);
    expect(memoryLimit("k2", config, t0 + 1000).success).toBe(true);
  });

  it("caps tracked keys so unique-identifier floods cannot exhaust memory", () => {
    const config = { limit: 5, windowMs: 60_000 };
    const now = 3_000_000;
    for (let i = 0; i < MEMORY_STORE_MAX_KEYS + 500; i++) {
      memoryLimit(`flood:${i}`, config, now);
    }
    expect(__memoryStoreSizeForTests()).toBeLessThanOrEqual(MEMORY_STORE_MAX_KEYS);
  });
});

describe("Rate limiting: helpers", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    expect(
      getClientIp(headersOf({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })),
    ).toBe("1.1.1.1");
  });

  it("uses the first hop of x-forwarded-for", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" }))).toBe(
      "203.0.113.5",
    );
  });

  it("returns null when no IP headers are present", () => {
    expect(getClientIp(headersOf({}))).toBeNull();
    expect(getClientIp(undefined)).toBeNull();
  });

  it("normalises emails so case/whitespace variants share a bucket", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("formats retry durations for users", () => {
    expect(formatRetryAfter(30)).toBe("about a minute");
    expect(formatRetryAfter(14 * 60 + 5)).toBe("15 minutes");
  });
});
