import { expect, test, type Page } from "./fixtures";

/**
 * Where a visitor looks once they have pressed a word, the facts line says what its fork is
 * doing and where, or why the word came back (`forkNoteOf`; the phone pass, 2026-11-08). On a
 * phone a fork's rows are usually below the screen, and the page never scrolls by itself: "see
 * it at" leads there on a press. Played on the re-plan bench's Elche at its live pace.
 */

const BENCH = "/lab/concepts/replan";
/** The phone pass's own screen, its browser's bars taking their share. */
const PHONE = { width: 390, height: 664 };
const DAY_TIMEOUT_MS = 60_000;
const STORY_TIMEOUT_MS = 120_000;

/** Elche on the bench, its re-plans ending as `ending` says, the day written to its end. */
async function openElche(page: Page, ending: "complete" | "busy"): Promise<void> {
  await page.setViewportSize(PHONE);
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await controls.getByRole("group", { name: "Day" }).getByRole("button", { name: "Elche" }).click();
  await controls
    .getByRole("group", { name: "Ending" })
    .getByRole("button", { name: ending })
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

  await expect(factsLine(page)).toHaveText(
    /^Writing “eating late” for .+ ·\u00A0see it at 13:15$/,
    {
      timeout: DAY_TIMEOUT_MS,
    },
  );
  expect(await isOnScreen(page, factsLine(page))).toBe(true);
  // Nothing scrolls by itself: the fork's first row is below the screen until the press.
  const row = page.locator('[data-fork-row="0"]').first();
  expect(await isOnScreen(page, row)).toBe(false);

  await factsLine(page)
    .getByRole("button", { name: /^see it at/ })
    .click();

  await expect.poll(() => isOnScreen(page, row), { timeout: DAY_TIMEOUT_MS }).toBe(true);
});
