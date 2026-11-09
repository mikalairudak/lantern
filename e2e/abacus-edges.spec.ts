import { expect, test } from "./fixtures";

test("draws a stop after midnight below the late evening, at its own clock time", async ({
  page,
}) => {
  await page.goto("/lab/concepts/abacus/edge/late-night");
  const bar = page.getByText("Cocktails in Príncipe Real", { exact: true }).first();
  const club = page.getByText("Late drinks on the river", { exact: true }).first();
  await expect(club).toBeVisible();

  const [barBox, clubBox] = await Promise.all([bar.boundingBox(), club.boundingBox()]);
  expect(clubBox!.y).toBeGreaterThan(barBox!.y);
  await expect(page.getByText("01:00", { exact: true }).first()).toBeVisible();
});

test("serves no edge day it does not have", async ({ page }) => {
  const response = await page.goto("/lab/concepts/abacus/edge/refused");
  expect(response?.status()).toBe(404);
});

test("keeps the longest names inside the screen, with no sideways scroll", async ({ page }) => {
  await page.goto("/lab/concepts/abacus/edge/crowded");
  await expect(page.getByText("Beer on Gràcia's squares", { exact: true }).first()).toBeVisible();

  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    screen: window.innerWidth,
  }));
  expect(widths.page).toBeLessThanOrEqual(widths.screen);
});

for (const edge of ["late-night", "crowded", "long-stay"]) {
  test(`the lab controls never sit over the ${edge} day's chart`, async ({ page }) => {
    await page.goto(`/lab/concepts/abacus/edge/${edge}`);
    const chart = await page.getByRole("group", { name: /The day's energy/ }).boundingBox();
    const controls = await page.getByRole("complementary", { name: "Lab controls" }).boundingBox();
    if (!chart || !controls) throw new Error("The chart or the controls did not render");

    const overlapsAcross =
      controls.x < chart.x + chart.width && chart.x < controls.x + controls.width;
    const overlapsDown =
      controls.y < chart.y + chart.height && chart.y < controls.y + controls.height;
    expect(overlapsAcross && overlapsDown).toBe(false);
  });
}

test("frames a night by its own stops, not by the header's morning", async ({ page }) => {
  await page.goto("/lab/concepts/abacus/edge/late-night");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  const first = page.getByText("Shellfish in Intendente", { exact: true }).first();
  await expect(first).toBeVisible();

  const [chartBox, firstBox] = await Promise.all([chart.boundingBox(), first.boundingBox()]);
  // The first row sits near the top of the chart, not under fourteen empty hours.
  expect(firstBox!.y - chartBox!.y).toBeLessThan(200);
});

test.describe("two versions at one energy", () => {
  test.use({ reducedMotion: "reduce" });

  test("both show on the wire, and a tap on the twin swaps it in", async ({ page }) => {
    await page.goto("/lab/concepts/abacus/edge/crowded");
    const slider = page.getByRole("slider", { name: "Energy at 13:00" });
    const twin = slider.locator("..").locator("[data-candidate]");
    await expect(twin).toHaveCount(1);
    await expect(slider).toHaveAttribute("aria-valuetext", "social: Cava and tapas on Montcada");

    await twin.click();

    await expect(slider).toHaveAttribute("aria-valuetext", "social: Seafood tapas in the Born");
    await expect(
      page.getByText("Seafood tapas in the Born", { exact: true }).first(),
    ).toBeVisible();
  });

  test("the arrow keys step to the twin and back", async ({ page }) => {
    await page.goto("/lab/concepts/abacus/edge/crowded");
    const slider = page.getByRole("slider", { name: "Energy at 13:00" });
    await slider.focus();

    await page.keyboard.press("ArrowLeft");
    await expect(slider).toHaveAttribute("aria-valuetext", "social: Seafood tapas in the Born");

    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", "social: Cava and tapas on Montcada");
  });
});

test("keeps the longest name a column beside its bead on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Only a phone is narrow either side of a middle bead");
  await page.goto("/lab/concepts/abacus/edge/crowded");
  const words = page
    .getByRole("button", { name: /^Basílica i Temple Expiatori de la Sagrada Família/ })
    .locator("..");
  await expect(words).toBeVisible();
  const bead = page.getByRole("slider", { name: "Energy at 09:00" });

  const [wordsBox, beadBox] = await Promise.all([words.boundingBox(), bead.boundingBox()]);
  if (!wordsBox || !beadBox) throw new Error("The row did not render");
  // Every line starts just past the bead, so where the name is written says how lively the
  // place is, and the column ends inside the screen.
  const beadX = beadBox.x + beadBox.width / 2;
  expect(wordsBox.x - beadX).toBeGreaterThan(10);
  expect(wordsBox.x - beadX).toBeLessThan(20);
  expect(wordsBox.x + wordsBox.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});
