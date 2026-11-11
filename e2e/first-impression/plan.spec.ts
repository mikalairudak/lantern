import { expect, test, type Page, waitMs } from "../fixtures";

/**
 * The day under the first impression (`src/lib/first-impression.ts`), against its own server with
 * the flag on: a day opens on its plan, lit by its light; the energy's five words move it; the
 * masthead's menu holds the ways to take it along; the chart is one press away and kept.
 */

const DAY_TIMEOUT_MS = waitMs(30_000);

test.use({ reducedMotion: "reduce" });

/** The day is written and still: the energy's words, which wait until then, can be chosen. */
async function dayIsWhole(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "lively" })).toBeEnabled({
    timeout: DAY_TIMEOUT_MS,
  });
}

test("a written day opens on its plan, lit, and its energy moves it", async ({ page }) => {
  await page.goto("/day/kanazawa");
  const plan = page.getByRole("list", { name: "The day, to read" });
  await dayIsWhole(page);
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "read");
  await expect(page.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-pressed", "true");

  // The rail of the day's light, golden hour in the lamp, and the sun's minutes in the list.
  await expect(plan.locator("line.stroke-lamp").first()).toBeAttached();
  await expect(plan.getByText("Sunset")).toBeVisible();

  const names = () => plan.getByRole("heading", { level: 2 }).allTextContents();
  const before = await names();
  await page.getByRole("button", { name: "lively" }).click();
  await expect.poll(names).not.toEqual(before);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("lively");
  await expect(page.getByText(/(click|tap) a word to change it/)).toBeHidden();
});

test("the masthead's menu holds the ways along, and the chart is kept once chosen", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  await page.getByRole("button", { name: "Take this day" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    /Copy the link/,
    /Add to your calendar/,
    /Walk it in Google Maps/,
    /Plan another day/,
  ]);
  const box = await menu.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Chart" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "chart");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "chart");
});
