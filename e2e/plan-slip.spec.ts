import { expect, test, type Locator, type Page, waitMs } from "./fixtures";
import { DOUBLE_PRESS_MS } from "../src/features/day/plan-fork";

/**
 * A changed word's fork on the plan (`docs/decisions.md`, "The plan lists the day alone, and a
 * part's other version stands beside it as a slip"): the plan's rows are the day and nothing
 * else, and each part's other version stands as a slip at the head of its part, in the column,
 * or in the margin beside it where the day's column is whole. Played on the re-plan bench's
 * Elche, whose dinner changed to "eating late" proposes a new lunch and evening, two parts of one
 * fork, at the bench's live pace, under reduced motion.
 */

const BENCH = "/lab/concepts/replan";
/** The proposal streams for about fifteen seconds at the bench's live pace; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(45_000);
const OWN_LUNCH = "Menú del día on Carrer Major de la Vila";
const NEW_LUNCH = "Arròs on Passeig de l'Estació";
/** The day's column whole, the plan and its margin, in rems (`--container-day-column`). */
const DAY_COLUMN_REMS = 64;

test.use({ reducedMotion: "reduce" });

const plan = (page: Page): Locator => page.getByRole("list", { name: "The day, to read" });
/** The names of the plan's rows: the day's stops, never a slip's lines. */
const rowNames = (page: Page): Promise<string[]> =>
  plan(page).getByRole("heading", { level: 2 }).allTextContents();
const slip = (page: Page, part: number): Locator =>
  plan(page).locator(`[data-fork-row="${part}"] [data-slip]`);

async function openElche(page: Page): Promise<void> {
  await page.goto(BENCH);
  await expect(page.locator("h1")).toContainText("Elche", { timeout: DAY_TIMEOUT_MS });
  // The day is written whole: its chart, laid out unseen under the plan, is still.
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

async function eatLate(page: Page): Promise<void> {
  await page.locator("h1").getByRole("button", { name: "early dinner", exact: true }).click();
  await page.getByRole("option", { name: "eating late" }).click();
}

async function waitForTheProposal(page: Page): Promise<void> {
  await expect(plan(page).getByRole("radio", { name: "eating late, proposed" })).toHaveCount(2, {
    timeout: DAY_TIMEOUT_MS,
  });
}

/** Whether the day's column is whole by the rule the page keys on: its width against 64 rems. */
async function isColumnWhole(page: Page): Promise<boolean> {
  return page.evaluate((rems) => {
    const column = document.querySelector("main")?.getBoundingClientRect().width ?? 0;
    const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return column + 0.5 >= rems * root;
  }, DAY_COLUMN_REMS);
}

test("lists the day alone through the proposal's writing and a take, each part's version in its slip", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  await openElche(page);
  const before = await rowNames(page);
  expect(before).toContain(OWN_LUNCH);

  await eatLate(page);
  await expect(plan(page).getByRole("radio", { name: "eating late, being written" })).toHaveCount(
    2,
  );
  await expect(slip(page, 0)).toContainText(NEW_LUNCH, { timeout: DAY_TIMEOUT_MS });
  expect(await rowNames(page)).toEqual(before);

  await waitForTheProposal(page);
  expect(await rowNames(page)).toEqual(before);
  await expect(slip(page, 0)).toContainText("in place of 13:15");

  await plan(page).getByRole("radio", { name: "eating late, proposed" }).first().click();

  await expect.poll(() => rowNames(page), { timeout: DAY_TIMEOUT_MS }).toContain(NEW_LUNCH);
  expect(await rowNames(page)).not.toContain(OWN_LUNCH);
  // The day before stands in the slip, under the same control, to take back.
  await expect(slip(page, 0)).toContainText(OWN_LUNCH);
  // A second press on the same control within a double press's time does nothing.
  await page.waitForTimeout(DOUBLE_PRESS_MS);
  await plan(page).getByRole("radio", { name: "early dinner, the day before" }).first().click();
  await expect.poll(() => rowNames(page), { timeout: DAY_TIMEOUT_MS }).toEqual(before);
});

test("stands each slip in the margin where the day's column is whole, and in the column otherwise, never wider than the page", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  await openElche(page);
  await eatLate(page);
  await waitForTheProposal(page);

  const isWhole = await isColumnWhole(page);
  const list = await plan(page).boundingBox();
  for (const part of [0, 1]) {
    const box = await slip(page, part).boundingBox();
    const fork = await plan(page).locator(`[data-fork-row="${part}"]`).boundingBox();
    if (!box || !fork || !list) throw new Error("The slip and the plan are drawn");
    if (isWhole) {
      // Beside the plan, level with its part's fork line, its hairline carrying the line's on.
      expect(box.x).toBeGreaterThanOrEqual(list.x + list.width - 1);
      expect(Math.abs(box.y - fork.y)).toBeLessThan(16);
      const beside = await plan(page)
        .locator(`[data-part-head="${part}"] [data-beside]`)
        .boundingBox();
      expect(Math.abs((beside?.y ?? Infinity) - fork.y)).toBeLessThan(0.5);
    } else {
      // Under the fork line, inside the plan's column.
      expect(box.x + box.width).toBeLessThanOrEqual(list.x + list.width + 1);
      expect(box.y).toBeGreaterThan(fork.y);
    }
  }
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});

test("keeps the rule at the widths either side of the column's whole, with no sideways scroll", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "A laptop's widths");
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  await openElche(page);
  await eatLate(page);
  await waitForTheProposal(page);

  for (const width of [1100, 1151, 1152, 1167, 1200]) {
    await page.setViewportSize({ width, height: 800 });
    const isWhole = await isColumnWhole(page);
    await expect
      .poll(async () => {
        const list = await plan(page).boundingBox();
        const box = await slip(page, 0).boundingBox();
        return list !== null && box !== null && box.x >= list.x + list.width - 1;
      })
      .toBe(isWhole);
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways, `at ${width} px`).toBe(0);
  }
});

/**
 * How fast the rows on screen may move as a whole day's proposal is taken at 1280 px, from the
 * press to rest: in a 60 Hz frame's time, and between two frames, however long the one between
 * them took. Over eight runs with the machine to itself the plan measures 2.7 to 3.0 px and 2.8 to
 * 5.2 px; each bound stands 15% over the most, for the frame timing of a busier run. A row that
 * drops by a slip's height in a frame moves tens of pixels.
 */
const WHOLE_TAKE: RowMotion = { pace: 3.4, step: 6 };
/**
 * The same as the part that ends the day is taken back at 1440 px, for every row on screen: the
 * plan measures 6.4 to 7.5 px where it was pressed, over seven runs, and 7 to 8.9 px with the
 * page at its foot, over eleven, as the day's end glides out under the view, a frame's move and a
 * frame's time alike; each bound stands 15% over the most. A page that shrinks at once under a
 * view at its foot moves its rows by the whole of what it lost in one frame.
 */
const TAKE_BACK: RowMotion = { pace: 10.3, step: 10.3 };
/** The day's last stop on the bench, which the evening taken back draws in again. */
const LAST_STOP = "stop-8";
/**
 * The most the day's last row moves in a frame's time as it is drawn in again where the part was
 * pressed: it measures 3.2 to 3.7 px over seven runs, and the bound stands 15% over the most.
 */
const LAST_ROW_BACK_PX = 4.3;
/** Long enough for a take's rows to come to rest, about 4.5 s, and more. */
const GESTURE_FRAMES = 360;
/** A 60 Hz frame, to which a busy page's longer gaps between samples are scaled. */
const FRAME_MS = 1000 / 60;

/** A frame sampled: when it was drawn, and each row's top on the screen by its stop. */
interface RowFrame {
  t: number;
  tops: Record<string, number>;
}

/** Samples each frame from now, `GESTURE_FRAMES` of them. */
async function sampleRows(page: Page): Promise<void> {
  await page.evaluate((count) => {
    const frames: RowFrame[] = [];
    (window as unknown as { rows_: RowFrame[] }).rows_ = frames;
    const tick = () => {
      const tops: Record<string, number> = {};
      const list = document.querySelector('ol[aria-label="The day, to read"]');
      for (const row of list?.querySelectorAll<HTMLElement>(":scope > li[data-stop]") ?? []) {
        tops[row.dataset.stop ?? ""] = row.getBoundingClientRect().top;
      }
      frames.push({ t: performance.now(), tops });
      if (frames.length < count) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, GESTURE_FRAMES);
}

/** The frames sampled, once there are all of them. */
async function sampledRows(page: Page): Promise<RowFrame[]> {
  await page.waitForFunction(
    (count) => ((window as unknown as { rows_?: unknown[] }).rows_?.length ?? 0) >= count,
    GESTURE_FRAMES,
    { timeout: DAY_TIMEOUT_MS },
  );
  return page.evaluate(() => (window as unknown as { rows_: RowFrame[] }).rows_);
}

/** How fast the rows on screen moved. */
interface RowMotion {
  /** The most a row moved in a 60 Hz frame's time, a late frame's move read as a pace. */
  pace: number;
  /**
   * The most a row moved between two frames, however long the one between them took: a jump
   * in one late frame reads slow as a pace.
   */
  step: number;
}

/**
 * How fast the rows on screen moved over the frames sampled, each row from where it stood in
 * the frame before, while it stood on screen in either; `rows` picks the rows looked at.
 */
function rowMotionOf(frames: RowFrame[], height: number, rows?: ReadonlySet<string>): RowMotion {
  const isSeen = (y: number) => y > -40 && y < height;
  const motion: RowMotion = { pace: 0, step: 0 };
  for (const [at, frame] of frames.entries()) {
    const before = frames[at - 1];
    if (!before) continue;
    const frameCount = Math.max(1, (frame.t - before.t) / FRAME_MS);
    for (const [id, top] of Object.entries(frame.tops)) {
      const was = before.tops[id];
      if (was === undefined || (rows && !rows.has(id))) continue;
      if (!isSeen(top) && !isSeen(was)) continue;
      const step = Math.abs(top - was);
      motion.step = Math.max(motion.step, step);
      motion.pace = Math.max(motion.pace, step / frameCount);
    }
  }
  return motion;
}

/**
 * How long a row stands within half a pixel before its move is over. Moves fewer frames apart
 * are one: a spring's last frames creep by less than half a pixel each, and counted on their own
 * they read as a second push no reader sees: held for fewer frames, a slip's glide reads as a push
 * and a tail of 3 px. A third of a second is far shorter than the time between two pushes a
 * reader sees as two, which come seconds apart, as a proposal's lines are written in.
 */
const STILL_FRAMES = 20;
/** After the proposal is whole, long enough for its slip to give back what it held and rest. */
const AFTER_WHOLE_FRAMES = 360;
/** The most frames sampled from the press: the bench writes its proposal in about 15 s. */
const MOST_FRAMES = 3600;

/** Each way a row moved on the page from the press, and whether the proposal was seen whole. */
interface RowMoves {
  moves: number[];
  isWholeSeen: boolean;
}

/**
 * Each way a row's place on the page moved from the press until the proposal has been whole for
 * `AFTER_WHOLE_FRAMES`, in order, down and up alike: a run of frames it moved in, over once it
 * has stood within half a pixel for `STILL_FRAMES`.
 */
async function movesOf(page: Page, id: string): Promise<RowMoves> {
  await page.evaluate(
    ([stop, after, most]) => {
      const sample = { places: [] as number[], wholeAt: -1, isDone: false };
      (window as unknown as { moves_: typeof sample }).moves_ = sample;
      const tick = () => {
        const list = document.querySelector('ol[aria-label="The day, to read"]');
        const row = list?.querySelector(`:scope > li[data-stop="${stop}"]`);
        sample.places.push((row?.getBoundingClientRect().top ?? 0) + window.scrollY);
        const isWhole = list?.querySelector('[role="radio"][aria-label$=", proposed"]') != null;
        if (isWhole && sample.wholeAt === -1) sample.wholeAt = sample.places.length - 1;
        const isOver =
          sample.places.length >= most ||
          (sample.wholeAt !== -1 && sample.places.length - sample.wholeAt >= after);
        if (isOver) sample.isDone = true;
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [id, AFTER_WHOLE_FRAMES, MOST_FRAMES] as const,
  );
  await page.waitForFunction(
    () => (window as unknown as { moves_: { isDone: boolean } }).moves_.isDone,
    undefined,
    { timeout: 2 * DAY_TIMEOUT_MS },
  );
  const { places, wholeAt } = await page.evaluate(
    () => (window as unknown as { moves_: { places: number[]; wholeAt: number } }).moves_,
  );
  const moves: number[] = [];
  let from = places[0] ?? 0;
  let rest = from;
  let still = 0;
  for (const place of places) {
    if (Math.abs(place - rest) > 0.5) {
      rest = place;
      still = 0;
    } else if (++still === STILL_FRAMES && Math.abs(place - from) > 1) {
      moves.push(Math.round(place - from));
      from = place;
    } else if (still === STILL_FRAMES) {
      from = place;
    }
  }
  const last = places.at(-1) ?? from;
  if (Math.abs(last - from) > 1) moves.push(Math.round(last - from));
  return { moves, isWholeSeen: wholeAt !== -1 && places.length - wholeAt >= AFTER_WHOLE_FRAMES };
}

test.describe("with motion", { tag: "@frame" }, () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { name, word, option, under } of [
    { name: "a part", word: "early dinner", option: "eating late", under: "stop-5" },
    { name: "a whole day", word: /^with /, option: /friends/, under: "stop-1" },
  ]) {
    test(`pushes the rows under the slip of ${name} once, from the press to the proposal whole`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "A phone's column");
      test.setTimeout(3 * DAY_TIMEOUT_MS);
      await openElche(page);
      const row = plan(page).locator(`li[data-stop="${under}"]`);
      await row.evaluate((element) =>
        window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 500),
      );
      await page.locator("h1").getByRole("button", { name: word }).first().click();
      await page.getByRole("option", { name: option }).first().click();

      // From the press, through the proposal written at the bench's live pace, to rest.
      const { moves, isWholeSeen } = await movesOf(page, under);

      expect(isWholeSeen).toBe(true);
      // Down once as the slip takes its room from the press, then, at most, up once as it gives
      // back what it held beyond the proposal.
      const directions = moves.map((move) => (move > 0 ? "down" : "up")).join(" ");
      expect(["down", "down up"], `moves ${moves.join(", ")}`).toContain(directions);
    });
  }

  test("takes a whole day's proposal with its slip in the margin from the first frame, no row dropping", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "The margin is a laptop's");
    test.setTimeout(2 * DAY_TIMEOUT_MS);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openElche(page);
    // A word the bench writes again whole: the taken day is a run of its own, drawn anew.
    await page
      .locator("h1")
      .getByRole("button", { name: /^with / })
      .first()
      .click();
    await page
      .getByRole("option")
      .filter({ hasText: /friends/ })
      .first()
      .click();
    const take = plan(page).getByRole("radio", { name: "with friends, proposed" });
    await expect(take).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await take.scrollIntoViewIfNeeded();

    // Each frame from the press: the fork line's height, and each row's top by its stop.
    await page.evaluate(() => {
      const forks: number[] = [];
      (window as unknown as { forks_: number[] }).forks_ = forks;
      const tick = () => {
        const list = document.querySelector('ol[aria-label="The day, to read"]');
        forks.push(list?.querySelector('[data-fork-row="0"]')?.getBoundingClientRect().height ?? 0);
        if (forks.length < 60) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await sampleRows(page);
    await take.click();
    const frames = await sampledRows(page);

    // The fork line alone holds room in the plan: the slip stands beside it, never in the column.
    const forks = await page.evaluate(() => (window as unknown as { forks_: number[] }).forks_);
    expect(Math.max(...forks)).toBeLessThan(100);
    // No row of the day moves faster than the plan's rows ever do, from the press to rest.
    const motion = rowMotionOf(frames, page.viewportSize()?.height ?? 0);
    expect(motion.pace).toBeLessThanOrEqual(WHOLE_TAKE.pace);
    expect(motion.step).toBeLessThanOrEqual(WHOLE_TAKE.step);
  });

  // Where it was pressed, on a screen tall enough that the day's last row comes in on it.
  for (const { where, isAtFoot, height } of [
    { where: "where it was pressed", isAtFoot: false, height: 1100 },
    { where: "with the page at its foot", isAtFoot: true, height: 900 },
  ]) {
    test(`takes back the part that ends the day ${where}, no row on screen moving faster than the plan's rows ever do`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "A laptop's margin");
      test.setTimeout(2 * DAY_TIMEOUT_MS);
      await page.setViewportSize({ width: 1440, height });
      await openElche(page);
      await eatLate(page);
      await waitForTheProposal(page);
      const evening = (name: string) =>
        plan(page).locator(`[data-fork-row="1"]`).getByRole("radio", { name }).last();
      // The evening's answer near the top of the screen, where a reader presses it.
      await evening("eating late, proposed").evaluate((element) =>
        window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 205),
      );
      const pressedAt = await page.evaluate(() => window.scrollY);
      await evening("eating late, proposed").click();
      // The take moves the view no further at once than a glide's frame: the rows it changes
      // fold in and out where they stand.
      const takenAt = await page.evaluate(() => window.scrollY);
      expect(Math.abs(takenAt - pressedAt), "the view moved at the take").toBeLessThan(10);
      await expect(evening("early dinner, the day before")).toBeVisible();
      await page.waitForTimeout(GESTURE_FRAMES * FRAME_MS);
      // The day taken back where it was taken, or read to its foot: the page scrolled as far as
      // it goes, so a page that shrinks under the hand moves the view.
      if (isAtFoot) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      }

      await sampleRows(page);
      await evening("early dinner, the day before").click();

      const frames = await sampledRows(page);
      // Every row on screen: those there at the press, and those the day before draws in.
      const motion = rowMotionOf(frames, height);
      expect(motion.pace).toBeLessThanOrEqual(TAKE_BACK.pace);
      expect(motion.step).toBeLessThanOrEqual(TAKE_BACK.step);
      // Where it was pressed, the last row comes in on screen, at the rows' pace.
      if (!isAtFoot) {
        expect(frames.some(({ tops }) => (tops[LAST_STOP] ?? height) < height)).toBe(true);
        const last = rowMotionOf(frames, height, new Set([LAST_STOP]));
        expect(last.pace).toBeLessThanOrEqual(LAST_ROW_BACK_PX);
      }
    });
  }
});
