import { test as base, type Page } from "@playwright/test";

export * from "@playwright/test";
export { waitMs } from "./ci-wait";

/**
 * How many times slower each page's CPU runs, from `E2E_CPU_RATE`; unset, it runs as it is.
 * A frame-by-frame spec can pass on a quiet machine and fail when sessions share it, since
 * a slow page lays out, paints and runs its timers in an order a quick one never does. 2
 * stands in for a busy machine without loading the others; at 4 the page starves, frames
 * come 100 ms apart and the specs' frame-count rules no longer hold (`docs/harness.md`).
 */
export const CPU_RATE = cpuRateOf(process.env.E2E_CPU_RATE);

function cpuRateOf(value: string | undefined): number {
  if (value === undefined || value === "") return 1;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 1) {
    throw new Error(`E2E_CPU_RATE is "${value}": give how many times slower to run, 1 or more.`);
  }
  return rate;
}

/** Where a day's page keeps the view the visitor chose (`src/lib/browser-storage.ts`). */
const DAY_VIEW_KEY = "lantern-day-view";

/**
 * Opens the test's pages as a visitor who once chose the chart, for the specs that drive the
 * chart's own gestures and frames: a day opens on its plan otherwise. A view the test chooses
 * after stands, as the visitor's own choice would.
 */
export async function chooseTheChart(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    try {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, "chart");
    } catch {
      // A page without storage opens on the plan.
    }
  }, DAY_VIEW_KEY);
}

/** The product's events route, which a page posts to as the visitor plays days. */
const EVENTS_ROUTE = "**/api/events";

const OCTET = 256;
/** The tests this worker process has given an address, this one's included. */
let testsAddressed = 0;

/**
 * An address of the test's own, which the server reads as the visitor's (`x-real-ip`, as
 * Vercel's edge sets it): every page of a run comes from one machine, and as one visitor
 * its product events would pass a visitor's day of them (`EVENT_LIMITS`) some way into the
 * run, and every one after would be dropped, a line in the server's log each. Each worker is
 * a process of its own, so its index and its count make the address unique in the run.
 */
function nextTestAddress(workerIndex: number): string {
  testsAddressed += 1;
  const high = Math.floor(testsAddressed / OCTET) % OCTET;
  return `10.${workerIndex % OCTET}.${high}.${testsAddressed % OCTET}`;
}

interface Fixtures {
  /**
   * Every product event the page sent, as posted, in order, answered in the browser. Asked
   * for by the specs that read them; elsewhere events reach the test server, which keeps them
   * in memory (`playwright.config.ts`). A route on every page held specs that resize it, two
   * of them, past their timeout.
   */
  productEvents: unknown[];
}

/**
 * Playwright's `test`, each page slowed by `E2E_CPU_RATE` through Chrome's own throttling,
 * coming from an address of its own, and the product events a spec asks for caught before
 * they leave the browser.
 */
export const test = base.extend<Fixtures>({
  // Playwright's second argument is named `use` in its docs; another name keeps React's hook
  // rule from reading it as a hook.
  page: async ({ page }, provide, testInfo) => {
    if (CPU_RATE > 1) {
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
    }
    await page.setExtraHTTPHeaders({ "x-real-ip": nextTestAddress(testInfo.workerIndex) });
    await provide(page);
  },
  productEvents: async ({ page }, provide) => {
    const events: unknown[] = [];
    await page.route(EVENTS_ROUTE, (route) => {
      events.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    });
    await provide(events);
    // A day left as the page closes posts its event then, and no route answers it now.
    await page.unrouteAll({ behavior: "ignoreErrors" });
  },
});
