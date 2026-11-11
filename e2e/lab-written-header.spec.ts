import { expect, test } from "./fixtures";

test.use({ reducedMotion: "reduce" });

// Thirty moments on six days, each in both themes.
const CELLS = 30 * 6 * 2;
// Moments a day never reaches: Portland has no written day, Tromsø and Hong Kong have no
// other versions to drag, and Hong Kong's every word is the visitor's.
// Portland, with no written day, re-plans nothing either; Elche's day is production's
// record, kept without the stream that wrote it.
const UNREACHED = (20 + 3 + 5 + 4) * 2;
// The playing's first frame, an unheard copy on every day: its headline is hidden from the
// reader too.
const UNHEARD = 6 * 2;

test("sets the day stage header in every moment on every day, in both themes", async ({ page }) => {
  await page.goto("/lab/matrix/written-header");
  const grid = page.getByTestId("matrix-grid");
  await expect(grid.getByText("Reading the day…")).toHaveCount(0);

  await expect(grid.locator("[data-theme]")).toHaveCount(CELLS);
  await expect(grid.getByRole("heading", { level: 1 })).toHaveCount(CELLS - UNREACHED - UNHEARD);
  await expect(
    grid.getByText(
      /never reaches this moment|has a livelier version|no swaps|writes none|set only as written/,
    ),
  ).toHaveCount(UNREACHED);
});

test("says busy over a written day and not yet over any other when nothing came", async ({
  page,
}) => {
  await page.goto("/lab/matrix/written-header");
  const unavailable = page
    .getByTestId("matrix-grid")
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: /^unavailable: / }) });

  const notices = unavailable.locator('[data-theme="light"] p[role="status"]');
  // Kanazawa's is a written day; Lisbon's, written by hand, is no day of the site's.
  await expect(notices).toHaveText([
    "Lantern couldn't write this day just now. Write it again",
    "Lantern isn't writing new days right now. These are written:",
    "Lantern isn't writing new days right now. These are written:",
    "Lantern isn't writing new days right now. These are written:",
    "Lantern isn't writing new days right now. These are written:",
    "Lantern isn't writing new days right now. These are written:",
  ]);
});

test("scrolls its grid sideways inside itself, never the page", async ({ page }) => {
  await page.goto("/lab/matrix/written-header");
  await page.getByRole("combobox", { name: "Width" }).selectOption({ label: "Wide screen" });
  await expect(page.getByTestId("matrix-grid").getByText("Reading the day…")).toHaveCount(0);

  // The header's unseen status line is positioned: its cell must hold it, or it stretches
  // the page past the grid that scrolls.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
