import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let contactRateLimiter: Ratelimit | null = null;

// Only initialize if the environment variables are present
// This prevents the app from crashing in local dev or before the user adds the keys to Vercel
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        contactRateLimiter = new Ratelimit({
            redis: redis,
            limiter: Ratelimit.slidingWindow(3, "10 m"), // Strict: 3 requests per 10 minutes
            analytics: true,
            prefix: "@upstash/ratelimit/contact",
        });
    } catch (e) {
        console.error("Failed to initialize Upstash Redis:", e);
    }
}

/**
 * Checks if the given identifier (usually an IP address) has exceeded the rate limit.
 * Will always pass true if Upstash is not configured.
 */
export async function checkContactRateLimit(identifier: string) {
    if (!contactRateLimiter) {
        console.warn("[Security] Upstash Redis is not configured. Rate limiting is currently DISABLED on this route.");
        return { success: true };
    }

    try {
        const result = await contactRateLimiter.limit(identifier);
        return result;
    } catch (e) {
        console.error("[Security] Rate Limiter check failed (allowing request by default):", e);
        return { success: true };
    }
}
