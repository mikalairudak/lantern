import { expect, test } from "./fixtures";

/**
 * A fork's Compare draws the version not taken beside the day again (`docs/decisions.md`, "A
 * changed word proposes its part beside the day, and the visitor takes it"). Elche's lunch has
 * a stop of each version at 13:15: the one compared enters over the one taken, and its dashed
 * wire and ring stand under its own words from the frame they are drawn, never across the
 * words of the stop at its hour (the phone pass, 2026-11-08). Played on the re-plan bench at
 * its live pace.
 */

const BENCH = "/lab/concepts/replan";
const PHONE = { width: 390, height: 664 };
/** The bench's day, the page and its proposal, at the live pace: about 35 s in all. */
const STORY_TIMEOUT_MS = 120_000;
const DAY_TIMEOUT_MS = 60_000;
/** Long enough for Compare's rows to come to rest, and the wires with them. */
const COMPARE_WATCHED_MS = 5000;

/**
 * Every frame from now: each row's words, and each proposal ring's middle, in page terms. A ring
 * stands on its wire, which runs the chart's width, so a ring at the height of another row's
 * words is its wire across them.
 */
function sampleTheRings(): void {
  const frames: { words: { top: number; bottom: number; isSeen: boolean }[]; rings: number[] }[] =
    [];
  (window as unknown as { ringFrames: typeof frames }).ringFrames = frames;
  const started = performance.now();
  const sample = () => {
    const words = [...document.querySelectorAll('ol[aria-label="The day"] > li button')].map(
      (button) => {
        const box = button.getBoundingClientRect();
        return {
          top: box.top + scrollY,
          bottom: box.bottom + scrollY,
          isSeen: button.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
        };
      },
    );
    // A proposal's ring alone: its group leads with a round press, a version's with a path.
    const rings = [
      ...document.querySelectorAll(
        'svg[role="group"] g[data-candidate] > circle.fill-none + circle.stroke-swap-drawn',
      ),
    ].map((ring) => {
      const box = ring.getBoundingClientRect();
      return box.top + box.height / 2 + scrollY;
    });
    frames.push({ words, rings });
    if (performance.now() - started < 5200) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

test("Compare draws the version not taken with its wire and ring under its own words, never across another row's", async ({
  page,
}) => {
  test.setTimeout(STORY_TIMEOUT_MS);
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await controls.getByRole("group", { name: "Day" }).getByRole("button", { name: "Elche" }).click();
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );

  await page
    .getByRole("heading", { level: 1 })
    .getByRole("button", { name: /^early dinner/ })
    .click();
  await page.getByRole("option", { name: /eating late/ }).click();
  // Whole once the fork row says what it would change.
  await expect(page.getByText(/, not \d\d:\d\d/).first()).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await page
    .getByRole("radio", { name: /eating late/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Compare" }).first()).toBeVisible();
  await page.evaluate(sampleTheRings);
  await page.getByRole("button", { name: "Compare" }).first().click();
  await page.waitForTimeout(COMPARE_WATCHED_MS);

  const frames = await page.evaluate(
    () =>
      (
        window as unknown as {
          ringFrames: {
            words: { top: number; bottom: number; isSeen: boolean }[];
            rings: number[];
          }[];
        }
      ).ringFrames,
  );
  expect(
    frames.some(({ rings }) => rings.length > 0),
    "the version compared was drawn",
  ).toBe(true);
  const across = frames.flatMap(({ words, rings }, at) =>
    rings.flatMap((ring) =>
      words.some(({ top, bottom, isSeen }) => isSeen && ring > top && ring < bottom)
        ? [`frame ${at}: a ring at ${Math.round(ring)} px`]
        : [],
    ),
  );
  expect(across).toEqual([]);
});
