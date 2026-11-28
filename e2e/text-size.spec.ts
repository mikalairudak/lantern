import { ALICANTE_REQUEST } from "../src/lib/fixtures/curated/requests";
import type { StoredDay } from "../src/lib/days/stored-day";
import { expect, test, type Page, waitMs, chooseTheChart, setBrowserTextSize } from "./fixtures";

/**
 * The pages with the browser's own text at 200%, Chrome's "Font size" at 32 px over its 16
 * (WCAG 1.4.4): the root follows it, so every word doubles, and a page still fits a phone's
 * width, and the chart's time column widens with its times.
 */

const LARGE_TEXT_PX = 32;
/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/**
 * The narrowest phone, common ones, and those between where the foot's longest link,
 * "© OpenStreetMap contributors", and its press come within a few pixels of the line at 200%.
 */
const PHONE_WIDTHS = [320, 386, 390, 393, 412];
/**
 * A phone, and a laptop's width. The breakpoints are in rems, which the text size doubles, so at
 * 1440 px the page still takes its narrow layout, with the chart wider than a phone's.
 */
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

/**
 * The foot's links whose words reach past the foot's line, by how far: a link breaks rather
 * than stand in the page's gutter. Its words are measured, not its target, which reaches past
 * them on purpose.
 */
function footLinksPastTheirLineOf(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("footer")].flatMap((foot) => {
      const line = foot.firstElementChild?.getBoundingClientRect();
      if (line === undefined) return [];
      return [...foot.querySelectorAll("a")].flatMap((link) => {
        const words = document.createRange();
        words.selectNodeContents(link);
        const right = Math.max(...[...words.getClientRects()].map((box) => box.right));
        const past = right - line.right;
        return past > 0.5 ? [`${link.textContent ?? ""}: ${past.toFixed(1)} px`] : [];
      });
    }),
  );
}

/** How far the headline reaches past the right edge of the page's column, in whole pixels. */
function headlinePastItsColumnOf(page: Page): Promise<number> {
  return page.getByRole("heading", { level: 1 }).evaluate((headline) => {
    const column = headline.closest("main") ?? document.body;
    const right = column.getBoundingClientRect().right;
    const inset = Number.parseFloat(getComputedStyle(column).paddingRight);
    return Math.round(headline.getBoundingClientRect().right - (right - inset));
  });
}

async function untilDayRests(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/**
 * The day at rest and its end line under it, which comes once the day has played: the page is
 * measured as it stands then, with every line it will hold.
 */
async function untilDayEnds(page: Page): Promise<void> {
  await untilDayRests(page);
  await expect(page.getByText(/^Home by/)).toBeVisible({
    timeout: DAY_TIMEOUT_MS,
  });
}

const PAGES = [
  {
    name: "the start screen",
    path: "/",
    until: (page: Page) =>
      expect(page.getByRole("list", { name: /^No city in mind/ })).toBeVisible(),
  },
  { name: "a written day", path: DAY, until: untilDayEnds },
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
      expect(await footLinksPastTheirLineOf(page)).toEqual([]);
    });
  }
}

/** A day's link, whose day the test answers in place of the log. */
const KEPT_ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
/** Alicante's day asked for a Wednesday, the longest weekday, its link past its days. */
const ON_A_WEDNESDAY: StoredDay = {
  status: "expired",
  request: { ...ALICANTE_REQUEST, date: "2026-11-18" },
};

// A written day is shown on the next date of its own weekday, so a Wednesday is asked for
// through a day's link, which answers with the request it holds.
test("with the text at 200%, a day on a Wednesday keeps its headline inside the page at 320 px", async ({
  page,
}) => {
  await page.route(`**/api/day/${KEPT_ID}`, (route) => route.fulfill({ json: ON_A_WEDNESDAY }));
  await setBrowserTextSize(page, LARGE_TEXT_PX);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/day/${KEPT_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A calm Wednesday", {
    timeout: DAY_TIMEOUT_MS,
  });

  expect(await rootPxOf(page)).toBe(LARGE_TEXT_PX);
  expect(await overflowOf(page)).toBe(0);
  // Clipped by the header, a headline wider than its column scrolls nothing: it is cut.
  expect(await headlinePastItsColumnOf(page)).toBeLessThanOrEqual(0);
});

/** Each word under `selector` that the page sets across two lines, as "Madri / d". */
function wordsBrokenIn(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((selector) => {
    const broken: string[] = [];
    for (const root of document.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        for (const match of text.matchAll(/\S+/g)) {
          const tops = new Set<number>();
          for (let at = match.index; at < match.index + match[0].length; at += 1) {
            const range = document.createRange();
            range.setStart(node, at);
            range.setEnd(node, at + 1);
            tops.add(Math.round(range.getBoundingClientRect().top));
          }
          if (tops.size > 1) broken.push(match[0]);
        }
      }
    }
    return broken;
  }, selector);
}

for (const width of [320, 412]) {
  test(`with the text at 200%, no word of the start screen's index breaks at ${width} px`, async ({
    page,
  }) => {
    await setBrowserTextSize(page, LARGE_TEXT_PX);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("list", { name: /^No city in mind/ })).toBeVisible();

    expect(await rootPxOf(page)).toBe(LARGE_TEXT_PX);
    expect(await wordsBrokenIn(page, "[data-index-cell]")).toEqual([]);
  });
}

// Wider than a 320 px phone's foot at 200%, the support address breaks after its "@".
test("with the text at 200%, the foot's support address breaks only after its @ at 320 px", async ({
  page,
}) => {
  await setBrowserTextSize(page, LARGE_TEXT_PX);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  const address = page.locator('footer a[href^="mailto:"]');
  await expect(address).toBeAttached();

  expect(await rootPxOf(page)).toBe(LARGE_TEXT_PX);
  const lines = await address.evaluate((link) => {
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    const byTop = new Map<number, string>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (let at = 0; at < text.length; at += 1) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + 1);
        const top = Math.round(range.getBoundingClientRect().top);
        byTop.set(top, (byTop.get(top) ?? "") + text[at]);
      }
    }
    return [...byTop.values()];
  });
  expect(lines).toEqual(["support@", "lanternday.com"]);
});

// The day's end line's summary keeps each dot on the line of the words after it, as it does at
// the default size, where its runs wrap at 320 px with the text at 200%.
test("with the text at 200%, no line of Kanazawa's day's end ends with its dot at 320 px", async ({
  page,
}) => {
  await setBrowserTextSize(page, LARGE_TEXT_PX);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(DAY);
  await untilDayEnds(page);

  expect(await rootPxOf(page)).toBe(LARGE_TEXT_PX);
  const lines = await page.locator("p", { hasText: /^Home by/ }).evaluate((summary) => {
    const walker = document.createTreeWalker(summary, NodeFilter.SHOW_TEXT);
    const byTop = new Map<number, string>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (let at = 0; at < text.length; at += 1) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + 1);
        const box = range.getBoundingClientRect();
        if (box.width === 0) continue;
        const top = Math.round(box.top);
        byTop.set(top, (byTop.get(top) ?? "") + text[at]);
      }
    }
    return [...byTop.values()].map((line) => line.trim());
  });
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.filter((line) => line.endsWith("·"))).toEqual([]);
});

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
