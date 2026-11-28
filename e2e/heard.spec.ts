import { CPU_RATE, expect, test, waitMs, type Page } from "./fixtures";
import { expectSaidOnceAsChange, logStatuses } from "./status-log";
import { GOLDEN_HOUR } from "../src/features/abacus/golden-hour-words";
import { THE_DAY_IS_WRITTEN } from "../src/features/day/day-stage-header";
import { writtenDayAt } from "../src/lib/days/written/days";
import { writtenVersionOf } from "../src/lib/days/written/version";
import { BROWSER_STORAGE } from "../src/lib/browser-storage";
import { NOTICE_HEARD_MS } from "../src/features/day/notice-status";

/**
 * What a screen reader hears of a day that a sighted visitor reads from its drawing, on the
 * re-plan bench's Elche, shown on a Thursday in early November: the day's own status saying
 * once that the day is written, a stop that starts in golden hour saying so after its time, on
 * the plan and on the chart, and each version's bead on the chart naming the stop it belongs to.
 */

const BENCH = "/lab/concepts/replan";
/** The bench writes its day at a live pace, about fifteen seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(45_000);
/** Elche's coffee on Plaça de Baix at 07:45, the sun just up: its one stop in golden hour. */
const GOLDEN_START = "07:45";
/** Its churros, the livelier version of that coffee. */
const CHURROS = "Churros on Plaça de Baix";

/**
 * The day's end lands under the list in the task that writes the line, so the status log, which
 * notes a change once that task is done, may note the line this much after its hold began, and
 * as much more on a page whose CPU is slowed.
 */
const LANDING_LATE_MS = 250;

test.use({ reducedMotion: "reduce" });

async function openElche(page: Page, view: "read" | "chart"): Promise<void> {
  await page.addInitScript((shown) => localStorage.setItem("lantern-day-view", shown), view);
  await page.goto(BENCH);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Elche", {
    timeout: DAY_TIMEOUT_MS,
  });
}

/** The day whole and still, in the view it opened on: its list on the plan, its chart otherwise. */
async function waitForTheDay(page: Page, view: "read" | "chart"): Promise<void> {
  const day =
    view === "read"
      ? page.getByRole("list", { name: "The day, to read" })
      : page.getByRole("group", { name: /The day's energy/ });
  await expect(day).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
}

test("a day written to its end says once that it is written, from a status that stood", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  await page.addInitScript(logStatuses);
  await openElche(page, "read");
  await waitForTheDay(page, "read");

  await expectSaidOnceAsChange(
    page,
    THE_DAY_IS_WRITTEN,
    NOTICE_HEARD_MS - waitMs(LANDING_LATE_MS) * CPU_RATE,
  );
  // The line on screen that counted the stops has gone: nothing a sighted visitor reads says it.
  await expect(page.getByText(THE_DAY_IS_WRITTEN).filter({ visible: true })).toHaveCount(0);
});

for (const view of ["read", "chart"] as const) {
  test(`${view === "read" ? "Plan" : "Chart"}: a stop that starts in golden hour says so after its time, and no other`, async ({
    page,
  }) => {
    await openElche(page, view);
    await waitForTheDay(page, view);
    const list =
      view === "read"
        ? page.getByRole("list", { name: "The day, to read" })
        : page.getByRole("list", { name: "The day", exact: true });
    const said = list.getByText(`, ${GOLDEN_HOUR}`, { exact: true });

    await expect(said).toHaveCount(1);
    const row = list
      .getByRole("listitem")
      .filter({ has: page.getByText(`, ${GOLDEN_HOUR}`, { exact: true }) });
    await expect(row).toContainText(`${GOLDEN_START}, ${GOLDEN_HOUR}`);
    // Heard, never seen: a box of one pixel, clipped.
    expect(await said.evaluate((element) => getComputedStyle(element).position)).toBe("absolute");
    expect((await said.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  });
}

test("Chart: each version's bead names the stop it belongs to, by the time its slider is named by", async ({
  page,
}) => {
  await openElche(page, "chart");
  await waitForTheDay(page, "chart");
  const chart = page.getByRole("group", { name: /The day's energy/ });

  await expect(
    chart.getByRole("button", { name: `${CHURROS}, livelier at ${GOLDEN_START}` }),
  ).toHaveCount(1);
  // Every bead's name ends with the time of the stop's own slider, drawn beside it.
  const pairs = await chart.evaluate((group) =>
    [...group.querySelectorAll('[role="button"][aria-label]')].map((bead) => ({
      bead: bead.getAttribute("aria-label") ?? "",
      slider:
        bead.parentElement?.querySelector('[role="slider"]')?.getAttribute("aria-label") ?? "",
    })),
  );
  expect(pairs.length).toBeGreaterThan(0);
  for (const { bead, slider } of pairs) {
    const time = /^Energy at (\d\d:\d\d)$/.exec(slider)?.[1];
    expect(time, `${bead} beside ${slider}`).toBeDefined();
    expect(bead).toMatch(new RegExp(`, (quieter|livelier|same energy|the original) at ${time}$`));
  }
});

/** Long enough a wait for the route that the page says the day is being written. */
const ROUTE_WAIT_MS = 2500;

test("a day this device has seen, sent whole by the route after a wait that was said, says it is written", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  // Two written days this device has seen, as no Elche or Alicante day has an address: the
  // second, chosen from the first's city word, is sent whole by the route.
  const seen = ["bologna", "porto"].map(
    (slug) => `${slug}:${writtenVersionOf(writtenDayAt(slug)!.itinerary)}`,
  );
  await page.addInitScript(logStatuses);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    BROWSER_STORAGE.seen.key,
    JSON.stringify(seen),
  ] as const);
  await page.goto("/day/bologna");
  await waitForTheDay(page, "read");
  await page.route("**/api/day", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ROUTE_WAIT_MS));
    await route.continue();
  });
  const since = await page.evaluate(() => performance.now());

  const headline = page.getByRole("heading", { level: 1 });
  await headline.getByRole("button", { name: "Bologna", exact: true }).click();
  await page.getByRole("button", { name: /^Porto/ }).click();
  await expect(headline).toContainText("Porto", { timeout: DAY_TIMEOUT_MS });
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.statusLog)).some(
        (entry) => entry.t >= since && entry.text === "Writing the day",
      ),
    )
    .toBe(true);
  await waitForTheDay(page, "read");

  await expectSaidOnceAsChange(
    page,
    THE_DAY_IS_WRITTEN,
    NOTICE_HEARD_MS - waitMs(LANDING_LATE_MS) * CPU_RATE,
    since,
  );
});
