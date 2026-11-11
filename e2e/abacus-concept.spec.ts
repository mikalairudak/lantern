import { expect, test, type Locator, type Page, waitMs } from "./fixtures";

/** The chart's lanes start after the time axis and end at the beads' reach from the edge. */
const LANE_MARGINS_PX = 52 + 28 + 16;
const LANE_COUNT = 4;
const CURVE_NAME = "drag the curve";
const URL = "/lab/concepts/abacus";
/** The replay takes about six seconds; a cold dev server can add a few more. */
const WRITE_TIMEOUT_MS = waitMs(20_000);
/** The ring is drawn a second after the write-in; a busy machine can take a few more. */
const INVITATION_TIMEOUT_MS = waitMs(5_000);
/** Longer than the curve's demonstration took, when there was one, from the ring's landing. */
const UNTOUCHED_MS = 5_000;
/** Taller than the lab's page with the whole day on it, at a phone's width. */
const WHOLE_DAY_HEIGHT_PX = 2_000;

/** Opens the day with reduced motion, for tests that are not about motion: it is written at once. */
async function openStill(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  await waitForTheDay(page);
}

/**
 * Waits for the day to finish writing itself in: the chart stops being busy once the
 * stream is complete and every bead has settled, and only then can it be dragged.
 */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: WRITE_TIMEOUT_MS },
  );
}

/**
 * A window tall enough to show the whole Alicante day at once. The ring waits at a stop in
 * view, so a phone's first screen has it on an earlier stop than lunch.
 */
async function showWholeDay(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  await page.setViewportSize({ width, height: WHOLE_DAY_HEIGHT_PX });
}

/** The ring that invites the first drag, on the curve at the invited stop. */
function ringOf(page: Page): Locator {
  return page.locator("[data-invitation] circle");
}

/** Pulls the curve at lunch quieter by a lane and a bit, holding the pointer down. */
async function pullLunchQuieter(page: Page): Promise<void> {
  const chart = page.getByRole("group", { name: /The day's energy/ });
  const lunch = page.getByRole("slider", { name: "Energy at 14:00" });

  await chart.scrollIntoViewIfNeeded();
  const chartBox = await chart.boundingBox();
  const knob = await lunch.boundingBox();
  if (!chartBox || !knob) throw new Error("The chart did not render");
  const laneStep = (chartBox.width - LANE_MARGINS_PX) / LANE_COUNT;
  const x = knob.x + knob.width / 2;
  const y = knob.y + knob.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - laneStep / 2, y, { steps: 4 });
  await page.mouse.move(x - laneStep * 1.2, y, { steps: 4 });
}

test("sets the day in one sans and one weight, and the model's sentences in italic", async ({
  page,
}) => {
  await openStill(page);
  const styleOf = (locator: Locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.fontFamily.split(",")[0]} ${style.fontWeight} ${style.fontStyle} ${style.textTransform}`;
    });
  const name = page.getByText("Playa del Postiguet", { exact: true }).first();
  // The beach's name says its quarter, so the walk's note is the one with a quarter.
  const note = page.getByText("walk · Casco Antiguo", { exact: true }).first();
  const line = page.getByText(/^Sunrise from the beach/).first();

  expect(await styleOf(name)).toBe('"Fira Sans" 400 normal none');
  expect(await styleOf(note)).toBe('"Fira Sans" 400 normal none');
  expect(await styleOf(line)).toBe('"Fira Sans" 400 italic none');
});

test("a calm row opens with how the place feels, and a lively one folds to what it is", async ({
  page,
}) => {
  await openStill(page);
  const day = page.getByRole("list", { name: "The day" });

  await expect(day.getByText("Small waves, a beach rake, gulls.")).toBeVisible();
  // A bar, folded, says "bar" for its kind, as a folded row says its name and kind, and
  // under them how full and how loud it is, as every row that does not open says
  // (`docs/decisions.md`, "The day is drawn as an abacus").
  await expect(day.getByRole("button", { name: /^Tapas on Calle Villegas/ })).toHaveAccessibleName(
    /^Tapas on Calle Villegas\s*bar\s*packed · loud$/,
  );
});

test("the day writes itself in, then the curve can be dragged", async ({ page }) => {
  await page.goto(URL);
  const chart = page.getByRole("group", { name: /The day's energy/ });
  const rows = page.getByRole("list", { name: "The day" }).getByRole("listitem");

  await expect(chart).toHaveAttribute("aria-busy", "true");
  // The scale names the curve only once it can be dragged.
  await expect(page.getByText(CURVE_NAME).filter({ visible: true })).toHaveCount(0);
  await expect(rows).not.toHaveCount(8);
  await expect(page.getByRole("slider")).toHaveCount(0);

  await waitForTheDay(page);

  await expect(rows).toHaveCount(8);
  await expect(page.getByRole("slider", { name: /^Energy at/ })).toHaveCount(8);
  // The light is the ground's: nothing to drag for it.
  await expect(page.getByRole("slider", { name: "The sun" })).toHaveCount(0);
  await expect(page.getByText(CURVE_NAME).filter({ visible: true })).toBeVisible();
  // A moment after the day can be dragged, the ring that invites the first drag waits.
  await expect(ringOf(page)).toBeVisible({ timeout: INVITATION_TIMEOUT_MS });

  await pullLunchQuieter(page);
  await page.mouse.up();

  await expect(page.getByRole("slider", { name: "Energy at 14:00" })).toHaveAttribute(
    "aria-valuetext",
    "reflective: Arroz a banda by the port",
  );
  await expect(rows.getByText("Arroz a banda by the port", { exact: true })).toBeVisible();
});

test("pulling the curve quieter at lunch swaps the restaurant once the drag ends", async ({
  page,
}) => {
  await openStill(page);
  const list = page.getByRole("list", { name: "The day" });
  const lunch = page.getByRole("slider", { name: "Energy at 14:00" });
  /** What every stop shows, by its time. */
  const shownByStop = () =>
    page
      .getByRole("slider", { name: /^Energy at / })
      .evaluateAll((sliders) =>
        sliders.map((slider) =>
          [slider.getAttribute("aria-label"), slider.getAttribute("aria-valuetext")].join(" = "),
        ),
      );
  const before = await shownByStop();

  await pullLunchQuieter(page);

  await expect(lunch).toHaveAttribute("aria-valuetext", "reflective: Arroz a banda by the port");
  await expect(list.getByText("Paella on the marina", { exact: true })).toBeVisible();

  await page.mouse.up();

  await expect(list.getByText("Arroz a banda by the port", { exact: true })).toBeVisible();
  await expect(list.getByText("Paella on the marina", { exact: true })).toHaveCount(0);
  await expect(list.getByText("quieter · instead of Paella on the marina")).toBeVisible();
  // A pull at lunch's wire swaps lunch alone: the stops around it keep their places.
  const changed = (await shownByStop()).filter((shown) => !before.includes(shown));
  expect(changed).toEqual(["Energy at 14:00 = reflective: Arroz a banda by the port"]);
});

test("an open stop's words grow into a sheet over the day, and move no row", async ({ page }) => {
  await openStill(page);
  const list = page.getByRole("list", { name: "The day" });
  const row = list.getByRole("button", { name: /^Paella on the marina/ });
  const next = list.getByRole("button", { name: /^MACA/ });
  /** Where a row's name sits in the day, whatever the page has scrolled. */
  const inDay = async (name: Locator) => {
    const [box, listBox] = await Promise.all([name.boundingBox(), list.boundingBox()]);
    return box && listBox ? { x: box.x - listBox.x, y: box.y - listBox.y } : null;
  };
  const [rowBefore, nextBefore] = await Promise.all([inDay(row), inDay(next)]);

  await row.click();
  const sheet = page.getByRole("region", { name: "About Paella on the marina" });

  await expect(sheet).toBeVisible();
  // A place to eat around says its hours and quarter: its name says what is eaten there.
  await expect(sheet).toContainText("14:00–15:45 · 1 h 45 min · Puerto");
  await expect(sheet).toBeFocused();
  await expect(sheet.getByRole("button", { name: "Arroz a banda by the port" })).toHaveCount(0);
  const rowBox = await row.boundingBox();
  const sheetBox = await sheet.boundingBox();
  if (!rowBox || !sheetBox || !nextBefore) throw new Error("The open stop did not render");
  // The sheet grows from the row's own words: the name stays where it was, on the sheet.
  expect(await inDay(row)).toEqual(rowBefore);
  expect(sheetBox.y).toBeLessThan(rowBox.y);
  expect(sheetBox.x).toBeLessThan(rowBox.x);
  expect(sheetBox.y + sheetBox.height).toBeGreaterThan(rowBox.y + rowBox.height);
  // Nothing in the day moves to make room for it, and the page does not widen.
  expect(await inDay(next)).toEqual(nextBefore);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );

  await page.keyboard.press("Escape");

  await expect(sheet).toHaveCount(0);
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(row).toBeFocused();
});

test("the last stop's sheet is read to its end, and the page grows no taller for it", async ({
  page,
}) => {
  await openStill(page);
  const list = page.getByRole("list", { name: "The day" });
  const pageHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
  const closed = await pageHeight();

  await list.getByRole("button", { name: /^Tapas on Calle Villegas/ }).click();
  const sheet = page.getByRole("region", { name: "About Tapas on Calle Villegas" });
  await expect(sheet).toBeVisible();
  expect(await pageHeight()).toBe(closed);
  // It brings itself into view whole, opening above the stop where the day ends under it.
  const viewport = page.viewportSize()?.height ?? 0;
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(viewport);
});

test("a version swapped in from the keyboard rewrites an open sheet", async ({ page }) => {
  await openStill(page);
  const list = page.getByRole("list", { name: "The day" });

  await list.getByRole("button", { name: /^Paella on the marina/ }).click();
  await page.getByRole("slider", { name: "Energy at 14:00" }).focus();
  await page.keyboard.press("End");

  const sheet = page.getByRole("region", { name: "About Tapas on San Fernando" });
  await expect(sheet).toContainText("at a crowded counter instead of a table on the water");
  await expect(
    list.getByRole("button", { name: /^Tapas on San Fernando/, expanded: true }),
  ).toBeVisible();
});

test("the ring steps aside while its stop is open", async ({ page }) => {
  await showWholeDay(page);
  await openStill(page);
  const list = page.getByRole("list", { name: "The day" });
  const lunch = list.getByRole("button", { name: /^Paella on the marina/ });
  await expect(ringOf(page)).toBeVisible();

  await lunch.click();
  await expect(ringOf(page)).toHaveCount(0);

  await lunch.click();
  await expect(ringOf(page)).toBeVisible();
});

test.describe("the light on the time axis", () => {
  test("runs Alicante's axis in the lamp at dawn and dusk, dotted after sunset, and nothing across the chart", async ({
    page,
  }) => {
    await openStill(page);
    const runs = page.locator("line[data-light]");
    await expect(runs).toHaveCount(4);
    const drawn = await runs.evaluateAll((all) =>
      all
        .map((run) => ({
          light: run.getAttribute("data-light"),
          y: Number(run.getAttribute("y1")),
          isDotted: getComputedStyle(run).strokeDasharray !== "none",
          x: Number(run.getAttribute("x1")),
        }))
        .sort((a, b) => a.y - b.y),
    );
    expect(drawn.map((run) => [run.light, run.isDotted])).toEqual([
      ["dark", true],
      ["golden", false],
      ["golden", false],
      ["dark", true],
    ]);
    // All on the time axis: the light is never drawn across the rows.
    expect(new Set(drawn.map((run) => run.x)).size).toBe(1);

    // The Explanada starts in the evening's gold, and says its time in the sunset's amber.
    const list = page.getByRole("list", { name: "The day" });
    const [explanada, sunset] = await Promise.all([
      list.getByText("17:20", { exact: true }).evaluate((time) => getComputedStyle(time).color),
      page
        .getByText(/^sunset \d\d:\d\d$/)
        .first()
        .evaluate((words) => getComputedStyle(words).color),
    ]);
    expect(explanada).toBe(sunset);
  });

  test("the energy scale names the curve between its two words, on any phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await openStill(page);
    const boxOf = async (text: string) => {
      const box = await page
        .getByText(text, { exact: true })
        .filter({ visible: true })
        .boundingBox();
      if (!box) throw new Error(`"${text}" did not render`);
      return box;
    };
    const quieter = await boxOf("← quieter");
    const curve = await boxOf(CURVE_NAME);
    const livelier = await boxOf("livelier →");

    expect(curve.x).toBeGreaterThan(quieter.x + quieter.width);
    expect(curve.x + curve.width).toBeLessThan(livelier.x);
  });

  test("leaves the page's scroll to a finger, and the curve's drag to the chart", async ({
    page,
  }) => {
    await openStill(page);

    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveCSS(
      "touch-action",
      "pan-y",
    );
  });
});

test("the lab controls never sit over the chart", async ({ page }) => {
  await page.goto(URL);
  await waitForTheDay(page);
  const chart = await page.getByRole("group", { name: /The day's energy/ }).boundingBox();
  const controls = await page.getByRole("complementary", { name: "Lab controls" }).boundingBox();
  if (!chart || !controls) throw new Error("The chart or the controls did not render");

  const overlapsAcross =
    controls.x < chart.x + chart.width && chart.x < controls.x + controls.width;
  const overlapsDown =
    controls.y < chart.y + chart.height && chart.y < controls.y + controls.height;
  expect(overlapsAcross && overlapsDown).toBe(false);
});

test("a realistic stream names the morning in the silence before its first words", async ({
  page,
}) => {
  /** The first words arrive 1.4 s in; the wait ends with them, fading out quickly. */
  const FIRST_WORDS_TIMEOUT_MS = waitMs(3_000);
  await page.goto(URL);
  await waitForTheDay(page);
  // The day's voice: a tick at the pen on the time axis, and the phrase and its ruled line
  // where the first row's name will be.
  const waiting = page.locator('[data-waiting="voice"]');
  const rows = page.getByRole("list", { name: "The day" }).getByRole("listitem");

  await page.getByRole("button", { name: "realistic" }).click();

  await expect(waiting).toHaveCount(2);
  await expect(waiting.getByText("the morning", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Writing the day" })).toHaveCount(1);
  await expect(rows).toHaveCount(0);
  await expect(waiting).toHaveCount(0, { timeout: FIRST_WORDS_TIMEOUT_MS });
  await expect(page.getByRole("status").filter({ hasText: "Writing the day" })).toHaveCount(0);
});

test("replay writes the day again from the empty frame", async ({ page }) => {
  await page.goto(URL);
  await waitForTheDay(page);
  const rows = page.getByRole("list", { name: "The day" }).getByRole("listitem");

  await page.getByRole("button", { name: "Replay", exact: true }).click();

  await expect(page.getByText(CURVE_NAME).filter({ visible: true })).toHaveCount(0);
  await expect(rows).not.toHaveCount(8);
  await waitForTheDay(page);
  await expect(rows).toHaveCount(8);
});

test.describe("the request sentence", () => {
  /** A re-composition streams for about five seconds; a cold dev server adds some. */
  const RECOMPOSE_TIMEOUT_MS = waitMs(15_000);
  /** A failing call gives up after its first pause, about a second. */
  const FAIL_TIMEOUT_MS = waitMs(5_000);

  /**
   * Only what is on screen: the header holds its tallest state in unseen copies of the
   * sentence and the facts line.
   */
  const seen = (locator: Locator) => locator.filter({ visible: true });

  /** Opens a word of the headline and chooses one of its options. */
  async function answer(page: Page, word: string, option: RegExp): Promise<void> {
    await page
      .getByRole("heading", { level: 1 })
      .getByRole("button", { name: word, exact: true })
      .click();
    await page.getByRole("option", { name: option }).click();
  }

  /**
   * Each row's text and its place against the chart. An answer may glide the day once, as a
   * whole, to the header's new height; a row never moves against the chart unless its own
   * time changes.
   */
  async function rowsOf(page: Page) {
    return page
      .getByRole("list", { name: "The day" })
      .getByRole("listitem")
      .evaluateAll((items) => {
        const chart = document.querySelector('[role="group"][aria-label^="The day"]');
        const chartTop = chart?.getBoundingClientRect().top ?? 0;
        return items.map((item) => {
          const box = item.getBoundingClientRect();
          return { text: item.textContent, top: Math.round(box.top - chartTop), left: box.left };
        });
      });
  }

  test("with family: eating late is revised, dinner is rewritten, the rest holds still", async ({
    page,
  }) => {
    await openStill(page);
    const headline = page.getByRole("heading", { level: 1 });
    const list = page.getByRole("list", { name: "The day" });
    const chart = page.getByRole("group", { name: /The day's energy/ });
    const before = await rowsOf(page);

    await answer(page, "with anyone", /with family/);

    await expect(list.getByText("Rice on Calle Mayor", { exact: true })).toBeVisible({
      timeout: RECOMPOSE_TIMEOUT_MS,
    });
    await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: RECOMPOSE_TIMEOUT_MS });
    await expect(headline.locator("del")).toHaveText("eating late");
    await expect(headline.getByRole("button", { name: "early dinner", exact: true })).toHaveClass(
      /decoration-dotted/,
    );
    await expect(
      headline.getByRole("button", { name: "with family", exact: true }),
    ).not.toHaveClass(/decoration-dotted/);
    await expect(seen(page.getByText("an earlier dinner suits a family"))).toBeVisible();
    await expect(seen(page.getByText("click a word to change it"))).toHaveCount(0);
    await expect(list.getByRole("listitem").last()).toContainText("20:30");
    await expect(list.getByText("Tapas on Calle Villegas", { exact: true })).toHaveCount(0);

    const after = await rowsOf(page);
    expect(after.slice(0, 7)).toEqual(before.slice(0, 7));
    // Dinner moved from nine to half past eight, and its row moved up the day with it.
    expect(after[7]?.top).toBeLessThan(before[7]?.top ?? 0);
  });

  test("confirming an assumption takes away its dotted mark and re-composes nothing", async ({
    page,
  }) => {
    await openStill(page);
    const before = await rowsOf(page);
    const word = page
      .getByRole("heading", { level: 1 })
      .getByRole("button", { name: "on foot", exact: true });
    await expect(word).toHaveClass(/decoration-dotted/);

    await answer(page, "on foot", /on foot/);

    await expect(word).not.toHaveClass(/decoration-dotted/);
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(await rowsOf(page)).toEqual(before);
  });

  test("a failed change keeps the day and the question, and the word in the error retries", async ({
    page,
  }) => {
    await openStill(page);
    const list = page.getByRole("list", { name: "The day" });
    const headline = page.getByRole("heading", { level: 1 });

    await page.getByRole("button", { name: "fail", exact: true }).click();
    await answer(page, "with anyone", /with family/);

    const retry = page.getByRole("button", { name: "family", exact: true });
    await expect(retry).toBeVisible({ timeout: FAIL_TIMEOUT_MS });
    await expect(seen(page.getByText(/Couldn.t re-plan\. Try/))).toBeVisible();
    await expect(headline.getByRole("button", { name: "with anyone", exact: true })).toBeVisible();
    await expect(list.getByText("Tapas on Calle Villegas", { exact: true })).toBeVisible();
    // "Next change" means once: the retry goes through.
    await expect(page.getByRole("button", { name: "ok", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await retry.click();

    await expect(list.getByText("Rice on Calle Mayor", { exact: true })).toBeVisible({
      timeout: RECOMPOSE_TIMEOUT_MS,
    });
    await expect(seen(page.getByText(/Couldn.t re-plan/))).toHaveCount(0);
  });
});

test.describe("the invitation", () => {
  // Lunch, the stop these follow, is the one in view nearest midday once all of the day is.
  test.beforeEach(async ({ page }) => showWholeDay(page));

  /** Lunch's row, the headline and the chart. */
  function partsOf(page: Page) {
    const list = page.getByRole("list", { name: "The day" });
    const lunch = list.getByRole("listitem").nth(4);
    return {
      list,
      chart: page.getByRole("group", { name: /The day's energy/ }),
      headline: page.getByRole("heading", { level: 1 }),
      shows: (name: string) => lunch.getByText(name, { exact: true }),
    };
  }

  /** The dashed day a pull would give: the example at the ring, or a pull to the pointer. */
  function previewOf(page: Page, kind: "example" | "pointer"): Locator {
    return page.locator(`[data-preview="${kind}"]`);
  }

  test("once the day is written it stays as planned: lunch's ring and its example only draw", async ({
    page,
  }) => {
    await page.goto(URL);
    const { list, chart, headline, shows } = partsOf(page);
    await waitForTheDay(page);
    const chartAtRest = await chart.boundingBox();

    await expect(ringOf(page)).toBeVisible({ timeout: INVITATION_TIMEOUT_MS });
    await expect(previewOf(page, "example")).toBeAttached();
    await page.waitForTimeout(UNTOUCHED_MS);

    // The page never changes the day by itself (2026-10-30).
    await expect(shows("Paella on the marina")).toBeVisible();
    await expect(headline).not.toContainText("livelier");
    await expect(list).toHaveAttribute("aria-busy", "false");
    expect(await chart.boundingBox()).toEqual(chartAtRest);
  });

  test("a pointer moving over the chart previews a pull there, and changes nothing", async ({
    page,
  }) => {
    await page.goto(URL);
    const { chart, headline, shows } = partsOf(page);
    await waitForTheDay(page);
    await expect(ringOf(page)).toBeVisible({ timeout: INVITATION_TIMEOUT_MS });
    const [ring, chartBox] = await Promise.all([ringOf(page).boundingBox(), chart.boundingBox()]);
    if (!ring || !chartBox) throw new Error("The ring or the chart did not render");
    const from = { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2 };
    // A lane and a half to the right of the curve at lunch, past where it picks livelier.
    const reach = ((chartBox.width - LANE_MARGINS_PX) / LANE_COUNT) * 1.5;

    await page.mouse.move(from.x, from.y);
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(from.x + (reach * step) / 10, from.y);
    }

    await expect(previewOf(page, "pointer")).toBeAttached();
    await expect(previewOf(page, "example")).toHaveCount(0);
    await expect(shows("Paella on the marina")).toBeVisible();
    await expect(headline).not.toContainText("livelier");
  });

  test("with reduced motion, the ring and its example show all the same", async ({ page }) => {
    await openStill(page);
    const { headline, shows } = partsOf(page);

    await expect(ringOf(page)).toBeVisible({ timeout: INVITATION_TIMEOUT_MS });
    await expect(previewOf(page, "example")).toBeAttached();
    await page.waitForTimeout(UNTOUCHED_MS);
    await expect(shows("Paella on the marina")).toBeVisible();
    await expect(headline).not.toContainText("livelier");
  });

  test("the first drag puts them away for good", async ({ page }) => {
    await openStill(page);
    await expect(ringOf(page)).toBeVisible({ timeout: INVITATION_TIMEOUT_MS });

    await pullLunchQuieter(page);
    await page.mouse.up();

    await expect(ringOf(page)).toHaveCount(0);
    await expect(page.locator("[data-preview]")).toHaveCount(0);
  });

  test("Replay draws them again for the day written anew", async ({ page }) => {
    await page.goto(URL);
    await waitForTheDay(page);
    await expect(ringOf(page)).toBeVisible({ timeout: INVITATION_TIMEOUT_MS });

    await page.getByRole("button", { name: "Replay", exact: true }).click();

    await expect(ringOf(page)).toHaveCount(0);
    await expect(ringOf(page)).toBeVisible({ timeout: WRITE_TIMEOUT_MS + INVITATION_TIMEOUT_MS });
  });
});
