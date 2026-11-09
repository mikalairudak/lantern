import { expect, test, type Locator, type Page } from "./fixtures";

/**
 * A changed word's fork on the lab's re-plan bench (`docs/decisions.md`, "A changed word
 * proposes its part beside the day, and the visitor takes it"): production's Elche, whose
 * dinner changed to "eating late" proposes a new lunch and evening beside the day, two parts of
 * one fork. The day is never taken away: the proposal is drawn beside it, its own rows where
 * they stood; taking it is a tap, and taking either version back is free and in place; a
 * failure changes nothing. The bench plays the recorded proposal at its live pace, about
 * fifteen seconds, modelled on production's.
 */

const BENCH = "/lab/concepts/replan";
/** The proposal streams for about fifteen seconds at the bench's live pace; a cold server adds a few. */
const DAY_TIMEOUT_MS = 45_000;
/** Elche's rows before its first part, the lunch at 13:15: the proposal never touches them. */
const BEFORE_THE_FORK = 4;
/** Elche's own lunch, which the proposal would replace, and the proposal's lunch and dinner. */
const OWN_LUNCH = "Menú del día on Carrer Major de la Vila";
const NEW_LUNCH = "Arròs on Passeig de l'Estació";
const NEW_DINNER = "Tapas along Carrer Major de la Vila";
/** Less than this between two places is a rounding, not a move. */
const SAME_PX = 1;
/** A 60 Hz frame, to which a busy page's longer gaps between samples are scaled. */
const FRAME_MS = 1000 / 60;
/**
 * The most a row on screen may move in a 60 Hz frame's time as a version dries or folds: a glide,
 * never a step. A page drawing fewer frames moves a row further between two samples, so the step is
 * read as a pace. Rows past the screen's foot ride a tap's glide faster, unseen
 * (`docs/decisions.md`, "A row's words go where its bead comes to rest, and rows ease rather than
 * jump").
 */
const STEP_PX = 8;

const rows = (page: Page): Locator => page.locator('ol[aria-label="The day"] > li');
const rowNamed = (page: Page, name: string): Locator => rows(page).filter({ hasText: name });
const forkRow = (page: Page, part: number): Locator => page.locator(`[data-fork-row="${part}"]`);
/** A fork row with its line, which stands in the margin beside it on a laptop. */
const forkRowAndLine = (page: Page, part: number): Locator =>
  page.locator(`[data-fork-row="${part}"], [data-fork-line="${part}"]`);

async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/** Opens the bench on Elche, to end as named. */
async function openElche(page: Page, ending = "complete"): Promise<void> {
  await page.goto(BENCH);
  if (ending !== "complete") {
    await page.getByRole("button", { name: "Re-plan" }).click();
    await page.getByRole("group", { name: "Ending" }).getByRole("button", { name: ending }).click();
    await page.getByRole("button", { name: "Re-plan" }).click();
    await page.getByRole("button", { name: "Again" }).click();
  }
  await expect(page.locator("h1")).toContainText("Elche", { timeout: DAY_TIMEOUT_MS });
  await waitForTheDay(page);
}

/** Changes Elche's dinner to a late one, from the sentence's word. */
async function eatLate(page: Page): Promise<void> {
  await page.locator("h1").getByRole("button", { name: "early dinner", exact: true }).click();
  await page.getByRole("option", { name: "eating late" }).click();
}

/** The proposal's answer on a fork row, once its proposal is whole. */
function proposalOn(page: Page, part = 0): Locator {
  return forkRow(page, part).getByRole("radio", { name: "eating late, proposed" });
}

/** Each row of the day's chart by its words, and its wire's place under the chart's top. */
function rowPlaces(page: Page): Promise<{ text: string; y: number }[]> {
  return page.evaluate(() => {
    const chart = document.querySelector('[role="group"][aria-label^="The day\'s energy"]');
    const top = chart?.getBoundingClientRect().top ?? 0;
    return [...document.querySelectorAll('ol[aria-label="The day"] > li')].map((row) => ({
      text: row.textContent ?? "",
      y: row.getBoundingClientRect().top - top,
    }));
  });
}

test.describe("under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("draws Elche's proposal beside its day, two parts of one fork, the day's rows where they stood", async ({
    page,
  }) => {
    await openElche(page);
    const before = await rowPlaces(page);

    await eatLate(page);

    // While it is written: the pair in the sentence, the fork rows over both parts, the
    // proposal's answer not yet to be taken, and the day still the visitor's to drag.
    await expect(page.locator("h1")).toContainText("early dinner or eating late");
    await expect(forkRow(page, 0)).toContainText("1 of 2");
    await expect(forkRow(page, 1)).toContainText("2 of 2");
    await expect(proposalOn(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });

    // Whole: the proposal's stops beside the day's, compact and blue, a dashed curve through
    // them, and what it would change said under each fork row.
    await expect(rowNamed(page, NEW_LUNCH)).toHaveCount(1);
    await expect(rowNamed(page, NEW_DINNER)).toHaveCount(1);
    await expect(rowNamed(page, NEW_LUNCH).locator("[data-start-time]")).toHaveClass(/text-swap/);
    expect(await page.locator("[data-proposal-path]").count()).toBeGreaterThan(0);
    // Under its answers on a phone, in the margin beside them on a laptop: seen either way.
    await expect(
      page
        .getByText("Dinner 21:00, not 18:15 · 3 new stops", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await waitForTheDay(page);
    // Every row of the day still there, as it read; those before the fork where they stood.
    const now = await rowPlaces(page);
    for (const row of before) expect(now.map(({ text }) => text)).toContain(row.text);
    for (const row of before.slice(0, BEFORE_THE_FORK)) {
      const same = now.find(({ text }) => text === row.text);
      expect(Math.abs((same?.y ?? Infinity) - row.y), row.text).toBeLessThan(SAME_PX);
    }
  });

  test("takes both parts from either row, in place, and takes the day before back, and compares", async ({
    page,
  }) => {
    await openElche(page);
    await eatLate(page);
    await expect(proposalOn(page, 1)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    // A mark on the day's list, which a day drawn anew would not keep.
    await page
      .locator('ol[aria-label="The day"]')
      .evaluate((list) => list.setAttribute("data-mark", "kept"));

    // From the evening's row: one choice takes both parts.
    await proposalOn(page, 1).click();

    await expect(rowNamed(page, OWN_LUNCH)).toHaveCount(0, { timeout: DAY_TIMEOUT_MS });
    await expect(rowNamed(page, NEW_DINNER)).toHaveCount(1);
    await expect(rowNamed(page, NEW_LUNCH).locator("[data-start-time]")).not.toHaveClass(
      /text-swap/,
    );
    await expect(page.locator("h1")).not.toContainText("early dinner or");
    await expect(page.locator("h1")).toContainText("eating late,");
    await expect(page.locator('ol[aria-label="The day"][data-mark="kept"]')).toHaveCount(1);
    await waitForTheDay(page);

    // The day before, from its fork row: at once, in place, with no call.
    await forkRow(page, 0).getByRole("radio", { name: "early dinner, the day before" }).click();

    await expect(rowNamed(page, OWN_LUNCH)).toHaveCount(1);
    await expect(rowNamed(page, NEW_DINNER)).toHaveCount(0);
    await expect(page.locator("h1")).toContainText("early dinner,");
    await expect(page.locator('ol[aria-label="The day"][data-mark="kept"]')).toHaveCount(1);
    await waitForTheDay(page);

    // Compared, the proposal stands beside the day again, and folds away once more.
    const compare = forkRow(page, 0).getByRole("button", { name: "Compare" });
    await compare.click();
    await expect(rowNamed(page, NEW_DINNER)).toHaveCount(1);
    await expect(compare).toHaveAttribute("aria-pressed", "true");
    await compare.click();
    await expect(rowNamed(page, NEW_DINNER)).toHaveCount(0);
  });

  test("takes the proposal from the keyboard, the answers a radio group", async ({ page }) => {
    await openElche(page);
    await eatLate(page);
    await expect(proposalOn(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });

    await forkRow(page, 0).getByRole("radio", { name: "early dinner, your day" }).focus();
    await page.keyboard.press("ArrowRight");

    await expect(
      forkRow(page, 0).getByRole("radio", { name: "eating late, your day" }),
    ).toBeFocused();
    await expect(rowNamed(page, OWN_LUNCH)).toHaveCount(0, { timeout: DAY_TIMEOUT_MS });
  });

  test("fails without touching the day: the proposal's rows go, and the fork row says why", async ({
    page,
  }) => {
    // Production's own proposal: its new coffee repeats the morning's, which the merge drops.
    await openElche(page, "a stop dropped");
    const before = (await rowPlaces(page)).map(({ text }) => text);

    await eatLate(page);

    await expect(forkRow(page, 0)).toContainText("The new dinner didn't fit", {
      timeout: DAY_TIMEOUT_MS,
    });
    await expect(forkRowAndLine(page, 0).getByRole("button", { name: "Ask again" })).toBeVisible();
    await expect.poll(async () => (await rowPlaces(page)).map(({ text }) => text)).toEqual(before);
    await expect(page.locator("[data-proposal-path]")).toHaveCount(0);
    await expect(page.locator("h1")).not.toContainText(" or ");
  });

  test("the sentence's blue answer takes the visitor to the fork, below the screen on a phone", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "a phone's screen, where the fork stands below it");
    await openElche(page);
    await eatLate(page);
    await expect(proposalOn(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(forkRow(page, 0)).not.toBeInViewport();

    await page
      .locator("h1")
      .getByRole("button", { name: /^eating late, proposed: go to it/ })
      .click();

    await expect(forkRow(page, 0)).toBeInViewport();
    await expect(
      forkRow(page, 0).getByRole("radio", { name: "early dinner, your day" }),
    ).toBeFocused();
  });
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("lands the proposal and takes it moving no row of the day before the fork, and no row in a step", async ({
    page,
  }) => {
    await openElche(page);
    const before = await rowPlaces(page);
    // Every frame from the press: each row's place under the chart's top, by its words.
    await page.evaluate(() => {
      const state = window as unknown as {
        frames: { t: number; rows: { text: string; y: number; isSeen: boolean }[] }[];
      };
      state.frames = [];
      const sample = () => {
        const chart = document.querySelector('[role="group"][aria-label^="The day\'s energy"]');
        const top = chart?.getBoundingClientRect().top ?? 0;
        // The day's rows by their words, and each fork row by its part.
        const drawn = document.querySelectorAll('ol[aria-label="The day"] > li, [data-fork-row]');
        state.frames.push({
          t: performance.now(),
          rows: [...drawn].map((row) => {
            const part = row.getAttribute("data-fork-row");
            const { top: rowTop, bottom } = row.getBoundingClientRect();
            // On screen, and not faded all but out, as a version folding away is.
            const isFaded = Number(getComputedStyle(row).opacity) < 0.05;
            return {
              text: part === null ? (row.textContent ?? "") : `fork row ${part}`,
              y: rowTop - top,
              isSeen: bottom > 0 && rowTop < window.innerHeight && !isFaded,
            };
          }),
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    await eatLate(page);
    await expect(proposalOn(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await proposalOn(page).click();
    await expect(rowNamed(page, OWN_LUNCH)).toHaveCount(0, { timeout: DAY_TIMEOUT_MS });
    await waitForTheDay(page);

    const frames = await page.evaluate(
      () =>
        (
          window as unknown as {
            frames: { t: number; rows: { text: string; y: number; isSeen: boolean }[] }[];
          }
        ).frames,
    );
    // The day's rows before the fork never moved, from the press through the taking.
    for (const row of before.slice(0, BEFORE_THE_FORK)) {
      const ys = frames.flatMap(({ rows: drawn }) =>
        drawn.filter(({ text }) => text === row.text).map(({ y }) => y),
      );
      const moved = Math.max(0, ...ys.map((y) => Math.abs(y - row.y)));
      expect(moved, row.text).toBeLessThan(SAME_PX);
    }
    // No row seen in two samples in a row, a fork row's included, moved faster than a glide's pace
    // while on screen and not faded out, the distance scaled to 60 Hz frames of the time between
    // the samples.
    const steps = frames.slice(1).flatMap((frame, at) => {
      const frames60 = Math.max(1, (frame.t - (frames[at]?.t ?? frame.t)) / FRAME_MS);
      return frame.rows.flatMap(({ text, y, isSeen }) => {
        const last = frames[at]?.rows.find((each) => each.text === text);
        return last === undefined || !(isSeen || last.isSeen)
          ? []
          : [{ text, step: Math.abs(y - last.y) / frames60 }];
      });
    });
    const largest = steps.reduce((most, step) => (step.step > most.step ? step : most), {
      text: "",
      step: 0,
    });
    expect(largest.step, largest.text).toBeLessThanOrEqual(STEP_PX);
  });
});
