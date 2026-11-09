import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * `pnpm eval:live` alone (`scripts/live-eval.ts`): Vitest here only runs TypeScript that
 * imports the app by `@/`. It spends money when confirmed, so `pnpm test` never collects it;
 * on the server's code it runs in Node, with no DOM and no test setup, and one file at a time.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["scripts/live-eval.ts"],
    maxWorkers: 1,
  },
});
