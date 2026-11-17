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

test("says in the first slip's head what the slips list once an energy re-picks both versions", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  await openElche(page);
  await eatLate(page);
  await waitForTheProposal(page);

  // Social re-picks the day and the proposal alike: the late stop is a bar, and the lunch stays.
  await page
    .getByRole("group", { name: "How lively the day is" })
    .getByRole("button", { name: "social" })
    .click();
  await expect(page.locator("h1")).toHaveText(/^A social /);

  // The receipt's first line is the first words under the slip's answer.
  const head = (await slip(page, 0).locator("p").first().textContent()) ?? "";
  const said = /(\d+) new stops?/.exec(head);
  const lines = plan(page).locator("[data-slip] li:not([aria-hidden])");
  await expect(lines).toHaveCount(4);
  // A new stop's line says until when; a stop kept says it stays, or the hour it had.
  const marked = await lines.filter({ hasText: "until" }).count();
  expect(Number(said?.[1] ?? 0), `"${head}"`).toBe(marked);
  // The chart's fork, laid out unseen under the plan, says the same: in its row where the line
  // stands under the answers, and beside the row where the chart has a margin.
  const chartFork = page.locator(
    ':is([data-fork-row="0"], [data-fork-line="0"]):not([aria-label="The day, to read"] *)',
  );
  await expect(chartFork.filter({ hasText: head })).toHaveCount(1);
  // An hour it names as dinner is a dinner among the lines.
  const dinner = /Dinner (?:at )?(\d\d:\d\d)/.exec(head)?.[1];
  if (dinner !== undefined) {
    await expect(lines.filter({ hasText: dinner }).filter({ hasText: "dinner" })).toHaveCount(1);
  }
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
 * How long a whole day's fork line on a phone may take from the press to full ink, its room
 * still opening under it: it measures 425 to 431 ms, and the bound stands a little over. The
 * line says that work has begun, and read pale it says less: ink that follows its room takes
 * over seven seconds.
 */
const FORK_LINE_INK_MS = waitMs(600);
/** Long enough to see a fork line inked as slowly as its room opens, over seven seconds. */
const INK_WATCHED_MS = waitMs(8000);

/** A press's moment and, each frame from before it, how opaque the plan's first fork line is. */
interface InkSample {
  pressedAt: number | null;
  frames: { t: number; ink: number | null }[];
}

/**
 * Samples each frame, for `INK_WATCHED_MS`, how opaque the plan's first fork line is as drawn,
 * each opacity it stands in multiplied, null while there is none; and when the next click comes.
 */
async function sampleForkInk(page: Page): Promise<void> {
  await page.evaluate((watched) => {
    const sample: InkSample = { pressedAt: null, frames: [] };
    (window as unknown as { ink_: InkSample }).ink_ = sample;
    document.addEventListener(
      "click",
      () => {
        sample.pressedAt = performance.now();
      },
      { capture: true, once: true },
    );
    const started = performance.now();
    const tick = () => {
      const line = document.querySelector('ol[aria-label="The day, to read"] [data-fork-row="0"]');
      let ink: number | null = line === null ? null : 1;
      for (let at: Element | null = line; at !== null; at = at.parentElement) {
        ink = (ink ?? 1) * Number.parseFloat(getComputedStyle(at).opacity);
      }
      sample.frames.push({ t: performance.now(), ink });
      if (performance.now() - started < watched) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, INK_WATCHED_MS);
}

/** How long from the press the fork line took to stand in full ink; null if it never did. */
async function inkedAfterPress(page: Page): Promise<number | null> {
  await page.waitForFunction(
    (watched) => {
      const frames = (window as unknown as { ink_: InkSample }).ink_.frames;
      return (frames.at(-1)?.t ?? 0) - (frames[0]?.t ?? 0) >= watched - 50;
    },
    INK_WATCHED_MS,
    { timeout: DAY_TIMEOUT_MS },
  );
  const { pressedAt, frames } = await page.evaluate(
    () => (window as unknown as { ink_: InkSample }).ink_,
  );
  if (pressedAt === null) throw new Error("No press was seen");
  const inked = frames.find(({ t, ink }) => t >= pressedAt && ink !== null && ink >= 0.999);
  return inked === undefined ? null : inked.t - pressedAt;
}

test.describe("with motion, outside the frame specs", () => {
  test.use({ reducedMotion: "no-preference" });

  test("inks a whole day's fork line at once on a phone, while its room opens", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "A phone's column, where the room is tallest");
    test.setTimeout(2 * DAY_TIMEOUT_MS);
    await openElche(page);
    await page
      .locator("h1")
      .getByRole("button", { name: /^with / })
      .first()
      .click();
    await sampleForkInk(page);
    await page
      .getByRole("option")
      .filter({ hasText: /friends/ })
      .first()
      .click();

    const inkedMs = await inkedAfterPress(page);
    expect(inkedMs, "the fork line never stood in full ink").not.toBeNull();
    expect(inkedMs ?? Infinity).toBeLessThanOrEqual(FORK_LINE_INK_MS);
  });
});

/**
 * How fast the rows on screen may move as a whole day's proposal is taken at 1280 px, from the
 * press to rest: in a 60 Hz frame's time, and between two frames, however long the one between
 * them took. Over twelve runs with the machine to itself the plan measures 2.7 to 3.0 px a
 * frame's time, and 3.0 to 3.4 px between two frames; the pace bound stands 15% over the most,
 * for the frame timing of a busier run. The step bound is three times the pace bound, room for
 * frames drawn late at that pace. A row that drops by a slip's height in a frame moves tens of
 * pixels.
 */
const WHOLE_TAKE: RowMotion = { pace: 3.5, step: 10.5 };
/**
 * The same as the part that ends the day is taken back at 1440 px, for every row on screen: the
 * plan measures 4.9 to 5.0 px a frame's time, where it was pressed and with the page at its
 * foot alike, and 7.2 to 10.9 px between two frames, over eight runs; the pace bound stands 15%
 * over the most, and the step bound, three times it, room for frames drawn late at that pace. A
 * page that shrinks at once under a view at its foot moves its rows by the whole of what it lost
 * in one frame, sixty pixels on this bench.
 */
const TAKE_BACK: RowMotion = { pace: 5.7, step: 17.1 };
/** The day's last stop on the bench, which the evening taken back draws in again. */
const LAST_STOP = "stop-8";
/**
 * The most the day's last row moves in a frame's time as it is drawn in again where the part was
 * pressed: it measures 2.5 px over four runs, and the bound stands 15% over the most.
 */
const LAST_ROW_BACK_PX = 2.9;
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

/**
 * The most the view may move between two frames as a part is taken: it measures 1 px, and 4 px
 * where a frame comes late, over twenty runs. A view moved at once moves by what the page lost
 * under it, tens of pixels, so the bound tells the two apart with room for a later frame.
 */
const TAKE_VIEW_STEP_PX = 10;
/**
 * The most the view may move in all, its moves summed, from a press short of the page's foot
 * until the plan's rows rest: the unseen chart holds no view while the plan is shown, so the
 * plan's own glides alone may move it. It measures 0 to 11 px over twelve runs; a view carried
 * along with a glide moves by what the page lost under it, fifty pixels and more.
 */
const VIEW_MOVE_TO_REST_PX = 30;
/** A second of frames from the press at least: a take that moved the view at once would do it in the first. */
const VIEW_FRAMES = 60;

/**
 * Samples how far the page is scrolled each frame from now, for a second at least and until the
 * plan's rows rest: the list says it is no longer busy, and the view and the page's height have
 * stood for `STILL_FRAMES`. The height stands for the room beside a slip, which glides without
 * the list saying so.
 */
async function sampleView(page: Page): Promise<void> {
  await page.evaluate(
    ([least, still, most]) => {
      const sample = { view: [window.scrollY], isDone: false };
      (window as unknown as { view_: typeof sample }).view_ = sample;
      let stood = 0;
      let height = document.documentElement.scrollHeight;
      const tick = () => {
        const y = window.scrollY;
        const tall = document.documentElement.scrollHeight;
        stood = y === sample.view.at(-1) && tall === height ? stood + 1 : 0;
        height = tall;
        sample.view.push(y);
        const list = document.querySelector('ol[aria-label="The day, to read"]');
        const isAtRest = list?.getAttribute("aria-busy") === "false" && stood >= still;
        if ((sample.view.length > least && isAtRest) || sample.view.length > most) {
          sample.isDone = true;
        } else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [VIEW_FRAMES, STILL_FRAMES, MOST_FRAMES] as const,
  );
}

/** How far the page was scrolled in each frame sampled, once the rows have come to rest. */
async function sampledView(page: Page): Promise<number[]> {
  await page.waitForFunction(
    () => (window as unknown as { view_?: { isDone: boolean } }).view_?.isDone === true,
    undefined,
    { timeout: DAY_TIMEOUT_MS },
  );
  return page.evaluate(() => (window as unknown as { view_: { view: number[] } }).view_.view);
}

/** The most the view moved between two frames. */
function viewStepOf(view: readonly number[]): number {
  return Math.max(0, ...view.slice(1).map((y, at) => Math.abs(y - (view[at] ?? y))));
}

/** How far the view moved in all, each frame's move counted, so a move and its return add up. */
function viewMoveOf(view: readonly number[]): number {
  return view.slice(1).reduce((sum, y, at) => sum + Math.abs(y - (view[at] ?? y)), 0);
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
 * How fast the rows on screen moved over the frames sampled, each row from where it was last
 * seen, however many frames back, so a day drawn anew across a frame with no rows still shows
 * how far each moved; counted while it stood on screen then or now. `rows` picks the rows looked
 * at.
 */
function rowMotionOf(frames: RowFrame[], height: number, rows?: ReadonlySet<string>): RowMotion {
  const isSeen = (y: number) => y > -40 && y < height;
  const motion: RowMotion = { pace: 0, step: 0 };
  const lastSeen = new Map<string, { top: number; t: number }>();
  for (const frame of frames) {
    for (const [id, top] of Object.entries(frame.tops)) {
      if (rows && !rows.has(id)) continue;
      const was = lastSeen.get(id);
      lastSeen.set(id, { top, t: frame.t });
      if (was === undefined || (!isSeen(top) && !isSeen(was.top))) continue;
      const frameCount = Math.max(1, (frame.t - was.t) / FRAME_MS);
      const step = Math.abs(top - was.top);
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
 * has stood within half a pixel for `STILL_FRAMES`. It cannot see a bounce that comes back within
 * `STILL_FRAMES`: that joins the move around it, or nets to none. Nor does it weigh a move: the
 * push tests read only their directions.
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

/**
 * A press of the pointer where a control stands. A locator's click scrolls a control it finds
 * still moving into view anew before it presses, which no visitor's pointer does, and a test of
 * the view's own motion would read that scroll as the page's.
 */
async function pressWhereItStands(page: Page, control: Locator): Promise<void> {
  const box = await control.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  if (!box || box.y < 0 || box.y + box.height > height) {
    throw new Error("The control is not on screen to be pressed.");
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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
    await pressWhereItStands(page, take);
    const frames = await sampledRows(page);
    // Taken: a press that missed would leave every row still.
    await expect(plan(page).getByRole("radio", { name: "with friends, your day" })).toBeChecked();

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
      await sampleView(page);
      await pressWhereItStands(page, evening("eating late, proposed"));
      // The take never moves the view at once, and hardly at all until its rows rest: the rows
      // it changes fold in and out where they stand.
      const taken = await sampledView(page);
      expect(viewStepOf(taken), "the view stepped at the take").toBeLessThanOrEqual(
        TAKE_VIEW_STEP_PX,
      );
      expect(viewMoveOf(taken), "the view moved after the take").toBeLessThanOrEqual(
        VIEW_MOVE_TO_REST_PX,
      );
      await expect(evening("early dinner, the day before")).toBeVisible();
      // The day taken back where it was taken, or read to its foot: the page scrolled as far as
      // it goes, so a page that shrinks under the hand moves the view.
      if (isAtFoot) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      }

      await sampleRows(page);
      if (!isAtFoot) await sampleView(page);
      await pressWhereItStands(page, evening("early dinner, the day before"));

      const frames = await sampledRows(page);
      // Taken back: a press that missed would leave every row still.
      await expect(evening("early dinner, your day")).toBeChecked();
      // Short of the page's foot, the view hardly moves until the rows rest.
      if (!isAtFoot) {
        expect(
          viewMoveOf(await sampledView(page)),
          "the view moved after the take-back",
        ).toBeLessThanOrEqual(VIEW_MOVE_TO_REST_PX);
      }
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
