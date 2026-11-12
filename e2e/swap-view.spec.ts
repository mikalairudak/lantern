import type { Page } from "@playwright/test";
import { expect, test, waitMs, chooseTheChart } from "./fixtures";
import { VIEW_HELD_AFTER_GESTURE_MS } from "../src/features/day/view-hold";
import { REVEAL_STEP_PX } from "../src/lib/tokens/motion";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/**
 * A swap holds the day under the hand (`docs/decisions.md`, "A row's words go where its bead comes
 * to rest, and rows ease rather than jump"). On a phone the header takes the room its clause and
 * the line's lead need once the finger lifts, so it grows up and out of the screen, the page
 * scrolling by its growth, and the chart stays where the hand is; a laptop holds that room from the
 * start, so there nothing above the hand grows at all. Sampled well past the hold, so a growth the
 * hold let through after it ends is seen. A tap on a bead swaps and opens nothing, though the row's
 * name glides under the finger (`docs/decisions.md`, "The day is drawn as an abacus"); a tap on a
 * name opens its sheet, which comes into view with no frame's jump.
 */

const DAY_TIMEOUT_MS = waitMs(30_000);
/** Sampled for twice the hold after the header's last glide, and the glide's own time. */
const SAMPLED_MS = VIEW_HELD_AFTER_GESTURE_MS * 2 + 1000;
/** Less than this is a rounding, not a move. */
const STILL_PX = 1.5;

/** Kanazawa written whole, and a version at another energy on the first screen. */
async function versionOnFirstScreen(page: Page, scrollTop = 0) {
  await page.goto("/day/kanazawa");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  if (scrollTop > 0) {
    await page.evaluate((top) => window.scrollTo(0, top), scrollTop);
    await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(scrollTop);
  }
  // A version whose swap writes a clause, and its place's name.
  const target = await chart.evaluate((group) => {
    const bead = [...group.querySelectorAll('[role="button"]')].find((each) => {
      const box = each.getBoundingClientRect();
      const label = each.getAttribute("aria-label") ?? "";
      return box.top > 300 && box.bottom < innerHeight - 40 && !label.includes("same energy");
    });
    const box = bead?.getBoundingClientRect();
    const name = (bead?.getAttribute("aria-label") ?? "").split(",")[0] ?? "";
    return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2, name } : null;
  });
  if (!target) throw new Error("No version at another energy on the first screen");
  return { chart, target };
}

/** Starts noting, each frame, where the chart stands and how far the page is scrolled. */
async function sampleFrames(page: Page): Promise<void> {
  await page.evaluate((sampledMs) => {
    const frames: { chartTop: number; scrollY: number }[] = [];
    const watched = window as unknown as { swapFrames: typeof frames };
    watched.swapFrames = frames;
    const group = document.querySelector('[role="group"][aria-label^="The day\'s energy"]');
    const start = performance.now();
    const look = () => {
      frames.push({ chartTop: group?.getBoundingClientRect().top ?? 0, scrollY });
      if (performance.now() - start < sampledMs) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, SAMPLED_MS);
}

async function framesOf(page: Page): Promise<{ chartTop: number; scrollY: number }[]> {
  return page.evaluate(
    () => (window as unknown as { swapFrames: { chartTop: number; scrollY: number }[] }).swapFrames,
  );
}

/** A swap that opens no sheet holds the chart still while the header grows, or not, above it. */
async function expectChartHeld(page: Page, isMobile: boolean): Promise<void> {
  test.setTimeout(DAY_TIMEOUT_MS + SAMPLED_MS + 15_000);
  const { target } = await versionOnFirstScreen(page);
  const header = page.locator("main header").first();
  const headerBefore = (await header.boundingBox())?.height ?? 0;
  await sampleFrames(page);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(SAMPLED_MS + 200);

  const tops = (await framesOf(page)).map(({ chartTop }) => chartTop);
  const [first = 0] = tops;
  const moved = Math.max(...tops.map((top) => Math.abs(top - first)));
  const grew = ((await header.boundingBox())?.height ?? 0) - headerBefore;
  if (isMobile) expect(grew).toBeGreaterThan(STILL_PX);
  else expect(Math.abs(grew)).toBeLessThan(STILL_PX);
  expect(moved).toBeLessThan(STILL_PX);
}

test(
  "a swap holds the chart under the hand while the header takes its room above it",
  { tag: "@frame" },
  async ({ page, isMobile }) => {
    await expectChartHeld(page, isMobile);
  },
);

test.describe("with reduced motion", { tag: "@frame" }, () => {
  test.use({ reducedMotion: "reduce" });

  test("a swap holds the chart under the hand, the header's room taken at once", async ({
    page,
    isMobile,
  }) => {
    await expectChartHeld(page, isMobile);
  });
});

/** A phone's tap on a version's bead: the version is shown, and no sheet opens. */
async function expectSwappedAndNothingOpened(page: Page): Promise<void> {
  test.setTimeout(DAY_TIMEOUT_MS + SAMPLED_MS + 15_000);
  const { target } = await versionOnFirstScreen(page);
  await page.touchscreen.tap(target.x, target.y);
  // The row says the version tapped, its name still closed.
  const name = page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: target.name, expanded: false });
  await expect(name).toBeVisible();
  await page.waitForTimeout(SAMPLED_MS);
  await expect(name).toBeVisible();
  await expect(page.getByRole("region", { name: /^About / })).toHaveCount(0);
}

test("a tap on a version's bead swaps it and opens no sheet, though the name glides under the finger", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "A phone's click comes after the finger lifts, where it lifted");
  await expectSwappedAndNothingOpened(page);
});

test.describe("a tap on a bead, with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("swaps it and opens no sheet", async ({ page, isMobile }) => {
    test.skip(!isMobile, "A phone's click comes after the finger lifts, where it lifted");
    await expectSwappedAndNothingOpened(page);
  });
});

/** Where to tap a stop's name in the screen's lower half, whose sheet runs past its foot. */
async function lowName(page: Page): Promise<{ x: number; y: number }> {
  const name = await page.evaluate(() => {
    const names = [...document.querySelectorAll('ol[aria-label="The day"] li button')];
    const low = names.find((each) => {
      const box = each.getBoundingClientRect();
      return box.top > innerHeight / 2 && box.bottom < innerHeight - 40;
    });
    const box = low?.getBoundingClientRect();
    return box ? { x: box.left + Math.min(box.width / 2, 40), y: box.top + 10 } : null;
  });
  if (!name) throw new Error("No stop's name in the screen's lower half");
  return name;
}

/**
 * The sheet opened lies whole on the screen, and the page scrolled there by no frame's jump.
 * At its margin: its foot where the scroll brought it, its scroll margin from the screen's.
 */
async function expectSheetRevealed(page: Page, isAtMargin = false): Promise<void> {
  const sheet = page.getByRole("region", { name: /^About / });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(SAMPLED_MS + 200);
  const box = await sheet.evaluate((element) => {
    const { top, bottom } = element.getBoundingClientRect();
    const margin = Number.parseFloat(getComputedStyle(element).scrollMarginBottom) || 0;
    return { top, bottom, height: innerHeight, margin };
  });
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.height);
  if (isAtMargin) expect(Math.abs(box.height - box.margin - box.bottom)).toBeLessThan(STILL_PX);
  const scrolls = (await framesOf(page)).map(({ scrollY }) => scrollY);
  const steps = scrolls.slice(1).map((scroll, at) => Math.abs(scroll - (scrolls[at] ?? scroll)));
  expect(Math.max(...steps)).toBeGreaterThan(STILL_PX);
  expect(Math.max(...steps)).toBeLessThanOrEqual(REVEAL_STEP_PX + 1);
}

for (const scrollTop of [0, 120]) {
  test(
    `a tap on a stop's name opens its sheet and brings it into view, from ${scrollTop} px down`,
    { tag: "@frame" },
    async ({ page, isMobile }) => {
      test.skip(!isMobile, "A sheet opened low on a phone's screen runs past its foot");
      test.setTimeout(DAY_TIMEOUT_MS + SAMPLED_MS + 15_000);
      await versionOnFirstScreen(page, scrollTop);
      const name = await lowName(page);
      await sampleFrames(page);
      await page.touchscreen.tap(name.x, name.y);
      await expectSheetRevealed(page);
    },
  );
}

/** Between a swap's tap and a name's: the header has most of its room still to take. */
const WHILE_THE_HEADER_GROWS_MS = 50;

test(
  "a sheet opened while the header grows after a swap lands whole, the growth in its way",
  { tag: "@frame" },
  async ({ page, isMobile }) => {
    test.skip(!isMobile, "On a laptop the header holds its room, and nothing above grows");
    test.setTimeout(DAY_TIMEOUT_MS + SAMPLED_MS + 15_000);
    const { target } = await versionOnFirstScreen(page);
    const header = page.locator("main header").first();
    const headerBefore = (await header.boundingBox())?.height ?? 0;
    await sampleFrames(page);
    await page.touchscreen.tap(target.x, target.y);
    await page.waitForTimeout(WHILE_THE_HEADER_GROWS_MS);
    // Read again once the swap has begun, as the rows stand now.
    const name = await lowName(page);
    await page.touchscreen.tap(name.x, name.y);
    // Its foot at its margin: the reveal read where it stood each frame as the header grew.
    await expectSheetRevealed(page, true);
    expect(((await header.boundingBox())?.height ?? 0) - headerBefore).toBeGreaterThan(STILL_PX);
  },
);
