import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("@/auth", async () => (await import("../../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../../helpers/mock-db")).createMockDb() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/features/pm/actions", () => ({
  checkAndNotifyOverdueTasks: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/pm/components/KanbanBoard", () => ({
  KanbanBoard: () => null,
}));
vi.mock("@/features/pm/components/ProjectSettingsModal", () => ({
  ProjectSettingsModal: () => null,
}));
vi.mock("@/features/pm/components/ProjectResourcesSidebar", () => ({
  ProjectResourcesSidebar: () => null,
}));
vi.mock("@/components/projects/weighted-progress-bar", () => ({
  ProjectProgressCard: () => null,
}));
vi.mock("@/features/pm/components/ProjectArchiveButton", () => ({
  ProjectArchiveButton: () => null,
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { notFound } from "next/navigation";
import { authorizeProject } from "@/lib/authz";
import KanbanBoardPage from "@/app/(admin)/dashboard/pm/[id]/page";
import { signInAs } from "../../helpers/mock-auth";
import type { MockDb } from "../../helpers/mock-db";

const mockDb = db as unknown as MockDb;

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

beforeEach(() => {
  mockDb.resetMocks();
  vi.clearAllMocks();
  signInAs(auth, null);
});

describe("authorizeProject source-text scan (no bare truthy checks)", () => {
  /**
   * Limits of this regex scan:
   * - Inspects local variable assignments (`const|let|var <id> = await authorizeProject(...)`)
   *   and inline conditionals (`if (!await authorizeProject(...))` / `if (await authorizeProject(...))`)
   *   within the same file.
   * - It is a lexical/regex check rather than a full TypeScript AST / cross-function dataflow analysis,
   *   so it assumes callers assign or destructure the awaited result locally as done across `src/`.
   */
  it("every await authorizeProject(...) in src/**/*.{ts,tsx} checks .ok explicitly", () => {
    const srcRoot = path.resolve(__dirname, "../../../src");
    const files = collectSourceFiles(srcRoot);
    let totalCallsFound = 0;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf8");
      if (!content.includes("authorizeProject(")) continue;

      const relPath = path.relative(srcRoot, filePath).replace(/\\/g, "/");

      // 1. Disallow inline truthy checks like `if (await authorizeProject(...))` or `if (!(await authorizeProject(...)))` without `.ok`
      const inlineBareCheck = /if\s*\(\s*!?\s*\(?\s*await\s+authorizeProject\([^)]*\)\s*\)?\s*\)/g;
      expect(
        content.match(inlineBareCheck),
        `${relPath} uses inline await authorizeProject(...) as a boolean without .ok`
      ).toBeNull();

      // 2. For every variable assignment `const <name> = await authorizeProject(...)`, verify `<name>.ok` is used
      //    and `<name>` is never tested directly as `!<name>` (without `.ok`) or `if (<name>)`.
      const assignRegex = /\b(?:const|let|var)\s+(\w+)\s*=\s*await\s+authorizeProject\s*\(/g;
      let match: RegExpExecArray | null;
      while ((match = assignRegex.exec(content)) !== null) {
        totalCallsFound += 1;
        const varName = match[1];
        const afterAssignment = content.slice(match.index + match[0].length);

        expect(
          afterAssignment.includes(`${varName}.ok`),
          `${relPath} assigns ${varName} = await authorizeProject(...) but never accesses ${varName}.ok`
        ).toBe(true);

        const bareNegation = new RegExp(`!\\s*${varName}(?!\\s*\\.)\\b`);
        expect(
          bareNegation.test(afterAssignment),
          `${relPath} negates ${varName} directly (!${varName}) instead of !${varName}.ok`
        ).toBe(false);

        const bareIf = new RegExp(`if\\s*\\(\\s*${varName}\\s*\\)`);
        expect(
          bareIf.test(afterAssignment),
          `${relPath} checks if (${varName}) directly instead of if (${varName}.ok)`
        ).toBe(false);
      }
    }

    expect(totalCallsFound).toBeGreaterThanOrEqual(7);
  });
});

describe("Project board page & authorizeProject access check behavior", () => {
  const projectId = "proj-11111111-1111-4111-a111-111111111111";

  it("blocks a developer who is NOT on project_team_member with notFound()", async () => {
    signInAs(auth, "developer", "dev-outsider");
    mockDb.query.projectTeamMembers.findFirst.mockResolvedValue(undefined);

    const authz = await authorizeProject(projectId, "read");
    expect(authz).toEqual({ ok: false, reason: "FORBIDDEN" });

    await expect(
      KanbanBoardPage({
        params: Promise.resolve({ id: projectId }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(mockDb.query.agencyProjects.findFirst).not.toHaveBeenCalled();
  });

  it("allows a developer who IS on project_team_member to load the project board", async () => {
    signInAs(auth, "developer", "dev-member");
    mockDb.query.projectTeamMembers.findFirst.mockResolvedValue({
      projectId,
      userId: "dev-member",
    });
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      id: projectId,
      title: "Delivery Tracking App",
      status: "In Progress",
      isArchived: false,
      stakeholders: [],
      milestones: [],
      tasks: [],
      lead: null,
    });
    mockDb.query.projectTeamMembers.findMany.mockResolvedValue([]);
    mockDb.setSelectRows([]);

    const element = await KanbanBoardPage({
      params: Promise.resolve({ id: projectId }),
      searchParams: Promise.resolve({}),
    });

    expect(notFound).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });

  it("allows a manager who owns the project to load the project board", async () => {
    signInAs(auth, "manager", "pm-owner");
    mockDb.query.agencyProjects.findFirst.mockResolvedValue({
      id: projectId,
      title: "Delivery Tracking App",
      status: "In Progress",
      isArchived: false,
      stakeholders: [],
      milestones: [],
      tasks: [],
      lead: null,
    });
    mockDb.query.projectTeamMembers.findMany.mockResolvedValue([]);
    mockDb.query.users.findMany.mockResolvedValue([]);
    mockDb.setSelectRows([]);

    const element = await KanbanBoardPage({
      params: Promise.resolve({ id: projectId }),
      searchParams: Promise.resolve({}),
    });

    expect(notFound).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });
});

