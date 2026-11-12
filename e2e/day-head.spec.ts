import { expect, test, type Page, waitMs } from "./fixtures";

// The day's head takes the plan's width from a laptop's, in both views, under a masthead at
// the page's (`docs/design-direction.md`, "The day page").

const DAY_TIMEOUT_MS = waitMs(30_000);
/** `--container-abacus` at the browser's 16 px rem, which grows only past 1440 px. */
const PLAN_WIDTH = 768;
const LAPTOP_WIDTHS = [1024, 1280, 1440];
/** 1023 px: the page is wider than the plan there, so the head's width is the screen's to set. */
const NARROW_WIDTHS = [390, 768, 1023];
const SCREEN_HEIGHT = 900;
/** Nafplio's line about the day is the longest of the written days'. */
const LONGEST_DAY = "/day/nafplio";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Head {
  masthead: Box;
  room: Box;
  /** Every line of the head a visitor sees, top to bottom: the sentence, the day's, the facts. */
  lines: Box[];
  /** The plan's or the chart's switch, over the day. */
  switch: Box | null;
}

/** The head as it stands: the live header, its masthead, its room and its seen lines. */
function headOf(page: Page): Promise<Head> {
  return page.evaluate(() => {
    const boxOf = (element: Element): Box => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const header = [...document.querySelectorAll("header")].find(
      (each) => !each.hasAttribute("aria-hidden") && each.querySelector("h1") !== null,
    );
    const masthead = header?.firstElementChild;
    const room = masthead?.nextElementSibling;
    if (!header || !masthead || !room) throw new Error("The day has no head");
    const lines = [...room.querySelectorAll("h1, p")].filter(
      (line) => line.closest(".invisible") === null && !line.classList.contains("sr-only"),
    );
    const viewSwitch = document.querySelector('[role="group"][aria-label="View"]');
    return {
      masthead: boxOf(masthead),
      room: boxOf(room),
      lines: lines.map(boxOf),
      switch: viewSwitch ? boxOf(viewSwitch) : null,
    };
  });
}

async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/** Two frames, so a view's styles have been laid out and painted. */
function afterTwoFrames(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function chooseView(page: Page, view: "Plan" | "Chart"): Promise<void> {
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: view, exact: true })
    .click();
  await afterTwoFrames(page);
}

test.use({ reducedMotion: "reduce" });

test.beforeEach(({ isMobile }) => {
  // Each test sets the screen's width itself; the phone's run would repeat the desktop's.
  test.skip(isMobile, "the widths are set by the test");
});

for (const width of LAPTOP_WIDTHS) {
  test(`at ${width} px the head takes the plan's width in both views, and the switch moves none of its lines`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: SCREEN_HEIGHT });
    await page.goto(LONGEST_DAY);
    await waitForTheDay(page);

    const plan = await headOf(page);
    expect(plan.room.width).toBe(PLAN_WIDTH);
    expect(plan.room.x).toBe(plan.masthead.x);
    // The masthead keeps the page's width; the head ends where the plan's switch does.
    expect(plan.masthead.width).toBeGreaterThan(PLAN_WIDTH);
    expect(plan.switch).not.toBeNull();
    expect(plan.room.x + plan.room.width).toBe(plan.switch!.x + plan.switch!.width);

    await chooseView(page, "Chart");
    const chart = await headOf(page);
    expect(chart.room).toEqual(plan.room);
    expect(chart.lines).toEqual(plan.lines);

    await chooseView(page, "Plan");
    expect((await headOf(page)).lines).toEqual(plan.lines);
  });
}

for (const width of NARROW_WIDTHS) {
  test(`at ${width} px the head stands across the page, as its masthead does`, async ({ page }) => {
    await page.setViewportSize({ width, height: SCREEN_HEIGHT });
    await page.goto(LONGEST_DAY);
    await waitForTheDay(page);

    const head = await headOf(page);
    expect(head.room.x).toBe(head.masthead.x);
    expect(head.room.width).toBe(head.masthead.width);
  });
}

test("a written day's head stands at its width in the first HTML, and hydration moves nothing", async ({
  browser,
}) => {
  const screen = { width: 1280, height: SCREEN_HEIGHT };

  // The first HTML as a reader without the page's script has it.
  const unscripted = await browser.newContext({ javaScriptEnabled: false, viewport: screen });
  const htmlPage = await unscripted.newPage();
  await htmlPage.goto(LONGEST_DAY);
  const html = await headOf(htmlPage);
  await unscripted.close();

  // A day this device has seen opens whole from its first HTML; the head's box is sampled
  // every frame from the page's start, through hydration, until the day rests.
  const context = await browser.newContext({ viewport: screen, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(LONGEST_DAY);
  await waitForTheDay(page);
  await page.addInitScript(() => {
    const frames: Box[] = [];
    (window as unknown as { roomFrames: Box[] }).roomFrames = frames;
    const sample = () => {
      const header = [...document.querySelectorAll("header")].find(
        (each) => !each.hasAttribute("aria-hidden") && each.querySelector("h1") !== null,
      );
      const room = header?.firstElementChild?.nextElementSibling;
      if (room) {
        const { x, y, width, height } = room.getBoundingClientRect();
        frames.push({ x, y, width, height });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.reload();
  await waitForTheDay(page);
  await afterTwoFrames(page);
  const frames = await page.evaluate(() => (window as unknown as { roomFrames: Box[] }).roomFrames);
  const rest = await headOf(page);
  await context.close();

  expect(html.room.width).toBe(PLAN_WIDTH);
  expect({ x: html.room.x, width: html.room.width }).toEqual({
    x: rest.room.x,
    width: rest.room.width,
  });
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter((frame) => JSON.stringify(frame) !== JSON.stringify(rest.room))).toEqual([]);
});
