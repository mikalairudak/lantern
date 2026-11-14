import { expect, test, type Page, waitMs } from "./fixtures";

/**
 * The product's events as the browser posts them (`docs/decisions.md`, "Product events are kept
 * under a visitor key that lives one day"), caught by the fixtures' stub of the events route, so
 * nothing is counted anywhere.
 */

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** What the start screen says over its index of the days Lantern has written. */
const INDEX_LABEL = "No city in mind? Start from one of these";

const KANAZAWA_LINK = { city: "kanazawa", via: "link", written: true };
/** The view a page opens on where the visitor chose none: the day's plan. */
const ON_PLAN = { view: "read" };
/** How long the line under a whole day stays in view before it is read (`READ_TO_END_MS`). */
const READ_TO_END_MS = 1000;

/**
 * The events but the day read to its end, which comes whenever the line under the day has stood
 * on screen a second, as it can on a tall screen without a scroll.
 */
function withoutReadToEnd(events: readonly unknown[]): unknown[] {
  return events.filter((event) => (event as { kind?: string }).kind !== "day-read-to-end");
}

/** Whether a posted event is of this kind. */
function isKind(kind: string): (event: unknown) => boolean {
  return (event) => (event as { kind?: string }).kind === kind;
}

async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a day's address counts its opening, its ending, each word changed and its menu opened", async ({
  page,
  productEvents,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);

  await expect
    .poll(() => withoutReadToEnd(productEvents))
    .toEqual([
      { kind: "day-opened", ...KANAZAWA_LINK },
      { kind: "day-ended", ...KANAZAWA_LINK, ...ON_PLAN, outcome: "complete" },
    ]);

  await page.getByRole("heading", { level: 1 }).getByRole("button", { name: "calm" }).click();
  await page.getByRole("option", { name: "lively" }).click();

  await expect
    .poll(() => withoutReadToEnd(productEvents).at(-1))
    .toEqual({ kind: "word-changed", city: "kanazawa", word: "energy", control: "headline" });

  // The same word on the plan's bar: one event, told as changed at the bar.
  await page
    .getByRole("group", { name: "How lively the day is" })
    .getByRole("button", { name: "balanced" })
    .click();
  await expect
    .poll(() => withoutReadToEnd(productEvents).filter(isKind("word-changed")))
    .toEqual([
      { kind: "word-changed", city: "kanazawa", word: "energy", control: "headline" },
      { kind: "word-changed", city: "kanazawa", word: "energy", control: "bar" },
    ]);

  // The day's menu, opened twice, is told once.
  const menu = page.getByRole("button", { name: "Take this day" });
  await menu.click();
  await menu.click();
  await menu.click();
  await expect
    .poll(() => productEvents.filter(isKind("menu-opened")))
    .toEqual([{ kind: "menu-opened", ...KANAZAWA_LINK, ...ON_PLAN }]);
});

test("a city chosen from the new day is counted as changed there, and opens no menu", async ({
  page,
  productEvents,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);

  await page.getByRole("button", { name: "New day" }).click();
  await page.getByRole("button", { name: /^Bologna/ }).click();

  await expect
    .poll(() => productEvents.filter(isKind("word-changed")))
    .toEqual([{ kind: "word-changed", city: "kanazawa", word: "city", control: "new-day" }]);
  expect(productEvents.filter(isKind("menu-opened"))).toEqual([]);
});

test("a day is counted read to its end once the line under it has stood on screen", async ({
  page,
  productEvents,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);

  await page.getByRole("button", { name: "Not quite" }).scrollIntoViewIfNeeded();

  const readToEnd = () =>
    productEvents.filter((event) => (event as { kind?: string }).kind === "day-read-to-end");
  await expect
    .poll(readToEnd, { timeout: READ_TO_END_MS * 10 })
    .toEqual([{ kind: "day-read-to-end", ...KANAZAWA_LINK, ...ON_PLAN }]);
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
  // Barcelona's, the longest day the index offers, so it is still being written as it is left.
  await page
    .getByRole("list", { name: INDEX_LABEL })
    .getByRole("button", { name: /^Barcelona / })
    .click();
  const barcelona = { city: "barcelona", via: "pressed", written: true };
  // The start screen is counted first, once, as its page opens.
  await expect
    .poll(() => productEvents)
    .toEqual([{ kind: "home-viewed" }, { kind: "day-opened", ...barcelona }]);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
  });

  await expect
    .poll(() => productEvents)
    .toEqual([
      { kind: "home-viewed" },
      { kind: "day-opened", ...barcelona },
      expect.objectContaining({ kind: "day-left", ...barcelona }),
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
