import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const targets = [
  path.join(rootDir, ".next", "cache"),
  path.join(rootDir, ".turbo"),
];

console.log("🧹 Clearing build and navigation cache directories...");

for (const target of targets) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`  ✔ Removed: ${path.relative(rootDir, target)}`);
    } else {
      console.log(`  - Skipped (not found): ${path.relative(rootDir, target)}`);
    }
  } catch (err) {
    console.warn(`  ⚠ Failed to remove ${target}:`, err?.message || err);
  }
}

console.log("✨ Cache clean complete. Fresh build/dev state ready.");
