import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "next/server": path.resolve(__dirname, "node_modules/next/server.js"),
      // Next aliases `server-only` itself at build time; Vitest needs the harmless empty module.
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["tests/vitest.setup.ts"],
    server: {
      deps: {
        inline: ["next-auth"],
      },
    },
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.spec.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
    ],
  },
});
