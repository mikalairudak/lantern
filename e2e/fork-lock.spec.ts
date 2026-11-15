import { expect, test, type Locator, type Page, waitMs } from "./fixtures";

/**
 * One change at a time, the energy's included (`docs/decisions.md`, "One change at a time, the
 * energy's included"): while a changed word's proposal is written, the energy waits, on the
 * plan's bar and in the headline, and a press says why; the proposal still arrives whole, the
 * day's energy as it was. Once the proposal is whole the energy answers again. Played on the
 * re-plan bench's Elche at its live pace, on the plan, where the bar stands.
 */

const BENCH = "/lab/concepts/replan";
/**
 * The bench's recorded proposal streams for about fifteen seconds at its live pace, modelled on
 * production's; a cold server adds a few.
 */
const DAY_TIMEOUT_MS = waitMs(45_000);
const LOCKED = "one change at a time";
/** The proposal's last new stop, Elche's dinner eaten late. */
const NEW_DINNER = "Tapas along Carrer Major de la Vila";

/** The fork's first row in the view on screen: the other view's copy is laid out unseen. */
function shownForkRow(page: Page): Locator {
  return page.locator('[data-fork-row="0"]').filter({ visible: true });
}

/** The live facts line, outside every unseen copy that holds its room. */
function factsLine(page: Page): Locator {
  return page.locator("header p.type-note:not([aria-hidden] *)").first();
}

function energyBar(page: Page): Locator {
  return page.getByRole("group", { name: "How lively the day is" });
}

test("the energy waits while a proposal is written, on the plan's bar and in the headline, and answers once it is whole", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  await page.goto(BENCH);
  const headline = page.locator("h1");
  await expect(headline).toContainText("Elche", { timeout: DAY_TIMEOUT_MS });
  const chart = page.locator('[aria-label^="The day\'s energy"]');
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  await headline.getByRole("button", { name: "early dinner", exact: true }).click();
  await page.getByRole("option", { name: "eating late" }).click();
  // Pressed once the proposal's last stop has landed and the day is still, a while before the
  // proposal is whole: the moment the day could otherwise be changed under it.
  await expect(
    page.locator('ol[aria-label="The day"] > li').filter({ hasText: NEW_DINNER }),
  ).toHaveCount(1, { timeout: DAY_TIMEOUT_MS });
  await expect(chart).toHaveAttribute("aria-busy", "false");
  await expect(
    shownForkRow(page).getByRole("radio", { name: "eating late, being written" }),
  ).toBeVisible();

  // The bar's word pressed while the proposal is written: nothing changes, and the facts line
  // says why. A locked control is pressed past Playwright's wait for it to be enabled, which
  // would otherwise press it only once the proposal is whole.
  const lively = energyBar(page).getByRole("button", { name: "lively" });
  await lively.click({ force: true });
  await expect(factsLine(page)).toContainText(LOCKED);
  await expect(lively).toHaveAttribute("aria-disabled", "true");
  await expect(headline).toHaveText(/^A balanced /);

  // The headline's energy word, locked as every other word is: no list opens.
  const energyWord = headline.getByRole("button", { name: "balanced", exact: true });
  await expect(energyWord).toHaveAttribute("aria-disabled", "true");
  await energyWord.click({ force: true });
  await expect(page.getByRole("listbox")).toHaveCount(0);

  // The proposal still arrives whole, and the day's energy is as it was.
  await expect(
    shownForkRow(page).getByRole("radio", { name: "eating late, proposed" }),
  ).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await expect(headline).toHaveText(/^A balanced /);
  await expect(energyBar(page).getByRole("button", { name: "balanced" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(factsLine(page)).not.toContainText(LOCKED);
  await expect(energyWord).not.toHaveAttribute("aria-disabled");

  // Whole, the proposal waits for its answer, and the energy answers again.
  await expect(lively).not.toHaveAttribute("aria-disabled");
  await lively.click();
  await expect(headline).toHaveText(/^A lively /);
  await expect(energyBar(page).getByRole("button", { name: "lively" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
