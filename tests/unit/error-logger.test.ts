import { describe, it, expect } from "vitest";
import { sanitizeContext } from "@/features/audit/error-logger";

describe("Audit & Diagnostics: sanitizeContext Unit Tests", () => {
  it("should redact sensitive credentials and auth tokens", () => {
    const raw = {
      username: "alex_admin",
      password: "SuperSecretPassword123!",
      apiKey: "sk-proj-984372984729384",
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI...",
      token: "oauth-refresh-token",
      userSecret: "internal-agency-secret",
      creditCardNumber: "4532-1234-5678-9012",
      cookieHeader: "session_id=abc; csrf=xyz",
    };

    const sanitized = sanitizeContext(raw) as Record<string, unknown>;

    expect(sanitized.username).toBe("alex_admin");
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.userSecret).toBe("[REDACTED]");
    expect(sanitized.creditCardNumber).toBe("[REDACTED]");
    expect(sanitized.cookieHeader).toBe("[REDACTED]");
  });

  it("should deeply redact sensitive keys nested inside arrays or sub-objects", () => {
    const nested = {
      request: {
        headers: {
          authorization: "Bearer token-value",
          "x-api-key": "secret-key",
        },
        payload: {
          user: {
            email: "client@acme.com",
            passwordHash: "$2a$12$abcdefg",
          },
        },
      },
      auditHistory: [
        { action: "LOGIN", status: "FAILED", attemptedPassword: "mypassword" },
      ],
    };

    const sanitized = sanitizeContext(nested) as any;

    expect(sanitized.request.headers.authorization).toBe("[REDACTED]");
    expect(sanitized.request.headers["x-api-key"]).toBe("[REDACTED]");
    expect(sanitized.request.payload.user.email).toBe("client@acme.com");
    expect(sanitized.request.payload.user.passwordHash).toBe("[REDACTED]");
    expect(sanitized.auditHistory[0].attemptedPassword).toBe("[REDACTED]");
  });

  it("should safely truncate excessively large strings to prevent database payload blowup", () => {
    const largeString = "A".repeat(1500);
    const sanitized = sanitizeContext(largeString) as string;

    expect(sanitized.length).toBeLessThan(1100);
    expect(sanitized).toContain("... [truncated]");
  });

  it("should prevent infinite recursion on circular or ultra-deep objects", () => {
    // Generate object nested 8 levels deep
    let deep: any = { value: "core" };
    for (let i = 0; i < 8; i++) {
      deep = { level: i, next: deep };
    }

    const sanitized = sanitizeContext(deep);
    expect(JSON.stringify(sanitized)).toContain("[Max Depth Reached]");
  });

  it("should preserve null, undefined, numbers, and booleans accurately", () => {
    expect(sanitizeContext(null)).toBeNull();
    expect(sanitizeContext(undefined)).toBeUndefined();
    expect(sanitizeContext(42)).toBe(42);
    expect(sanitizeContext(true)).toBe(true);
  });
});
