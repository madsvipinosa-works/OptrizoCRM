import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Centralised rate limiting.
 *
 * - Uses Upstash Redis (shared across all server instances) when
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are configured.
 * - Otherwise (or if Redis errors) falls back to a bounded in-memory sliding-window
 *   limiter so protection is never silently disabled. Note: the in-memory store is
 *   per server instance, so on multi-instance / serverless hosting Redis is required
 *   for globally consistent limits.
 *
 * This module intentionally has no Next.js imports so it can be unit tested in isolation.
 */

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export type RateLimitPolicy =
  | "loginIp"
  | "loginEmail"
  | "signupIp"
  | "passwordResetRequestIp"
  | "passwordResetRequestEmail"
  | "passwordResetSubmitIp"
  | "contact"
  | "intake";

interface PolicyConfig {
  limit: number;
  windowMs: number;
}

const MINUTE = 60 * 1000;

export const RATE_LIMIT_POLICIES: Record<RateLimitPolicy, PolicyConfig> = {
  // Login: dual-key defence. IP layer stops floods / password spraying from one source,
  // email layer stops distributed botnets hammering a single account.
  loginIp: { limit: 20, windowMs: 15 * MINUTE },
  loginEmail: { limit: 5, windowMs: 15 * MINUTE },
  // Account creation (bcrypt.hash + DB insert per request).
  signupIp: { limit: 5, windowMs: 60 * MINUTE },
  // Password reset emails: protects inbox flooding and the email provider quota.
  passwordResetRequestIp: { limit: 5, windowMs: 15 * MINUTE },
  passwordResetRequestEmail: { limit: 3, windowMs: 15 * MINUTE },
  // Password reset submission (bcrypt.hash per request).
  passwordResetSubmitIp: { limit: 10, windowMs: 15 * MINUTE },
  // Public contact form (unchanged from the previous limiter: 3 per 10 minutes).
  contact: { limit: 3, windowMs: 10 * MINUTE },
  // Authenticated service intake form, keyed by user id.
  intake: { limit: 5, windowMs: 10 * MINUTE },
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds when the oldest counted request leaves the window. */
  resetAt: number;
  /** Whole seconds the caller should wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
}

// ---------------------------------------------------------------------------
// In-memory sliding-window limiter (bounded, HMR-safe)
// ---------------------------------------------------------------------------

/** Hard cap on tracked keys so a flood of unique identifiers cannot exhaust memory. */
export const MEMORY_STORE_MAX_KEYS = 5000;
const SWEEP_INTERVAL_MS = 60 * 1000;

interface MemoryEntry {
  /** Request timestamps inside the current window, oldest first. */
  hits: number[];
  windowMs: number;
}

interface MemoryState {
  store: Map<string, MemoryEntry>;
  lastSweep: number;
}

const globalForRateLimit = globalThis as unknown as { __rateLimitMemory?: MemoryState };
const memory: MemoryState =
  globalForRateLimit.__rateLimitMemory ??
  (globalForRateLimit.__rateLimitMemory = { store: new Map(), lastSweep: 0 });

function sweepExpired(now: number) {
  if (now - memory.lastSweep < SWEEP_INTERVAL_MS) return;
  memory.lastSweep = now;
  for (const [key, entry] of memory.store) {
    const newest = entry.hits[entry.hits.length - 1];
    if (newest === undefined || now - newest >= entry.windowMs) {
      memory.store.delete(key);
    }
  }
}

export function memoryLimit(
  key: string,
  { limit, windowMs }: PolicyConfig,
  now: number = Date.now(),
): RateLimitResult {
  sweepExpired(now);

  let entry = memory.store.get(key);
  if (entry) {
    // Re-insert to keep Map order as least-recently-used first.
    memory.store.delete(key);
    entry.hits = entry.hits.filter((t) => now - t < windowMs);
  } else {
    entry = { hits: [], windowMs };
  }

  const allowed = entry.hits.length < limit;
  if (allowed) entry.hits.push(now);

  memory.store.set(key, entry);

  // Evict least-recently-used keys beyond the cap.
  while (memory.store.size > MEMORY_STORE_MAX_KEYS) {
    const oldestKey = memory.store.keys().next().value;
    if (oldestKey === undefined) break;
    memory.store.delete(oldestKey);
  }

  const oldest = entry.hits[0] ?? now;
  const resetAt = oldest + windowMs;
  return {
    success: allowed,
    limit,
    remaining: Math.max(0, limit - entry.hits.length),
    resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

function memoryReset(key: string) {
  memory.store.delete(key);
}

/** Test helper: clears all in-memory counters. */
export function __resetMemoryStoreForTests() {
  memory.store.clear();
  memory.lastSweep = 0;
}

/** Test helper: current number of tracked in-memory keys. */
export function __memoryStoreSizeForTests() {
  return memory.store.size;
}

// ---------------------------------------------------------------------------
// Upstash limiters (lazy, one per policy)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;
const upstashLimiters = new Map<RateLimitPolicy, Ratelimit>();
let warnedMissingRedis = false;

function getUpstashLimiter(policy: RateLimitPolicy): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warnedMissingRedis) {
      warnedMissingRedis = true;
      console.warn(
        "[Security] Upstash Redis is not configured. Using per-instance in-memory rate limiting.",
      );
    }
    return null;
  }

  const existing = upstashLimiters.get(policy);
  if (existing) return existing;

  try {
    redis ??= new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const { limit, windowMs } = RATE_LIMIT_POLICIES[policy];
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${Math.round(windowMs / 1000)} s`),
      analytics: true,
      prefix: `@upstash/ratelimit/${policy}`,
    });
    upstashLimiters.set(policy, limiter);
    return limiter;
  } catch (e) {
    console.error("[Security] Failed to initialise Upstash rate limiter:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Consume one request for `identifier` under `policy`.
 * Never fails open: if Redis is unavailable the in-memory limiter is used instead.
 */
export async function checkRateLimit(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_POLICIES[policy];
  const key = `${policy}:${identifier}`;
  const limiter = getUpstashLimiter(policy);

  if (limiter) {
    try {
      const res = await limiter.limit(identifier);
      const now = Date.now();
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        resetAt: res.reset,
        retryAfterSeconds: res.success ? 0 : Math.max(1, Math.ceil((res.reset - now) / 1000)),
      };
    } catch (e) {
      console.error(`[Security] Upstash rate limit check failed for "${policy}", using memory:`, e);
    }
  }

  return memoryLimit(key, config);
}

/** Clear the counter for `identifier` under `policy` (e.g. after a successful login). */
export async function resetRateLimit(policy: RateLimitPolicy, identifier: string) {
  memoryReset(`${policy}:${identifier}`);
  const limiter = getUpstashLimiter(policy);
  if (!limiter) return;
  try {
    await limiter.resetUsedTokens(identifier);
  } catch (e) {
    console.error(`[Security] Failed to reset Upstash rate limit for "${policy}":`, e);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Error name used to recognise rate-limit rejections thrown from NextAuth `authorize()`. */
export const RATE_LIMIT_ERROR_NAME = "RateLimitError";

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = RATE_LIMIT_ERROR_NAME;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Best-effort client IP extraction. Prefers `x-real-ip` (set by Vercel and most reverse
 * proxies), then the first hop of `x-forwarded-for`. Returns null when unknown so callers
 * can skip the IP layer instead of lumping every unidentified user into one shared bucket.
 */
export function getClientIp(headers: Pick<Headers, "get"> | null | undefined): string | null {
  if (!headers) return null;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || null;
}

export function formatRetryAfter(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return "about a minute";
  return `${minutes} minutes`;
}

// ---------------------------------------------------------------------------
// Backwards-compatible wrapper (existing callers)
// ---------------------------------------------------------------------------

/** @deprecated Prefer `checkRateLimit("contact", identifier)`. */
export async function checkContactRateLimit(identifier: string) {
  return checkRateLimit("contact", identifier);
}
