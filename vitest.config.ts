import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // DB integration suites share one TEST_DATABASE_URL and truncate tables, so run files one at a
    // time when it is set; unit-only runs stay parallel.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});
