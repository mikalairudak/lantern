import { expect, test, type Locator, type Page, waitMs } from "./fixtures";

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const CURVE_NAME = "drag the curve";
/**
 * Lantern promises 390 px and up; a 320 px phone is a fall-back that must still read, so the
 * energy scale's words drop their arrows there.
 */
const SMALL_PHONE = { width: 320, height: 700 };
/** Phones narrow enough to test the scale's words, yet wide enough to keep their arrows. */
const ARROWED_WIDTHS = [360, 390];
const PHONE_HEIGHT = 844;
/**
 * Where the arrows go: a phone's scale spans its width less 128 px, and below a 228 px span
 * the gap beside the arrows falls under one em, too tight to read as a gap, so 356 px keeps
 * them.
 */
const LAST_ARROWLESS_WIDTH = 355;
const FIRST_ARROWED_WIDTH = 356;
/**
 * The least room between two of the scale's words. A space in its 13 px type is about
 * 3.4 px, so words closer than about two of them read as one phrase.
 */
const MIN_CAPTION_GAP_PX = 8;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** Waits for the day to be written and its curve named on the scale, ready to drag. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await expect(page.getByText(CURVE_NAME, { exact: true }).filter({ visible: true })).toBeVisible();
}

/** The gaps between the scale's three words, left to right. */
async function captionGaps(page: Page, quieter: string, livelier: string): Promise<number[]> {
  const boxes = await Promise.all(
    [quieter, CURVE_NAME, livelier].map(async (text) => {
      const box = await page
        .getByText(text, { exact: true })
        .filter({ visible: true })
        .boundingBox();
      if (!box) throw new Error(`"${text}" did not render`);
      return box;
    }),
  );
  return boxes.slice(1).map((box, index) => {
    const before = boxes[index];
    return before ? box.x - (before.x + before.width) : 0;
  });
}

for (const [width, quieter, livelier] of [
  [LAST_ARROWLESS_WIDTH, "quieter", "livelier"],
  [FIRST_ARROWED_WIDTH, "← quieter", "livelier →"],
] as const) {
  test(`on a ${width} px phone the energy scale's end words read "${quieter}" and "${livelier}"`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await page.goto("/day/kanazawa");

    await expect(page.getByText(quieter, { exact: true }).filter({ visible: true })).toBeVisible({
      timeout: DAY_TIMEOUT_MS,
    });
    await expect(page.getByText(livelier, { exact: true }).filter({ visible: true })).toBeVisible();
  });
}

test("on a 320 px phone the energy scale's words drop their arrows and keep apart", async ({
  page,
}) => {
  await page.setViewportSize(SMALL_PHONE);
  await page.goto("/day/kanazawa");

  // The scale is drawn while the day is still being written, before the curve is named.
  await expect(page.getByText("quieter", { exact: true }).filter({ visible: true })).toBeVisible({
    timeout: DAY_TIMEOUT_MS,
  });
  await expect(page.getByText(CURVE_NAME, { exact: true }).filter({ visible: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("livelier", { exact: true }).filter({ visible: true })).toBeVisible();

  await waitForTheDay(page);

  // Naming the curve between them changes neither word: the scale's width alone decides.
  await expect(page.getByText("quieter", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("livelier", { exact: true }).filter({ visible: true })).toBeVisible();
  for (const gap of await captionGaps(page, "quieter", "livelier")) {
    expect(gap).toBeGreaterThanOrEqual(MIN_CAPTION_GAP_PX);
  }
});

for (const width of ARROWED_WIDTHS) {
  test(`at ${width} px the energy scale's words keep their arrows`, async ({ page }) => {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await page.goto("/day/kanazawa");
    await waitForTheDay(page);

    await expect(
      page.getByText("← quieter", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("livelier →", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    for (const gap of await captionGaps(page, "← quieter", "livelier →")) {
      expect(gap).toBeGreaterThanOrEqual(MIN_CAPTION_GAP_PX);
    }
  });
}

test("each stop's slider ranges from its quietest version to its liveliest", async ({ page }) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const sliders = page.getByRole("slider", { name: /^Energy at/ });
  await expect(sliders).not.toHaveCount(0);

  // Home and End take a stop to its quietest and liveliest versions: its range's two ends.
  for (const slider of await sliders.all()) {
    const least = await slider.getAttribute("aria-valuemin");
    const greatest = await slider.getAttribute("aria-valuemax");
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuenow", least ?? "");
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", greatest ?? "");
  }
});

/** The ink a text in the same place reads, in the theme that place has. */
async function inkAt(target: Locator): Promise<string> {
  return target.evaluate((element) => {
    const probe = document.createElement("span");
    probe.className = "text-ink";
    element.parentElement?.append(probe);
    const ink = getComputedStyle(probe).color;
    probe.remove();
    return ink;
  });
}

// The visual baseline shoots no focused state, so the rings `focus-ring` and
// `focus-ring-inset` draw (globals.css) are held here.
test("the keyboard's focus rings each word and link in ink, and the theme's icon inside its edge", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const headline = page.getByRole("main").getByRole("heading", { level: 1 });
  const targets: [string, Locator, string][] = [
    ["the wordmark", page.getByRole("link", { name: "Lantern", exact: true }), "2px"],
    ["the city word", headline.getByRole("button", { name: "Kanazawa", exact: true }), "2px"],
    ["the energy word", headline.getByRole("button", { name: "calm", exact: true }), "2px"],
    [
      "the view to go to",
      page.getByRole("group", { name: "View" }).getByRole("button", { name: "Read" }),
      "2px",
    ],
    ["the theme's icon", page.getByRole("button", { name: /^Theme: / }), "-2px"],
  ];
  // A key pressed first, so a focus moved there next is the keyboard's (`:focus-visible`).
  await page.keyboard.press("Tab");

  for (const [name, target, offset] of targets) {
    await target.focus();
    expect(await target.evaluate((element) => element.matches(":focus-visible")), name).toBe(true);
    await expect(target, name).toHaveCSS("outline-style", "solid");
    await expect(target, name).toHaveCSS("outline-width", "2px");
    await expect(target, name).toHaveCSS("outline-offset", offset);
    // A word's colours ease on focus (`transition-colors`), its ring from the word's own ink.
    await expect(target, name).toHaveCSS("outline-color", await inkAt(target));
  }
});
