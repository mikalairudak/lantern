import { expect, test, type Page, waitMs } from "./fixtures";

const URL = "/lab/concepts/start";
/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const SIZES = [
  { name: "a phone", viewport: { width: 390, height: 844 } },
  { name: "a laptop", viewport: { width: 1440, height: 900 } },
] as const;

const field = (page: Page) => page.getByRole("textbox", { name: "Where, and anything else" });
const sign = (page: Page) => page.locator("form button[type=submit] [data-part=pen]");

for (const { name, viewport } of SIZES) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test("a typed text hands the focus to the button, a lantern while it waits, and its day opens", async ({
      page,
    }) => {
      await page.goto(URL);
      await field(page).fill("Bologna");
      await field(page).press("Enter");

      const button = page.getByRole("button", { name: "Reading" });
      await expect(button).toBeFocused();
      await expect(sign(page)).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        /^A lively Saturday in Bologna/,
        { timeout: DAY_TIMEOUT_MS },
      );
      await expect(sign(page)).toHaveCount(0);
    });

    test("a wait that ends without a day gives the focus back to the field and the button its arrow", async ({
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
    });
  });
}
