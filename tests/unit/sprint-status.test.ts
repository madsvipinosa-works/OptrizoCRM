import { describe, it, expect, vi, beforeEach } from "vitest";
import { deriveSprintStatus, todayInManila } from "@/features/sprints/sprint-status";

const { insertValuesMock, insertMock, authMock } = vi.hoisted(() => {
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn(() => ({ values: insertValuesMock }));
  const authMock = vi.fn();
  return { insertValuesMock, insertMock, authMock };
});

vi.mock("@/db", () => ({
  db: {
    insert: insertMock,
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

import { logAction } from "@/features/audit/log";
import { auditLogs } from "@/db/schema";

describe("deriveSprintStatus", () => {
  const start = "2026-11-10";
  const end = "2026-11-23";

  it("returns 'planned' the day before start", () => {
    expect(deriveSprintStatus(start, end, "2026-11-09")).toBe("planned");
  });

  it("returns 'active' on the start day", () => {
    expect(deriveSprintStatus(start, end, "2026-11-10")).toBe("active");
  });

  it("returns 'active' on a middle day", () => {
    expect(deriveSprintStatus(start, end, "2026-11-16")).toBe("active");
  });

  it("returns 'active' on the end day", () => {
    expect(deriveSprintStatus(start, end, "2026-11-23")).toBe("active");
  });

  it("returns 'ended' the day after end", () => {
    expect(deriveSprintStatus(start, end, "2026-11-24")).toBe("ended");
  });
});

describe("todayInManila", () => {
  it("converts 2026-11-05T16:30:00Z (00:30+08:00 next day) to '2026-11-06'", () => {
    expect(todayInManila(new Date("2026-11-05T16:30:00Z"))).toBe("2026-11-06");
  });

  it("converts an earlier-in-day UTC timestamp (2026-11-05T08:00:00Z = 16:00+08:00) to '2026-11-05'", () => {
    expect(todayInManila(new Date("2026-11-05T08:00:00Z"))).toBe("2026-11-05");
  });
});

describe("logAction optional projectId parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("passes projectId to audit_log insert when given", async () => {
    await logAction("CREATE", "Sprint", "Planned Sprint 1", "user-pm", "proj-123");

    expect(insertMock).toHaveBeenCalledWith(auditLogs);
    expect(insertValuesMock).toHaveBeenCalledWith({
      userId: "user-pm",
      action: "CREATE",
      entity: "Sprint",
      details: "Planned Sprint 1",
      projectId: "proj-123",
    });
  });

  it("omits projectId when not given (existing 3-arg and 4-arg call sites unchanged)", async () => {
    await logAction("UPDATE", "Task", "Started task");

    expect(insertMock).toHaveBeenCalledWith(auditLogs);
    const passed = insertValuesMock.mock.calls[0]?.[0];
    expect(passed).toEqual({
      userId: "user-1",
      action: "UPDATE",
      entity: "Task",
      details: "Started task",
    });
    expect("projectId" in passed).toBe(false);
  });
});

