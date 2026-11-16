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
      // Beside the plan, level with its part's fork line.
      expect(box.x).toBeGreaterThanOrEqual(list.x + list.width - 1);
      expect(Math.abs(box.y - fork.y)).toBeLessThan(16);
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
 * The most a row on screen moves in a 60 Hz frame's time on a whole day taken at 1280 px, from
 * the press to rest: what the plan does there with the proposal's day held whole, 5.2 px.
 */
const WHOLE_TAKE_STEP_PX = 5.2;
/**
 * The most the day's last row moves in a frame's time as the part that ends the day is taken
 * back at 1440 px, with the proposal's rows among the day's: 6.7 px.
 */
const TAKE_BACK_LAST_ROW_PX = 6.7;
/** Long enough for a take's rows to come to rest, about 4.5 s, and more. */
const GESTURE_FRAMES = 360;
/** A 60 Hz frame, to which a busy page's longer gaps between samples are scaled. */
const FRAME_MS = 1000 / 60;

/** Each frame from now: each row's top by its stop, and when it was drawn. */
async function sampleRows(page: Page): Promise<void> {
  await page.evaluate((count) => {
    const frames: { t: number; tops: Record<string, number> }[] = [];
    (window as unknown as { rows_: typeof frames }).rows_ = frames;
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

/**
 * The most a row on screen moved in a frame's time, a late frame's move read as a pace;
 * `which` picks the rows looked at.
 */
async function fastestRow(page: Page, which?: (id: string) => boolean): Promise<number> {
  const frames = await page.evaluate(
    () => (window as unknown as { rows_: { t: number; tops: Record<string, number> }[] }).rows_,
  );
  const height = page.viewportSize()?.height ?? 0;
  let pace = 0;
  for (const [at, frame] of frames.entries()) {
    const before = frames[at - 1];
    if (!before) continue;
    const frameCount = Math.max(1, (frame.t - before.t) / FRAME_MS);
    for (const [id, top] of Object.entries(frame.tops)) {
      const was = before.tops[id];
      if (was === undefined || (which && !which(id))) continue;
      const isSeen = (y: number) => y > -40 && y < height;
      if (!isSeen(top) && !isSeen(was)) continue;
      pace = Math.max(pace, Math.abs(top - was) / frameCount);
    }
  }
  return pace;
}

/** How long a row stands within half a pixel before its move is over: a spring's tail is not. */
const STILL_FRAMES = 20;

/**
 * Each way a row's place on the page moved, in order: a run of frames it moved in, over once it
 * has stood within half a pixel for `STILL_FRAMES`, so a glide's slow tail is part of its move.
 */
async function movesOf(page: Page, id: string, count: number): Promise<number[]> {
  await page.evaluate(
    ([stop, frames]) => {
      const places: number[] = [];
      (window as unknown as { places_: number[] }).places_ = places;
      const tick = () => {
        const row = document.querySelector(
          `ol[aria-label="The day, to read"] > li[data-stop="${stop}"]`,
        );
        places.push((row?.getBoundingClientRect().top ?? 0) + window.scrollY);
        if (places.length < frames) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [id, count] as const,
  );
  await page.waitForTimeout((count + 30) * FRAME_MS);
  const places = await page.evaluate(() => (window as unknown as { places_: number[] }).places_);
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
  return moves;
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
      const moves = await movesOf(page, under, 1800);

      expect(moves.filter((move) => move > 0)).toHaveLength(1);
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
    await page.waitForTimeout(GESTURE_FRAMES * FRAME_MS + 1000);

    // The fork line alone holds room in the plan: the slip stands beside it, never in the column.
    const forks = await page.evaluate(() => (window as unknown as { forks_: number[] }).forks_);
    expect(Math.max(...forks)).toBeLessThan(100);
    // No row of the day moves faster than the plan's rows on the same take with the proposal
    // held whole, from the press to rest.
    expect(await fastestRow(page)).toBeLessThanOrEqual(WHOLE_TAKE_STEP_PX);
  });

  test("takes back the part that ends the day with its last row no faster than the plan's rows ever moved", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "A laptop's margin");
    test.setTimeout(2 * DAY_TIMEOUT_MS);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openElche(page);
    await eatLate(page);
    await waitForTheProposal(page);
    const evening = (name: string) =>
      plan(page).locator(`[data-fork-row="1"]`).getByRole("radio", { name }).last();
    // The evening's answer a fifth of the way down the screen, where a reader presses it.
    await evening("eating late, proposed").evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 205),
    );
    await evening("eating late, proposed").click();
    await expect(evening("early dinner, the day before")).toBeVisible();
    await page.waitForTimeout(GESTURE_FRAMES * FRAME_MS);

    await sampleRows(page);
    await evening("early dinner, the day before").click();
    await page.waitForTimeout(GESTURE_FRAMES * FRAME_MS + 1000);

    expect(await fastestRow(page, (id) => id === "stop-8")).toBeLessThanOrEqual(
      TAKE_BACK_LAST_ROW_PX,
    );
  });
});
