import { expect, test, type Page, waitMs } from "./fixtures";

/**
 * The product's events as the browser posts them (`docs/decisions.md`, "Product events are kept
 * under a visitor key that lives one day"), caught by the fixtures' stub of the events route, so
 * nothing is counted anywhere.
 */

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** What the start screen says over the cities Lantern has written. */
const WRITTEN_HEADING = "Or watch Lantern write a day it knows";

const KANAZAWA_LINK = { city: "kanazawa", via: "link", written: true };
/** The view a page opens on where the visitor chose none. */
const ON_CHART = { view: "chart" };
/** How long the line under a whole day stays in view before it is read (`READ_TO_END_MS`). */
const READ_TO_END_MS = 1000;

/**
 * The events but the day read to its end, which comes whenever the line under the day has stood
 * on screen a second, as it can on a tall screen without a scroll.
 */
function withoutReadToEnd(events: readonly unknown[]): unknown[] {
  return events.filter((event) => (event as { kind?: string }).kind !== "day-read-to-end");
}

async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a day's address counts its opening, its ending and each word changed", async ({
  page,
  productEvents,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);

  await expect
    .poll(() => withoutReadToEnd(productEvents))
    .toEqual([
      { kind: "day-opened", ...KANAZAWA_LINK },
      { kind: "day-ended", ...KANAZAWA_LINK, ...ON_CHART, outcome: "complete" },
    ]);

  await page.getByRole("heading", { level: 1 }).getByRole("button", { name: "calm" }).click();
  await page.getByRole("option", { name: "lively" }).click();

  await expect
    .poll(() => withoutReadToEnd(productEvents).at(-1))
    .toEqual({ kind: "word-changed", city: "kanazawa", word: "energy" });
});

test("a day is counted read to its end once the line under it has stood on screen", async ({
  page,
  productEvents,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);

  await page.getByRole("button", { name: "Copy link" }).scrollIntoViewIfNeeded();

  const readToEnd = () =>
    productEvents.filter((event) => (event as { kind?: string }).kind === "day-read-to-end");
  await expect
    .poll(readToEnd, { timeout: READ_TO_END_MS * 10 })
    .toEqual([{ kind: "day-read-to-end", ...KANAZAWA_LINK, ...ON_CHART }]);
  // Once a day opened, however long the line stays.
  await page.waitForTimeout(READ_TO_END_MS * 2);
  expect(readToEnd()).toHaveLength(1);
});

// The page's own `pagehide`, sent while it stays: a beacon from a page really unloading
// leaves past Playwright's routes, and reaches the test server, which keeps no database.
test("a day the page leaves while it is written is counted as left, once, by beacon", async ({
  page,
  productEvents,
}) => {
  await page.goto("/");
  await page
    .getByRole("list", { name: WRITTEN_HEADING })
    .getByRole("button", { name: / in Kanazawa,/ })
    .click();
  const kanazawa = { city: "kanazawa", via: "pressed", written: true };
  // The start screen is counted first, once, as its page opens.
  await expect
    .poll(() => productEvents)
    .toEqual([{ kind: "home-viewed" }, { kind: "day-opened", ...kanazawa }]);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
  });

  await expect
    .poll(() => productEvents)
    .toEqual([
      { kind: "home-viewed" },
      { kind: "day-opened", ...kanazawa },
      expect.objectContaining({ kind: "day-left", ...kanazawa }),
    ]);
  // Left, it is never ended as well.
  await waitForTheDay(page);
  expect(withoutReadToEnd(productEvents)).toHaveLength(3);
});

test("a lab's day counts nothing", async ({ page, productEvents }) => {
  await page.goto("/lab/concepts/invitation/light");
  await waitForTheDay(page);

  expect(productEvents).toEqual([]);
});
