import { expect, test, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/**
 * Where a visitor looks once they have pressed a word, the facts line says what its fork is
 * doing and where, or why the word came back (`forkNoteOf`; the phone pass, 2026-11-08). On a
 * phone a fork's rows are usually below the screen, and the page never scrolls by itself: "see
 * it" leads there on a press. Played on the re-plan bench's Elche at its live pace.
 */

const BENCH = "/lab/concepts/replan";
/** The phone pass's own screen, its browser's bars taking their share. */
const PHONE = { width: 390, height: 664 };
const LAPTOP = { width: 1440, height: 900 };
const DAY_TIMEOUT_MS = waitMs(60_000);
const STORY_TIMEOUT_MS = waitMs(120_000);

/**
 * Elche on the bench, its re-plans ending as `ending` says, at the pace given, the day written
 * to its end.
 */
async function openElche(
  page: Page,
  ending: "complete" | "busy",
  { size = PHONE, pace = "live" }: { size?: typeof PHONE; pace?: "live" | "slow" } = {},
): Promise<void> {
  await page.setViewportSize(size);
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await controls.getByRole("group", { name: "Day" }).getByRole("button", { name: "Elche" }).click();
  await controls
    .getByRole("group", { name: "Ending" })
    .getByRole("button", { name: ending })
    .click();
  await controls
    .getByRole("group", { name: "Re-plan pace" })
    .getByRole("button", { name: pace })
    .click();
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

async function changeDinner(page: Page): Promise<void> {
  await page
    .getByRole("heading", { level: 1 })
    .getByRole("button", { name: /^early dinner/ })
    .click();
  await page.getByRole("option", { name: /eating late/ }).click();
}

/** The live facts line, outside every unseen copy that holds its room. */
function factsLine(page: Page) {
  return page.locator("header p.type-note:not([aria-hidden] *)").first();
}

/** Whether a box stands wholly inside the phone's screen. */
async function isOnScreen(page: Page, locator: ReturnType<Page["locator"]>): Promise<boolean> {
  const box = await locator.boundingBox();
  return box !== null && box.y >= 0 && box.y + box.height <= PHONE.height;
}

test("a proposal that could not be written says on the screen why the word came back, and asks again", async ({
  page,
}) => {
  test.setTimeout(STORY_TIMEOUT_MS);
  await openElche(page, "busy");

  await changeDinner(page);

  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toContainText("early dinner", { timeout: DAY_TIMEOUT_MS });
  await expect(factsLine(page)).toHaveText(
    "Couldn't re-plan just now, so “early dinner” stays ·\u00A0Ask again",
    { timeout: DAY_TIMEOUT_MS },
  );
  expect(await isOnScreen(page, factsLine(page))).toBe(true);
  await expect(factsLine(page).getByRole("button", { name: "Ask again" })).toBeVisible();
});

test("a proposal being written says on the screen what it writes and where, and leads there on a press", async ({
  page,
}) => {
  test.setTimeout(STORY_TIMEOUT_MS);
  await openElche(page, "complete");

  await changeDinner(page);

  await expect(factsLine(page)).toHaveText(/^Writing “eating late” for .+ ·\u00A0see it$/, {
    timeout: DAY_TIMEOUT_MS,
  });
  expect(await isOnScreen(page, factsLine(page))).toBe(true);
  // Nothing scrolls by itself: the fork's first row is below the screen until the press.
  const row = page.locator('[data-fork-row="0"]').first();
  expect(await isOnScreen(page, row)).toBe(false);

  await factsLine(page)
    .getByRole("button", {
      name: "see it: “eating late” beside lunch, the afternoon, dinner and the evening",
    })
    .click();

  await expect.poll(() => isOnScreen(page, row), { timeout: DAY_TIMEOUT_MS }).toBe(true);
});

/** The top of the chart's energy, which stands under the head: it moves when the head grows. */
async function chartTopOf(page: Page): Promise<number | undefined> {
  const box = await page.getByRole("group", { name: /The day's energy/ }).boundingBox();
  return box?.y;
}

for (const [name, size] of [
  ["a phone", PHONE],
  ["a laptop", LAPTOP],
] as const) {
  test(`a second word says on ${name} that the proposal standing was set aside, then what it writes, in the room the head holds`, async ({
    page,
  }) => {
    test.setTimeout(STORY_TIMEOUT_MS);
    // At the slow pace, so the second word's proposal is still written once the first note has
    // been said.
    await openElche(page, "complete", { size, pace: "slow" });
    await changeDinner(page);
    await expect(factsLine(page)).toHaveText(/^“eating late” drawn beside .+ ·\u00A0see it$/, {
      timeout: DAY_TIMEOUT_MS,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    const chartTop = await chartTopOf(page);

    await page
      .getByRole("heading", { level: 1 })
      .getByRole("button", { name: /^home by eleven/ })
      .click();
    await page.getByRole("option", { name: /out late/ }).click();

    // The bench's proposals name no id, so the one set aside is kept nowhere.
    await expect(factsLine(page)).toHaveText("“eating late” not kept");
    expect(await isOnScreen(page, factsLine(page))).toBe(true);
    expect(await chartTopOf(page)).toBe(chartTop);
    await expect(factsLine(page)).toHaveText("Writing “out late” for the evening ·\u00A0see it", {
      timeout: DAY_TIMEOUT_MS,
    });
    expect(await chartTopOf(page)).toBe(chartTop);
  });
}
