import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";

/**
 * A changed word's proposal points to its fork from the sentence (`docs/decisions.md`, "A changed
 * word proposes its part beside the day, and the visitor takes it"): "see it" under the
 * headline and the proposal's blue answer in it each bring the fork's first row into view and
 * give it the focus, in the view the visitor reads, the plan or the chart, on a phone and on a
 * laptop. Played on the re-plan bench's Elche, whose dinner changed to "eating late" proposes a
 * new lunch at 13:15.
 */

const BENCH = "/lab/concepts/replan";
/** The proposal streams for about fifteen seconds at the bench's live pace; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(45_000);

/** The fork's first row in the view on screen: the other view's copy is laid out unseen. */
function shownForkRow(page: Page): Locator {
  return page.locator('[data-fork-row="0"]').filter({ visible: true });
}

/** The live facts line, outside every unseen copy that holds its room. */
function factsLine(page: Page): Locator {
  return page.locator("header p.type-note:not([aria-hidden] *)").first();
}

/** Elche on the bench, its dinner changed to a late one, the proposal whole beside the day. */
async function proposeLateDinner(page: Page): Promise<void> {
  await page.goto(BENCH);
  await expect(page.locator("h1")).toContainText("Elche", { timeout: DAY_TIMEOUT_MS });
  // The day is written whole: its chart, seen or not, is still.
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await page.locator("h1").getByRole("button", { name: "early dinner", exact: true }).click();
  await page.getByRole("option", { name: "eating late" }).click();
  await expect(
    shownForkRow(page).getByRole("radio", { name: "eating late, proposed" }),
  ).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** The fork's first row stands on the screen and its chosen answer, the day's, holds the focus. */
async function expectTheForkReached(page: Page): Promise<void> {
  await expect(shownForkRow(page)).toBeInViewport();
  await expect(
    shownForkRow(page).getByRole("radio", { name: "early dinner, your day" }),
  ).toBeFocused();
}

const POINTERS = {
  "the line's “see it”": (page: Page) =>
    factsLine(page).getByRole("button", { name: /^see it: “eating late” beside / }),
  "the sentence's blue answer": (page: Page) =>
    page.locator("h1").getByRole("button", { name: /^eating late, proposed: go to it/ }),
};

/**
 * The plan, the default view, with motion, where the page scrolls smoothly, and without, where
 * it is there at once; the chart without.
 */
const CASES = [
  { view: "plan", motion: "no-preference" },
  { view: "plan", motion: "reduce" },
  { view: "chart", motion: "reduce" },
] as const;

for (const { view, motion } of CASES) {
  test.describe(`on the ${view}, ${motion === "reduce" ? "under reduced motion" : "with motion"}`, () => {
    test.use({ reducedMotion: motion });
    if (view === "chart") {
      test.beforeEach(async ({ page }) => {
        await chooseTheChart(page);
      });
    }

    for (const [name, pointer] of Object.entries(POINTERS)) {
      test(`${name} brings the fork's first row into view and gives it the focus`, async ({
        page,
      }) => {
        test.setTimeout(2 * DAY_TIMEOUT_MS);
        await proposeLateDinner(page);
        await expect(shownForkRow(page)).not.toBeInViewport();

        await pointer(page).click();

        await expectTheForkReached(page);
      });
    }
  });
}
