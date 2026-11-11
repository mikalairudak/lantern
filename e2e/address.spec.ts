import { expect, test, type Page, type Request, waitMs } from "./fixtures";

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const DAY_LIST = 'ol[aria-label="The day"]';
/** What the start screen says over the cities Lantern has written. */
const WRITTEN_HEADING = "Or watch Lantern write a day it knows";

/** A fetch of a route's server components, as a router navigation makes. */
function isRouteFetch(request: Request): boolean {
  return request.headers()["rsc"] === "1" || new URL(request.url()).searchParams.has("_rsc");
}

/** Every route fetch the page makes from now on, and every error it logs. */
function watch(page: Page): { routeFetches: string[]; errors: string[] } {
  const seen = { routeFetches: [] as string[], errors: [] as string[] };
  page.on("request", (request) => {
    if (isRouteFetch(request)) seen.routeFetches.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") seen.errors.push(message.text());
  });
  return seen;
}

function pathOf(page: Page): string {
  return new URL(page.url()).pathname;
}

function headline(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

/** Waits for the day to be written and still, when its words can be changed. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/** Plays another written day from the city word in the headline. */
async function chooseWrittenCity(page: Page, from: string, to: string): Promise<void> {
  await headline(page).getByRole("button", { name: from, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${to}`) }).click();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a city pressed on the start screen is named in the address once its day takes the page, Back comes back to the start screen, and a reload opens it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Lantern");
  expect(pathOf(page)).toBe("/");
  const seen = watch(page);
  const entries = await page.evaluate(() => window.history.length);

  await page
    .getByRole("list", { name: WRITTEN_HEADING })
    .getByRole("button", { name: / in Kanazawa,/ })
    .click();

  await expect(page).toHaveURL(/\/day\/kanazawa$/);
  await expect(page).toHaveTitle("A calm Saturday in Kanazawa, early start · Lantern");
  // Pushed once, so Back comes back to the start screen; the router kept the start screen's
  // tree, so no route was fetched.
  expect(await page.evaluate(() => window.history.length)).toBe(entries + 1);
  await expect(page.locator(DAY_LIST)).toHaveCount(1);

  // Back shows the start screen while the day writes on in memory; Forward shows the day as
  // the visitor left it, its energy re-picked and a stop open.
  await waitForTheDay(page);
  await headline(page).getByRole("button", { name: "calm", exact: true }).click();
  await page.getByRole("option", { name: "lively" }).click();
  await page.locator(DAY_LIST).getByRole("button").first().click();
  const sheet = page.getByRole("region", { name: /^About / });
  await expect(sheet).toBeVisible();
  const about = await sheet.getAttribute("aria-label");
  await page.goBack();
  expect(pathOf(page)).toBe("/");
  await expect(page).toHaveTitle("Lantern");
  await expect(page.getByRole("list", { name: WRITTEN_HEADING })).toBeVisible();
  await expect(headline(page)).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/day\/kanazawa$/);
  await expect(headline(page)).toContainText("A lively Saturday in Kanazawa");
  await expect(page).toHaveTitle("A lively Saturday in Kanazawa, early start · Lantern");
  await expect(page.getByRole("region", { name: /^About / })).toBeVisible();
  if (about !== null) await expect(page.getByRole("region", { name: about })).toBeVisible();

  await chooseWrittenCity(page, "Kanazawa", "Bologna");

  await expect(page).toHaveURL(/\/day\/bologna$/);
  await expect(page).toHaveTitle("A lively Saturday in Bologna, with friends · Lantern");
  await expect(headline(page)).toContainText("A lively Saturday in Bologna");
  // A day after a day replaces its address: one entry for the day, whichever city it is.
  expect(await page.evaluate(() => window.history.length)).toBe(entries + 1);
  expect(seen).toEqual({ routeFetches: [], errors: [] });

  await page.reload();
  await expect(headline(page)).toContainText("A lively Saturday in Bologna");
  await expect(page).toHaveTitle("A lively Saturday in Bologna, with friends · Lantern");
});

test("a written day's address gives way to the start screen's for a city Lantern has not written", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const seen = watch(page);

  await page.getByRole("button", { name: "Plan another day" }).first().click();
  await expect(page.getByRole("textbox", { name: "Somewhere else" })).toBeFocused();
  await page.keyboard.type("Paris");
  await page.keyboard.press("Enter");

  // Kanazawa's own words go with it: its early start is the visitor's.
  await expect(headline(page)).toHaveText("A calm Saturday in Paris, early start");
  expect(pathOf(page)).toBe("/");
  await expect(page).toHaveTitle("Lantern");
  expect(seen).toEqual({ routeFetches: [], errors: [] });
});

test("the lab's start screen keeps its own address whatever day it shows", async ({ page }) => {
  await page.goto("/lab/concepts/start");
  const title = await page.title();

  await page
    .getByRole("list", { name: WRITTEN_HEADING })
    .getByRole("button", { name: / in Kanazawa,/ })
    .click();
  await waitForTheDay(page);
  await chooseWrittenCity(page, "Kanazawa", "Bologna");

  await expect(headline(page)).toContainText("A lively Saturday in Bologna");
  expect(pathOf(page)).toBe("/lab/concepts/start");
  await expect(page).toHaveTitle(title);
});
