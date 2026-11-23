import { SCALE_ARROWS_MIN_REMS, SCALE_NAME_MIN_REMS } from "../src/features/abacus/chart-axes";
import { CHART } from "../src/features/abacus/geometry";
import { DEFAULT_ROOT_PX } from "../src/lib/tokens/root";
import {
  expect,
  test,
  type JSHandle,
  type Locator,
  type Page,
  waitMs,
  chooseTheChart,
} from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const CURVE_NAME = "drag the curve";
/**
 * Lantern promises 390 px and up; a 320 px phone is a fall-back that must still read, so the
 * energy scale's words drop their arrows there.
 */
const SMALL_PHONE = { width: 320, height: 700 };
/** Phones narrow enough to test the scale's words, yet wide enough to keep their arrows. */
const ARROWED_WIDTHS = [360, 390];
const PHONE_HEIGHT = 844;
/**
 * What a phone's width gives the scale at the default text size: the page's gutters, a rem
 * either side, and the chart's room beside its lanes, the time axis on the left and the
 * beads' reach on the right.
 */
const PHONE_BESIDE_SCALE_PX =
  2 * DEFAULT_ROOT_PX + CHART.axisWidth + CHART.laneInsetStart + CHART.laneInsetEnd;
/** The narrowest phone whose scale spans this many rems, in whole pixels. */
function phoneWidthFor(rems: number): number {
  return Math.ceil(rems * DEFAULT_ROOT_PX) + PHONE_BESIDE_SCALE_PX;
}
/**
 * Where the arrows go: narrower than the arrows' least span, the gap beside them falls under
 * one em, too tight to read as a gap (`SCALE_ARROWS_MIN_REMS`).
 */
const FIRST_ARROWED_WIDTH = phoneWidthFor(SCALE_ARROWS_MIN_REMS);
const LAST_ARROWLESS_WIDTH = FIRST_ARROWED_WIDTH - 1;
/**
 * Where the curve's name first stands between the arrowless end words (`SCALE_NAME_MIN_REMS`).
 * Narrower, the scale keeps its two end words alone.
 */
const FIRST_NAMED_WIDTH = phoneWidthFor(SCALE_NAME_MIN_REMS);
/**
 * The least room between two of the scale's words, so they are told apart at a glance and
 * each stands apart under a finger.
 */
const MIN_CAPTION_GAP_PX = 8;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** How long after the day can be dragged the ring that invites the first drag may take. */
const INVITATION_TIMEOUT_MS = 10_000;

/** Waits for the day to be written, ready to drag. */
async function waitForTheDayWritten(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/** Waits for the day to be written and its curve named on the scale, ready to drag. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await expect(page.getByText(CURVE_NAME, { exact: true }).filter({ visible: true })).toBeVisible();
}

/** The gaps between the scale's three words, left to right. */
async function captionGaps(page: Page, quieter: string, livelier: string): Promise<number[]> {
  const boxes = await Promise.all(
    [quieter, CURVE_NAME, livelier].map(async (text) => {
      const box = await page
        .getByText(text, { exact: true })
        .filter({ visible: true })
        .boundingBox();
      if (!box) throw new Error(`"${text}" did not render`);
      return box;
    }),
  );
  return boxes.slice(1).map((box, index) => {
    const before = boxes[index];
    return before ? box.x - (before.x + before.width) : 0;
  });
}

for (const [width, quieter, livelier] of [
  [LAST_ARROWLESS_WIDTH, "quieter", "livelier"],
  [FIRST_ARROWED_WIDTH, "← quieter", "livelier →"],
] as const) {
  test(`on a ${width} px phone the energy scale's end words read "${quieter}" and "${livelier}"`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await page.goto("/day/kanazawa");

    await expect(page.getByText(quieter, { exact: true }).filter({ visible: true })).toBeVisible({
      timeout: DAY_TIMEOUT_MS,
    });
    await expect(page.getByText(livelier, { exact: true }).filter({ visible: true })).toBeVisible();
  });
}

test("on a 320 px phone the energy scale keeps its two end words on their lanes, and the ring shows what to drag", async ({
  page,
}) => {
  await page.setViewportSize(SMALL_PHONE);
  await page.goto("/day/kanazawa");

  await expect(page.getByText("quieter", { exact: true }).filter({ visible: true })).toBeVisible({
    timeout: DAY_TIMEOUT_MS,
  });
  await expect(page.getByText("livelier", { exact: true }).filter({ visible: true })).toBeVisible();

  await waitForTheDayWritten(page);

  // Too narrow for the curve's name 8 px clear of both: the end words stand alone, each on its
  // end lane, and the ring that invites the first drag says what moves.
  await expect(page.locator("[data-invitation] circle")).toBeVisible({
    timeout: INVITATION_TIMEOUT_MS,
  });
  await expect(page.getByText(CURVE_NAME, { exact: true }).filter({ visible: true })).toHaveCount(
    0,
  );
  const ends = await page.evaluate(() => {
    const ticks = [...document.querySelectorAll('svg[role="group"] line.stroke-line')]
      .map((tick) => tick.getBoundingClientRect())
      .filter((tick) => tick.height > 0 && tick.height < 20);
    const word = (text: string) =>
      [...document.querySelectorAll("span")]
        .find((each) => each.textContent?.trim() === text && each.getBoundingClientRect().width > 0)
        ?.getBoundingClientRect();
    const lanes = ticks.map((tick) => tick.left + tick.width / 2);
    return {
      quietest: Math.min(...lanes),
      liveliest: Math.max(...lanes),
      quieter: word("quieter")?.left ?? 0,
      livelier: word("livelier")?.right ?? 0,
    };
  });
  expect(ends.quieter).toBeCloseTo(ends.quietest, 0);
  expect(ends.livelier).toBeCloseTo(ends.liveliest, 0);
});

test(`on a ${FIRST_NAMED_WIDTH} px phone, the narrowest that names the curve, the scale's three words keep apart`, async ({
  page,
}) => {
  await page.setViewportSize({ width: FIRST_NAMED_WIDTH, height: PHONE_HEIGHT });
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);

  await expect(page.getByText("quieter", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("livelier", { exact: true }).filter({ visible: true })).toBeVisible();
  for (const gap of await captionGaps(page, "quieter", "livelier")) {
    expect(gap).toBeGreaterThanOrEqual(MIN_CAPTION_GAP_PX);
  }
});

for (const width of ARROWED_WIDTHS) {
  test(`at ${width} px the energy scale's words keep their arrows`, async ({ page }) => {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await page.goto("/day/kanazawa");
    await waitForTheDay(page);

    await expect(
      page.getByText("← quieter", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("livelier →", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    for (const gap of await captionGaps(page, "← quieter", "livelier →")) {
      expect(gap).toBeGreaterThanOrEqual(MIN_CAPTION_GAP_PX);
    }
  });
}

test("each stop's slider ranges from its quietest version to its liveliest", async ({ page }) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const sliders = page.getByRole("slider", { name: /^Energy at/ });
  await expect(sliders).not.toHaveCount(0);

  // Home and End take a stop to its quietest and liveliest versions: its range's two ends.
  for (const slider of await sliders.all()) {
    const least = await slider.getAttribute("aria-valuemin");
    const greatest = await slider.getAttribute("aria-valuemax");
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuenow", least ?? "");
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", greatest ?? "");
  }
});

/** The ink a text in the same place reads, in the theme that place has. */
async function inkAt(target: Locator): Promise<string> {
  return target.evaluate((element) => {
    const probe = document.createElement("span");
    probe.className = "text-ink";
    element.parentElement?.append(probe);
    const ink = getComputedStyle(probe).color;
    probe.remove();
    return ink;
  });
}

// The visual baseline shoots no focused state, so the rings `focus-ring` and
// `focus-ring-inset` draw (globals.css) are held here.
test("the keyboard's focus rings each word and link in ink, and the theme's button inside its edge", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const headline = page.getByRole("main").getByRole("heading", { level: 1 });
  const targets: [string, Locator, string][] = [
    ["the wordmark", page.getByRole("link", { name: "Lantern", exact: true }), "2px"],
    ["the city word", headline.getByRole("button", { name: "Kanazawa", exact: true }), "2px"],
    ["the energy word", headline.getByRole("button", { name: "calm", exact: true }), "2px"],
    [
      "the view to go to",
      page.getByRole("group", { name: "View" }).getByRole("button", { name: "Plan" }),
      "2px",
    ],
    ["the theme's button", page.getByRole("button", { name: /^Switch to / }), "-2px"],
  ];
  // A key pressed first, so a focus moved there next is the keyboard's (`:focus-visible`).
  await page.keyboard.press("Tab");

  for (const [name, target, offset] of targets) {
    await target.focus();
    expect(await target.evaluate((element) => element.matches(":focus-visible")), name).toBe(true);
    await expect(target, name).toHaveCSS("outline-style", "solid");
    await expect(target, name).toHaveCSS("outline-width", "2px");
    await expect(target, name).toHaveCSS("outline-offset", offset);
    // A word's colours ease on focus (`transition-colors`), its ring from the word's own ink.
    await expect(target, name).toHaveCSS("outline-color", await inkAt(target));
  }
});

/** Kanazawa's fourth stop, whose open sheet lies over rows below it and beads beside it. */
const FOURTH_STOP = "Seafood Bowls at Omicho Market";
/** More presses than the day has stops, so a walk that finds nothing under the sheet ends. */
const MAX_PRESSES = 30;

/**
 * Presses `key` until the focus is on a stop's name, a bead's slider, or something of the day's
 * foot under the chart, that the open sheet lies over, and returns what has the focus there, or
 * null when the walk finds none.
 */
async function focusUnder(
  page: Page,
  sheet: Locator,
  key: "Tab" | "Shift+Tab",
  kind: "name" | "slider" | "foot",
): Promise<JSHandle<Element | null> | null> {
  for (let press = 0; press < MAX_PRESSES; press += 1) {
    await page.keyboard.press(key);
    const isUnder = await sheet.evaluate((region, wanted) => {
      const focused = document.activeElement;
      if (!focused || focused === document.body || focused.closest("li")?.contains(region)) {
        return false;
      }
      const isInTheDay = focused.closest('ol[aria-label="The day"]') !== null;
      const isSlider = focused.getAttribute("role") === "slider";
      const isWanted =
        wanted === "slider"
          ? isSlider
          : wanted === "name"
            ? focused.tagName === "BUTTON" && isInTheDay
            : focused.closest("[data-under-chart], footer") !== null;
      const over = region.getBoundingClientRect();
      const under = focused.getBoundingClientRect();
      const width = Math.min(over.right, under.right) - Math.max(over.left, under.left);
      const height = Math.min(over.bottom, under.bottom) - Math.max(over.top, under.top);
      return isWanted && width > 0 && height > 0;
    }, kind);
    if (isUnder) return page.evaluateHandle(() => document.activeElement);
  }
  return null;
}

/** Whether `element` still has the focus. */
function isFocused(page: Page, element: JSHandle<Element | null>): Promise<boolean> {
  return page.evaluate(
    (held) => held !== null && held !== document.body && held === document.activeElement,
    element,
  );
}

// An open sheet lies over the rows below its stop and the beads beside it. Escape wherever the
// focus is folds it and leaves the focus where it is, so what it covered is seen (WCAG 2.4.11).
test("Escape folds an open sheet from a name or a bead it covers, and the focus stays there", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const name = page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: new RegExp(`^${FOURTH_STOP}`) });
  const sheet = page.getByRole("region", { name: `About ${FOURTH_STOP}` });

  for (const [key, kind] of [
    ["Tab", "name"],
    ["Shift+Tab", "slider"],
  ] as const) {
    await name.focus();
    await page.keyboard.press("Enter");
    await expect(sheet).toBeFocused();
    const covered = await focusUnder(page, sheet, key, kind);
    if (!covered) throw new Error(`No ${kind} under the open sheet within ${MAX_PRESSES} presses`);

    await page.keyboard.press("Escape");
    await expect(sheet, kind).toHaveCount(0);
    expect(await isFocused(page, covered), kind).toBe(true);
  }
});

// A late stop's sheet reaches past the chart over the day's foot: its answer and the credits.
// Escape there folds it too, the focus staying where it is.
test("Escape folds an open sheet from the day's foot it covers, and the focus stays there", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const names = page.getByRole("list", { name: "The day" }).getByRole("button");
  const count = await names.count();

  // The last stops' sheets are the ones that reach the foot; which one does depends on the width.
  for (let index = count - 1; index >= 0; index -= 1) {
    const name = names.nth(index);
    const sheet = page.getByRole("region", { name: /^About / });
    await name.focus();
    await page.keyboard.press("Enter");
    await expect(sheet).toBeFocused();
    const covered = await focusUnder(page, sheet, "Tab", "foot");
    if (covered) {
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      expect(await isFocused(page, covered)).toBe(true);
      return;
    }
    // This stop's sheet covers nothing under the chart: folded from its own name, as a visitor
    // would, before the next stop is opened.
    await name.focus();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  }
  throw new Error("No stop's open sheet lies over anything of the day's foot");
});

/** Kanazawa's second stop, whose open sheet's edge crosses beads. */
const SECOND_STOP = "Coffee in Kenrokumachi";

// The beads an open sheet's edge crosses are drawn again over it, a picture alone: once a sheet
// has opened and folded, Tab from the day's last stop still goes straight to the next control.
test("after a sheet over beads has opened and folded, Tab from the last stop goes to the day's answer", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const names = page.getByRole("list", { name: "The day" }).getByRole("button");
  const sheet = page.getByRole("region", { name: `About ${SECOND_STOP}` });

  await names.filter({ hasText: SECOND_STOP }).focus();
  await page.keyboard.press("Enter");
  await expect(sheet).toBeFocused();
  // The sheet's edges cross beads, so their copies are drawn over it: the drawing that would
  // otherwise take a Tab is on the page.
  await expect(page.locator("svg.z-20 circle").first()).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Yes" })).toBeVisible();
  await names.last().focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Yes" })).toBeFocused();
});
