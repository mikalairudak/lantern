import { expect, test, type Locator, type Page } from "./fixtures";

test.use({ reducedMotion: "reduce" });

const MOMENTS = ["a silence after a stop", "a silence after the last stop"];
// The room the laptop's column keeps under the day (`pb-6`), at the browser's 16 px rem.
const ROOM_UNDER_LINE = 24;
// What the one-stop day's cell says in place of a silence after a stop (`ONE_STOP`).
const ONE_STOP =
  "This day has one stop, so its one silence after a stop is the one after its last.";

/** A row of the matrix: one silence across the days. */
function momentRow(page: Page, moment: string): Locator {
  return page.getByTestId("matrix-grid").locator("section", {
    has: page.getByRole("heading", { level: 2, name: moment, exact: true }),
  });
}

/** Every cell of a row, in both themes. */
function cellsOf(row: Locator): Locator {
  return row.locator('[aria-label$=" theme"]');
}

for (const width of ["Phone", "Wide screen"]) {
  test(`stands each silence's line under the last row, with room under it (${width})`, async ({
    page,
  }) => {
    await page.goto("/lab/matrix/silence");
    await page.getByRole("combobox", { name: "Width" }).selectOption({ label: width });
    await expect(page.getByTestId("matrix-grid").getByText("Reading the day…")).toHaveCount(0);

    for (const moment of MOMENTS) {
      const cells = cellsOf(momentRow(page, moment));
      await expect(cells).not.toHaveCount(0);
      for (const cell of await cells.all()) {
        if ((await cell.getByText(ONE_STOP).count()) > 0) continue;
        const line = cell.locator('div[data-waiting="voice"]');
        await expect(line).toHaveCount(1);
        // Inside the cell on every side, and the column's room between it and the edge.
        const gaps = await line.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const within = element.closest('[aria-label$=" theme"]');
          if (!within) return null;
          const edge = within.getBoundingClientRect();
          const border = parseFloat(getComputedStyle(within).borderBottomWidth);
          return {
            below: edge.bottom - border - box.bottom,
            left: box.left - edge.left,
            right: edge.right - box.right,
          };
        });
        expect(gaps?.below).toBeGreaterThanOrEqual(ROOM_UNDER_LINE);
        expect(gaps?.left).toBeGreaterThanOrEqual(0);
        expect(gaps?.right).toBeGreaterThanOrEqual(0);
      }
    }
  });
}

test("says why a day of one stop has no silence after a stop but its last", async ({ page }) => {
  await page.goto("/lab/matrix/silence");

  // In both themes, once: its one silence after a stop is the one after its last.
  await expect(cellsOf(momentRow(page, MOMENTS[0]!)).getByText(ONE_STOP)).toHaveCount(2);
  await expect(cellsOf(momentRow(page, MOMENTS[1]!)).getByText(ONE_STOP)).toHaveCount(0);
});

test("draws a silence at the page's pace, so the pen's tick stands beside the phrase", async ({
  page,
}) => {
  await page.goto("/lab/matrix/silence");

  for (const moment of MOMENTS) {
    // Alicante: the cell shows the frame the page shows at that moment of the stream.
    const cell = momentRow(page, moment)
      .locator("figure", { has: page.getByText("Alicante", { exact: true }) })
      .locator('[data-theme="light"]');
    const line = cell.locator('div[data-waiting="voice"]');
    await expect(line).toHaveCount(1);
    const tick = await cell.locator('g[data-waiting="voice"] line').boundingBox();
    const phrase = await line.locator(":scope > span:first-child > span:first-child").boundingBox();
    const rule = await line.locator(":scope > span:last-child").boundingBox();
    if (!tick || !phrase || !rule) throw new Error(`The waiting line in "${moment}" is not drawn`);

    // Level with the phrase, above the rule it hangs over, as on the page.
    const tickY = tick.y + tick.height / 2;
    expect(tickY).toBeGreaterThanOrEqual(phrase.y);
    expect(tickY).toBeLessThanOrEqual(rule.y);
  }
});
