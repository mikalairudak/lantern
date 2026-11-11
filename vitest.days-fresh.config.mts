import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * `pnpm days:fresh` alone (`scripts/days-fresh.ts`): Vitest here only runs TypeScript that
 * imports the app by `@/`. It reads the clock, so `pnpm test` never collects it: a commit
 * would fail on a date rather than on a change.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["scripts/days-fresh.ts"],
  },
});
