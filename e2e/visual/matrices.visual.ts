import { expect, test, type Locator, type Page } from "@playwright/test";
import type { GridView } from "@/lib/lab-matrix";

const MATRIX_PATH = "/lab/matrix/";
const THEMES = ["light", "dark"] as const;
// What a cell that reads stream frames says until it has them (use-still.tsx).
const LOADING = "Reading the day…";

/**
 * The file name Playwright 1.64 gives a string screenshot name: every run of ASCII
 * characters other than letters, digits and `-` becomes one `-`, and anything beyond ASCII
 * stays. Lower-cased, because macOS's file system ignores case.
 */
function fileNameOf(label: string): string {
  return label.replace(/[^A-Za-z0-9\u0080-\uffff-]+/g, "-").toLowerCase();
}

/**
 * Two labels with one file name would share one baseline, each shot compared with the
 * other's; so the second fails the run, naming both.
 */
function claimFileName(fileNames: Map<string, string>, label: string): void {
  const fileName = fileNameOf(label);
  const earlier = fileNames.get(fileName);
  if (earlier !== undefined) {
    throw new Error(`"${label}" and "${earlier}" would share ${fileName}.png: rename a value`);
  }
  fileNames.set(fileName, label);
}

/** Every matrix the lab lists: the spec reads the page, never the registry itself. */
async function matrixKeysOf(page: Page): Promise<string[]> {
  await page.goto("/lab");
  const hrefs = await page
    .locator(`a[href^="${MATRIX_PATH}"]`)
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return hrefs.map((href) => href.slice(MATRIX_PATH.length));
}

async function selectedAxisOf(page: Page, picker: "Rows" | "Columns"): Promise<string> {
  return page
    .getByRole("combobox", { name: picker })
    .evaluate((select: HTMLSelectElement) => select.selectedOptions[0]?.text ?? "");
}

/**
 * Takes the focus out of the grid and holds it out for two frames. A list open in a cell
 * takes the focus a frame after the cell is drawn, and only the last to open keeps it, so
 * which cell carries a focus mark depends on timing; no shot carries one.
 */
async function releaseFocus(page: Page): Promise<void> {
  await expect(async () => {
    const isFocusInGrid = await page.evaluate(async () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const grid = document.querySelector('[data-testid="matrix-grid"]');
      return grid?.contains(document.activeElement) ?? false;
    });
    expect(isFocusInGrid).toBe(false);
  }).toPass();
}

/**
 * Moves a figure onto whole pixels. The lab's type sets lines at fractional heights (15 px
 * at 1.55 is 23.25 px), so a figure lands between pixels by whatever sits above it, and
 * Chromium draws text by where it lands: a longer note on the page failed every shot of
 * its matrix. Snapped, a shot changes only when its own cell does.
 */
async function snapToWholePixels(figure: Locator): Promise<void> {
  await figure.evaluate((element: HTMLElement) => {
    element.style.position = "relative";
    element.style.left = "0px";
    element.style.top = "0px";
    const box = element.getBoundingClientRect();
    const left = box.left + window.scrollX;
    const top = box.top + window.scrollY;
    element.style.left = `${Math.round(left) - left}px`;
    element.style.top = `${Math.round(top) - top}px`;
  });
}

/**
 * Brings a figure into view and waits until every plate has come in whole: the index's plates ask
 * for their files only near the screen, and fade in once they arrive
 * (`src/features/day/index-picture.tsx`). A plate a cell holds back, or whose file failed, waits
 * for nothing.
 */
async function awaitPictures(figure: Locator): Promise<void> {
  // Only a figure with pictures is scrolled to: moving the page shifts how others' text is drawn.
  if ((await figure.locator("rect[data-layer]").count()) === 0) return;
  await figure.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      figure.evaluate((element) =>
        [...element.querySelectorAll("rect[data-layer]")].every((rect) =>
          ["drawn", "held", "failed"].includes(rect.getAttribute("data-state") ?? ""),
        ),
      ),
    )
    .toBe(true);
}

/** Each figure of one view, one theme at a time, named for what it shows, not where. */
async function shootView(
  page: Page,
  key: string,
  view: GridView,
  fileNames: Map<string, string>,
): Promise<void> {
  const grid = page.getByTestId("matrix-grid");
  await page.getByRole("combobox", { name: "Rows" }).selectOption(String(view.rows));
  await page.getByRole("combobox", { name: "Columns" }).selectOption(String(view.columns));
  const viewName = `${await selectedAxisOf(page, "Rows")} x ${await selectedAxisOf(page, "Columns")}`;

  for (const theme of THEMES) {
    await page.getByRole("combobox", { name: "Theme" }).selectOption(theme);
    const otherTheme = THEMES.find((other) => other !== theme);
    await expect(grid.locator(`figure [aria-label="${otherTheme} theme"]`)).toHaveCount(0);
    await expect(grid.getByText(LOADING)).toHaveCount(0);
    await releaseFocus(page);

    // The grid's own rows only: a cell can hold sections of its own, as the start index does.
    for (const section of await grid.locator(":scope > div > section").all()) {
      // The row's own label: a cell can hold headings of its own, as the list to read's stops.
      const row = (await section.locator(":scope > h2").textContent()) ?? "";
      for (const figure of await section.locator("figure").all()) {
        const caption = figure.locator("figcaption");
        const column = (await caption.count()) > 0 ? ` -- ${await caption.textContent()}` : "";
        const label = `${key}/${theme}/${viewName}/${row}${column}`;
        claimFileName(fileNames, label);
        await awaitPictures(figure);
        await snapToWholePixels(figure);
        // Soft, so one run reports every cell that changed rather than the first.
        await expect.soft(figure).toHaveScreenshot(`${label}.png`);
      }
    }
  }
}

test("shoots every cell of each matrix's baseline views, one theme at a time", async ({ page }) => {
  const keys = await matrixKeysOf(page);
  expect(keys.length).toBeGreaterThan(0);
  const fileNames = new Map<string, string>();

  for (const key of keys) {
    await test.step(key, async () => {
      await page.goto(`${MATRIX_PATH}${key}`);
      const baseline = await page.getByTestId("matrix-grid").getAttribute("data-baseline");
      await page.getByRole("combobox", { name: "Width" }).selectOption("phone");
      for (const view of JSON.parse(baseline ?? "[]") as GridView[]) {
        await shootView(page, key, view, fileNames);
      }
    });
  }
});
