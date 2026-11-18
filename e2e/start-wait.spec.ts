import { expect, test, type Page, waitMs } from "./fixtures";

const URL = "/lab/concepts/start";
/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** The index's plates stepped back while Lantern reads and writes a typed text. */
const STEPPED_BACK_OPACITY = 0.4;
/** Less than this from a value is the spring at rest there. */
const AT_REST = 0.02;
const SIZES = [
  { name: "a phone", viewport: { width: 390, height: 844 } },
  { name: "a laptop", viewport: { width: 1440, height: 900 } },
] as const;

/** Each plate's frame in the index, by its drawn opacity. */
function plateOpacities(page: Page): Promise<number[]> {
  return page
    .locator("li svg[data-picture]")
    .evaluateAll((plates) =>
      plates.map((plate) => Number(getComputedStyle(plate.parentElement as Element).opacity)),
    );
}

const field = (page: Page) => page.getByRole("textbox", { name: "Where, and anything else" });
const sign = (page: Page) => page.locator("form button[type=submit] [data-part=pen]");

for (const { name, viewport } of SIZES) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test("a typed text hands the focus to the button, a lantern while the plates step back, and its day opens", async ({
      page,
    }) => {
      await page.goto(URL);
      await field(page).fill("Bologna");
      await field(page).press("Enter");

      const button = page.getByRole("button", { name: "Reading" });
      await expect(button).toBeFocused();
      await expect(sign(page)).toHaveCount(1);
      await expect
        .poll(async () =>
          (await plateOpacities(page)).every((o) => Math.abs(o - STEPPED_BACK_OPACITY) < AT_REST),
        )
        .toBe(true);
      // The cities' names keep their strength, and every one can still be pressed.
      const city = page
        .getByRole("list", { name: /No city in mind/ })
        .getByText("Paris", { exact: true });
      await expect(city).toBeVisible();
      expect(await city.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");

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
      await expect(page.getByRole("button", { name: "Reading" })).toBeFocused();

      await expect(page.getByText("Lantern can't plan that day.", { exact: false })).toBeVisible();
      await expect(field(page)).toBeFocused();
      await expect(page.getByRole("button", { name: "Plan this day" })).toBeVisible();
      await expect(sign(page)).toHaveCount(0);
      await expect
        .poll(async () => (await plateOpacities(page)).every((o) => Math.abs(o - 1) < AT_REST))
        .toBe(true);
    });
  });
}
