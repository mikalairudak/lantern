import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";

/**
 * A changed word's fork moves rows above the screen, and the page under the visitor's eyes stays
 * where it is read (`docs/decisions.md`, "A changed word proposes its part beside the day, and the
 * visitor takes it"). On the chart, rows above the screen making room move the page by as much,
 * so the rows in view stay where they are. On the plan the chart is laid out unseen behind it and
 * holds no view: taking the proposal leaves the plan's rows where they were pressed. Played with
 * motion on the re-plan bench's Elche, whose dinner changed to "eating late" proposes a new lunch
 * and evening, two parts of one fork.
 */

const BENCH = "/lab/concepts/replan";
/** The proposal streams for about fifteen seconds at the bench's live pace; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(45_000);
/** Where on the screen the control is pressed, its middle this far under the screen's top. */
const PRESSED_AT_PX = 205;
/** From the press until the rows the take moves have come to rest, with a margin. */
const WATCHED_MS = waitMs(4500);
/**
 * The most the day's row above the answer may move on the screen after a take, the answer
 * pressed where it stood: a row no version changes, so only the page scrolling moves it. A
 * chart that holds its own first row in view while unseen scrolls the plan's page, and the row
 * with it, by 88 to 114 px on a phone and 56 to 59 px on a laptop.
 */
const PLAN_ROW_PX = 2;
/** Room added under the page, a screen's height and more. */
const ROOM_UNDER_PX = 1000;
/** The afternoon's first stop, under the lunch the proposal rewrites. */
const AFTERNOON = "15:00";
/** Where the afternoon's wire is set on the chart's screen, the lunch's above it out of sight. */
const AFTERNOON_AT_PX = 60;
/**
 * Less than this is a page that did not scroll: the proposal made 75 to 240 px of room above the
 * screen, by the screen's width.
 */
const SCROLLED_PX = 40;
/**
 * How much of the room made above the screen the afternoon's wire may move by while the page
 * follows the rows, as a frame read between a glide's step and the page's sees. Held, it moved 1
 * to 27 px across the widths measured; unheld, 80 to 190 px, all of the room.
 */
const HELD_SHARE = 0.25;

/** A fork row in the view on show: the other view's copy is laid out unseen. */
function shownForkRow(page: Page, part: number): Locator {
  return page.locator(`[data-fork-row="${part}"]`).filter({ visible: true });
}

/** The day's energy, whose chart says it is busy while a day or a proposal is written. */
function theDay(page: Page): Locator {
  return page.locator('[aria-label^="The day\'s energy"]');
}

/** Elche on the bench, written whole, its dinner then changed to a late one. */
async function eatLateInElche(page: Page): Promise<void> {
  await page.goto(BENCH);
  await expect(page.locator("h1")).toContainText("Elche", { timeout: DAY_TIMEOUT_MS });
  await expect(theDay(page)).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  await page.locator("h1").getByRole("button", { name: "early dinner", exact: true }).click();
  await page.getByRole("option", { name: "eating late" }).click();
}

/** Waits for the proposal to stand whole beside the day. */
async function waitForTheProposal(page: Page): Promise<void> {
  await expect(
    shownForkRow(page, 0).getByRole("radio", { name: "eating late, proposed" }),
  ).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await expect(theDay(page)).toHaveAttribute("aria-busy", "false");
}

/**
 * Scrolls at once so `control`'s middle stands `PRESSED_AT_PX` down the screen, and waits until
 * the page and the control stay there.
 */
async function bringToPress(page: Page, control: Locator): Promise<void> {
  await control.evaluate((element, at) => {
    const box = element.getBoundingClientRect();
    window.scrollTo({ top: box.top + box.height / 2 + scrollY - at, behavior: "instant" });
  }, PRESSED_AT_PX);
  await expect
    .poll(() =>
      control.evaluate(
        (element) =>
          new Promise<boolean>((settled) => {
            const from = scrollY;
            const top = element.getBoundingClientRect().top;
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                settled(scrollY === from && element.getBoundingClientRect().top === top),
              ),
            );
          }),
      ),
    )
    .toBe(true);
}

interface Sample {
  scrollY: number;
  /** Where the watched element's top stands on the screen, or null in a frame none is shown. */
  y: number | null;
}

/**
 * Reads every frame from now, until `stopWatching`: the page's scroll, and where the first shown
 * element `selector` finds stands, found anew each frame, since a fork's frame draws its rows
 * anew, and the view not on show holds unseen copies.
 */
async function startWatching(page: Page, selector: string): Promise<void> {
  await page.evaluate((watched) => {
    const state = window as unknown as { watchedFrames: Sample[]; isWatching: boolean };
    state.watchedFrames = [];
    state.isWatching = true;
    const sample = () => {
      // A row folding away is still in the page while it leaves, inert, and a row folded away to
      // no height too: not those.
      const shown = [...document.querySelectorAll(watched)].find(
        (element) =>
          element.closest("[inert]") === null &&
          element.checkVisibility({ visibilityProperty: true }) &&
          element.getBoundingClientRect().height > 0,
      );
      state.watchedFrames.push({ scrollY, y: shown?.getBoundingClientRect().top ?? null });
      if (state.isWatching) requestAnimationFrame(sample);
    };
    sample();
  }, selector);
}

async function stopWatching(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const state = window as unknown as { watchedFrames: Sample[]; isWatching: boolean };
    state.isWatching = false;
    return state.watchedFrames;
  });
}

/** The most `read` strays across `frames` from its first frame's, over the frames that have it. */
function strayOf(frames: readonly Sample[], read: (sample: Sample) => number | null): number {
  const values = frames.flatMap((frame) => {
    const value = read(frame);
    return value === null ? [] : [value];
  });
  const first = values[0];
  if (first === undefined) throw new Error("No frame was read");
  return Math.max(...values.map((value) => Math.abs(value - first)));
}

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("on the chart, the rows in view stay where they are read as the proposal makes room above the screen", async ({
    page,
  }) => {
    test.setTimeout(2 * DAY_TIMEOUT_MS);
    await chooseTheChart(page);
    await eatLateInElche(page);
    // Room under the page, so its end never stops the page short of the lunch above the screen.
    await page.evaluate((room) => {
      document.body.style.paddingBottom = `${room}px`;
    }, ROOM_UNDER_PX);
    // The afternoon's wire on the screen, the lunch's above it.
    const afternoon = page.getByRole("slider", { name: `Energy at ${AFTERNOON}` });
    await afternoon.evaluate((wire, at) => {
      const box = wire.getBoundingClientRect();
      window.scrollTo({ top: box.top + box.height / 2 + scrollY - at, behavior: "instant" });
    }, AFTERNOON_AT_PX);
    const lunch = await page.getByRole("slider", { name: "Energy at 13:15" }).boundingBox();
    expect((lunch?.y ?? 0) + (lunch?.height ?? 0) / 2).toBeLessThan(0);
    await startWatching(page, `[role="slider"][aria-label="Energy at ${AFTERNOON}"]`);

    await waitForTheProposal(page);

    const frames = await stopWatching(page);
    // The page moved by the room the proposal made above the screen, and the wire barely did.
    const scrolled = strayOf(frames, ({ scrollY }) => scrollY);
    expect(scrolled).toBeGreaterThan(SCROLLED_PX);
    expect(strayOf(frames, ({ y }) => y)).toBeLessThan(HELD_SHARE * scrolled);
  });

  test("on the plan, taking the proposal leaves the rows where it was pressed", async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(2 * DAY_TIMEOUT_MS);
    await eatLateInElche(page);
    await waitForTheProposal(page);
    const take = shownForkRow(page, 0).getByRole("radio", { name: "eating late, proposed" });
    await bringToPress(page, take);
    // Short of the page's end, so a page that grows shorter does not move it.
    expect(
      await page.evaluate(() => scrollY + innerHeight < document.documentElement.scrollHeight - 1),
    ).toBe(true);
    const box = await take.boundingBox();
    if (box === null) throw new Error("The proposal's answer has no box");
    // The fork line's answer, the day's, which the answer taken comes to stand in.
    const line = await shownForkRow(page, 0)
      .getByRole("radio", { name: "early dinner, your day" })
      .boundingBox();
    if (line === null) throw new Error("The fork line's answer has no box");
    // The day's row above the answer, which no version changes: the answer itself goes to stand
    // at the first stop of the version taken.
    const above = await take.evaluate((element) => {
      const top = element.getBoundingClientRect().top;
      const rows = document.querySelectorAll<HTMLElement>(
        'ol[aria-label="The day, to read"] > li[data-stop]',
      );
      const over = [...rows].filter(
        (row) => row.checkVisibility() && row.getBoundingClientRect().bottom <= top,
      );
      return over.at(-1)?.dataset.stop ?? null;
    });
    if (above === null) throw new Error("No row of the day stands above the answer");
    await startWatching(page, `ol[aria-label="The day, to read"] > li[data-stop="${above}"]`);

    // With the pointer where the answer stands, as a hand presses it: a locator's click would
    // scroll an answer it finds still moving into view anew.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(WATCHED_MS);

    const frames = await stopWatching(page);
    // Taken: a missed press would leave the page still too.
    await expect(
      shownForkRow(page, 0).getByRole("radio", { name: "eating late, your day" }),
    ).toBeChecked();
    // The row above the press stands still. The page itself may scroll, as the browser keeps
    // it in place while what stands above the screen changes height.
    expect(strayOf(frames, ({ y }) => y)).toBeLessThanOrEqual(PLAN_ROW_PX);
    // Once the rows rest, the answer taken stands on the fork line where the day's stood. Beside
    // the plan that is where it was pressed; in the column, where the slip stands a line under
    // the fork line, it is that line higher.
    const taken = await shownForkRow(page, 0)
      .getByRole("radio", { name: "eating late, your day" })
      .boundingBox();
    expect(Math.abs((taken?.y ?? Infinity) - line.y)).toBeLessThanOrEqual(PLAN_ROW_PX);
    if (isMobile) return;
    expect(Math.abs((taken?.y ?? Infinity) - box.y)).toBeLessThanOrEqual(PLAN_ROW_PX);
  });
});
