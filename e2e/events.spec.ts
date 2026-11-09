import { expect, test, type Page } from "./fixtures";

/**
 * The product's events as the browser posts them (`docs/decisions.md`, "Product events are kept
 * under a visitor key that lives one day"), caught by the fixtures' stub of the events route, so
 * nothing is counted anywhere.
 */

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = 30_000;
/** What the start screen says over the cities Lantern has written. */
const WRITTEN_HEADING = "Or watch Lantern write a day it knows";

const KANAZAWA_LINK = { city: "kanazawa", via: "link", written: true };

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
    .poll(() => productEvents)
    .toEqual([
      { kind: "day-opened", ...KANAZAWA_LINK },
      { kind: "day-ended", ...KANAZAWA_LINK, outcome: "complete" },
    ]);

  await page.getByRole("heading", { level: 1 }).getByRole("button", { name: "calm" }).click();
  await page.getByRole("option", { name: "lively" }).click();

  await expect
    .poll(() => productEvents.at(-1))
    .toEqual({ kind: "word-changed", city: "kanazawa", word: "energy" });
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
  await expect.poll(() => productEvents).toEqual([{ kind: "day-opened", ...kanazawa }]);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
  });

  await expect
    .poll(() => productEvents)
    .toEqual([
      { kind: "day-opened", ...kanazawa },
      expect.objectContaining({ kind: "day-left", ...kanazawa }),
    ]);
  // Left, it is never ended as well.
  await waitForTheDay(page);
  expect(productEvents).toHaveLength(2);
});

test("a lab's day counts nothing", async ({ page, productEvents }) => {
  await page.goto("/lab/concepts/invitation/light");
  await waitForTheDay(page);

  expect(productEvents).toEqual([]);
});
