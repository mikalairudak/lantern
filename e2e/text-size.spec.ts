import { expect, test, type Page, waitMs, chooseTheChart, setBrowserTextSize } from "./fixtures";

/**
 * The pages with the browser's own text at 200%, Chrome's "Font size" at 32 px over its 16
 * (WCAG 1.4.4): the root follows it, so every word doubles, and a page still fits a phone's
 * width, and the chart's time column widens with its times.
 */

const LARGE_TEXT_PX = 32;
/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** The narrowest phone and a common one. */
const PHONE_WIDTHS = [320, 412];
/** A phone, and a laptop's width, where the chart stands beside the list. */
const CHART_WIDTHS = [412, 1440];
/** A written day the specs play, whose headline holds the longest answers. */
const DAY = "/day/kanazawa";

/** The root's size in pixels as the page computes it, which the text size sets. */
function rootPxOf(page: Page): Promise<number> {
  return page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  );
}

/** How far the page reaches past the screen's right edge. */
function overflowOf(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function untilDayRests(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

const PAGES = [
  {
    name: "the start screen",
    path: "/",
    until: (page: Page) =>
      expect(page.getByRole("list", { name: /^No city in mind/ })).toBeVisible(),
  },
  { name: "a written day", path: DAY, until: untilDayRests },
  {
    name: "the privacy page",
    path: "/privacy",
    until: (page: Page) =>
      expect(page.getByRole("heading", { name: "Terms", exact: true })).toBeAttached(),
  },
] as const;

for (const { name, path, until } of PAGES) {
  for (const width of PHONE_WIDTHS) {
    test(`with the text at 200%, ${name} never scrolls sideways at ${width} px`, async ({
      page,
    }) => {
      await setBrowserTextSize(page, LARGE_TEXT_PX);
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      await until(page);

      expect(await rootPxOf(page)).toBe(LARGE_TEXT_PX);
      expect(await overflowOf(page)).toBe(0);
    });
  }
}

// A phrase of the headline wider than the line wraps inside its box, and a city wider than the
// line breaks inside its name, and the comma after either stays on the line of the letter before
// it. Amsterdam's name with its comma is wider than a 320 px phone's line at 200%.
const HEADLINE_DAYS = [
  { city: "Kanazawa", path: DAY },
  { city: "Amsterdam", path: "/day/amsterdam" },
];

for (const { city, path } of HEADLINE_DAYS) {
  test(`with the text at 200%, no line of ${city}'s headline starts with a comma at 320 px`, async ({
    page,
  }) => {
    await setBrowserTextSize(page, LARGE_TEXT_PX);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(path);
    await untilDayRests(page);

    expect(await rootPxOf(page)).toBe(LARGE_TEXT_PX);
    const { commas, alone } = await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
      const isShown = (node: Node) =>
        node.parentElement?.checkVisibility({ visibilityProperty: true }) ?? false;
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      let before: DOMRect | null = null;
      let count = 0;
      const lonely: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        if (!isShown(node) || text.trim() === "") continue;
        for (let at = 0; at < text.length; at += 1) {
          if (text[at] === " ") continue;
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + 1);
          const box = range.getBoundingClientRect();
          if (text[at] === ",") {
            count += 1;
            // The comma's middle stands on the line of the letter before it.
            const middle = box.top + box.height / 2;
            if (before === null || middle < before.top || middle > before.bottom) {
              lonely.push(`${count}`);
            }
          }
          before = box;
        }
      }
      return { commas: count, alone: lonely };
    });
    expect(commas).toBeGreaterThan(0);
    expect(alone).toEqual([]);
  });
}

/** A label on the chart: its text's own box, and the box it may not be cut by. */
interface ChartLabel {
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** The left edge of the box it is drawn in, and of the nearest one that clips it. */
  boxLeft: number;
  clipLeft: number;
}

/** The stops' times and the suns' minutes the chart shows, each with what bounds it. */
function chartLabelsOf(page: Page): Promise<{ times: ChartLabel[]; suns: ChartLabel[] }> {
  return page.evaluate(() => {
    const isShown = (element: Element) =>
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const clipLeftOf = (element: Element): number => {
      let parent = element.parentElement;
      while (parent && getComputedStyle(parent).overflowX === "visible") {
        parent = parent.parentElement;
      }
      return parent?.getBoundingClientRect().left ?? 0;
    };
    const labelOf = (element: Element, box: Element): ChartLabel => {
      // A time's text may reach past its own box; a sun's minute is a box of its own.
      const range = document.createRange();
      range.selectNodeContents(element);
      const text =
        element instanceof SVGElement
          ? element.getBoundingClientRect()
          : range.getBoundingClientRect();
      return {
        text: element.textContent.trim(),
        left: text.left,
        right: text.right,
        top: text.top,
        bottom: text.bottom,
        boxLeft: box.getBoundingClientRect().left,
        clipLeft: clipLeftOf(box),
      };
    };
    return {
      times: [...document.querySelectorAll("[data-start-time]")]
        .filter(isShown)
        .map((time) => labelOf(time, time)),
      suns: [...document.querySelectorAll("[data-sun] text")]
        .filter(isShown)
        .map((minute) => labelOf(minute, minute.closest("svg") ?? minute)),
    };
  });
}

/** A label cut on its left, by its own box or by what clips it, as "07:30 by 24.2 px". */
function cutOf(label: ChartLabel): string[] {
  const cut = Math.max(label.boxLeft, label.clipLeft) - label.left;
  return cut > 0.5 ? [`${label.text} by ${cut.toFixed(1)} px`] : [];
}

/**
 * Two written days, each a sun on its chart. A written day is shown on a date that moves, so
 * whether a sun's minute is said beside it moves too; where one is, it is whole and stands on
 * no stop's time (the weighing itself: `src/features/abacus/rows.test.ts`).
 */
const CHART_DAYS = [
  { city: "Kanazawa", path: DAY },
  { city: "Tokyo", path: "/day/tokyo" },
];

for (const { city, path } of CHART_DAYS) {
  for (const width of CHART_WIDTHS) {
    test(`with the text at 200%, every time on ${city}'s chart reads whole at ${width} px`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile && width > 1000, "A laptop's width is the desktop's.");
      await chooseTheChart(page);
      await setBrowserTextSize(page, LARGE_TEXT_PX);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await untilDayRests(page);

      expect(await rootPxOf(page)).toBe(LARGE_TEXT_PX);
      const { times, suns } = await chartLabelsOf(page);
      expect(times.length).toBeGreaterThan(0);
      for (const time of times) expect(time.text).toMatch(/^\d\d:\d\d$/);
      expect([...times, ...suns].flatMap(cutOf)).toEqual([]);
      // A sun's minute said beside it stands on no stop's time.
      const crossings = suns.flatMap((sun) =>
        times.flatMap((time) =>
          sun.top < time.bottom && time.top < sun.bottom ? [`${sun.text} on ${time.text}`] : [],
        ),
      );
      expect(crossings).toEqual([]);
    });
  }
}
