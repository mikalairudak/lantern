import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "./fixtures";
import { shownWrittenDayAt, writtenDayAt } from "../src/lib/days/written/days";

// The line under a finished day: when it ends, how far it goes, what the map found, and the
// ways to take it along (docs/design-direction.md, "The end of a day and the foot"). It lands with
// the day whole, under its last row, once what stands over it has come to rest, and nothing
// above it, nor the line itself, moves after; a day that opens whole has it from its first
// frame, with nothing moving. Each is watched with motion and under reduced motion, where
// nothing glides and so nothing a glide moves can be seen.

const DAY_TIMEOUT_MS = 30_000;
const KANAZAWA = writtenDayAt("kanazawa")!.itinerary;
/** How far a row, the chart or the line may stand from where it stood, in px: subpixel rounding. */
const TOLERANCE_PX = 1;
/**
 * A day this device has watched opens whole, its end in the first frame its page runs, which
 * on a CPU four times slower came 2 s after the reload. The frames tell whether it was there
 * at once; a day played again would be seconds in the writing.
 */
const WHOLE_TIMEOUT_MS = 8_000;
/** Frames in a row with nothing on the page moving, which is a page at rest. */
const FRAMES_AT_REST = 20;
/** Longer than the longest glide after the end lands, the foot's 0.6 s, on a busy machine. */
const REST_TIMEOUT_MS = 10_000;

const VIEWS = ["chart", "read"] as const;
type View = (typeof VIEWS)[number];
const MOTIONS = ["reduce", "no-preference"] as const;
type Motion = (typeof MOTIONS)[number];

/** One frame of the page: where its rows, chart, end and credit stand, in page coordinates. */
interface Frame {
  rows: number[];
  chartTop: number | null;
  headerBottom: number | null;
  /** The top of the day's end, once it is seen. */
  end: number | null;
  credit: number | null;
  /** The line under the chart says the day is still being written. */
  isWriting: boolean;
}

/**
 * Samples every frame from the page's start, in the page's own coordinates, by what is seen:
 * a written day's first HTML holds the whole day unseen for a visitor who has not watched it.
 */
function sampleTheDay(view: View): void {
  const frames: Frame[] = [];
  (window as unknown as { dayFrames: Frame[] }).dayFrames = frames;
  const topOf = (element: Element | null | undefined): number | null =>
    element ? element.getBoundingClientRect().top + window.scrollY : null;
  const isSeen = (element: Element) => element.checkVisibility({ visibilityProperty: true });
  const sample = () => {
    const rows =
      view === "chart"
        ? document.querySelectorAll("[data-start-time]")
        : document.querySelectorAll('ol[aria-label="The day, to read"] > li');
    const header = document.querySelector("header");
    const credit = [...document.querySelectorAll('a[href*="openstreetmap.org"]')].find(isSeen);
    const end = [...document.querySelectorAll("p")].find(
      (line) => line.textContent?.startsWith("Home by") && isSeen(line),
    );
    frames.push({
      rows: [...rows].filter(isSeen).map((row) => topOf(row) ?? 0),
      chartTop: topOf(document.querySelector('[aria-label^="The day\'s energy"]')),
      headerBottom: header ? header.getBoundingClientRect().bottom + window.scrollY : null,
      end: topOf(end),
      credit: topOf(credit),
      // The line under the chart: not the header's own status line.
      isWriting: [...document.querySelectorAll("main p")].some(
        (line) =>
          line.closest("header") === null &&
          (line.textContent?.startsWith("Writing ") ?? false) &&
          isSeen(line),
      ),
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

async function framesOf(page: Page): Promise<Frame[]> {
  return page.evaluate(() => (window as unknown as { dayFrames: Frame[] }).dayFrames);
}

/** Waits until the end and the credit under it have held still for `FRAMES_AT_REST` frames. */
async function untilAtRest(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const last = (await framesOf(page)).slice(-FRAMES_AT_REST);
        const at = (frame: Frame) => JSON.stringify([frame.end, frame.credit, frame.rows]);
        return last.length === FRAMES_AT_REST && last.every((frame) => at(frame) === at(last[0]!));
      },
      { timeout: REST_TIMEOUT_MS },
    )
    .toBe(true);
}

async function openKanazawa(page: Page, view: View, motion: Motion): Promise<void> {
  await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript((chosen) => {
    try {
      localStorage.setItem("lantern-day-view", chosen);
    } catch {
      // A page without storage shows the chart, which the chart's run covers.
    }
  }, view);
  await page.addInitScript(sampleTheDay, view);
  await page.goto("/day/kanazawa");
}

function theEnd(page: Page) {
  return page.getByText(/^Home by quarter past eight/);
}

/** How far a value moved over the frames, in px: from the least to the most it stood at. */
function travelOf(values: readonly (number | null)[]): number {
  const seen = values.filter((value): value is number => value !== null);
  return Math.max(...seen) - Math.min(...seen);
}

const withMotion = (motion: Motion) =>
  motion === "reduce" ? "under reduced motion" : "with motion";

for (const motion of MOTIONS) {
  for (const view of VIEWS) {
    test(
      `in ${view} ${withMotion(motion)}, the day's end lands as the day is whole, and nothing above it, nor it, moves`,
      { tag: "@frame" },
      async ({ page }) => {
        await openKanazawa(page, view, motion);
        await expect(theEnd(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
        await untilAtRest(page);

        const frames = await framesOf(page);
        const landed = frames.findIndex(({ end }) => end !== null);
        expect(landed, "the end landed").toBeGreaterThan(0);
        // It came after the day was written, never with the line still writing it.
        expect(frames.slice(landed).filter(({ isWriting }) => isWriting)).toEqual([]);
        expect(frames.slice(0, landed).some(({ isWriting }) => isWriting)).toBe(true);
        // Every row on screen as it landed holds still, the chart and the header with them, and
        // so does the end itself: under reduced motion the last row comes in Read with the day
        // whole, in the same frame as the end under it.
        const before = frames[landed - 1]!;
        expect(before.rows.length).toBeGreaterThanOrEqual(KANAZAWA.stops.length - 1);
        const after = frames.slice(landed);
        for (const frame of after) {
          expect(frame.rows).toHaveLength(KANAZAWA.stops.length);
          before.rows.forEach((top, at) =>
            expect(Math.abs(frame.rows[at]! - top)).toBeLessThanOrEqual(TOLERANCE_PX),
          );
          expect(Math.abs((frame.chartTop ?? 0) - (before.chartTop ?? 0))).toBeLessThanOrEqual(
            TOLERANCE_PX,
          );
          expect(
            Math.abs((frame.headerBottom ?? 0) - (before.headerBottom ?? 0)),
          ).toBeLessThanOrEqual(TOLERANCE_PX);
        }
        expect(travelOf(after.map(({ end }) => end)), "the end moved").toBeLessThanOrEqual(
          TOLERANCE_PX,
        );

        // Under the last row, above the page's foot and its sources.
        const lastRow =
          view === "chart"
            ? page.locator("[data-start-time]").last()
            : page.locator('ol[aria-label="The day, to read"] > li').last();
        const credit = page.getByRole("link", { name: "© OpenStreetMap contributors" });
        const [endBox, rowBox, creditBox] = await Promise.all([
          theEnd(page).boundingBox(),
          lastRow.boundingBox(),
          credit.boundingBox(),
        ]);
        if (!endBox || !rowBox || !creditBox) throw new Error("The day did not render");
        expect(endBox.y).toBeGreaterThan(rowBox.y + rowBox.height);
        expect(creditBox.y).toBeGreaterThan(endBox.y + endBox.height);
      },
    );

    test(
      `in ${view} ${withMotion(motion)}, a day this device watched opens with its end there at once, and nothing moves`,
      { tag: "@frame" },
      async ({ page }) => {
        await openKanazawa(page, view, motion);
        await expect(theEnd(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
        await untilAtRest(page);

        await page.reload();
        await expect(theEnd(page)).toBeVisible({ timeout: WHOLE_TIMEOUT_MS });
        await untilAtRest(page);
        const frames = await framesOf(page);
        // No frame of the day whole without its end, and none that wrote it again.
        expect(
          frames.filter(({ rows, end }) => rows.length === KANAZAWA.stops.length && end === null),
        ).toEqual([]);
        expect(frames.filter(({ isWriting }) => isWriting)).toEqual([]);
        // The end and the foot's sources under it stand where they rest from the first frame they are
        // seen: the end's room is whole at once, and the chart's frame ends where it rests.
        const shown = frames.filter(({ end }) => end !== null);
        expect(travelOf(shown.map(({ end }) => end)), "the end moved").toBeLessThanOrEqual(
          TOLERANCE_PX,
        );
        expect(
          travelOf(shown.map(({ credit }) => credit)),
          "the sources moved",
        ).toBeLessThanOrEqual(TOLERANCE_PX);
      },
    );
  }
}

test("its ways: the walk through the places shown in Google Maps, and the day as a calendar file", async ({
  page,
}) => {
  await openKanazawa(page, "chart", "reduce");
  await expect(theEnd(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });

  const route = page.getByRole("link", { name: "Walk it in Google Maps" });
  const address = new URL((await route.getAttribute("href")) ?? "");
  expect(`${address.origin}${address.pathname}`).toBe("https://www.google.com/maps/dir/");
  expect(address.searchParams.get("api")).toBe("1");
  expect(address.searchParams.get("travelmode")).toBe("walking");
  // The first and the last place are its ends, every other one a waypoint, in order.
  expect(address.searchParams.get("waypoints")?.split("|")).toHaveLength(KANAZAWA.stops.length - 2);
  await expect(route).toHaveAttribute("target", "_blank");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Add to calendar" }).click(),
  ]);
  // On the date the page shows the day on, as the server's clock and this one agree on it,
  // never the date it was written for.
  const shownOn = shownWrittenDayAt("kanazawa", new Date())!.itinerary.date;
  expect(download.suggestedFilename()).toBe(`lantern-kanazawa-${shownOn}.ics`);
  const calendar = await readFile(await download.path(), "utf8");
  expect(calendar.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(KANAZAWA.stops.length);
  // Every stop starts on that date, none after midnight.
  const startsThen = new RegExp(`^DTSTART;TZID=Asia/Tokyo:${shownOn.replaceAll("-", "")}T`, "gm");
  expect(calendar.match(startsThen)).toHaveLength(KANAZAWA.stops.length);
  expect(calendar).toContain(`URL:${new URL("/day/kanazawa", page.url()).href}`);

  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
});

/** A phone's screen, where the page's foot is read as the day ends. */
const PHONE = { width: 390, height: 844 };

/** Every frame from the page's start: what the line under the chart shows, and the page's height. */
function sampleTheLineUnderTheChart(): void {
  const frames: { words: string; height: number }[] = [];
  (window as unknown as { underFrames: typeof frames }).underFrames = frames;
  const sample = () => {
    const under = document.querySelector("[data-under-chart]");
    const words = under
      ? [...under.querySelectorAll("p")]
          .filter((line) =>
            line.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
          )
          .map((line) => line.textContent ?? "")
          .join(" ")
      : "";
    frames.push({ words, height: document.documentElement.scrollHeight });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

// Kanazawa's and Nafplio's frames rise to their own last hours as the day is whole, and the
// end waits for them: the line saying how far the day is written stays until the end takes
// its place, and the room the frame gives up is held under it, so a phone reading the page's
// foot sees no empty line and no page shrinking under it (the phone pass, 2026-11-08).
for (const city of ["kanazawa", "nafplio"]) {
  test(
    `with motion, ${city}'s line under the chart gives way to the day's end with no empty frame, the page never shorter`,
    { tag: "@frame" },
    async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.addInitScript(sampleTheLineUnderTheChart);
      await page.goto(`/day/${city}`);
      const underFrames = () =>
        page.evaluate(
          () =>
            (window as unknown as { underFrames: { words: string; height: number }[] }).underFrames,
        );
      // The day's end under the chart, whatever hour it says, and the page at rest after it.
      await expect(page.locator("[data-under-chart]").getByText(/stops? ·/)).toBeVisible({
        timeout: DAY_TIMEOUT_MS,
      });
      await expect
        .poll(
          async () => {
            const last = (await underFrames()).slice(-FRAMES_AT_REST);
            return (
              last.length === FRAMES_AT_REST &&
              last.every(({ height }) => height === last[0]!.height)
            );
          },
          { timeout: REST_TIMEOUT_MS },
        )
        .toBe(true);

      const frames = await underFrames();
      // From the line's last count, every stop's versions written, to the end in its place.
      const from = frames.findIndex(({ words }) =>
        /^Writing quieter and livelier versions · (\d+)\u00A0of\u00A0\1\u00A0stops/.test(words),
      );
      const to = frames.findIndex(({ words }) => /stops? ·/.test(words));
      expect(from, "the line said every stop's versions were being written").toBeGreaterThanOrEqual(
        0,
      );
      expect(to, "the day's end stood").toBeGreaterThan(from);
      const between = frames.slice(from, to + 1);
      expect(between.filter(({ words }) => words.trim() === "")).toEqual([]);
      for (let at = 1; at < between.length; at++) {
        expect(between[at]!.height).toBeGreaterThanOrEqual(between[at - 1]!.height - TOLERANCE_PX);
      }
    },
  );
}
