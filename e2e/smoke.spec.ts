import { expect, test, waitMs } from "./fixtures";

/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** What the start screen says over its index of the days Lantern has written. */
const INDEX_LABEL = "No city in mind? Start from one of these";
/** What Lantern is, the start screen's first line. */
const PROMISE = "One day in a city, planned hour by hour, as quiet or as lively as you want it.";
/** The widths the start screen is judged at: the narrowest phone, a common one, a laptop. */
const WIDTHS = [320, 390, 1440];
/** A small phone, on which the start screen is taller than the screen and scrolls. */
const SMALL_PHONE = { width: 320, height: 480 };

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("lands on the start screen: one question over the index of written days, and no day playing", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Lantern");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One day in a city, planned hour by hour, as quiet or as lively as you want it.",
  );
  await expect(page.getByRole("textbox", { name: "Where, and anything else" })).toBeVisible();
  await expect(page.getByRole("list", { name: INDEX_LABEL }).getByRole("button")).toHaveCount(6);
  await expect(page.locator('svg[role="group"]')).toHaveCount(0);
});

// The index waits for the visitor's own days, which the browser alone keeps, so the list over
// it never pushes it down (`docs/decisions.md`, "A row's words go where its bead comes to rest,
// and rows ease rather than jump"): the server draws the question.
test("the server's first page holds the question and no chart, and the browser the index", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();

  expect(html).toContain(PROMISE);
  expect(html).toContain("Where, and anything else");
  expect(html).not.toContain(INDEX_LABEL);
  expect(html).not.toContain('role="group"');
});

for (const width of WIDTHS) {
  test(`the start screen never scrolls sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("list", { name: INDEX_LABEL })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}

// The city word's list holds the starts' gists, Madrid's the longest: its sheet keeps
// between a 320 px phone's gutters, and a long row wraps.
test("a day's city list never takes the narrowest phone sideways", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/day/kanazawa");
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );

  await page
    .getByRole("heading", { level: 1 })
    .getByRole("button", { name: "Kanazawa", exact: true })
    .click();
  const list = page.getByRole("group", { name: "Where" });
  await expect(list.getByRole("button", { name: /^Madrid/ })).toBeVisible();

  const [overflow, box] = await Promise.all([
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
    list.boundingBox(),
  ]);
  expect(overflow).toBe(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320 - 16);
});

test("writes a written city's day where the question was", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Where, and anything else" }).fill("Bologna");
  await page.getByRole("button", { name: "Plan this day" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A lively Saturday in Bologna",
    { timeout: DAY_TIMEOUT_MS },
  );
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
});

test(
  "brings a small phone's scrolled page up to the day being written, never in one frame",
  { tag: "@frame" },
  async ({ page }) => {
    await page.setViewportSize(SMALL_PHONE);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    // The index's last cell, scrolled to the screen's foot, so the press itself scrolls nothing.
    const lastStart = page
      .getByRole("list", { name: INDEX_LABEL })
      .getByRole("button", { name: /^Nafplio / });
    // Drawn once the visitor's days are read, so the page is tall enough to scroll.
    await expect(lastStart).toBeAttached();
    await lastStart.evaluate((cell) => cell.scrollIntoView({ block: "end" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const scrolled = await page.evaluate(() => window.scrollY);
    const sampled = page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const scrolls: number[] = [];
          const start = performance.now();
          const tick = () => {
            scrolls.push(window.scrollY);
            if (performance.now() - start < 1200) requestAnimationFrame(tick);
            else resolve(scrolls);
          };
          requestAnimationFrame(tick);
        }),
    );

    await lastStart.click();

    const scrolls = await sampled;
    const steps = scrolls.slice(1).map((top, index) => Math.abs(top - (scrolls[index] ?? top)));
    // It comes up to the top, where the day's header is written, over several frames.
    expect(scrolls.at(-1)).toBe(0);
    expect(Math.max(...steps)).toBeLessThan(scrolled / 2);
  },
);
