import { expect, test, type Page } from "./fixtures";

/** Waits for the day's frames, then returns the frame slider. */
async function frameSlider(page: Page) {
  const slider = page.getByRole("slider", { name: "Frame" });
  await expect(slider).toBeVisible();
  return slider;
}

const outcomeOf = (page: Page) => page.getByTestId("outcome");
const openFieldOf = (page: Page) => page.getByTestId("open-field");

test.beforeEach(async ({ page }) => {
  await page.goto("/lab/stream");
});

test("scrubs from nothing to the whole day, and the finished day is complete", async ({ page }) => {
  const slider = await frameSlider(page);
  await expect(openFieldOf(page)).toHaveText("Nothing has arrived.");

  await slider.press("End");
  await expect(openFieldOf(page)).toContainText("Writing alternatives[");
  await page.getByRole("button", { name: "The model finishes" }).click();

  await expect(outcomeOf(page)).toContainText(/complete: 8 stops, \d+ swaps/);
});

test("a stream that drops inside the swaps keeps the day, and one that stops before any text has nothing", async ({
  page,
}) => {
  const slider = await frameSlider(page);
  await slider.press("End");
  await slider.press("ArrowLeft");
  await page.getByRole("button", { name: "The connection drops here" }).click();
  await expect(outcomeOf(page)).toContainText(/disconnected: kept 8 stops, \d+ swaps/);

  await slider.press("Home");
  await page.getByRole("button", { name: "A timeout here" }).click();
  await expect(outcomeOf(page)).toContainText("at character 0 → unavailable: nothing arrived");
});

test("the refused day finishes invalid", async ({ page }) => {
  await frameSlider(page);
  const day = page.getByRole("combobox", { name: "Day" });
  const refused = day.locator("option", { hasText: "refuses" });
  await day.selectOption({ label: (await refused.textContent()) ?? "" });

  const slider = await frameSlider(page);
  await slider.press("End");
  await page.getByRole("button", { name: "The model finishes" }).click();

  await expect(outcomeOf(page)).toContainText("invalid: the line about the day is blank");
});

test("plays the day through the app's stream hook, shows it arriving, and ends it", async ({
  page,
}) => {
  await frameSlider(page);
  const player = page.getByRole("region", { name: "Play the stream" });
  await player.getByRole("combobox", { name: "Pace" }).selectOption("Ten times faster");
  await player.getByRole("button", { name: "Play" }).click();

  await expect(player.getByRole("list", { name: "Stops so far" })).toBeVisible();
  await expect(page.getByTestId("played-outcome")).toContainText(/complete: 8 stops, \d+ swaps/, {
    timeout: 15_000,
  });
});

test("plays the day at every pace", async ({ page }) => {
  await frameSlider(page);
  const player = page.getByRole("region", { name: "Play the stream" });
  const pace = player.getByRole("combobox", { name: "Pace" });
  const names = await pace.locator("option").allTextContents();
  expect(names.length).toBeGreaterThan(1);

  for (const name of names) {
    await pace.selectOption(name);
    await player.getByRole("button", { name: "Play" }).click();
    // Each pace reaches the stops; a live model's takes a few seconds to.
    await expect(player.getByRole("list", { name: "Stops so far" })).toBeVisible({
      timeout: 15_000,
    });
    await player.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByTestId("played-outcome")).toHaveText("Play the day to watch it arrive.");
  }
});

test("a played day that is stopped has no outcome", async ({ page }) => {
  await frameSlider(page);
  const player = page.getByRole("region", { name: "Play the stream" });
  await player.getByRole("button", { name: "Play" }).click();
  await expect(page.getByTestId("played-outcome")).toHaveText("Streaming…");

  await player.getByRole("button", { name: "Stop" }).click();

  await expect(player.getByRole("button", { name: "Stop" })).toBeDisabled();
  await expect(page.getByTestId("played-outcome")).toHaveText("Play the day to watch it arrive.");
});

test("plays a written day from the app's own route, which finishes it", async ({ page }) => {
  await frameSlider(page);
  const player = page.getByRole("region", { name: "Play the stream" });
  const source = player.getByRole("combobox", { name: "Source" });
  // Kyoto's, first, is written by hand: the route has no day for it.
  await expect(source.locator("option", { hasText: "The route, POST /api/day" })).toHaveAttribute(
    "disabled",
  );
  await page.getByRole("combobox", { name: "Day" }).selectOption({ label: "Kanazawa" });
  await frameSlider(page);
  await source.selectOption({ label: "The route, POST /api/day" });
  await expect(player.getByRole("combobox", { name: "Ending" })).toBeDisabled();
  await player.getByRole("button", { name: "Play" }).click();

  await expect(player.getByRole("list", { name: "Stops so far" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("played-outcome")).toContainText(/complete: 8 stops, \d+ swaps/, {
    timeout: 30_000,
  });
});

test("the route plays the written days alone, so a lab page never asks a model for another", async ({
  page,
}) => {
  await frameSlider(page);
  const day = page.getByRole("combobox", { name: "Day" });
  const minimal = day.locator("option", { hasText: "one stop, no swaps" });
  await day.selectOption({ label: (await minimal.textContent()) ?? "" });
  await frameSlider(page);
  const player = page.getByRole("region", { name: "Play the stream" });
  const source = player.getByRole("combobox", { name: "Source" });

  // Where live generation is on, the route would write any day but a written one with a model.
  // Playwright reads an option as enabled whatever its attribute, so the attribute is checked.
  await expect(source.locator("option", { hasText: "The route, POST /api/day" })).toHaveAttribute(
    "disabled",
  );
  await expect(source).toHaveValue("page");
  await player.getByRole("button", { name: "Play" }).click();
  await expect(page.getByTestId("played-outcome")).toContainText("complete", { timeout: 15_000 });
});
