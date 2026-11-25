import { expect, test, type CDPSession, type Locator, type Page, waitMs } from "./fixtures";
import { seeWrittenDay } from "./live-page";
import { writtenDayAt } from "../src/lib/days/written/days";

/**
 * The day's plan: a day opens on its plan, lit by its light; the energy's five words move it; the
 * masthead's menu holds the ways to take it along; the chart is one press away and kept.
 */

const DAY_TIMEOUT_MS = waitMs(30_000);

test.use({ reducedMotion: "reduce" });

/** The day is written and still: the energy's words, which wait until then, can be chosen. */
async function dayIsWhole(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "lively" })).toBeEnabled({
    timeout: DAY_TIMEOUT_MS,
  });
}

test("a written day opens on its plan, lit, and its energy moves it", async ({ page }) => {
  await page.goto("/day/kanazawa");
  const plan = page.getByRole("list", { name: "The day, to read" });
  await dayIsWhole(page);
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "read");
  await expect(page.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-pressed", "true");

  // The rail of the day's light, golden hour in the lamp, and the sun's minutes in the list.
  await expect(plan.locator("line.stroke-lamp").first()).toBeAttached();
  await expect(plan.getByText("Sunset")).toBeVisible();

  const names = () => plan.getByRole("heading", { level: 2 }).allTextContents();
  const before = await names();
  await page.getByRole("button", { name: "lively" }).click();
  await expect.poll(names).not.toEqual(before);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("lively");
  await expect(page.getByText(/(click|tap) a word to change it/)).toBeHidden();
});

test("after dark the plan's beads are lit, in the first HTML, and every bead shows under forced colours", async ({
  page,
}) => {
  // Lit by the styles alone, in the HTML a page read without its script shows.
  const html = await (await page.request.get("/day/kanazawa")).text();
  expect(html).toContain('data-bead="lit"');

  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  const beads = await plan.locator("[data-bead]").evaluateAll((all) =>
    all.map((bead) => ({
      isLit: bead.getAttribute("data-bead") === "lit",
      isDotted: bead.parentElement?.querySelector("svg line")?.hasAttribute("stroke-dasharray"),
    })),
  );
  expect(beads.some(({ isLit }) => isLit)).toBe(true);
  for (const bead of beads) expect(bead.isLit).toBe(bead.isDotted);

  await page.emulateMedia({ forcedColors: "active" });
  const drawn = await plan.locator("[data-bead]").evaluateAll((all) =>
    all.map((bead) => {
      const dot = getComputedStyle(bead.lastElementChild!);
      const glow = bead.querySelector(".bg-lamp-glow");
      return {
        border: dot.borderTopWidth,
        isText: dot.borderTopColor === getComputedStyle(document.body).color,
        isGlowDrawn: glow !== null && getComputedStyle(glow).display !== "none",
      };
    }),
  );
  for (const bead of drawn)
    expect(bead).toEqual({ border: "4px", isText: true, isGlowDrawn: false });
});

test("the masthead's menu holds the three ways along, and the chart is kept once chosen", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  await page.getByRole("button", { name: "Take this day" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    /Copy the link/,
    /Add to your calendar/,
    /Walk it in Google Maps/,
  ]);
  const box = await menu.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Chart" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "chart");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "chart");
});

test("a stop swipes along its versions, from a drag and from the keys", async ({ page }) => {
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  const names = () => plan.getByRole("heading", { level: 2 }).allTextContents();
  const stop = plan.locator('[role="group"][tabindex="0"]').nth(1);
  await stop.scrollIntoViewIfNeeded();
  const before = await names();

  // A short drag springs back; one past a third of the stop takes the version beside it.
  const box = (await stop.boundingBox())!;
  const y = box.y + 12;
  await page.mouse.move(box.x + box.width - 16, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 46, y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(names).toEqual(before);
  await expect.poll(async () => (await stop.boundingBox())?.x).toBe(box.x);
  await page.mouse.move(box.x + box.width - 16, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 16, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(names).not.toEqual(before);

  // The arrow key on the stop takes it back, and the focus stays on the stop.
  await stop.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(names).toEqual(before);
  await expect(stop).toBeFocused();
});

/** Kanazawa's coffee stop as written, and the livelier version beside it. */
const WRITTEN_COFFEE = "Coffee in Kenrokumachi";
const LIVELIER_COFFEE = "Coffee near Hirosaka";
/** A livelier version shorter than the stop it replaces, and a quieter one. */
const LIVELIER_GRILLS = "Seafood Grills in Omicho";
const QUIETER_WORKSHOP = "Utatsuyama Craft Workshop Hill";
/** How far above the scroll padding's edge a stop's foot is scrolled, its top out of view. */
const UNDER_BAR_PX = 10;
/** How far, rounded, a stop brought to the plan's bar's edge may sit off it. */
const BAR_EDGE_PX = 2;

/** Kanazawa's written day, seen before, so it opens whole. */
async function openSeenKanazawa(page: Page): Promise<void> {
  await seeWrittenDay(page, "kanazawa", writtenDayAt("kanazawa")!.itinerary);
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
}

test("an arrow pressed hands the focus to its stop once the stop carries the version taken", async ({
  page,
}) => {
  await openSeenKanazawa(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  // The name each stop carries as the focus reaches it, which is what a screen reader says.
  await page.evaluate(() => {
    const watched = window as unknown as { focusedNames: string[] };
    watched.focusedNames = [];
    document.addEventListener(
      "focusin",
      (event) => {
        const target = event.target as HTMLElement;
        if (target.getAttribute("role") === "group") {
          watched.focusedNames.push(target.getAttribute("aria-label") ?? "");
        }
      },
      true,
    );
  });

  await plan.getByRole("button", { name: `Livelier: ${LIVELIER_COFFEE}` }).focus();
  await page.keyboard.press("Enter");
  const stop = plan.getByRole("group", { name: LIVELIER_COFFEE });
  await expect(stop).toBeFocused();
  expect(
    await page.evaluate(() => (window as unknown as { focusedNames: string[] }).focusedNames),
  ).toEqual([LIVELIER_COFFEE]);

  // The arrow keys on the stop swap it where the focus already is.
  await page.keyboard.press("ArrowLeft");
  await expect(plan.getByRole("group", { name: WRITTEN_COFFEE })).toBeFocused();
});

/** Where the plan's bar, stuck at the window's top, ends on screen. */
async function barBottomOf(page: Page): Promise<number> {
  return page.getByRole("group", { name: "How lively the day is" }).evaluate((group) => {
    let bar: Element | null = group;
    while (bar && getComputedStyle(bar).position !== "sticky") bar = bar.parentElement;
    return bar!.getBoundingClientRect().bottom;
  });
}

// The bar takes one row on a phone 390 px wide and wraps to two on one 320 px wide.
for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`${viewport.width} px wide`, () => {
    test.use({ viewport });

    test("an arrow pressed brings its stop out from under the plan's bar the least way", async ({
      page,
    }) => {
      await openSeenKanazawa(page);
      const plan = page.getByRole("list", { name: "The day, to read" });
      const arrow = plan.getByRole("button", { name: `Livelier: ${LIVELIER_GRILLS}` });
      // The page's scroll padding is the edge that focus scrolled to stays clear of.
      const barEdge = await page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
      );
      await arrow.evaluate(
        (element, { barEdge, underBar }) => {
          const stop = element.parentElement!.parentElement!.querySelector('[role="group"]')!;
          const { top, height } = stop.getBoundingClientRect();
          window.scrollBy(0, top + height - barEdge + underBar);
          (element as HTMLElement).focus({ preventScroll: true });
        },
        { barEdge, underBar: UNDER_BAR_PX },
      );
      await page.keyboard.press("Enter");

      // The shorter version taken comes to the edge the scroll padding keeps, not to the
      // middle of the window, and the bar, on one row or two, covers none of it.
      const stop = plan.getByRole("group", { name: LIVELIER_GRILLS });
      await expect(stop).toBeFocused();
      await expect
        .poll(async () => Math.abs((await stop.boundingBox())!.y - barEdge))
        .toBeLessThanOrEqual(BAR_EDGE_PX);
      expect((await stop.boundingBox())!.y).toBeGreaterThanOrEqual(await barBottomOf(page));
    });
  });
}

test("an arrow pressed while the stop leans scrolls nothing sideways", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSeenKanazawa(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  const arrow = plan.getByRole("button", { name: `Quieter: ${QUIETER_WORKSHOP}`, exact: true });
  await arrow.scrollIntoViewIfNeeded();
  // The keyboard reaching the arrow leans the stop, past the edge of the box that holds it.
  await page.keyboard.press("Shift");
  await arrow.focus();
  const leaned = arrow.locator("xpath=../..").locator('[role="group"]');
  await expect
    .poll(() => leaned.evaluate((stop) => getComputedStyle(stop).transform))
    .not.toBe("none");
  await page.keyboard.press("Enter");

  const stop = plan.getByRole("group", { name: QUIETER_WORKSHOP, exact: true });
  await expect(stop).toBeFocused();
  expect(await stop.evaluate((element) => element.parentElement!.scrollLeft)).toBe(0);
});

/** Kanazawa's market stop as written, taller than the livelier version beside it. */
const WRITTEN_BOWLS = "Seafood Bowls at Omicho Market";
/** The most a stop the focus is handed to may move in a frame ("Three pixels a frame"). */
const MOST_PX_PER_FRAME = 3;
/** How many frames in a row a row stands still before it counts as at rest. */
const STILL_FRAMES = 10;

/** Waits until an element's box has stood still on screen for `STILL_FRAMES` frames. */
async function untilStill(element: Locator): Promise<void> {
  await element.evaluate(
    (target, stillFrames) =>
      new Promise<void>((resolve) => {
        let last = "";
        let still = 0;
        const read = () => {
          const { top, height } = target.getBoundingClientRect();
          const now = `${top.toFixed(1)} ${height.toFixed(1)}`;
          still = now === last ? still + 1 : 0;
          last = now;
          if (still >= stillFrames) resolve();
          else requestAnimationFrame(read);
        };
        requestAnimationFrame(read);
      }),
    STILL_FRAMES,
  );
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`with motion, ${viewport.width} px wide`, { tag: "@frame" }, () => {
    test.use({ reducedMotion: "no-preference", viewport });

    test("an arrow pressed at the window's foot hands the focus to a taller version, its stop moving under 3 px a frame", async ({
      page,
    }) => {
      await openSeenKanazawa(page);
      const plan = page.getByRole("list", { name: "The day, to read" });
      // The shorter version first, so the arrow back names the stop as written, the taller.
      await plan.getByRole("button", { name: `Livelier: ${LIVELIER_GRILLS}`, exact: true }).focus();
      await page.keyboard.press("Enter");
      const stop = plan.getByRole("group", { name: LIVELIER_GRILLS, exact: true });
      await expect(stop).toBeFocused();
      // The stop's row, by its place in the plan, which the version taken does not change.
      const at = await stop.evaluate((group) => {
        const item = group.closest('[aria-label="The day, to read"] > li')!;
        return [...item.parentElement!.children].indexOf(item);
      });
      const row = plan.locator(":scope > li").nth(at);
      await untilStill(row);

      // The arrow back at the window's foot, reached by Tab from the stop.
      const back = plan.getByRole("button", { name: `Quieter: ${WRITTEN_BOWLS}`, exact: true });
      await back.evaluate((arrow) => {
        window.scrollBy(0, arrow.getBoundingClientRect().bottom - window.innerHeight);
      });
      await page.keyboard.press("Tab");
      await expect(back).toBeFocused();
      await untilStill(row);

      // Where the stop's box stands on screen, every frame from the press on.
      await stop.evaluate((group) => {
        const tops: number[] = [];
        (window as unknown as { tops: number[] }).tops = tops;
        const box = group.parentElement!;
        const sample = () => {
          tops.push(box.getBoundingClientRect().top);
          requestAnimationFrame(sample);
        };
        sample();
      });
      await page.keyboard.press("Enter");
      const written = plan.getByRole("group", { name: WRITTEN_BOWLS, exact: true });
      await expect(written).toBeFocused();
      await untilStill(row);

      const tops = await page.evaluate(() => (window as unknown as { tops: number[] }).tops);
      const steps = tops.slice(1).map((top, at) => Math.abs(top - tops[at]!));
      expect(
        Math.max(...steps),
        `steps ${steps.map((step) => step.toFixed(1)).join(", ")}`,
      ).toBeLessThanOrEqual(MOST_PX_PER_FRAME);
    });
  });
}

/** A finger on the page at a point, moved by `by` in steps, and lifted unless it is to stay. */
async function swipeOn(
  cdp: CDPSession,
  from: { x: number; y: number },
  by: { x: number; y: number },
  isLifted = true,
): Promise<void> {
  const STEPS = 12;
  const at = (step: number) => [
    { id: 1, x: from.x + (by.x * step) / STEPS, y: from.y + (by.y * step) / STEPS },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
  for (let step = 1; step <= STEPS; step++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(step) });
  }
  if (isLifted) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("a finger drags a stop by its name or its line, and a scroll that starts on it pans the page", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "a finger needs a touch screen");
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  const stop = plan.locator('[role="group"][tabindex="0"]').nth(1);
  await stop.scrollIntoViewIfNeeded();
  const cdp = await page.context().newCDPSession(page);
  const nameOf = () => stop.getAttribute("aria-label");
  const xOf = () => stop.evaluate((group) => new DOMMatrix(getComputedStyle(group).transform).m41);
  /** Toward the side with a version: right when one waits on the stop's left. */
  const towardAVersion = async () =>
    (
      await stop.locator("xpath=../..").getByRole("button", { name: /./ }).first().textContent()
    )?.startsWith("←")
      ? 1
      : -1;
  const startOn = async (words: Locator) => {
    const box = (await words.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const width = (await stop.boundingBox())!.width;

  for (const words of [stop.locator("h2"), stop.locator("h2 + p")]) {
    const before = await nameOf();
    const way = await towardAVersion();
    // Short of a third it follows the finger while held, and goes home with nothing taken.
    const from = await startOn(words);
    await swipeOn(cdp, from, { x: way * width * 0.2, y: 0 }, false);
    await expect.poll(xOf).toBeCloseTo(way * width * 0.2, 0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(xOf).toBe(0);
    expect(await nameOf()).toBe(before);
    // Past a third it takes the version on the side it came from.
    await swipeOn(cdp, await startOn(words), { x: way * width * 0.5, y: 0 });
    await expect.poll(nameOf).not.toBe(before);
    await expect.poll(xOf).toBe(0);
  }

  // A finger moving up from the stop's name scrolls the page and leaves the stop where it is.
  const shown = await nameOf();
  const scrolled = await page.evaluate(() => window.scrollY);
  await swipeOn(cdp, await startOn(stop.locator("h2")), { x: 2, y: -200 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled + 50);
  expect(await nameOf()).toBe(shown);
  expect(await xOf()).toBe(0);
});

/** A finger pressed at `from`, moved through each point given from there, and lifted. */
async function touchAlong(
  cdp: CDPSession,
  from: { x: number; y: number },
  path: readonly { x: number; y: number }[],
): Promise<void> {
  const at = ({ x, y }: { x: number; y: number }) => [{ id: 1, x: from.x + x, y: from.y + y }];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: at({ x: 0, y: 0 }),
  });
  for (const point of path) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(point) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("a finger that drifts down or up, or sets off at 45 degrees, before it swipes across still drags", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "a finger needs a touch screen");
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  const stop = plan.locator('[role="group"][tabindex="0"]').nth(1);
  await stop.scrollIntoViewIfNeeded();
  const cdp = await page.context().newCDPSession(page);
  const nameOf = () => stop.getAttribute("aria-label");
  const xOf = () => stop.evaluate((group) => new DOMMatrix(getComputedStyle(group).transform).m41);
  const width = (await stop.boundingBox())!.width;
  const SWIPE_STEPS = 12;
  const DRIFT_STEPS = 4;
  /** A start on the stop's name, and toward the side with a version: right when one is on the left. */
  const setOff = async () => {
    const box = (await stop.locator("h2").boundingBox())!;
    const arrow = stop.locator("xpath=../..").getByRole("button", { name: /./ }).first();
    const way = (await arrow.textContent())?.startsWith("←") ? 1 : -1;
    return { from: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, way };
  };
  /** Half the stop's width across, in steps, from where the drift left the finger. */
  const acrossFrom = (way: number, start: { x: number; y: number }) =>
    Array.from({ length: SWIPE_STEPS }, (_, step) => ({
      x: start.x + (way * width * 0.5 * (step + 1)) / SWIPE_STEPS,
      y: start.y,
    }));

  for (const drift of [8, -8, 12, -12]) {
    const before = await nameOf();
    const { from, way } = await setOff();
    const down = Array.from({ length: DRIFT_STEPS }, (_, step) => ({
      x: 0,
      y: (drift * (step + 1)) / DRIFT_STEPS,
    }));
    await touchAlong(cdp, from, [...down, ...acrossFrom(way, { x: 0, y: drift })]);
    await expect.poll(nameOf, { message: `a drift of ${drift} px` }).not.toBe(before);
    await expect.poll(xOf).toBe(0);
  }

  // Exactly as far across as down at first, then on across. Past the browser's touch slop, some
  // 11 to 15 px in Chromium, a start that is not mostly across is the page's pan, and the page
  // takes the pointer with `pointercancel`; within it, the finger is the stop's to turn.
  const before = await nameOf();
  const { from, way } = await setOff();
  const diagonal = Array.from({ length: DRIFT_STEPS }, (_, step) => ({
    x: way * 2 * (step + 1),
    y: 2 * (step + 1),
  }));
  await touchAlong(cdp, from, [...diagonal, ...acrossFrom(way, { x: way * 8, y: 8 })]);
  await expect.poll(nameOf).not.toBe(before);
});

/** Each stop's versions line on the plan: its column's box and its arrows' boxes, by side. */
async function versionLinesOf(page: Page) {
  const plan = page.getByRole("list", { name: "The day, to read" });
  return plan.locator('[role="group"]').evaluateAll((stops) =>
    stops.map((stop) => {
      const words = stop.parentElement!.parentElement!;
      const column = words.getBoundingClientRect();
      const arrows = [...words.querySelectorAll("button[aria-label]")].map((arrow) => {
        const box = arrow.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(arrow).lineHeight);
        return {
          isLeft: arrow.textContent?.startsWith("←") ?? false,
          left: box.left - column.left,
          right: column.right - box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          lines: Math.round(arrow.firstElementChild!.getBoundingClientRect().height / lineHeight),
        };
      });
      return { column: column.width, arrows };
    }),
  );
}

/** The gap between two versions that share a line: `gap-3`. */
const ARROWS_GAP_PX = 12;
/** A screen's width, rounded, that a box may sit off an edge by. */
const EDGE_PX = 1;

test("versions share a line when both fit, and otherwise take a line each, each on its side", async ({
  page,
}) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/day/barcelona");
    // Barcelona's day is lively, so its energy word names the button the other tests wait on.
    await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    for (const { column, arrows } of await versionLinesOf(page)) {
      const left = arrows.find(({ isLeft }) => isLeft);
      const right = arrows.find(({ isLeft }) => !isLeft);
      // Each stands on its own side, whatever line it takes.
      if (left) expect(left.left).toBeLessThanOrEqual(EDGE_PX);
      if (right) expect(right.right).toBeLessThanOrEqual(EDGE_PX);
      if (!left || !right) continue;
      const isShared = Math.abs(left.top - right.top) <= EDGE_PX;
      // One line exactly when both fit on it with the gap between them.
      const wouldFit = left.width + right.width + ARROWS_GAP_PX <= column + EDGE_PX;
      if (isShared) expect(wouldFit).toBe(true);
      else {
        expect(right.top).toBeGreaterThanOrEqual(left.bottom);
        // Two that would fit share a line, so a stacked pair of one line each never fits.
        if (left.lines === 1 && right.lines === 1) expect(wouldFit).toBe(false);
        // Stacked, each takes its words' width, up to the column's.
        expect(left.lines === 1 || left.width >= column - EDGE_PX).toBe(true);
        expect(right.lines === 1 || right.width >= column - EDGE_PX).toBe(true);
      }
      if (width === 1280) expect(isShared).toBe(true);
    }
    if (width === 390) {
      // The longest name a written day puts on the left stands on one line beside its arrow.
      const longest = page.getByRole("button", { name: /Cocktails along Carrer dels Assaonadors/ });
      const lines = await longest.evaluate(
        (arrow) =>
          arrow.firstElementChild!.getBoundingClientRect().height /
          parseFloat(getComputedStyle(arrow).lineHeight),
      );
      expect(Math.round(lines)).toBe(1);
    }
  }
});

/** Two arrows' press targets: how tall each is, and where a press passes from one to the other. */
interface TargetPair {
  isStacked: boolean;
  left: number;
  right: number;
  handOverFromMiddle: number;
  isOverlapping: boolean;
}

/** The least a version's arrow may be pressed over, down through it, in px. */
const ARROW_TARGET_PX = 31;

test("versions' arrows each keep a press target of their own, stacked or side by side", async ({
  page,
}) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/day/barcelona");
    await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const pairs = await page
      .getByRole("list", { name: "The day, to read" })
      .locator('[role="group"]')
      .evaluateAll((stops): TargetPair[] =>
        stops.flatMap((stop): TargetPair[] => {
          const [left, right] = [...stop.parentElement!.parentElement!.querySelectorAll("button")];
          if (!left || !right) return [];
          left.scrollIntoView({ block: "center" });
          const a = left.getBoundingClientRect();
          const b = right.getBoundingClientRect();
          const hit = (x: number, y: number) => {
            const button = document.elementFromPoint(x, y)?.closest("button");
            return button === left ? "left" : button === right ? "right" : null;
          };
          /** How far down through `x` each arrow takes a press, sampled every quarter pixel. */
          const down = (x: number) => {
            const reach = { left: 0, right: 0, handOver: Number.NaN };
            for (let y = a.top - 16; y <= b.bottom + 16; y += 0.25) {
              const side = hit(x, y);
              if (side) reach[side] += 0.25;
              if (side === "right" && Number.isNaN(reach.handOver)) reach.handOver = y;
            }
            return reach;
          };
          const isStacked = b.top >= a.bottom - 1;
          if (isStacked) {
            // Down the stretch where one stands over the other, or through each alone.
            const from = Math.max(a.left, b.left);
            const to = Math.min(a.right, b.right);
            const shared = to - from > 8 ? down(from + 4) : null;
            return [
              {
                isStacked,
                left: shared?.left ?? down(a.left + a.width / 2).left,
                right: shared?.right ?? down(b.left + b.width / 2).right,
                handOverFromMiddle: shared ? shared.handOver - (a.bottom + b.top) / 2 : 0,
                isOverlapping: false,
              },
            ];
          }
          // Side by side, across the gap at the line's middle: never both at one point.
          let lastLeft = Number.NEGATIVE_INFINITY;
          let firstRight = Number.POSITIVE_INFINITY;
          const y = a.top + a.height / 2;
          for (let x = a.right - 8; x <= b.left + 8; x += 0.25) {
            const side = hit(x, y);
            if (side === "left") lastLeft = x;
            if (side === "right") firstRight = Math.min(firstRight, x);
          }
          return [
            {
              isStacked,
              left: down(a.left + a.width / 2).left,
              right: down(b.left + b.width / 2).right,
              handOverFromMiddle: 0,
              isOverlapping: firstRight <= lastLeft,
            },
          ];
        }),
      );
    expect(pairs.some(({ isStacked }) => isStacked)).toBe(true);
    for (const pair of pairs) {
      expect(pair.left).toBeGreaterThanOrEqual(ARROW_TARGET_PX);
      expect(pair.right).toBeGreaterThanOrEqual(ARROW_TARGET_PX);
      // Stacked, the press passes from one to the other at the middle of the gap between them.
      expect(Math.abs(pair.handOverFromMiddle)).toBeLessThanOrEqual(1);
      expect(pair.isOverlapping).toBe(false);
    }
  }
});
