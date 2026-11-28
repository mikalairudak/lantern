import { expect, test, type Locator, type Page, waitMs } from "./fixtures";
import { logStatuses } from "./status-log";
import { STATUS_STANDS_MS } from "../src/features/day/notice-status";

/**
 * One change at a time, the energy's included (`docs/decisions.md`, "One change at a time, the
 * energy's included"): while a changed word's proposal is written, the energy waits, on the
 * plan's bar and in the headline, and a press says why; the proposal still arrives whole, the
 * day's energy as it was. Once the proposal is whole the energy answers again, and the proposal
 * stands through it. Played on the re-plan bench's Elche at its live pace, on the plan, where
 * the bar stands.
 */

const BENCH = "/lab/concepts/replan";
/**
 * The bench's recorded proposal streams for about fifteen seconds at its live pace, modelled on
 * production's; a cold server adds a few.
 */
const DAY_TIMEOUT_MS = waitMs(45_000);
const LOCKED = "one change at a time";
/**
 * How much of its stand the log must see the fork's status keep, empty, before its words: the
 * log notes the status coming onto the page once the press's task is done, which on a phone
 * opening the fork is a long one, so it may note the status a good part of the stand late.
 */
const STAND_SEEN_SHARE = 0.5;
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
    shownForkRow(page).getByRole("radio", {
      name: "eating late, being written",
      exact: true,
    }),
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
    shownForkRow(page).getByRole("radio", { name: "eating late Take, proposed" }),
  ).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await expect(headline).toHaveText(/^A balanced /);
  await expect(energyBar(page).getByRole("button", { name: "balanced" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(factsLine(page)).not.toContainText(LOCKED);
  await expect(energyWord).not.toHaveAttribute("aria-disabled");

  // Whole, the proposal waits for its answer, and the energy answers again: the day re-picks,
  // and the proposal stands beside it, still to take, nothing set aside.
  await expect(lively).not.toHaveAttribute("aria-disabled");
  await lively.click();
  await expect(headline).toHaveText(/^A lively /);
  await expect(energyBar(page).getByRole("button", { name: "lively" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    shownForkRow(page).getByRole("radio", { name: "eating late Take, proposed" }),
  ).toBeVisible();
  await expect(factsLine(page)).not.toContainText("set aside");
  await expect(factsLine(page)).not.toContainText("not kept");
});

/** What the page's statuses said, in order, as `logStatuses` logged it. */
function statusLogOf(page: Page) {
  return page.evaluate(() => window.statusLog);
}

/** Elche on the bench, its re-plans ending as `ending` says, the day written to its end. */
async function openElcheEnding(page: Page, ending: "complete" | "busy"): Promise<Locator> {
  await page.addInitScript(logStatuses);
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await controls
    .getByRole("group", { name: "Ending" })
    .getByRole("button", { name: ending })
    .click();
  await controls.getByRole("button", { name: "Re-plan" }).click();
  const headline = page.locator("h1");
  await expect(headline).toContainText("Elche", { timeout: DAY_TIMEOUT_MS });
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  return headline;
}

test("each press on a waiting word says one change at a time again, the facts line as it stood", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  const headline = await openElcheEnding(page, "complete");
  await headline.getByRole("button", { name: "early dinner", exact: true }).click();
  await page.getByRole("option", { name: "eating late" }).click();
  await expect(
    shownForkRow(page).getByRole("radio", { name: "eating late, being written", exact: true }),
  ).toBeVisible({ timeout: DAY_TIMEOUT_MS });

  const lively = energyBar(page).getByRole("button", { name: "lively" });
  const onFoot = headline.getByRole("button", { name: /^on foot/ });
  const since = await page.evaluate(() => performance.now());
  // The bar's word twice, then a word of the headline twice: four presses, each answered.
  for (const word of [lively, lively, onFoot, onFoot]) {
    const saidBefore = (await statusLogOf(page)).filter((entry) => entry.text === LOCKED).length;
    await word.click({ force: true });
    await expect
      .poll(async () => (await statusLogOf(page)).filter((entry) => entry.text === LOCKED).length)
      .toBe(saidBefore + 1);
  }
  await expect(factsLine(page)).toContainText(LOCKED);

  const log = (await statusLogOf(page)).filter((entry) => entry.t >= since);
  const said = log.filter((entry) => entry.text === LOCKED);
  expect(said).toHaveLength(4);
  // One status, emptied at each press and written again: each a change a screen reader hears.
  expect(new Set(said.map((entry) => entry.id)).size).toBe(1);
  expect(said.every((entry) => entry.kind === "changed")).toBe(true);
  const between = log.filter((entry) => entry.id === said[0]!.id && entry.text !== LOCKED);
  expect(between.map((entry) => entry.text)).toEqual(["", "", "", ""]);
});

test("a re-plan the route refuses at once is said from a status that stood before its words", async ({
  page,
}) => {
  test.setTimeout(2 * DAY_TIMEOUT_MS);
  const headline = await openElcheEnding(page, "busy");
  const NOT_JUST_NOW = "Couldn't re-plan just now";
  const pressed = await page.evaluate(() => performance.now());
  await headline.getByRole("button", { name: "early dinner", exact: true }).click();
  await page.getByRole("option", { name: "eating late" }).click();
  await expect(shownForkRow(page).getByText(NOT_JUST_NOW, { exact: false }).first()).toBeVisible({
    timeout: DAY_TIMEOUT_MS,
  });
  await expect
    .poll(async () =>
      (await statusLogOf(page)).some((entry) => entry.text.startsWith(NOT_JUST_NOW)),
    )
    .toBe(true);

  const log = await statusLogOf(page);
  const said = log.filter((entry) => entry.t >= pressed && entry.text.startsWith(NOT_JUST_NOW));
  expect(said.length).toBeGreaterThan(0);
  for (const failure of said) {
    const born = log.find((entry) => entry.id === failure.id && entry.kind === "added")!;
    // Put on the page empty, at the press, and said only once it had stood.
    expect(failure.kind, "a status put on the page already holding the line").toBe("changed");
    expect(born.text).toBe("");
    expect(failure.t - born.t).toBeGreaterThanOrEqual(STATUS_STANDS_MS * STAND_SEEN_SHARE);
  }
});
