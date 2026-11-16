import { expect, test, type Locator, type Page, waitMs } from "./fixtures";

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
