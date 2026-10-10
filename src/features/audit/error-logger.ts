import { db } from "@/db";
import { systemErrorLogs } from "@/db/schema";
import { auth } from "@/auth";

export type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type LogErrorOptions = {
  errorCode?: string;
  severity?: ErrorSeverity;
  source: string; // e.g. "action:pm", "action:crm", "route:api", "boundary:app"
  context?: Record<string, unknown>;
  userId?: string;
};

// Sensitive keys to scrub from contextual logs to preserve privacy & compliance
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /apikey/i,
  /api_key/i,
  /creditcard/i,
  /cookie/i,
];

function sanitizeContext(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[Max Depth Reached]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    // Truncate excessively large strings to avoid bloating db
    return value.length > 1000 ? value.slice(0, 1000) + "... [truncated]" : value;
  }

  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeContext(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeContext(val, depth + 1);
    }
  }
  return sanitized;
}

export async function logSystemError(
  error: unknown,
  options: LogErrorOptions
): Promise<string | null> {
  try {
    let userId = options.userId;

    if (!userId) {
      try {
        const session = await auth();
        if (session?.user?.id) {
          userId = session.user.id;
        }
      } catch {
        // Ignored if auth check is not feasible in current execution context
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "An unknown error occurred";

    const stackTrace =
      error instanceof Error && error.stack
        ? error.stack
        : new Error().stack || null;

    const sanitizedContext = (
      options.context ? sanitizeContext(options.context) : {}
    ) as Record<string, unknown>;

    const errorCode = options.errorCode || "INTERNAL_ERROR";
    const severity = options.severity || "MEDIUM";

    const [inserted] = await db
      .insert(systemErrorLogs)
      .values({
        errorCode,
        severity,
        message,
        stackTrace,
        source: options.source,
        context: sanitizedContext,
        userId: userId || null,
        isResolved: false,
      })
      .returning({ id: systemErrorLogs.id });

    // Also output structured format to standard error for hosting metrics
    console.error(`[SYSTEM_ERROR:${severity}:${errorCode}] ${options.source}: ${message}`);

    return inserted?.id || null;
  } catch (loggerErr) {
    // Fail-safe: ensure logger failure never interrupts customer workflow
    console.error("[CRITICAL: System Error Logger Failed]", loggerErr);
    return null;
  }
}
