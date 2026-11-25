import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

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
/** How long the whole proposal is watched beside the day for a lead that must not come. */
const WHOLE_WATCH_MS = 1_000;
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
  // The headline's room, told from the masthead's row, a container too, by its headline.
  const room = cellAt(grid, moment).locator("header .\\@container:has(h1)");
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
    const word = section
      .locator("h1")
      .getByRole("button", { name: "eating late, being written: go to it" });
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
  expect(lines[0]).toMatch(/^Writing “[^”]+” for .+ ·\u00A0see it$/);
  // Seen as "see it", heard by where it leads: the proposal's answer beside the parts it writes.
  await expect(header.getByRole("button", { name: /^see it: “[^”]+” beside .+$/ })).toBeVisible();
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

  // Travel changes the word alone, every stop as it was; an energy answer counts the stops its
  // re-pick changes on the day on screen.
  await headline.getByRole("button", { name: /on foot/ }).click();
  await expect(page.getByRole("option", { name: "by taxi" })).toHaveAccessibleDescription(
    "keeps every stop · at once",
  );
  await page.keyboard.press("Escape");
  await headline.getByRole("button", { name: /balanced/ }).click();
  await expect(page.getByRole("option", { name: "lively" })).toHaveAccessibleDescription(
    "re-picks three stops · at once",
  );
});

test("leads the line about the day with no “As first planned:” while a proposal is written, nor while it stands whole", async ({
  page,
}) => {
  test.setTimeout(waitMs(120_000));
  await page.goto(BENCH);
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await controls.getByRole("group", { name: "Day" }).getByRole("button", { name: "Elche" }).click();
  await controls
    .getByRole("group", { name: "Ending" })
    .getByRole("button", { name: "complete" })
    .click();
  await controls.getByRole("button", { name: "Re-plan" }).click();
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  // Every frame from the press on, read by the page itself: whether the line on screen, outside
  // the unseen copies that hold its room, was ever led as first planned.
  await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) throw new Error("The day has a header");
    const isLed = () =>
      [...header.querySelectorAll("p")].some(
        (line) =>
          line.closest("[aria-hidden]") === null &&
          (line.textContent ?? "").startsWith("As first planned"),
      );
    const seen = { isLed: isLed() };
    Object.assign(window, { leadSeen: seen });
    new MutationObserver(() => {
      seen.isLed ||= isLed();
    }).observe(header, { subtree: true, childList: true, characterData: true });
  });
  const wasLed = () =>
    page.evaluate(() => (window as unknown as { leadSeen: { isLed: boolean } }).leadSeen.isLed);

  await page
    .getByRole("heading", { level: 1 })
    .getByRole("button", { name: /^early dinner/ })
    .click();
  await page.getByRole("option", { name: /eating late/ }).click();

  const facts = page.locator("header p.type-note:not([aria-hidden] *)").first();
  await expect(facts).toHaveText(/^Writing “eating late”/, { timeout: DAY_TIMEOUT_MS });
  expect(await wasLed()).toBe(false);
  await expect(facts).toHaveText(/^“eating late” drawn beside/, { timeout: waitMs(90_000) });
  // Whole beside the day and not taken, the day's stops are the ones the line was written for.
  await page.waitForTimeout(WHOLE_WATCH_MS);
  expect(await wasLed()).toBe(false);
});

/**
 * The headline's pair as its fork folds: its words are written out after the word, and while
 * they are, the pair is out of reach and a focus on it is the word's. Watched every frame by the
 * page itself, with motion, under which the pen writes them out.
 */
test.describe("the headline's pair as its fork folds", { tag: "@frame" }, () => {
  test.use({ reducedMotion: "no-preference" });

  /** Long enough for the pair's words to be written out, a slow page's too. */
  const WRITTEN_OUT_MS = 1_500;
  const PAIR = "h1 button[data-fork-pair]";
  /** The bench's day and its proposal at the live pace, a slow page's too. */
  const STORY_TIMEOUT_MS = waitMs(120_000);
  /** The proposal written whole or to its end at the live pace, a page four times slower too. */
  const PROPOSAL_TIMEOUT_MS = waitMs(90_000);

  /** Elche on the bench, its re-plans ending as `ending` says, the day written to its end. */
  async function openElche(page: Page, ending: "complete" | "cut after a stop"): Promise<void> {
    await page.goto(BENCH);
    const controls = page.getByRole("complementary", { name: "Lab controls" });
    await controls.getByRole("button", { name: "Re-plan" }).click();
    await controls
      .getByRole("group", { name: "Day" })
      .getByRole("button", { name: "Elche" })
      .click();
    await controls
      .getByRole("group", { name: "Ending" })
      .getByRole("button", { name: ending })
      .click();
    await controls.getByRole("button", { name: "Re-plan" }).click();
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
  }

  /** Opens the dinner's word from the keys and moves its list's active option to `answer`. */
  async function pointAtAnswer(page: Page, answer: string): Promise<void> {
    await page
      .getByRole("heading", { level: 1 })
      .getByRole("button", { name: "early dinner", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const list = page.getByRole("listbox");
    const active = list.getByRole("option", { name: new RegExp(`^${answer}`) });
    await expect(active).toBeVisible();
    for (let step = 0; step < 8; step += 1) {
      const id = await list.getAttribute("aria-activedescendant");
      if (id !== null && id === (await active.getAttribute("id"))) return;
      await page.keyboard.press("ArrowDown");
    }
    throw new Error(`The list never reached ${answer}`);
  }

  interface PairWatch {
    /** Where the focus stood each frame: on the pair, on the page itself, or elsewhere. */
    frames: ("pair" | "page" | "elsewhere")[];
    /** Whether the pair still stood at each Tab. */
    tabs: boolean[];
    /** Each time the focus left an element for nowhere. */
    lost: string[];
  }

  /** Every frame from now on, read by the page: where the focus stands, and where the pair is. */
  function watchThePair(pair: string): void {
    const watch: PairWatch = { frames: [], tabs: [], lost: [] };
    Object.assign(window, { pairWatch: watch });
    addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Tab") watch.tabs.push(document.querySelector(pair) !== null);
      },
      true,
    );
    addEventListener(
      "focusout",
      (event) => {
        if (event.relatedTarget === null) {
          watch.lost.push((event.target as Element).textContent ?? "");
        }
      },
      true,
    );
    const sample = () => {
      const active = document.activeElement;
      watch.frames.push(
        active?.matches(pair)
          ? "pair"
          : active === null || active === document.body
            ? "page"
            : "elsewhere",
      );
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }

  /** How many frames the focus stood at `where`. */
  const framesAt = (watch: PairWatch, where: PairWatch["frames"][number]) =>
    watch.frames.filter((each) => each === where).length;

  const watchOf = (page: Page) =>
    page.evaluate(() => (window as unknown as { pairWatch: PairWatch }).pairWatch);

  test("a Tab while the pair is written out after a keep from the word's list passes it by", async ({
    page,
  }) => {
    test.setTimeout(STORY_TIMEOUT_MS);
    await openElche(page, "complete");
    await pointAtAnswer(page, "eating late");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("radio", { name: "eating late Take, proposed" }).first(),
    ).toBeAttached({ timeout: PROPOSAL_TIMEOUT_MS });
    await expect(page.locator(PAIR)).toHaveAccessibleName("eating late, proposed: go to it");

    await pointAtAnswer(page, "early dinner");
    await page.evaluate(watchThePair, PAIR);
    // The keep hands the focus back to the word; the Tab comes as the pair is written out.
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(WRITTEN_OUT_MS);

    const watch = await watchOf(page);
    expect(watch.tabs, "the Tab met the pair still written out").toEqual([true]);
    expect(framesAt(watch, "pair"), "frames with the focus on the pair").toBe(0);
    expect(watch.lost).toEqual([]);
    await expect(page.locator(PAIR)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1 }).getByRole("button", { name: /^home by eleven/ }),
    ).toBeFocused();
  });

  test("the headline's name keeps the pair's join and comma while its words are written out, and none of them", async ({
    page,
  }) => {
    test.setTimeout(STORY_TIMEOUT_MS);
    await openElche(page, "complete");
    await pointAtAnswer(page, "eating late");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("radio", { name: "eating late Take, proposed" }).first(),
    ).toBeAttached({ timeout: PROPOSAL_TIMEOUT_MS });
    await expect(page.locator(PAIR)).toHaveAccessibleName("eating late, proposed: go to it");
    // The headline's name as Chrome gives it to a screen reader.
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "h1" });
    const { node } = await cdp.send("DOM.describeNode", { nodeId });
    const nameOf = async () => {
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
        backendNodeId: node.backendNodeId,
        fetchRelatives: false,
      });
      return String(nodes[0]?.name?.value ?? "");
    };
    const isPairThere = () => page.evaluate((pair) => document.querySelector(pair) !== null, PAIR);

    await pointAtAnswer(page, "early dinner");
    await page.keyboard.press("Enter");
    // The pair only leaves: one still there after a read stood through it.
    const names: string[] = [];
    for (let isThere = true; isThere;) {
      const name = await nameOf();
      isThere = await isPairThere();
      if (isThere) names.push(name);
    }

    expect(names.length, "names read while the pair was written out").toBeGreaterThan(0);
    for (const name of names) {
      expect(name).toContain("early dinner or");
      expect(name).toMatch(/or ?, home by eleven/);
      expect(name).not.toContain("go to it");
    }
  });

  // With reduced motion the pair goes at once, its words never written out.
  for (const [reducedMotion, how] of [
    ["no-preference", "as its words are written out"],
    ["reduce", "as it goes at once with reduced motion"],
  ] as const) {
    test(`a focus on the pair when its proposal fails goes to the word, never to the page, ${how}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      test.setTimeout(STORY_TIMEOUT_MS);
      await openElche(page, "cut after a stop");
      await pointAtAnswer(page, "eating late");
      await page.keyboard.press("Enter");
      const pair = page.locator(PAIR);
      await expect(pair).toHaveAccessibleName("eating late, being written: go to it", {
        timeout: PROPOSAL_TIMEOUT_MS,
      });
      // The pair is the Tab's next stop after the word.
      await page.keyboard.press("Tab");
      await expect(pair).toBeFocused();
      await page.evaluate(watchThePair, PAIR);

      await expect(pair).toHaveCount(0, { timeout: PROPOSAL_TIMEOUT_MS });
      await page.waitForTimeout(WRITTEN_OUT_MS);

      const watch = await watchOf(page);
      expect(framesAt(watch, "pair"), "frames with the focus on the pair").toBeGreaterThan(0);
      expect(framesAt(watch, "page"), "frames with the focus on the page").toBe(0);
      expect(watch.lost).toEqual([]);
      await expect(
        page.getByRole("heading", { level: 1 }).getByRole("button", { name: "early dinner" }),
      ).toBeFocused();
    });
  }

  // A pointer's press or a screen reader gives the plan slip's proposal the focus while it is
  // written, though it cannot be taken yet; the slip fades as the proposal fails.
  for (const [reducedMotion, how] of [
    ["no-preference", "as it fades"],
    ["reduce", "as it goes at once with reduced motion"],
  ] as const) {
    test(`a focus on the plan slip's proposal when it fails goes to the version that stays, ${how}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      test.setTimeout(STORY_TIMEOUT_MS);
      await openElche(page, "cut after a stop");
      await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Plan" }).click();
      await pointAtAnswer(page, "eating late");
      await page.keyboard.press("Enter");
      const proposal = page
        .locator("[data-slip]")
        .getByRole("radio", { name: "eating late, being written" })
        .filter({ visible: true })
        .first();
      await expect(proposal).toBeVisible({ timeout: PROPOSAL_TIMEOUT_MS });
      await proposal.focus();
      await expect(proposal).toBeFocused();
      // The proposal is written until the headline's pair goes: it stands first.
      await expect(page.locator(PAIR)).toHaveCount(1, { timeout: PROPOSAL_TIMEOUT_MS });
      await page.evaluate(watchThePair, PAIR);

      await expect(page.locator(PAIR)).toHaveCount(0, { timeout: PROPOSAL_TIMEOUT_MS });
      await page.waitForTimeout(WRITTEN_OUT_MS);

      const watch = await watchOf(page);
      expect(framesAt(watch, "elsewhere"), "frames with the focus in the page").toBeGreaterThan(0);
      expect(framesAt(watch, "page"), "frames with the focus on the page").toBe(0);
      expect(watch.lost).toEqual([]);
      // The answer that stays of the part whose slip had the focus: the fork's first.
      await expect(page.locator('[data-fork-row="0"] :focus')).toHaveAccessibleName(
        "early dinner, your day",
      );
    });
  }
});
