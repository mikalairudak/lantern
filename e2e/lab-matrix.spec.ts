import { expect, test, waitMs } from "./fixtures";

// --container-phone, --container-abacus and --container-page, at the browser's 16 px rem.
const PHONE_WIDTH = 390;
const ABACUS_WIDTH = 768;
const PAGE_WIDTH = 1152;
// The day stage header's masthead on a laptop: the page's column inside its gutter, measured
// on /day/kyoto at 1280 and 1440 px. The head under it takes the abacus's width from a
// 1024 px screen, and the page's under it, as a phone's run is.
const LAPTOP_HEADER_WIDTH = 1024;
const LAPTOP_SCREEN = 1024;

test.beforeEach(async ({ page }) => {
  await page.goto("/lab/matrix/stream-frames");
});

test("sets a row for every moment, each cell in both themes", async ({ page }) => {
  for (const moment of ["nothing yet", "a duration still growing", "the whole day"]) {
    await expect(page.getByRole("heading", { level: 2, name: moment })).toBeVisible();
  }
  const backgroundOf = (theme: string) =>
    page
      .locator(`[data-theme="${theme}"]`)
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);

  expect(await backgroundOf("light")).not.toBe(await backgroundOf("dark"));
});

test("frames each cell at a phone's width or the abacus's, inside the page", async ({ page }) => {
  // Inside its border, where the component is laid out.
  const cell = page.locator('[data-theme="light"]').first();
  const innerWidthOf = () => cell.evaluate((element) => element.clientWidth);
  expect(await innerWidthOf()).toBe(PHONE_WIDTH);

  await page.getByRole("combobox", { name: "Width" }).selectOption({ label: "Wide screen" });
  expect(await innerWidthOf()).toBe(ABACUS_WIDTH);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

// A 390 px phone inside the page's two 16 px gutters, as the page sets a day on a phone.
const PHONE_PAGE_WIDTH = 358;
/**
 * A cell that reads its day before it draws, as the stop row's, the day stage header's, the
 * light's and a stream frame's do: on the e2e server, alone or in a full run, the stop row's
 * first cell took longer than an assertion's 5 s, and the day stage header's first headline in
 * a full run (2026-11-06).
 */
const CELL_READ = { timeout: waitMs(30_000) };
/**
 * How long a test that opens matrices in turn may take: each page's first cell read, as long as
 * `CELL_READ` allows. Three or four matrices took 14 to 23 s on four workers and 26 to 35 s at
 * twice the CPU, past a test's 30 s (2026-11-06).
 */
function matricesTestMs(matrices: number): number {
  return matrices * CELL_READ.timeout;
}
const PHONE_GUTTER = 16;
/**
 * The chart's parts, a line under the day, the page's foot and a header, whose type still
 * reads the screen. The stop row's first states hold no drawing yet, so its cell is the first
 * one with its chart, read by its role: a row's words hold a crosshair's room unseen, an svg
 * too.
 */
const PHONE_CELL_PARTS = [
  ["stop-row", 'svg[role="group"]', true],
  ["progress-line", ":scope > div > *", false],
  ["foot-line", "footer", false],
  ["written-header", "h1", false],
] as const;

test("sets a phone cell's component inside the page's gutters, as a phone does", async ({
  page,
}) => {
  test.setTimeout(matricesTestMs(PHONE_CELL_PARTS.length));
  for (const [key, part, isDrawn] of PHONE_CELL_PARTS) {
    await page.goto(`/lab/matrix/${key}`);
    const lightCells = page.getByTestId("matrix-grid").locator('[data-theme="light"]');
    const cell = isDrawn
      ? lightCells.filter({ has: page.locator(part) }).first()
      : lightCells.first();
    const component = cell.locator(part).first();
    await expect(component).toBeVisible(CELL_READ);
    const box = await component.evaluate((element) => {
      const within = element.closest('[aria-label$=" theme"]');
      if (!within) return null;
      const edge = within.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(within).borderLeftWidth);
      const { left, width } = element.getBoundingClientRect();
      return { left: left - edge.left - border, width };
    });
    expect(box).toEqual({ left: PHONE_GUTTER, width: PHONE_PAGE_WIDTH });
  }
});

/** The chart's parts, which stand in the abacus column. */
const ABACUS_MATRICES = ["stop-row", "silence", "axis-light"];

test("sets each wide cell at the width its component takes on a laptop", async ({ page }) => {
  // The chart's parts, then the day stage header.
  test.setTimeout(matricesTestMs(ABACUS_MATRICES.length + 1));
  const grid = page.getByTestId("matrix-grid");
  const firstCell = grid.locator('[data-theme="light"]').first();

  for (const key of ABACUS_MATRICES) {
    await page.goto(`/lab/matrix/${key}`);
    await page.getByRole("combobox", { name: "Width" }).selectOption({ label: "Wide screen" });
    expect(await firstCell.evaluate((element) => element.clientWidth)).toBe(ABACUS_WIDTH);
  }

  // The day's masthead stands across the page's column, in its gutter, as on a laptop, the
  // head under it at the plan's width; a phone cell is still a phone's.
  await page.goto("/lab/matrix/written-header");
  const headline = firstCell.getByRole("heading", { level: 1 });
  await expect(headline).toBeVisible(CELL_READ);
  expect(await firstCell.evaluate((element) => element.clientWidth)).toBe(PHONE_WIDTH);
  await page.getByRole("combobox", { name: "Width" }).selectOption({ label: "Wide screen" });
  // Its cells are drawn again at the page's width, each reading its day.
  await expect
    .poll(() => firstCell.evaluate((element) => element.clientWidth), CELL_READ)
    .toBe(PAGE_WIDTH);
  const masthead = firstCell.locator("header > *").first();
  expect(await masthead.evaluate((element) => element.getBoundingClientRect().width)).toBe(
    LAPTOP_HEADER_WIDTH,
  );
  const isLaptop = (page.viewportSize()?.width ?? 0) >= LAPTOP_SCREEN;
  expect(await headline.evaluate((element) => element.getBoundingClientRect().width)).toBe(
    isLaptop ? ABACUS_WIDTH : LAPTOP_HEADER_WIDTH,
  );
});

// The page's gutter, which a word's open list keeps inside its bounds (panel-shift.ts). A
// list shifted to it, as a phone cell's city list is, lands there within the layout's
// rounding.
const LIST_GUTTER = 16;
const LAYOUT_ROUNDING_PX = 0.01;

test("draws the city word's open lists inside their phone cells, and leaves the focus be", async ({
  page,
}) => {
  await page.goto("/lab/matrix/city-word");
  const lists = page.getByTestId("matrix-grid").getByRole("group", { name: "Where" });
  await expect(lists).not.toHaveCount(0);

  // A list drawn open takes no focus, so the page neither moves to it nor marks a row. Read
  // two frames after the lists are drawn, once a list that took the focus would have.
  const settled = await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { focused: document.activeElement?.tagName, scrollY: window.scrollY };
  });
  expect(settled).toEqual({ focused: "BODY", scrollY: 0 });

  // Each keeps the gutter inside its cell, as on a phone, wherever the cell sits on the page.
  for (const list of await lists.all()) {
    const gaps = await list.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const cell = element.closest('[aria-label$=" theme"]')?.getBoundingClientRect();
      return cell ? { left: box.left - cell.left, right: cell.right - box.right } : null;
    });
    expect(gaps?.left).toBeGreaterThanOrEqual(LIST_GUTTER - LAYOUT_ROUNDING_PX);
    expect(gaps?.right).toBeGreaterThanOrEqual(LIST_GUTTER - LAYOUT_ROUNDING_PX);
  }
});

// --text-title's floor, 1.75rem at the browser's 16 px rem.
const PHONE_TITLE_SIZE = "28px";

test("sets a phone cell's title as a phone does, and an abacus cell's as the screen does", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "A phone's screen sets a phone's title too, so only a laptop tells them apart",
  );
  await page.goto("/lab/matrix/start-header");
  const title = page.getByTestId("matrix-grid").locator('[data-theme="light"] h1').first();
  await expect(title).toHaveCSS("font-size", PHONE_TITLE_SIZE);

  await page.getByRole("combobox", { name: "Width" }).selectOption({ label: "Wide screen" });
  const screenTitleSize = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "text-title";
    document.body.append(probe);
    const { fontSize } = getComputedStyle(probe);
    probe.remove();
    return fontSize;
  });
  expect(screenTitleSize).not.toBe(PHONE_TITLE_SIZE);
  await expect(title).toHaveCSS("font-size", screenTitleSize);
});

test("swaps the axes and holds the one left out", async ({ page }) => {
  await page.getByRole("combobox", { name: "Rows" }).selectOption({ label: "day" });
  await page.getByRole("combobox", { name: "Columns" }).selectOption({ label: "day" });
  await page.getByRole("combobox", { name: "moment" }).selectOption({ label: "the whole day" });

  await expect(page.getByRole("heading", { level: 2, name: "Kyoto" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "nothing yet" })).toHaveCount(0);
  await expect(page.getByTestId("open-field").first()).toContainText(
    "Writing alternatives[",
    CELL_READ,
  );
});

/**
 * How long the axis-light matrix is watched once every cell has read its day and drawn: well
 * past any spring's rest. Each chart is watched from the frame it first draws.
 */
const WATCH_MS = 4000;
/** Less than this is a sub-pixel rounding, not a glide. */
const STILL_PX = 0.5;

test(
  "draws a whole day's cells at their own end from the first frame, with motion on",
  { tag: "@frame" },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // Every chart's least and most height, from the frame it first draws until it is read.
    await page.addInitScript(() => {
      const heights = new Map<number, { least: number; most: number }>();
      (window as unknown as { chartHeights: typeof heights }).chartHeights = heights;
      const tick = () => {
        document.querySelectorAll('svg[role="group"]').forEach((chart, index) => {
          const height = chart.getBoundingClientRect().height;
          const seen = heights.get(index);
          if (!seen) heights.set(index, { least: height, most: height });
          else
            heights.set(index, {
              least: Math.min(seen.least, height),
              most: Math.max(seen.most, height),
            });
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/lab/matrix/axis-light");
    // Its cells read their day before they draw: a watch timed from the page's start would see
    // no chart drawn on a page whose reading took longer than the watch.
    const grid = page.getByTestId("matrix-grid");
    await expect(grid.locator('svg[role="group"]').first()).toBeVisible(CELL_READ);
    await expect(grid.getByText("Reading the day…")).toHaveCount(0, CELL_READ);
    await page.waitForTimeout(WATCH_MS);

    const moves = await page.evaluate(() =>
      [
        ...(
          window as unknown as { chartHeights: Map<number, { least: number; most: number }> }
        ).chartHeights.values(),
      ].map(({ least, most }) => most - least),
    );
    expect(moves.length).toBeGreaterThan(0);
    // Measured before the fix: the whole cells glided 45 and 66 px from the asked end.
    expect(Math.max(...moves)).toBeLessThan(STILL_PX);
  },
);
