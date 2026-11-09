import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const COVERAGE_THRESHOLD = 80;
/**
 * The commit hook runs this suite in every session, and sessions commit at once on one
 * machine. Vitest's default, the cores but one, put 51 workers on 18 cores when three hooks
 * ran together, and tests slowed past their limit. Half the cores runs a hook alone as fast,
 * 17 s against 18, and three at once in 34 s each with none failing, against 41 s and two
 * failing in each.
 */
const MAX_WORKERS = "50%";
/**
 * The slowest tests take under 3 s alone, so Vitest's 5 s left them less than twice that,
 * and a shared machine slows them two to five times. A test that hangs still fails, later.
 */
const TEST_TIMEOUT_MS = 15_000;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    maxWorkers: MAX_WORKERS,
    testTimeout: TEST_TIMEOUT_MS,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      // Routes are covered end to end by Playwright, not by unit tests.
      exclude: ["src/app/**", "src/**/*.test.{ts,tsx}"],
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
      },
    },
  },
});
