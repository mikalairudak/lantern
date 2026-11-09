import { expect, test } from "./fixtures";

/** Where a day is played at a live model's pace. */
const BENCH = "/lab/concepts/day";
/** A live model writes a stop in a few seconds; a cold dev server adds a few. */
const STOP_TIMEOUT_MS = 30_000;

test.use({ reducedMotion: "reduce" });

// A day takes 40 to 52 s to write live, its stops arriving whole one by one: each opens as
// soon as it is whole, while the curve still waits for the whole day (2026-10-31).
test("a whole stop opens while the day is still written", async ({ page }) => {
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Ending" }).click();
  await controls.getByRole("combobox", { name: "Pace" }).selectOption("A live model");
  await controls.getByRole("button", { name: "Ending" }).click();
  // A pace changes the next play, never the one on screen: played again, the day is
  // written at a live model's pace.
  await controls.getByRole("button", { name: "Replay" }).click();

  const list = page.getByRole("list", { name: "The day" });
  const first = list.getByRole("button").first();
  await expect(first).toBeEnabled({ timeout: STOP_TIMEOUT_MS });
  // The day is still being written: the curve cannot be dragged yet.
  const day = page.getByRole("group", { name: /The day's energy/ });
  await expect(day).toHaveAttribute("aria-busy", "true");
  // The stop being written stays shut.
  await expect(list.getByRole("button").last()).toBeDisabled();

  await first.click();
  const sheet = page.getByRole("region", { name: /^About / });
  await expect(sheet).toBeVisible();
  await expect(sheet).toBeFocused();
  await expect(day).toHaveAttribute("aria-busy", "true");
});
