import { expect, test, type Locator, type Page, waitMs } from "./fixtures";

/**
 * The header through a word's fork (`docs/decisions.md`, "A changed word proposes its part beside
 * the day, and the visitor takes it"): at the press the pen writes the proposal's answer after the
 * visitor's word, "early dinner or eating late", which takes a line more at most; the facts line's
 * end fades rather than being written over; the proposal's answer carries the start screen's steady
 * light in its own blue; and each answer says what it would do, from the plan the route runs. The
 * header's matrix sets every state; the re-plan bench plays a live day.
 */

const MATRIX = "/lab/matrix/written-header";
const BENCH = "/lab/concepts/replan";
const DAY_TIMEOUT_MS = waitMs(30_000);
/** The header's state at rest, and the re-plan's states the press brings, by their rows' labels. */
const AT_REST = /^written, with the hint$/;
const WRITING = /^a proposal being written: its word says both answers/;
const LONGEST = /^a proposal being written for the longest answer/;
const SHORTEST = /^a proposal being written for the shortest answer/;
const LOCKED = /^a re-plan being written, a locked word pressed/;
/** Less than this between two heights is a rounding, not a move. */
const SAME_PX = 0.5;

/** The matrix with one cell a row: its moments down, the day held at each in turn. */
async function openMatrixByMoment(page: Page): Promise<Locator> {
  await page.goto(MATRIX);
  await page.getByRole("combobox", { name: "Rows" }).selectOption("0");
  await page.getByRole("combobox", { name: "Columns" }).selectOption("0");
  await page.getByRole("combobox", { name: "Theme" }).selectOption("light");
  return page.getByTestId("matrix-grid");
}

/** A moment's cell in the grid. */
function cellAt(grid: Locator, moment: RegExp): Locator {
  return grid
    .locator("section")
    .filter({ has: grid.page().getByRole("heading", { level: 2, name: moment }) });
}

/** The height of the header's room in a moment's cell, or null where the day never reaches it. */
async function roomAt(grid: Locator, moment: RegExp): Promise<number | null> {
  const room = cellAt(grid, moment).locator("header .\\@container");
  if ((await room.count()) === 0) return null;
  return (await room.boundingBox())?.height ?? null;
}

/**
 * The height of a cell's headline itself: under the room the sentence holds, a word that let
 * the words after it up a line would leave a band under it with the room unchanged.
 */
async function headlineAt(grid: Locator, moment: RegExp): Promise<number> {
  return (await cellAt(grid, moment).locator("h1").boundingBox())?.height ?? 0;
}

/** One line of a cell's headline, as its type sets it at that width. */
async function titleLineAt(grid: Locator, moment: RegExp): Promise<number> {
  return cellAt(grid, moment)
    .locator("h1")
    .evaluate((headline) => parseFloat(getComputedStyle(headline).lineHeight));
}

test.use({ reducedMotion: "reduce" });

const WIDTHS = [
  ["phone", "a phone's width"],
  ["wide", "a laptop's page column"],
] as const;

for (const [width, where] of WIDTHS) {
  test(`grows the header by a line at most at a fork's press on every day, at ${where}`, async ({
    page,
  }) => {
    const grid = await openMatrixByMoment(page);
    await page.getByRole("combobox", { name: "Width" }).selectOption(width);
    const days = await page
      .getByRole("combobox", { name: "day" })
      .locator("option")
      .allTextContents();
    const compared: string[] = [];

    for (const [index, day] of days.entries()) {
      await page.getByRole("combobox", { name: "day" }).selectOption(String(index));
      await expect(grid.getByText("Reading the day…")).toHaveCount(0);
      const rest = await roomAt(grid, AT_REST);
      if (rest === null) continue;
      const restHeadline = await headlineAt(grid, AT_REST);
      // The pair written in after the word, a locked word's press saying one change is made at
      // a time where the hint stood, and the longest and shortest answers a word offers: the
      // pair takes a line more at most, and never less room than the day had.
      for (const moment of [WRITING, LOCKED, SHORTEST, LONGEST]) {
        const line = await titleLineAt(grid, moment);
        const room = await roomAt(grid, moment);
        expect(room, `${day}: ${String(moment)}`).not.toBeNull();
        expect((room ?? 0) - rest, `${day}: ${String(moment)}`).toBeGreaterThan(-SAME_PX);
        expect((room ?? 0) - rest, `${day}: ${String(moment)}`).toBeLessThan(line + SAME_PX);
        const headline = (await headlineAt(grid, moment)) - restHeadline;
        expect(headline, `${day}: ${String(moment)}'s headline`).toBeGreaterThan(-SAME_PX);
        expect(headline, `${day}: ${String(moment)}'s headline`).toBeLessThan(line + SAME_PX);
      }
      compared.push(day);
    }
    // Portland has no written day, so it is never re-planned.
    expect(compared).toHaveLength(days.length - 1);
  });
}

test("lights the proposal's answer with the steady light in its blue, and stands it in its blue with reduced motion", async ({
  browser,
}) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    const grid = await openMatrixByMoment(page);
    await expect(grid.getByText("Reading the day…")).toHaveCount(0);
    const section = grid
      .locator("section")
      .filter({ has: page.getByRole("heading", { level: 2, name: WRITING }) });
    const word = section.locator("h1").getByRole("button", { name: /^eating late, proposed/ });
    const light = await word.evaluate((element) => {
      const style = getComputedStyle(element);
      // A plain span's background, which is none.
      const plain = document.body.appendChild(document.createElement("span"));
      const none = getComputedStyle(plain).backgroundColor;
      plain.remove();
      return {
        animation: style.animationName,
        image: style.backgroundImage,
        hasColourBehind: style.backgroundColor !== none,
      };
    });
    // No colour stands behind the word, so none fades into a box as the light leaves it.
    expect(light.hasColourBehind).toBe(false);
    if (reducedMotion === "reduce") {
      expect(light).toEqual({ animation: "none", image: "none", hasColourBehind: false });
    } else {
      expect(light.animation).toBe("pass-steady");
      expect(light.image).toContain("gradient");
    }
    // Every other word is locked: it says so, and opens nothing.
    const other = section.locator("h1").getByRole("button", { name: "early start" });
    await expect(other).toHaveAttribute("aria-disabled", "true");
    await context.close();
  }
});

test("says in the facts line's place what a proposal being written writes, and where, a press away", async ({
  page,
}) => {
  const grid = await openMatrixByMoment(page);
  await expect(grid.getByText("Reading the day…")).toHaveCount(0);
  const header = cellAt(grid, WRITING).locator("header");
  // The live line, outside the unseen copies that hold its room.
  const lines = await header
    .locator("p.type-note")
    .evaluateAll((each) =>
      each.filter((line) => line.closest("[aria-hidden]") === null).map((line) => line.textContent),
    );
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^Writing “[^”]+” for .+ ·\u00A0see it at\u00A0\d\d:\d\d$/);
  await expect(header.getByRole("button", { name: /^see it at/ })).toBeVisible();
});

test("says under each answer what it would do, from the plan the route runs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BENCH);
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  const headline = page.locator("h1");

  // A time word proposes its part of the day anew, named as the day's rows name it.
  await headline.getByRole("button", { name: /early dinner/ }).click();
  await expect(page.getByRole("option", { name: "eating late" })).toHaveAccessibleDescription(
    "a proposal for lunch, the afternoon, dinner and the evening · about half a minute",
  );
  // The current answer carries its check alone.
  await expect(page.getByRole("option", { name: "early dinner" })).toHaveAccessibleDescription("");
  await page.keyboard.press("Escape");

  // Travel changes the word alone, every stop as it was; the energy re-picks at once.
  await headline.getByRole("button", { name: /on foot/ }).click();
  await expect(page.getByRole("option", { name: "by taxi" })).toHaveAccessibleDescription(
    "keeps every stop · at once",
  );
  await page.keyboard.press("Escape");
  await headline.getByRole("button", { name: /balanced/ }).click();
  await expect(page.getByRole("option", { name: "lively" })).toHaveAccessibleDescription(
    "re-picks at once",
  );
});
