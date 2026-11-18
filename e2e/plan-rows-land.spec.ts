import { expect, test, type Page, waitMs } from "./fixtures";
import { ALICANTE_DAY } from "../src/lib/fixtures/curated/alicante";
import { formatClock, parseClock } from "../src/lib/time/clock";

/**
 * The plan under reduced motion, frame by frame, while a day is written at the bench's live
 * pace (`docs/decisions.md`, "A day can be read as a list, written as the chart is"): a row
 * lands whole once its words are final, long before the stops' versions are written; its words
 * never change after; and its versions come in as a step of the rows below it, in one frame.
 */

const BENCH = "/lab/concepts/day";
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };
/** Alicante's day at a live model's pace takes about a minute; a cold server adds a few seconds. */
const DAY_TIMEOUT_MS = waitMs(120_000);
/**
 * How long the first row stands before any row has its versions, at the least: a live model
 * writes the stops over about half the day's minute, and the versions after them.
 */
const ROW_AHEAD_OF_VERSIONS_MS = 5000;

/** A row's state as one frame drew it, kept only when it changed. */
interface RowEvent {
  frame: number;
  t: number;
  top: number;
  height: number;
  hasVersions: boolean;
}

interface RowRecord {
  landedAt: number;
  /** The words the row says of its own stop as it landed. */
  words: string;
  /** Every other set of words the row was drawn with after it landed. */
  changedWords: string[];
  events: RowEvent[];
}

interface Recording {
  armedAt: number | null;
  listAt: number | null;
  frames: number;
  rows: Record<string, RowRecord>;
  /** The order the rows stand in, as last drawn. */
  order: string[];
  writtenFrame: number | null;
}

/**
 * Samples the plan every frame from the next one on its own row of the list, once it has
 * stood empty: the day before's rows, which share their ids, are never counted.
 */
async function recordThePlan(page: Page): Promise<void> {
  await page.evaluate(() => {
    const recording: Recording = {
      armedAt: null,
      listAt: null,
      frames: 0,
      rows: {},
      order: [],
      writtenFrame: null,
    };
    (window as unknown as { recording: Recording }).recording = recording;
    /**
     * The words a row says of its own stop, as heard: without the versions drawn beside it, the
     * arrows that name them or the hint that tells how to swipe.
     */
    const wordsOf = (row: Element): string => {
      const copy = row.cloneNode(true) as Element;
      for (const other of copy.querySelectorAll("[aria-hidden], button, .sr-only")) other.remove();
      return copy.textContent ?? "";
    };
    const sample = () => {
      const list = document.querySelector('ol[aria-label="The day, to read"]');
      const rows = list ? [...list.querySelectorAll(":scope > li[data-stop]")] : [];
      const t = performance.now();
      if (recording.armedAt === null) {
        if (rows.length === 0) recording.armedAt = t;
        requestAnimationFrame(sample);
        return;
      }
      recording.frames += 1;
      const frame = recording.frames;
      if (list && recording.listAt === null) recording.listAt = t;
      const listTop = list?.getBoundingClientRect().top ?? 0;
      recording.order = rows.map((row) => row.getAttribute("data-stop") ?? "");
      for (const row of rows) {
        const id = row.getAttribute("data-stop") ?? "";
        const box = row.getBoundingClientRect();
        const event: RowEvent = {
          frame,
          t,
          top: Math.round((box.top - listTop) * 10) / 10,
          height: Math.round(box.height * 10) / 10,
          hasVersions: [...row.querySelectorAll("button")].some((arrow) =>
            /^(Quieter|Livelier|Same energy): /.test(arrow.getAttribute("aria-label") ?? ""),
          ),
        };
        const words = wordsOf(row);
        const known = recording.rows[id];
        if (!known) {
          recording.rows[id] = {
            landedAt: t,
            words,
            changedWords: [],
            events: [event],
          };
          continue;
        }
        if (words !== known.words && !known.changedWords.includes(words)) {
          known.changedWords.push(words);
        }
        const last = known.events.at(-1)!;
        if (
          last.top !== event.top ||
          last.height !== event.height ||
          last.hasVersions !== event.hasVersions
        ) {
          known.events.push(event);
        }
      }
      if (recording.writtenFrame === null && list?.getAttribute("aria-busy") === "false") {
        recording.writtenFrame = frame;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

/** Plays Alicante's day on the bench at a live model's pace, recording its plan. */
async function playAlicante(page: Page): Promise<Recording> {
  await page.goto(BENCH);
  const list = page.getByRole("list", { name: "The day, to read" });
  // The bench's first play, at its own pace, written whole before Alicante's is asked.
  await expect(list).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Ending" }).click();
  await controls.getByRole("combobox", { name: "Pace" }).selectOption("A live model");
  await recordThePlan(page);
  // A new day remounts the bench's, which plays it at the pace chosen.
  await controls.getByRole("combobox", { name: "Day" }).selectOption("Alicante");
  await expect(page.locator("h1")).toContainText("Alicante", { timeout: DAY_TIMEOUT_MS });
  await page.waitForFunction(
    () => (window as unknown as { recording: Recording }).recording.writtenFrame !== null,
    null,
    { timeout: DAY_TIMEOUT_MS, polling: 500 },
  );
  return page.evaluate(() => (window as unknown as { recording: Recording }).recording);
}

/** The frames a row's height changed in after it landed, with how far, and whether its versions came then. */
function heightStepsOf(record: RowRecord) {
  return record.events.slice(1).flatMap((event, at) => {
    const before = record.events[at]!;
    if (event.height === before.height) return [];
    return [
      {
        frame: event.frame,
        px: event.height - before.height,
        isVersions: event.hasVersions && !before.hasVersions,
      },
    ];
  });
}

test.describe("under reduced motion", { tag: "@frame" }, () => {
  test.use({ reducedMotion: "reduce" });

  test("a row lands whole before the versions, keeps its words, and its versions step the rows below in one frame", async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(3 * DAY_TIMEOUT_MS);
    await page.setViewportSize(isMobile ? PHONE : LAPTOP);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const recording = await playAlicante(page);
    const ids = recording.order;
    const records = ids.map((id) => recording.rows[id]!);
    expect(records.length).toBeGreaterThan(1);

    // (a) The first row stands well before any row has its versions.
    const firstRowAt = Math.min(...records.map((record) => record.landedAt));
    const versionsAt = Math.min(
      ...records.flatMap((record) =>
        record.events.filter((event) => event.hasVersions).map((event) => event.t),
      ),
    );
    const listAt = recording.listAt ?? firstRowAt;

    // (b) Each row lands with its own stop's words, as the day has them, and they never change.
    const misread = records.flatMap((record, at) => {
      const id = ids[at]!;
      const stop = ALICANTE_DAY.day.stops[Number(id.replace("stop-", ""))];
      if (!stop) return [`${id}: no such stop`];
      const until = `until\u00a0${formatClock((parseClock(stop.startTime) ?? 0) + stop.durationMinutes)}`;
      const own = [`${stop.startTime}${stop.place.name}`, until, stop.place.summary];
      return own.every((words) => record.words.includes(words))
        ? []
        : [`${id}: "${record.words}" for ${own.join(" | ")}`];
    });
    const changed = records.flatMap((record, at) =>
      record.changedWords.map((words) => `${ids[at]}: "${record.words}" became "${words}"`),
    );

    // (c) A row's height changes only in the frame its versions come in, once; the last row's
    // once more as the list is written, when the sun's lines after it join it. A row's top moves
    // only in a frame where a row above it changed height: never a frame in between.
    const steps = records.map(heightStepsOf);
    const strayHeights = steps.flatMap((rowSteps, at) =>
      rowSteps
        .filter(
          (step) =>
            !step.isVersions && !(at === ids.length - 1 && step.frame >= recording.writtenFrame!),
        )
        .map((step) => `${ids[at]} by ${step.px} px in frame ${step.frame}`),
    );
    const strayTops = records.flatMap((record, at) =>
      record.events.slice(1).flatMap((event, index) => {
        const before = record.events[index]!;
        if (event.top === before.top) return [];
        const isAboveStepped = steps
          .slice(0, at)
          .some((rowSteps) => rowSteps.some((step) => step.frame === event.frame));
        return isAboveStepped
          ? []
          : [`${ids[at]} from ${before.top} to ${event.top} in frame ${event.frame}`];
      }),
    );
    const versionSteps = steps.flatMap((rowSteps) =>
      rowSteps.filter((step) => step.isVersions).map((step) => Math.round(step.px)),
    );

    test.info().annotations.push({
      type: "measured",
      description: `first row ${Math.round(firstRowAt - recording.armedAt!)} ms after the day was asked, ${Math.round(firstRowAt - listAt)} ms after the list was drawn, first versions ${Math.round(versionsAt - firstRowAt)} ms after it; ${versionSteps.length} version steps of ${Math.min(...versionSteps)} to ${Math.max(...versionSteps)} px; ${recording.frames} frames`,
    });
    expect(versionsAt - firstRowAt).toBeGreaterThan(ROW_AHEAD_OF_VERSIONS_MS);
    expect(misread).toEqual([]);
    expect(changed).toEqual([]);
    expect(strayHeights).toEqual([]);
    expect(strayTops).toEqual([]);
    expect(versionSteps.length).toBeGreaterThan(0);
  });
});
