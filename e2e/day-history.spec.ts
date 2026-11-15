import { chooseTheChart, expect, test, type Page, waitMs } from "./fixtures";
import { BROWSER_STORAGE } from "../src/lib/browser-storage";

// The address names a day, and Back goes to the day before (`docs/decisions.md`, "Back goes to
// the day before"): a day that takes the page after another has an entry of its own, a change
// within the day keeps its entry, and a day reached by Back or Forward is drawn whole from
// memory, or from its own address, with nothing asked of a route that writes or reads a day.

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** Two days played in a test, and a third load in one. */
const TWO_DAYS_TEST_MS = waitMs(90_000);
/** A day drawn whole is still within a moment; one played again takes the route's seconds. */
const WHOLE_TIMEOUT_MS = 3000;
/** What the start screen says over its index of the days Lantern has written. */
const INDEX_LABEL = "No city in mind? Start from one of these";
const PLAN_ROWS = 'ol[aria-label="The day, to read"] > li';
/** The routes that write, read or re-plan a day for a visitor, each a call that may be paid. */
const DAY_POSTS = /^\/api\/(intake|day|replan)(\/|$)/;

const PARIS = /^A calm Sunday in Paris/;
const BOLOGNA = /^A lively Saturday in Bologna/;

/** Every post to a day's routes the page makes from now on, by path, and every error it logs. */
function watch(page: Page): { posts: string[]; errors: string[] } {
  const seen = { posts: [] as string[], errors: [] as string[] };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && DAY_POSTS.test(path)) seen.posts.push(path);
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

function historyLength(page: Page): Promise<number> {
  return page.evaluate(() => window.history.length);
}

/** The day on screen is written whole and still, within the time given. */
async function waitForTheDay(page: Page, timeout = DAY_TIMEOUT_MS): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout },
  );
}

/** Paris pressed on the start screen, written to its end: how many stops its plan shows. */
async function playParis(page: Page): Promise<number> {
  await page.goto("/");
  await page
    .getByRole("list", { name: INDEX_LABEL })
    .getByRole("button", { name: /^Paris / })
    .click();
  await expect(page).toHaveURL(/\/day\/paris$/);
  await waitForTheDay(page);
  return page.locator(PLAN_ROWS).count();
}

/** Bologna from the headline's city word, written to its end. */
async function chooseBolognaAtTheCityWord(page: Page): Promise<void> {
  await headline(page).getByRole("button", { name: "Paris", exact: true }).click();
  await page.getByRole("button", { name: /^Bologna/ }).click();
  await expect(page).toHaveURL(/\/day\/bologna$/);
  await waitForTheDay(page);
}

/** Bologna from the new day's list: the masthead's button, or on a narrow phone the menu's row. */
async function chooseBolognaAtTheNewDay(page: Page): Promise<void> {
  const newDay = page.getByRole("button", { name: "New day" });
  if (await newDay.isVisible()) {
    await newDay.click();
  } else {
    await page.getByRole("button", { name: "Take this day" }).click();
    await page.getByRole("menuitem", { name: /^New day/ }).click();
  }
  await expect(page.getByRole("textbox", { name: "Somewhere else" })).toBeFocused();
  await page.getByRole("button", { name: /^Bologna/ }).click();
  await expect(page).toHaveURL(/\/day\/bologna$/);
  await waitForTheDay(page);
}

/** Back to Paris, drawn whole at once with every stop it had. */
async function expectParisWhole(page: Page, rows: number): Promise<void> {
  await expect(page).toHaveURL(/\/day\/paris$/);
  await expect(headline(page)).toContainText(PARIS);
  await waitForTheDay(page, WHOLE_TIMEOUT_MS);
  await expect(page.locator(PLAN_ROWS)).toHaveCount(rows);
}

/** Back from Paris to the start screen, then Forward through Paris to Bologna again. */
async function expectTheStartThenForwardTwice(page: Page, rows: number): Promise<void> {
  await page.goBack();
  expect(pathOf(page)).toBe("/");
  await expect(page.getByRole("list", { name: INDEX_LABEL })).toBeVisible();
  await expect(page).toHaveTitle("Lantern");

  await page.goForward();
  await expectParisWhole(page, rows);

  await page.goForward();
  await expect(page).toHaveURL(/\/day\/bologna$/);
  await expect(headline(page)).toContainText(BOLOGNA);
  await expect(page).toHaveTitle("A lively Saturday in Bologna, with friends · Lantern");
  await waitForTheDay(page, WHOLE_TIMEOUT_MS);
}

/** The places chosen on each day, as this device keeps them. */
const PICKS_KEY = BROWSER_STORAGE.picks.key;

/** The stop sliders of the chart a test steps, until one shows another version. */
const SLIDERS_TRIED = 6;

/**
 * Steps a stop of the chart to another of its versions from the keyboard: the first of the day's
 * stops that has one beside the version written. Which stop, and the version it then shows.
 */
async function chooseAnotherVersion(page: Page): Promise<{ index: number; value: string }> {
  for (let index = 0; index < SLIDERS_TRIED; index += 1) {
    const slider = page.getByRole("slider").nth(index);
    const written = await slider.getAttribute("aria-valuetext");
    await slider.focus();
    for (const key of ["ArrowRight", "ArrowLeft"]) {
      await page.keyboard.press(key);
      const value = await slider.getAttribute("aria-valuetext");
      if (value !== null && value !== written) return { index, value };
    }
  }
  throw new Error("No stop of the day has another version to show");
}

test.describe("with reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("a city changed at the city word is an entry of its own: Back shows the day before whole, and Forward the day after, with no call", async ({
    page,
  }) => {
    test.setTimeout(TWO_DAYS_TEST_MS);
    const rows = await playParis(page);
    const withParis = await historyLength(page);
    await chooseBolognaAtTheCityWord(page);
    expect(await historyLength(page)).toBe(withParis + 1);
    const seen = watch(page);

    await page.goBack();

    await expectParisWhole(page, rows);
    await expect(page).toHaveTitle(
      "A calm Sunday in Paris, slow morning, with a partner · Lantern",
    );
    await expectTheStartThenForwardTwice(page, rows);
    expect(await historyLength(page)).toBe(withParis + 1);
    expect(seen).toEqual({ posts: [], errors: [] });
  });

  test("a city chosen at the new day is an entry of its own, Back and Forward each drawn with no call", async ({
    page,
  }) => {
    test.setTimeout(TWO_DAYS_TEST_MS);
    const rows = await playParis(page);
    const withParis = await historyLength(page);
    await chooseBolognaAtTheNewDay(page);
    expect(await historyLength(page)).toBe(withParis + 1);
    const seen = watch(page);

    await page.goBack();

    await expectParisWhole(page, rows);
    await expectTheStartThenForwardTwice(page, rows);
    expect(seen).toEqual({ posts: [], errors: [] });
  });

  test("the energy changed on a day adds no entry: Back still goes to the day before", async ({
    page,
  }) => {
    test.setTimeout(TWO_DAYS_TEST_MS);
    const rows = await playParis(page);
    await chooseBolognaAtTheCityWord(page);
    const withBologna = await historyLength(page);

    await headline(page).getByRole("button", { name: "lively", exact: true }).click();
    await page.getByRole("option", { name: "calm" }).click();

    await expect(headline(page)).toContainText("A calm Saturday in Bologna");
    expect(pathOf(page)).toBe("/day/bologna");
    expect(await historyLength(page)).toBe(withBologna);
    const seen = watch(page);

    await page.goBack();

    await expectParisWhole(page, rows);
    await page.goForward();
    await expect(page).toHaveURL(/\/day\/bologna$/);
    // As its address opens it: at the energy it was asked at, with the places the energy
    // re-picked showed kept as the visitor's, as a reload of it shows them too.
    const returned = "A lively Saturday, quieter in places, in Bologna";
    await expect(headline(page)).toContainText(returned);
    expect(seen.posts).toEqual([]);
    await page.reload();
    await expect(headline(page)).toContainText(returned);
  });

  test("a reload in the middle of the days keeps them: Forward and Back open each from its own address", async ({
    page,
  }) => {
    test.setTimeout(TWO_DAYS_TEST_MS);
    const rows = await playParis(page);
    await chooseBolognaAtTheCityWord(page);
    await page.goBack();
    await expectParisWhole(page, rows);

    await page.reload();
    await expect(headline(page)).toContainText(PARIS);
    await waitForTheDay(page);
    const seen = watch(page);

    // Each was watched to its end on this device, so its own page opens it whole.
    await page.goForward();
    await expect(page).toHaveURL(/\/day\/bologna$/);
    await expect(headline(page)).toContainText(BOLOGNA);
    await waitForTheDay(page, WHOLE_TIMEOUT_MS);

    await page.goBack();
    await expectParisWhole(page, rows);
    await page.goBack();
    expect(pathOf(page)).toBe("/");
    await expect(page.getByRole("list", { name: INDEX_LABEL })).toBeVisible();
    expect(seen.posts).toEqual([]);
  });
});

test.describe("with motion", () => {
  test("a city changed at the city word, Back shows the day before whole at once, with no call", async ({
    page,
  }) => {
    test.setTimeout(TWO_DAYS_TEST_MS);
    const rows = await playParis(page);
    await chooseBolognaAtTheCityWord(page);
    const seen = watch(page);

    await page.goBack();

    await expectParisWhole(page, rows);
    await expectTheStartThenForwardTwice(page, rows);
    expect(seen.posts).toEqual([]);
  });

  test("a day returned to shows the places chosen on it", async ({ page }) => {
    test.setTimeout(TWO_DAYS_TEST_MS);
    await chooseTheChart(page);
    await playParis(page);
    const chosen = await chooseAnotherVersion(page);
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), PICKS_KEY))
      .not.toBeNull();
    await chooseBolognaAtTheCityWord(page);

    await page.goBack();

    await expect(headline(page)).toContainText(PARIS);
    await waitForTheDay(page, WHOLE_TIMEOUT_MS);
    await expect(page.getByRole("slider").nth(chosen.index)).toHaveAttribute(
      "aria-valuetext",
      chosen.value,
    );
  });
});
