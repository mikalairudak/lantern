import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page, waitMs } from "./fixtures";

/**
 * The masthead's three kinds (`docs/decisions.md`, "The day's ways along live in one menu, in
 * the masthead"): this day's menu, the new day and the theme. Container queries are the
 * browser's, so the row's two forms are held here, not in jsdom.
 */

test.use({ reducedMotion: "reduce" });

const DAY_TIMEOUT_MS = waitMs(30_000);
/** The page's gutters on a phone, either side of the masthead's row. */
const GUTTERS = 32;
/** One row of the masthead. */
const ROW_HEIGHT = 48;

/** `--container-masthead` in pixels, at the browser's default 16 px root. */
const MASTHEAD_PX = Math.ceil(
  16 *
    Number(
      /--container-masthead:\s*([\d.]+)rem/.exec(readFileSync("src/app/globals.css", "utf8"))?.[1],
    ),
);

async function openDay(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/day/kanazawa");
  // The day is written and still: the energy's words, which wait until then, can be chosen.
  await expect(page.getByRole("button", { name: "lively" })).toBeEnabled({
    timeout: DAY_TIMEOUT_MS,
  });
}

const trigger = (page: Page) => page.getByRole("button", { name: "Take this day" });
const newDayButton = (page: Page) => page.getByRole("button", { name: "New day" });
const cityWord = (page: Page) =>
  page.getByRole("heading", { level: 1 }).getByRole("button", { name: "Kanazawa", exact: true });
const field = (page: Page) => page.getByRole("textbox", { name: "Somewhere else" });

/** The masthead's row: its height, and whether the new day stands in it. */
async function rowOf(page: Page): Promise<{ height: number; isNewDayInRow: boolean }> {
  return trigger(page).evaluate((element) => {
    const row = element.closest(".min-h-12")!;
    const newDay = [...row.querySelectorAll("button")].find(
      (each) => each.textContent === "New day",
    );
    return {
      height: Math.round(row.getBoundingClientRect().height),
      isNewDayInRow: newDay !== undefined && getComputedStyle(newDay).display !== "none",
    };
  });
}

test("the row holds the three kinds at the token's width, and the menu and the theme a pixel under it", async ({
  page,
}) => {
  expect(MASTHEAD_PX).toBeGreaterThan(300);
  await openDay(page, MASTHEAD_PX + GUTTERS);
  expect(await rowOf(page)).toEqual({ height: ROW_HEIGHT, isNewDayInRow: true });

  await page.setViewportSize({ width: MASTHEAD_PX + GUTTERS - 1, height: 800 });
  expect(await rowOf(page)).toEqual({ height: ROW_HEIGHT, isNewDayInRow: false });
});

for (const width of [320, 360, 375, 390, 1280]) {
  test(`the masthead's row is one row at ${width} px`, async ({ page }) => {
    await openDay(page, width);
    const row = await rowOf(page);
    expect(row.height).toBe(ROW_HEIGHT);
    expect(row.isNewDayInRow).toBe(width - GUTTERS >= MASTHEAD_PX);
  });
}

test("on a 360 px phone the new day is the menu's last row, under its rule, and opens the city's field", async ({
  page,
}) => {
  await openDay(page, 360);
  await expect(newDayButton(page)).toBeHidden();
  await trigger(page).click();
  await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
    /Copy the link/,
    /Add to your calendar/,
    /Walk it in Google Maps/,
    /^New day/,
  ]);
  await page.getByRole("menuitem", { name: /^New day/ }).click();
  await expect(field(page)).toBeFocused();
  // One rule for the focus at every width: Escape gives it to the city word, which owns the list.
  await page.keyboard.press("Escape");
  await expect(cityWord(page)).toBeFocused();
  await expect(cityWord(page)).toHaveAttribute("aria-expanded", "false");
});

/** Whether the city's list ever left the page from here on: a fold, or a list mounted again. */
async function watchTheList(page: Page): Promise<() => Promise<boolean>> {
  await page.evaluate(() => {
    const list = document.querySelector('[role="group"][aria-label="Where"]');
    const seen = { isGone: false };
    new MutationObserver(() => {
      if (!list?.isConnected) seen.isGone = true;
    }).observe(document.body, { childList: true, subtree: true });
    (window as unknown as { listSeen: typeof seen }).listSeen = seen;
  });
  return () =>
    page.evaluate(() => (window as unknown as { listSeen: { isGone: boolean } }).listSeen.isGone);
}

test.describe("on a row of three", () => {
  test.beforeEach(async ({ page }) => openDay(page, 1280));

  test("the new day opens the city's field, a second press folds nothing, and Escape gives the focus to the city word", async ({
    page,
  }) => {
    await newDayButton(page).click();
    await expect(field(page)).toBeFocused();
    const isListGone = await watchTheList(page);

    await newDayButton(page).click();
    await expect(field(page)).toBeFocused();
    await expect(cityWord(page)).toHaveAttribute("aria-expanded", "true");
    expect(await isListGone()).toBe(false);

    await page.keyboard.press("Escape");
    await expect(cityWord(page)).toBeFocused();
  });

  test("the menu holds the three ways, and its keys walk them alone", async ({ page }) => {
    const menu = page.getByRole("menu");
    const rows = (name: RegExp): Locator => menu.getByRole("menuitem", { name });
    await trigger(page).focus();
    // The up arrow opens on the last way drawn: the new day's row is not drawn here.
    await page.keyboard.press("ArrowUp");
    await expect(rows(/^Walk it in Google Maps/)).toBeFocused();
    await expect(menu.getByRole("menuitem")).toHaveCount(3);
    // The arrows wrap between the first way and the third.
    await page.keyboard.press("ArrowDown");
    await expect(rows(/^Copy the link/)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(rows(/^Walk it in Google Maps/)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(rows(/^Copy the link/)).toBeFocused();
    await page.keyboard.press("End");
    await expect(rows(/^Walk it in Google Maps/)).toBeFocused();
  });

  test("the menu hangs from its own words, its top 4 px under the row's foot, clear of the new day", async ({
    page,
  }) => {
    await trigger(page).click();
    const sheet = (await page.getByRole("menu").boundingBox())!;
    const words = (await trigger(page).boundingBox())!;
    const newDay = (await newDayButton(page).boundingBox())!;
    const row = (await trigger(page).evaluate((element) =>
      element.closest(".min-h-12")!.getBoundingClientRect().toJSON(),
    )) as DOMRect;
    expect(sheet.x + sheet.width).toBeCloseTo(words.x + words.width, 0);
    expect(sheet.y).toBeCloseTo(row.bottom + 4, 0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(newDay.x);
  });
});

test.describe("a window resized across the row's threshold", () => {
  test("from 360 px to 390, the menu's new day row is no longer drawn and the menu's button takes the focus", async ({
    page,
  }) => {
    await openDay(page, 360);
    await trigger(page).focus();
    // The up arrow opens the menu on its last row, here the new day's.
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: /^New day/ })).toBeFocused();

    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });

  test("from 390 px to 360, the row's new day is no longer drawn and the menu's button takes the focus", async ({
    page,
  }) => {
    await openDay(page, 390);
    await newDayButton(page).focus();
    await expect(newDayButton(page)).toBeFocused();

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(newDayButton(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });
});

test("Escape on the new day with the city's list open closes it, the focus to the city word", async ({
  page,
}) => {
  await openDay(page, 1280);
  await newDayButton(page).click();
  await expect(field(page)).toBeFocused();
  // Back to the button by the keys, past the list's rows and the headline's words.
  for (let presses = 0; presses < 40; presses += 1) {
    if (await newDayButton(page).evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Shift+Tab");
  }
  await expect(newDayButton(page)).toBeFocused();
  await expect(cityWord(page)).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(cityWord(page)).toHaveAttribute("aria-expanded", "false");
  await expect(cityWord(page)).toBeFocused();
});
