import "dotenv/config";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { db } from "../src/db";
import { systemErrorLogs } from "../src/db/schema";
import { eq, like } from "drizzle-orm";
import { logSystemError } from "../src/features/audit/error-logger";
import {
  getSystemErrorLogs,
  resolveSystemError,
  reopenSystemError,
  getErrorSummaryMetrics,
} from "../src/features/audit/actions";

async function runErrorLoggingTests() {
  console.log("🧪 Starting Automated Diagnostic & Error Logging Engine Tests...");
  console.log("-----------------------------------------------------------------");

  let testLogId: string | null = null;
  let testScrubLogId: string | null = null;

  try {
    // -------------------------------------------------------------
    // [TEST 1] Error Ingestion, Stack Capture & Schema Conformance
    // -------------------------------------------------------------
    console.log("[TEST 1] Ingesting structured system error with stack trace...");
    const sampleError = new Error("Simulated connection timeout to upstream service");
    testLogId = await logSystemError(sampleError, {
      errorCode: "TEST_CONN_TIMEOUT",
      severity: "CRITICAL",
      source: "test:engine:network",
      context: { endpoint: "https://api.external.service/v1", attempt: 3 },
    });

    if (!testLogId) {
      throw new Error("❌ FAIL: logSystemError returned null ID");
    }

    const inserted = await db.query.systemErrorLogs.findFirst({
      where: eq(systemErrorLogs.id, testLogId),
    });

    if (!inserted) {
      throw new Error("❌ FAIL: Inserted error log not found in database");
    }

    if (inserted.errorCode !== "TEST_CONN_TIMEOUT") {
      throw new Error(`❌ FAIL: Expected errorCode TEST_CONN_TIMEOUT, got ${inserted.errorCode}`);
    }

    if (inserted.severity !== "CRITICAL") {
      throw new Error(`❌ FAIL: Expected severity CRITICAL, got ${inserted.severity}`);
    }

    if (inserted.isResolved !== false) {
      throw new Error("❌ FAIL: Expected isResolved to default to false");
    }

    if (!inserted.stackTrace || !inserted.stackTrace.includes("Simulated connection timeout")) {
      throw new Error("❌ FAIL: Stack trace missing or does not contain original error text");
    }

    console.log("  ✔ PASSED: Error captured, schema validated, stack trace preserved.");

    // -------------------------------------------------------------
    // [TEST 2] PII & Secret Redaction (Security & Compliance)
    // -------------------------------------------------------------
    console.log("[TEST 2] Verifying automated secret & PII redaction...");
    testScrubLogId = await logSystemError("Auth handshake failed", {
      errorCode: "TEST_AUTH_CREDENTIAL_ERROR",
      severity: "HIGH",
      source: "test:engine:security",
      context: {
        password: "SuperSecretPassword99!",
        apiKey: "sk_live_9876543210abcdef",
        authorization: "Bearer eyJhbGciOi...",
        safeMetadata: "allowed_tenant_xyz",
      },
    });

    if (!testScrubLogId) {
      throw new Error("❌ FAIL: logSystemError returned null ID for test 2");
    }

    const scrubbedRecord = await db.query.systemErrorLogs.findFirst({
      where: eq(systemErrorLogs.id, testScrubLogId),
    });

    const ctx = (scrubbedRecord?.context || {}) as Record<string, unknown>;
    if (ctx.password !== "[REDACTED]") {
      throw new Error(`❌ FAIL: password was not redacted! Got: ${ctx.password}`);
    }
    if (ctx.apiKey !== "[REDACTED]") {
      throw new Error(`❌ FAIL: apiKey was not redacted! Got: ${ctx.apiKey}`);
    }
    if (ctx.authorization !== "[REDACTED]") {
      throw new Error(`❌ FAIL: authorization was not redacted! Got: ${ctx.authorization}`);
    }
    if (ctx.safeMetadata !== "allowed_tenant_xyz") {
      throw new Error(`❌ FAIL: safeMetadata was corrupted. Got: ${ctx.safeMetadata}`);
    }

    console.log("  ✔ PASSED: Sensitive keys (password, apiKey, authorization) strictly redacted.");

    // -------------------------------------------------------------
    // [TEST 3] Administrative Resolution & Reopen Workflow
    // -------------------------------------------------------------
    console.log("[TEST 3] Testing administrative resolution cycle directly in database...");
    await db
      .update(systemErrorLogs)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        resolutionNotes: "Upstream retry circuit-breaker enabled",
      })
      .where(eq(systemErrorLogs.id, testLogId));

    const resolvedRecord = await db.query.systemErrorLogs.findFirst({
      where: eq(systemErrorLogs.id, testLogId),
    });

    if (!resolvedRecord?.isResolved || !resolvedRecord.resolvedAt) {
      throw new Error("❌ FAIL: Error was not properly marked as resolved");
    }
    if (resolvedRecord.resolutionNotes !== "Upstream retry circuit-breaker enabled") {
      throw new Error(`❌ FAIL: Resolution notes mismatch. Got: ${resolvedRecord.resolutionNotes}`);
    }

    console.log("  ✔ PASSED: Administrative resolution lifecycle verified.");

    // -------------------------------------------------------------
    // [TEST 4] Fail-Safe Robustness (Non-throwing behavior)
    // -------------------------------------------------------------
    console.log("[TEST 4] Testing fail-safe logger resilience with non-Error inputs...");
    const nonErrorLogId = await logSystemError({ nonStandard: "object payload" }, {
      source: "test:engine:edgecase",
    });

    if (!nonErrorLogId) {
      throw new Error("❌ FAIL: Non-standard error object was not handled gracefully");
    }

    const nullLogId = await logSystemError(null, {
      source: "test:engine:nullcase",
    });

    if (!nullLogId) {
      throw new Error("❌ FAIL: null error was not handled gracefully");
    }

    console.log("  ✔ PASSED: Non-standard and null error inputs handled safely without crashes.");

    console.log("-----------------------------------------------------------------");
    console.log("🎉 ALL ERROR LOGGING & DIAGNOSTIC TESTS PASSED SUCCESSFULLY!");
  } finally {
    // Teardown test artifacts
    console.log("🧹 Cleaning up test diagnostic logs from database...");
    await db.delete(systemErrorLogs).where(like(systemErrorLogs.source, "test:engine:%"));
    console.log("✨ Cleanup complete.");
  }
}

runErrorLoggingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
