import { expect, test, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/**
 * A sun's minute on the time axis keeps clear of every stop's time in the gutter, the day's own
 * and a version's beside it (`sunLabelsAt`), whatever a fork shows: the proposal, either version
 * taken, and the other compared beside it, where the rows that stay are held lower than the day
 * laid out afresh. Played on the re-plan bench's Utrecht, whose early start proposes its morning
 * by the sunrise, with its sunset by the dinner at 17:30.
 */

const BENCH = "/lab/concepts/replan";
/** The proposal streams for a few seconds at the bench's live pace; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(60_000);
const STORY_TIMEOUT_MS = waitMs(120_000);

/** A box in the page, top to bottom, with what it says. */
interface Label {
  text: string;
  top: number;
  bottom: number;
}

/** The suns' minutes and the stops' times the chart shows, wherever they stand on the page. */
function gutterLabels(page: Page): Promise<{ suns: Label[]; times: Label[] }> {
  return page.evaluate(() => {
    const isShown = (element: Element) =>
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const labelOf = (element: Element) => {
      const box = element.getBoundingClientRect();
      return {
        text: element.textContent.trim(),
        top: box.top + scrollY,
        bottom: box.bottom + scrollY,
      };
    };
    return {
      suns: [...document.querySelectorAll("[data-sun] text")].filter(isShown).map(labelOf),
      times: [...document.querySelectorAll("[data-start-time]")].filter(isShown).map(labelOf),
    };
  });
}

/** Each sun's minute that stands on a stop's time, as "16:49 on 17:30". */
function crossings({ suns, times }: { suns: Label[]; times: Label[] }): string[] {
  return suns.flatMap((sun) =>
    times.flatMap((time) =>
      sun.top < time.bottom && time.top < sun.bottom ? [`${sun.text} on ${time.text}`] : [],
    ),
  );
}

/** The gutter once its rows rest: two looks a beat apart that agree. */
async function restingLabels(page: Page): Promise<{ suns: Label[]; times: Label[] }> {
  let last = "";
  let labels = await gutterLabels(page);
  await expect
    .poll(
      async () => {
        labels = await gutterLabels(page);
        const now = JSON.stringify(labels);
        const isStill = now === last;
        last = now;
        return isStill;
      },
      { intervals: [300], timeout: DAY_TIMEOUT_MS },
    )
    .toBe(true);
  return labels;
}

test("a sun's minute never stands on a stop's time, as the fork is taken and compared", async ({
  page,
}, testInfo) => {
  test.setTimeout(STORY_TIMEOUT_MS);
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await controls
    .getByRole("group", { name: "Day" })
    .getByRole("button", { name: "Utrecht" })
    .click();
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await page
    .getByRole("heading", { level: 1 })
    .getByRole("button", { name: "slow morning", exact: true })
    .click();
  await page.getByRole("option", { name: "early start" }).click();
  const row = page.locator('[data-fork-row="0"]').filter({ visible: true });
  await expect(row.getByRole("radio", { name: "early start Take, proposed" })).toBeVisible({
    timeout: DAY_TIMEOUT_MS,
  });
  const compare = row.getByRole("button", { name: "Compare" });
  const steps: [string, () => Promise<void>][] = [
    ["proposed", async () => {}],
    ["taken", () => row.getByRole("radio", { name: /^early start/ }).click()],
    ["the day before compared", () => compare.click()],
    ["folded", () => compare.click()],
    ["taken back", () => row.getByRole("radio", { name: /^slow morning/ }).click()],
    ["the proposal compared", () => compare.click()],
  ];
  const seen: Record<string, string[]> = {};
  const said: Record<string, string[]> = {};
  for (const [name, step] of steps) {
    await step();
    const labels = await restingLabels(page);
    seen[name] = crossings(labels);
    said[name] = labels.suns.map(({ text }) => text);
  }
  expect(seen).toEqual(Object.fromEntries(steps.map(([name]) => [name, []])));
  // On a laptop the sunrise says its minute between the proposal's 07:30 and 08:30, clear of
  // both, so the gutter holds a sun's minute among a proposal's times.
  if (testInfo.project.name === "desktop") expect(said.proposed).toContain("08:00");
});
