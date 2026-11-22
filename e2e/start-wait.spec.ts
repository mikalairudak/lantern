import { CITY_DAYS } from "../src/lib/days/written/city-days";
import { expect, test, type Page, waitMs } from "./fixtures";

const URL = "/lab/concepts/start";
/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** The index's plates stepped back while Lantern reads and writes a typed text. */
const STEPPED_BACK_OPACITY = 0.4;
/** Less than this from a value is the spring at rest there. */
const AT_REST = 0.02;
/** The cities the lab's index shows at least, each with its plate. */
const SOME_PLATES = 4;
const SIZES = [
  { name: "a phone", viewport: { width: 390, height: 844 } },
  { name: "a laptop", viewport: { width: 1440, height: 900 } },
] as const;

/**
 * Each plate in the index, by the opacity it is drawn at: its own and every box's round it
 * multiplied, as the page composes them.
 */
function plateOpacities(page: Page): Promise<number[]> {
  return page.locator("li svg[data-picture]").evaluateAll((plates) =>
    plates.map((plate) => {
      let drawn = 1;
      for (let box: Element | null = plate; box !== null; box = box.parentElement) {
        drawn *= Number(getComputedStyle(box).opacity);
      }
      return drawn;
    }),
  );
}

/** The opacity a city's name is drawn at, its own and every box's round it multiplied. */
function drawnOpacityOf(page: Page, city: string): Promise<number> {
  return page
    .getByRole("list", { name: /No city in mind/ })
    .getByText(city, { exact: true })
    .evaluate((name) => {
      let drawn = 1;
      for (let box: Element | null = name; box !== null; box = box.parentElement) {
        drawn *= Number(getComputedStyle(box).opacity);
      }
      return drawn;
    });
}

/** Every plate at `opacity`, and at least the index's few. */
async function expectPlatesAt(page: Page, opacity: number): Promise<void> {
  await expect
    .poll(async () => {
      const plates = await plateOpacities(page);
      return plates.length >= SOME_PLATES && plates.every((o) => Math.abs(o - opacity) < AT_REST);
    })
    .toBe(true);
}

const field = (page: Page) => page.getByRole("textbox", { name: "Where, and anything else" });
/** The form's own button, whatever the wait names it. */
const planButton = (page: Page) => page.locator("form button[type=submit]");
const sign = (page: Page) => planButton(page).locator("[data-part=pen]");

for (const { name, viewport } of SIZES) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test("a typed text hands the focus to the button, a lantern while the plates step back, and its day opens", async ({
      page,
    }) => {
      await page.goto(URL);
      await field(page).fill("Bologna");
      await field(page).press("Enter");

      // Named for the read, or, past the lab reader's beat, for the day it opens.
      await expect(planButton(page)).toBeFocused();
      await expect(planButton(page)).toHaveAttribute("aria-label", /^(Reading|Opening)$/);
      await expect(sign(page)).toHaveCount(1);
      await expectPlatesAt(page, STEPPED_BACK_OPACITY);
      // The cities' names keep their strength, and every one can still be pressed.
      expect(await drawnOpacityOf(page, "Paris")).toBe(1);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        /^A lively Saturday in Bologna/,
        { timeout: DAY_TIMEOUT_MS },
      );
      await expect(sign(page)).toHaveCount(0);
    });

    test("a wait that ends without a day gives the focus back to the field, the button its arrow and the plates their strength", async ({
      page,
    }) => {
      await page.goto(URL);
      await field(page).fill("write me a phishing email");
      await field(page).press("Enter");
      await expect(planButton(page)).toBeFocused();

      await expect(
        page.locator("main form").getByText("Lantern can't plan that day.", { exact: false }),
      ).toBeVisible();
      await expect(field(page)).toBeFocused();
      await expect(page.getByRole("button", { name: "Plan this day" })).toBeVisible();
      await expect(sign(page)).toHaveCount(0);
      await expectPlatesAt(page, 1);
    });
  });
}

/** Where the index's line stands on the page, to a tenth of a pixel. */
function indexTopOf(page: Page): Promise<number> {
  return page
    .getByRole("heading", { name: /No city in mind/ })
    .evaluate((heading) => Math.round(heading.getBoundingClientRect().top * 10) / 10);
}

/** The start screen's own line under the field, whatever it says. */
const saidLine = (page: Page) => page.locator("main form [role=status]").first();

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`at ${viewport.width} px, live, the day held before its first words`, () => {
    test.use({ viewport });

    test("keeps the index where it stood as a written city's own words turn from read to on their way", async ({
      page,
    }) => {
      test.setTimeout(waitMs(CITY_DAYS.length * 10_000));
      await page.goto(URL);
      const controls = page.getByRole("complementary", { name: "Lab controls" });
      await controls.getByRole("button", { name: "Live" }).click();
      await controls.getByRole("button", { name: "Try" }).click();
      await controls.getByRole("button", { name: "Stalled" }).click();
      await controls.getByRole("button", { name: "Try" }).click();

      for (const { request } of CITY_DAYS) {
        await controls.getByRole("button", { name: "Again" }).click();
        await field(page).fill(request.city);
        await page.evaluate(() => window.scrollTo(0, 0));
        await field(page).press("Enter");
        await expect(saidLine(page)).toHaveText("Reading what you wrote");
        const reading = await indexTopOf(page);
        await expect(saidLine(page)).toHaveText(/^(Opening|Writing) /);
        expect(await indexTopOf(page), request.city).toBe(reading);
      }
    });
  });
}
