import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

/** Every file under src that starts with "use server", so its exports become public endpoints. */
function collectUseServerFiles(dir = path.join(root, "src")): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectUseServerFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const head = fs.readFileSync(full, "utf8").slice(0, 200);
      if (/^\s*["']use server["']/.test(head)) out.push(full);
    }
  }
  return out;
}

const INTERNAL_HELPERS = [
  "logAction",
  "createSystemNotification",
  "notifyAllAdmins",
  "notifyProjectClients",
  "notifyLeadClient",
  "syncProjectStatus",
];

describe("internal helpers are not public server actions", () => {
  it("no \"use server\" file exports an internal helper", () => {
    const offenders: string[] = [];
    for (const file of collectUseServerFiles()) {
      const src = fs.readFileSync(file, "utf8");
      for (const name of INTERNAL_HELPERS) {
        const exported = new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`);
        if (exported.test(src)) offenders.push(`${path.relative(root, file)}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("log.ts and send.ts are marked server-only", () => {
    expect(read("src/features/audit/log.ts")).toMatch(/^import "server-only";/);
    expect(read("src/features/notifications/send.ts")).toMatch(/^import "server-only";/);
  });

  it("no client component imports the server-only modules", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          const isClient = /^\s*["']use client["']/.test(src.slice(0, 200));
          if (isClient && /features\/(audit\/log|notifications\/send)|lib\/authz/.test(src)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(path.join(root, "src"));
    expect(offenders).toEqual([]);
  });
});

describe("debug routes are gone", () => {
  it.each(["debug", "test-db", "make-me-admin"])("src/app/api/%s/route.ts does not exist", (name) => {
    expect(fs.existsSync(path.join(root, "src/app/api", name, "route.ts"))).toBe(false);
  });
});
