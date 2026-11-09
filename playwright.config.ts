import { defineConfig, devices } from "@playwright/test";
import { E2E_STUDIO_AUTHORIZATION, E2E_STUDIO_ENV } from "./e2e/studio-login";

const PORT = Number(process.env.E2E_PORT ?? 3417);
// Its own build directory lets e2e run while `pnpm dev` is up (see next.config.ts).
const DIST_DIR = ".next-e2e";
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

// The visual baseline (`pnpm e2e:visual`): one phone-wide cell per shot, in a viewport no
// wider than a phone's layout needs, with Motion's springs at rest.
const VISUAL_VIEWPORT = { width: 460, height: 1000 };
// Longer than the 5 s default: the gate has timed out beside another session's e2e.
const SCREENSHOT_TIMEOUT_MS = 15_000;
// Playwright's default, 0.2, passed a whole palette change as unchanged; 0.01 flags a grey
// shift from 2.6 of 255 levels and measured no noise in three runs (docs/harness.md).
const SCREENSHOT_PIXEL_THRESHOLD = 0.01;
// One test shoots every matrix the lab lists, over a thousand cells in both themes, which takes
// about 5 minutes on a laptop, so it gets 12.
const VISUAL_TEST_TIMEOUT_MS = 12 * 60_000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // The studio and the lab ask for the run's own password (`e2e/studio-login.ts`), which
    // every request gives; `e2e/studio.spec.ts` asks without it. Not as `httpCredentials`:
    // those have Playwright catch every request, which turns the browser's cache off, so each
    // request says `cache-control: no-cache`, and Next's dev server then draws its "Cache
    // disabled" badge over the page's bottom-left corner, on the foot line's first link.
    extraHTTPHeaders: { Authorization: E2E_STUDIO_AUTHORIZATION },
  },
  // Chromium only: the desktop and phone layouts matter more than engine coverage here.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      // Out of a bare `playwright test`: its baselines are this Mac's, and every design
      // round changes pixels on purpose, so updating them is its own act (docs/harness.md).
      name: "visual",
      default: false,
      testDir: "./e2e/visual",
      testMatch: "**/*.visual.ts",
      snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}",
      retries: 0,
      timeout: VISUAL_TEST_TIMEOUT_MS,
      use: {
        ...devices["Desktop Chrome"],
        viewport: VISUAL_VIEWPORT,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      },
      expect: {
        toHaveScreenshot: {
          timeout: SCREENSHOT_TIMEOUT_MS,
          threshold: SCREENSHOT_PIXEL_THRESHOLD,
          stylePath: "./e2e/visual/screenshot.css",
        },
      },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    // No database: Next never lets `.env.local` override a variable already set, so the
    // product events a run's pages send are kept in the dev server's memory, never in
    // `lantern-dev` (the events spec catches its own in the browser).
    // The studio's login is the run's own, so the dev server asks for a password as
    // production does (`src/lib/http/studio-gate.ts`).
    env: { NEXT_DIST_DIR: DIST_DIR, DATABASE_URL: "", ...E2E_STUDIO_ENV },
    url: BASE_URL,
    // Never attach to whatever already listens on the port: it may be another app.
    reuseExistingServer: false,
  },
});
