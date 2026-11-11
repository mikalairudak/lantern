import { expect, test, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/**
 * The page grows on a large screen: from 1440 px wide the root's size grows with the
 * viewport to a quarter more at 2560 px, and the chart's drawing by the same factor
 * (`--root-grows-*` in globals.css, `drawingAt` in src/features/abacus/drawing.ts). Up to
 * 1440 px nothing changes: the numbers below are Kanazawa's as written, at the default text
 * size, measured when the days written by hand left the site (2026-11-04); Kyoto's, measured
 * on the commit before the root grew (78798b2), held until then. Only what the root and the
 * drawing decide is held: the chart's column, its beads within it and a sheet's run; where
 * the header puts the chart, and so the page's height, is the header's own.
 */

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };
const LARGE = { width: 2560, height: 1440 };
/** `toBeCloseTo`'s digits, not pixels: one decimal holds a value within 0.05 px. */
const SAME_TO_ONE_DECIMAL = 1;
/**
 * The page rests once its height has stood this many frames: the day's end lands under the
 * chart a frame after the list comes to rest, after the chart is no longer busy, and on a busy
 * machine many frames after.
 */
const REST_FRAMES = 30;

interface Point {
  x: number;
  y: number;
}

interface Geometry {
  root: string;
  chart: { x: number; y: number; width: number; height: number };
  /** The shown beads' centres, from the chart's top left, top to bottom. */
  beads: Point[];
  page: number;
}

/**
 * Kanazawa as written (2026-11-04): its chart's column, three shown beads, its second stop's
 * sheet. The chart's column and the sheet's run are where Kyoto's stood at 78798b2; its
 * height and its beads are its own day's, its rows a bead's target over their wires since
 * 2026-11-05.
 */
const BEFORE = {
  phone: {
    chart: { x: 16, width: 358, height: 986.5 },
    beads: { first: { x: 80, y: 115 }, second: { x: 145.5, y: 223 }, last: { x: 145.5, y: 929 } },
    sheet: { x: 76, width: 298 },
  },
  laptop: {
    chart: { x: 208, width: 768, height: 635.5 },
    beads: { first: { x: 80, y: 95 }, second: { x: 248, y: 164 }, last: { x: 248, y: 578 } },
    sheet: { x: 452, width: 524 },
  },
};

/** Waits until the page's height has stood still `REST_FRAMES` frames. */
async function untilPageRests(page: Page): Promise<void> {
  await page.waitForFunction(
    (frames) =>
      new Promise<boolean>((resolve) => {
        let last = -1;
        let still = 0;
        const tick = () => {
          const height = document.documentElement.scrollHeight;
          still = height === last ? still + 1 : 0;
          last = height;
          if (still >= frames) resolve(true);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    REST_FRAMES,
  );
}

async function openKanazawa(page: Page, viewport: { width: number; height: number }) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(viewport);
  await page.goto("/day/kanazawa");
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await untilPageRests(page);
}

function geometryOf(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const chart = document.querySelector('svg[role="group"]');
    if (!chart) throw new Error("The chart did not render");
    const box = chart.getBoundingClientRect();
    const beads = [...chart.querySelectorAll("circle.fill-ink")].map((bead) => {
      const r = bead.getBoundingClientRect();
      return { x: r.x + r.width / 2 - box.x, y: r.y + r.height / 2 - box.y };
    });
    return {
      root: getComputedStyle(document.documentElement).fontSize,
      chart: { x: box.x, y: box.y + scrollY, width: box.width, height: box.height },
      beads,
      page: document.documentElement.scrollHeight,
    };
  });
}

function expectPointAt(point: Point | undefined, at: Point, name: string) {
  expect(point, name).toBeDefined();
  expect(point?.x, `${name}, across`).toBeCloseTo(at.x, SAME_TO_ONE_DECIMAL);
  expect(point?.y, `${name}, down`).toBeCloseTo(at.y, SAME_TO_ONE_DECIMAL);
}

test("up to 1440 px the chart is drawn at a phone's and a laptop's own pixels", async ({
  page,
  isMobile,
}) => {
  const before = isMobile ? BEFORE.phone : BEFORE.laptop;
  await openKanazawa(page, isMobile ? PHONE : LAPTOP);

  const drawn = await geometryOf(page);
  expect(drawn.root).toBe("16px");
  expect(drawn.chart.x).toBeCloseTo(before.chart.x, SAME_TO_ONE_DECIMAL);
  expect(drawn.chart.width).toBeCloseTo(before.chart.width, SAME_TO_ONE_DECIMAL);
  expect(drawn.chart.height).toBeCloseTo(before.chart.height, SAME_TO_ONE_DECIMAL);
  expectPointAt(drawn.beads[0], before.beads.first, "the first bead");
  expectPointAt(drawn.beads[1], before.beads.second, "the second bead");
  expectPointAt(drawn.beads.at(-1), before.beads.last, "the last bead");

  await page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: /^Coffee in Kenrokumachi/ })
    .click();
  const sheet = page.getByRole("region", { name: "About Coffee in Kenrokumachi" });
  await expect(sheet).toBeFocused();
  const sheetBox = await sheet.boundingBox();
  if (!sheetBox) throw new Error("The sheet did not render");
  expect(sheetBox.x).toBeCloseTo(before.sheet.x, SAME_TO_ONE_DECIMAL);
  expect(sheetBox.width).toBeCloseTo(before.sheet.width, SAME_TO_ONE_DECIMAL);
  // An open sheet never makes the page taller.
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(drawn.page);
});

/** The root's size, the drawing's factor and what follows from it at 2560 px wide. */
const LARGE_ROOT = "20px";
const FACTOR = 1.25;
/** The chart's column, 48 rem: 768 px on a laptop. */
const LARGE_CHART_PX = 768 * FACTOR;
/** Where the lanes start: the time axis's gutter and the inset to the quietest lane. */
const LARGE_LANES_FROM = (52 + 28) * FACTOR;
/** The shown bead's radius. */
const LARGE_BEAD_R = 6 * FACTOR;
/** An open stop's sheet at its least, 28 rem: 448 px on a laptop. */
const LARGE_SHEET_LEAST_PX = 448 * FACTOR;
/** The day's height the time scale is fitted to, 33.75 rem: 540 px on a laptop. */
const LARGE_DAY_PX = 540 * FACTOR;
/** The energy scale over the plot and the inset under it: 40 and 20 px on a laptop. */
const LARGE_INSET_BELOW_PX = 20 * FACTOR;
const LARGE_FRAME_INSETS_PX = (40 + 20) * FACTOR;
/** Kanazawa asks for 07:00 to 23:00, and its last wire, at 19:45, stands 75 minutes above 21:00. */
const KANAZAWA_ASKED_MINUTES = 16 * 60;
const KANAZAWA_UNDER_LAST_WIRE = 75;

test(
  "at 2560 px the chart is drawn a quarter larger from its first frame, its sheet at least 560 px",
  { tag: "@frame" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "A large screen is not a phone.");
    // Every frame from the first: the chart's width, where its lanes start and its shown bead's
    // radius, so a frame drawn at a laptop's pixels before the factor is read would show.
    await page.addInitScript(() => {
      const frames: { width: string | null; lanesFrom: string | null; beadR: string | null }[] = [];
      Object.assign(window, { chartFrames: frames });
      const sample = () => {
        const chart = document.querySelector('svg[role="group"]');
        if (chart) {
          const quieter = [...chart.querySelectorAll("text")].find((text) =>
            text.textContent?.includes("quieter"),
          );
          frames.push({
            width: chart.getAttribute("width"),
            lanesFrom: quieter?.getAttribute("x") ?? null,
            beadR: chart.querySelector("circle.fill-ink")?.getAttribute("r") ?? null,
          });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await openKanazawa(page, LARGE);

    const frames = await page.evaluate(
      () => (window as unknown as { chartFrames: Record<string, string | null>[] }).chartFrames,
    );
    expect(frames.length).toBeGreaterThan(0);
    expect(new Set(frames.map((frame) => frame.width))).toEqual(new Set([`${LARGE_CHART_PX}`]));
    expect(new Set(frames.map((frame) => frame.lanesFrom))).toEqual(
      new Set([`${LARGE_LANES_FROM}`]),
    );
    const radii = new Set(frames.flatMap((frame) => (frame.beadR === null ? [] : [frame.beadR])));
    expect(radii).toEqual(new Set([`${LARGE_BEAD_R}`]));

    const drawn = await geometryOf(page);
    expect(drawn.root).toBe(LARGE_ROOT);
    expect(drawn.chart.width).toBe(LARGE_CHART_PX);
    expect(drawn.chart.width / LARGE.width).toBe(0.375);

    // The time scale runs a quarter faster down the page: the day it is fitted to is a quarter
    // taller, and its frame's insets with it.
    const time = await page.evaluate((insetBelow) => {
      const chart = document.querySelector('svg[role="group"]');
      const day = document.querySelector(".h-day");
      if (!chart || !day) throw new Error("The day did not render");
      const wires = [...chart.querySelectorAll("path")].flatMap((path) => {
        const wire = /^M[\d.]+ ([\d.]+) H/.exec(path.getAttribute("d") ?? "");
        return wire ? [Number(wire[1])] : [];
      });
      const plotBottom = Number(chart.getAttribute("height")) - insetBelow;
      return { dayHeight: day.clientHeight, under: plotBottom - Math.max(...wires) };
    }, LARGE_INSET_BELOW_PX);
    expect(time.dayHeight).toBe(LARGE_DAY_PX);
    const pace = (LARGE_DAY_PX - LARGE_FRAME_INSETS_PX) / KANAZAWA_ASKED_MINUTES;
    expect(pace).toBe(0.5 * FACTOR);
    expect(time.under).toBeCloseTo(KANAZAWA_UNDER_LAST_WIRE * pace, SAME_TO_ONE_DECIMAL);

    // Oden in Katamachi folds to its name and kind, so its sheet is as narrow as a sheet goes.
    await page
      .getByRole("list", { name: "The day" })
      .getByRole("button", { name: /^Oden in Katamachi/ })
      .click();
    const sheet = page.getByRole("region", { name: "About Oden in Katamachi" });
    await expect(sheet).toBeFocused();
    const sheetBox = await sheet.boundingBox();
    if (!sheetBox) throw new Error("The sheet did not render");
    expect(sheetBox.width).toBeCloseTo(LARGE_SHEET_LEAST_PX, SAME_TO_ONE_DECIMAL);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(drawn.page);
  },
);

/**
 * The browser's own text at 125 %: Chrome's default font size set to 20 px, as a visitor sets
 * it, before the page loads.
 */
const LARGE_TEXT_PX = 20;
/** The root at 2560 px wide in that text: it grows from 20 px by its share of 90 to 160 rem. */
const LARGE_TEXT_ROOT_AT_2560 = 20 * (1 + (0.25 * (2560 / 20 - 90)) / 70);
/** Where the lanes start with the drawing as written: the gutter and the inset. */
const LANES_FROM = 52 + 28;

async function openKanazawaInLargeText(page: Page, viewport: { width: number; height: number }) {
  const session = await page.context().newCDPSession(page);
  await session.send("Page.enable");
  await session.send("Page.setFontSizes", { fontSizes: { standard: LARGE_TEXT_PX } });
  await openKanazawa(page, viewport);
}

/** How the chart is drawn, and how a few of Kanazawa's words lay out beside it. */
function largeTextLayoutOf(page: Page) {
  return page.evaluate(() => {
    const linesOf = (element: Element | undefined) => {
      if (!element) return null;
      const range = document.createRange();
      range.selectNodeContents(element);
      const tops = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => r.top);
      return new Set(tops.map(Math.round)).size;
    };
    const rowOf = (name: string) =>
      [...document.querySelectorAll('ol[aria-label="The day"] > li')].find((row) =>
        row.textContent?.includes(name),
      );
    const chart = document.querySelector('svg[role="group"]');
    if (!chart) throw new Error("The chart did not render");
    const texts = [...chart.querySelectorAll("text")];
    const words = texts.map((text) => text.textContent ?? "");
    // The quieter end word stands on the quietest lane.
    const quieter = texts.find((text) => text.textContent?.includes("quieter"));
    return {
      root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      lanesFrom: Number(quieter?.getAttribute("x")),
      isCurveNamed: words.includes("drag the curve"),
      museumLines: linesOf(
        [
          ...(rowOf("21st Century Museum of Contemporary Art")?.querySelectorAll(".type-name") ??
            []),
        ].find((name) => name.textContent?.includes("21st Century Museum")),
      ),
      marketNoteLines: linesOf(
        [...(rowOf("Seafood Bowls at Omicho Market")?.querySelectorAll(".type-note") ?? [])].find(
          (note) => note.textContent?.includes("chatter"),
        ),
      ),
    };
  });
}

test("a phone in large text keeps the chart's drawing as written, and the words the room they had", async ({
  page,
}) => {
  await openKanazawaInLargeText(page, PHONE);

  // As before the root grew (89ac582): the drawing as written, so the words keep their width.
  const layout = await largeTextLayoutOf(page);
  expect(layout.root).toBe(LARGE_TEXT_PX);
  expect(layout.lanesFrom).toBe(LANES_FROM);
  expect(layout.isCurveNamed).toBe(true);
  expect(layout.museumLines).toBe(3);
  // How full and how loud the market is, on one line, in the room a row's second line has.
  expect(layout.marketNoteLines).toBe(1);
});

test("a large screen in large text grows the drawing by the root's growth alone", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A large screen is not a phone.");
  await openKanazawaInLargeText(page, LARGE);

  const layout = await largeTextLayoutOf(page);
  expect(layout.root).toBeCloseTo(LARGE_TEXT_ROOT_AT_2560, 3);
  const growth = LARGE_TEXT_ROOT_AT_2560 / LARGE_TEXT_PX;
  expect(growth).toBeCloseTo(1.136, 3);
  expect(layout.lanesFrom).toBeCloseTo(LANES_FROM * growth, 2);
});
