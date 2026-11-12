import { expect, test, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const PHONE = { width: 390, height: 844 };

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** What marks the band, "held" once it stands at the screen's top (`SCALE_BAND_ATTRIBUTE`). */
const BAND = "data-scale-band";

/** The sticky scale's band, where it stands on the screen, whether it is held there, and seen. */
function bandOf(page: Page) {
  return page.evaluate((attribute) => {
    const band = document.querySelector<HTMLElement>(`[${attribute}]`);
    if (!band) return null;
    const { top, bottom } = band.getBoundingClientRect();
    return {
      top,
      bottom,
      isHeld: band.getAttribute(attribute) === "held",
      opacity: Number(getComputedStyle(band).opacity),
      text: band.textContent ?? "",
    };
  }, BAND);
}

test("on a phone the energy scale is held at the screen's top while the chart is in view, and takes a change back", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("/day/kanazawa");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  const rows = page.getByRole("list", { name: "The day" });
  const written = await rows.getByRole("listitem").allTextContents();

  // Where the chart begins, the scale stands where its words always stood, not held.
  const chartBox = await chart.boundingBox();
  if (!chartBox) throw new Error("The chart has no box");
  await page.evaluate((y) => scrollTo(0, y + scrollY - 120), chartBox.y);
  await expect.poll(async () => (await bandOf(page))?.isHeld).toBe(false);
  expect((await bandOf(page))?.text).toContain("drag the curve");

  // Scrolled into the chart, it is held at the top, on the ground.
  await page.evaluate(() => scrollBy(0, 360));
  await expect.poll(async () => (await bandOf(page))?.isHeld).toBe(true);
  expect(Math.round((await bandOf(page))?.top ?? 99)).toBeLessThanOrEqual(0);

  // A drag there changes the day: the scale says how, and offers the plan back.
  const slider = page.getByRole("slider", { name: /^Energy at/ }).nth(3);
  const knob = await slider.locator("circle").boundingBox();
  if (!knob) throw new Error("The knob has no box");
  const from = { x: knob.x + knob.width / 2, y: knob.y + knob.height / 2 };
  const reach = (chartBox.width / 5) * 1.5 * (from.x < chartBox.x + chartBox.width / 2 ? 1 : -1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(from.x + (reach * step) / 10, from.y);
  }
  // While the hand is on the curve, the held band steps aside for the bead and its name.
  await expect.poll(async () => (await bandOf(page))?.opacity).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await bandOf(page))?.opacity).toBe(1);
  const back = page.getByRole("button", { name: "Back to the plan" });
  await expect(back).toBeVisible();
  expect(await rows.getByRole("listitem").allTextContents()).not.toEqual(written);

  // Taken back, the day is as planned, and the scale says what it said.
  await back.focus();
  await page.keyboard.press("Enter");
  await expect(back).toHaveCount(0);
  // The keys go on from a stop it changed back, not from the top of the page.
  await expect(page.locator(":focus")).toHaveAttribute("role", "slider");
  await expect.poll(() => rows.getByRole("listitem").allTextContents()).toEqual(written);
  expect((await bandOf(page))?.text).toContain("drag the curve");
});

test("on a laptop the scale stays the chart's own, and nothing is held", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/day/kanazawa");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  await expect(page.locator(`[${BAND}]`)).toBeHidden();
  await expect(
    page.getByText("drag the curve", { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
});

/** The narrowest phone Lantern promises, where a drag's name has the least room. */
const NARROW_PHONE = { width: 360, height: 780 };
/**
 * Knobs grabbed this far under the screen's top: well down the screen first, then under the held
 * band and just below it, so each name is one a drag before it named at another scroll.
 */
const GRABBED_AT_PX = [250, 17, 40, 60];
/** How far a name may move between two frames that say the same on the same line. */
const NAME_STILL_PX = 2;

/**
 * Records, frame by frame from now, the first two frames a drag's name shows in: where its top
 * stands on the screen, its line and what it says. Read before the frame paints, as it paints.
 */
function watchFirstNames(page: Page) {
  return page.evaluate(() => {
    const seen: { top: number; line: string | null; text: string }[] = [];
    (window as unknown as { firstNames: typeof seen }).firstNames = seen;
    const look = () => {
      const tag = document.querySelector("[data-tag][data-dragged]");
      const name = tag?.firstElementChild;
      if (tag && name) {
        seen.push({
          top: name.getBoundingClientRect().top,
          line: tag.getAttribute("data-tag"),
          text: tag.textContent ?? "",
        });
      }
      if (seen.length < 2) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}

function firstNamesOf(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { firstNames: { top: number; line: string | null; text: string }[] })
        .firstNames,
  );
}

for (const city of ["bologna", "kanazawa", "nafplio"]) {
  test(
    `on ${city}'s day a drag grabbed at the screen's top names its version on the screen`,
    { tag: "@frame" },
    async ({ page }) => {
      await page.setViewportSize(NARROW_PHONE);
      await page.goto(`/day/${city}`);
      const chart = page.getByRole("group", { name: /The day's energy/ });
      await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
      const chartBox = await chart.boundingBox();
      if (!chartBox) throw new Error("The chart has no box");
      const lane = chartBox.width / 5;
      const past: string[] = [];
      const sliders = page.getByRole("slider", { name: /^Energy at/ });
      for (const at of GRABBED_AT_PX) {
        for (const index of [0, 1]) {
          const knob = sliders.nth(index).locator("circle");
          const box = await knob.boundingBox();
          if (!box) throw new Error("The knob has no box");
          // The knob this far under the screen's top, the band held over the chart.
          await page.evaluate((by) => scrollBy(0, by), box.y + box.height / 2 - at);
          const from = await knob.boundingBox();
          if (!from) throw new Error("The knob has no box");
          const x = from.x + from.width / 2;
          const y = from.y + from.height / 2;
          const toward = x < chartBox.x + chartBox.width / 2 ? 1 : -1;
          const band = await bandOf(page);
          await watchFirstNames(page);
          await page.mouse.move(x, y);
          await page.mouse.down();
          // Held over the knob, the band steps aside at the press, before the hand has moved;
          // over a knob under it, as the drag sets off.
          const isUnderBand = band?.isHeld && y <= band.bottom;
          if (isUnderBand) await expect.poll(async () => (await bandOf(page))?.opacity).toBe(0);
          for (let step = 1; step <= 12; step += 1) {
            await page.mouse.move(x + (toward * lane * 1.5 * step) / 12, y);
          }
          if (band?.isHeld) await expect.poll(async () => (await bandOf(page))?.opacity).toBe(0);
          const name = page.locator("[data-tag][data-dragged] > *").first();
          if (await name.count()) {
            const top = (await name.boundingBox())?.y ?? 0;
            if (top < 0) past.push(`stop ${index} at ${at} px: ${Math.round(top)} px`);
          }
          // Its first frame stands where the screen is now, not where it was at the drag before.
          const [first, second] = await firstNamesOf(page);
          if (first && first.top < 0) {
            past.push(`stop ${index} at ${at} px, first frame: ${Math.round(first.top)} px`);
          }
          const isSameName = first && second && first.line === second.line;
          if (isSameName && first.text === second.text) {
            const moved = Math.abs(second.top - first.top);
            if (moved > NAME_STILL_PX) {
              past.push(`stop ${index} at ${at} px, first frame ${Math.round(moved)} px off`);
            }
          }
          await page.mouse.up();
          const back = page.getByRole("button", { name: "Back to the plan" });
          if (await back.count()) await back.click();
        }
      }
      expect(past).toEqual([]);
    },
  );
}
