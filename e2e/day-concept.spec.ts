import { expect, test, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

const URL = "/lab/concepts/day";
/** The route lands a written day in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const NOT_YET = "Lantern isn't writing new days right now. These are written:";

/** What each family of endings says over a day, the retry's words included. */
const WORDS = {
  unfinished: "Lantern couldn't finish this day. Write it again, or open one it has written:",
  dropped:
    "The connection dropped before Lantern finished this day. Write it again, or open one it has written:",
  refused: "Lantern can't plan this day. Open one it has written:",
  busy: "Lantern couldn't write this day just now. Write it again",
  resting: "Lantern has written all the days it can for now. These are written:",
};
/** The written days a notice over Kyoto offers: the starts', every one, Kyoto's being none. */
const BESIDES_KYOTO = [
  "A lively Saturday in Bologna, with friends",
  "A calm Sunday in Porto, slow morning",
  "A calm Saturday in Kanazawa, early start",
  "A lively Sunday in Madrid, out late, with friends",
  "A balanced Sunday in Utrecht, with family",
  "A quiet Saturday in Nafplio, slow morning",
];

/** The facts line on screen; an unseen copy of it under the header holds its room. */
function factsLine(page: Page) {
  return page.locator("header p.type-note").first();
}

/** A place on the day, which shows its name on the chart and in the list. */
function place(page: Page, name: string) {
  return page.getByText(name, { exact: true }).first();
}

/**
 * Waits for the day to be written and still: the chart stops being busy once the stream
 * is complete and every bead has settled, and only then can its words be changed.
 */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/** The lab's chrome: the strip, and the panel its "Ending" toggle opens. */
function labControls(page: Page) {
  return page.getByRole("complementary", { name: "Lab controls" });
}

/** Counts the days asked of the route, from before the page loads. */
function countDayPosts(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/day")) count += 1;
  });
  return () => count;
}

/**
 * Ends the bench's next first play of `city`'s day as `ending`, at the pace the endings are
 * tested at. Kyoto's, written by hand, unless said; Kanazawa's for a day the site serves.
 */
async function chooseEnding(page: Page, ending: string, city = "Kyoto"): Promise<void> {
  const controls = labControls(page);
  const toggle = controls.getByRole("button", { name: "Ending" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await controls.getByRole("combobox", { name: "Day" }).selectOption(city);
  // The pace changes the next play, and the ending remounts the day to play it.
  await controls.getByRole("combobox", { name: "Pace" }).selectOption("Ten times faster");
  await controls.getByRole("combobox", { name: "Ending" }).selectOption(ending);
}

/** The chart: the day's energy, drawn while a day is written and once it has one. */
function chart(page: Page) {
  return page.getByRole("group", { name: /The day's energy/ });
}

/**
 * What a day that ends without one says in its header: the notice's line on screen, under
 * the headline, whatever its words are. A screen reader is told the same line from the
 * header's status.
 */
function endingLine(page: Page) {
  return page.locator("header p.text-quote");
}

/** The days a notice offers when no day is coming, each a sentence to choose. */
function writtenDays(page: Page) {
  return page.locator("header").getByRole("list").getByRole("listitem");
}

/** The stops on the chart, each a slider named for its start time. */
function stopSliders(page: Page) {
  return page.getByRole("slider", { name: /^Energy at \d/ });
}

/** Opens the Kyoto day with reduced motion, so nothing but the stream takes time. */
async function openWritten(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  // Played again ten times faster: the tests that open it act on the day once it is written,
  // and at the landing's pace it took 13 s, half of a test that then plays a second day.
  const controls = labControls(page);
  const toggle = controls.getByRole("button", { name: "Ending" });
  await toggle.click();
  await controls.getByRole("combobox", { name: "Pace" }).selectOption("Ten times faster");
  await toggle.click();
  await controls.getByRole("button", { name: "Replay" }).click();
  await waitForTheDay(page);
}

test("says the request before the first word, then writes Lantern's words and the line, then the date, the chart and the sun", async ({
  page,
}) => {
  await page.goto(URL);
  const headline = page.getByRole("heading", { level: 1 });
  const facts = factsLine(page);

  // The stream waits more than a second before its first words; the request is there, and
  // the date and the chart wait for the header's room, so nothing under it rides down.
  await expect(headline).toHaveText("A calm Saturday in Kyoto");
  await expect(page.locator("header p.type-note:visible")).toHaveCount(0);
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveCount(0);

  await expect(headline).toHaveText(
    "A calm Saturday in Kyoto, on foot, early start, early dinner, home by eight, with anyone",
    { timeout: DAY_TIMEOUT_MS },
  );
  // The line about the day, once: its unseen copy under the header holds its room.
  await expect(page.getByText(/^Honen-in before eight/).first()).toBeVisible();
  await expect(facts).toContainText(/^Sat 14 Nov/);
  await expect(facts).toContainText("sunrise 06:30");
  await expect(facts).toContainText("sunset 16:53");
  await waitForTheDay(page);
  await expect(place(page, "Obanzai along Pontocho")).toBeVisible();
});

test("with live generation off, a changed word stays and says what it would have re-planned", async ({
  page,
}) => {
  await openWritten(page);
  const headline = page.getByRole("heading", { level: 1 });

  await headline.getByRole("button", { name: "with anyone" }).click();
  await page.getByRole("option", { name: "with family" }).click();

  await expect(headline).toContainText("home by eight, with anyone");
  await expect(factsLine(page)).toContainText(
    "Lantern isn't re-planning days right now, so dinner stays as written",
  );
});

test("the energy word re-picks the day from the versions already written", async ({ page }) => {
  await openWritten(page);
  const headline = page.getByRole("heading", { level: 1 });

  await headline.getByRole("button", { name: "calm", exact: true }).click();
  await page.getByRole("option", { name: "lively" }).click();

  await expect(headline).toContainText("A lively Saturday in Kyoto");
  await expect(place(page, "Shinnyo-do")).toBeVisible();
  // On the chart, the view on show here: the planned version has given way.
  await expect(
    page.getByRole("list", { name: "The day", exact: true }).getByText("Honen-in", { exact: true }),
  ).toHaveCount(0);
  // The line about the day still names Honen-in, so it says it is the day as first planned,
  // until the calm day it was written for is back.
  const dek = page.getByText(/Honen-in before eight/).filter({ visible: true });
  await expect(dek).toHaveText(/^As first planned: Honen-in before eight/);
  await headline.getByRole("button", { name: "lively", exact: true }).click();
  await page.getByRole("option", { name: "calm" }).click();
  await expect(dek).toHaveText(/^Honen-in before eight/);
});

test("the city word plays another written day, whole sentence and all", async ({ page }) => {
  await openWritten(page);
  const headline = page.getByRole("heading", { level: 1 });

  await headline.getByRole("button", { name: "Kyoto", exact: true }).click();
  // Kyoto's is no written day: the list offers the starts', the first of them in focus.
  await expect(
    page.getByRole("button", { name: /this day$/ }).filter({ hasNotText: "Take this day" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Bologna/ })).toBeFocused();
  await page.getByRole("button", { name: /^Bologna/ }).click();

  await expect(headline).toContainText("A lively Saturday in Bologna");
  await expect(headline).toContainText("with friends");
  await expect(headline.getByRole("button", { name: "Bologna", exact: true })).toBeFocused();

  // Tabbing on past the field closes the list, as the words' pickers close.
  await headline.getByRole("button", { name: "Bologna", exact: true }).click();
  await page.getByRole("textbox", { name: "Somewhere else" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("group", { name: "Where" })).toHaveCount(0);
  // Its assumptions stream first, and are final once the line about the day starts: the
  // sentence is whole long before the day, which the route plays at the landing's pace.
  await expect(headline).toContainText("on foot, slow morning", { timeout: DAY_TIMEOUT_MS });
});

test("a city Lantern has no day for is said back as asked, with the days that are written", async ({
  page,
}) => {
  await openWritten(page);
  const headline = page.getByRole("heading", { level: 1 });

  await page.getByRole("button", { name: "Take this day" }).click();
  await page.getByRole("menuitem", { name: /^Plan another day/ }).click();
  await expect(page.getByRole("textbox", { name: "Somewhere else" })).toBeFocused();
  await page.keyboard.type("Lisbon");
  await page.keyboard.press("Enter");

  await expect(headline).toHaveText("A calm Saturday in Lisbon");
  await expect(endingLine(page).filter({ hasText: NOT_YET })).toBeVisible();
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveCount(0);

  await page.getByRole("button", { name: "A quiet Saturday in Nafplio, slow morning" }).click();
  await expect(headline).toContainText("A quiet Saturday in Nafplio");
  // Its first stop is written: the day plays, without waiting the landing's pace to its end.
  await expect(place(page, "Coffee on Staikopoulou")).toBeVisible({ timeout: DAY_TIMEOUT_MS });
});

test("hands the focus back to the energy word after a choice from the keyboard", async ({
  page,
}) => {
  await page.goto(URL);
  await waitForTheDay(page);
  const headline = page.getByRole("heading", { level: 1 });
  await headline.getByRole("button", { name: "calm" }).focus();

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  // The old word unwrites and the new one writes in; the focus stays with the word.
  const chosen = headline.getByRole("button", { name: "balanced" });
  await expect(chosen).toHaveText("balanced");
  await expect(chosen).toBeFocused();
});

test.describe("the ending bench", () => {
  test.use({ reducedMotion: "reduce" });

  test("the first play after load and after Replay ends as chosen, and only Write it again asks the route", async ({
    page,
  }) => {
    // Two days stream whole at the landing's pace: the first play, and the one written again.
    test.slow();
    const dayPosts = countDayPosts(page);
    await page.goto(URL);
    await waitForTheDay(page);
    expect(dayPosts()).toBe(0);

    // A day the site serves, which its retry asks the route for, as on its own address.
    await chooseEnding(page, "error-mid-plan", "Kanazawa");
    await expect(endingLine(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await expect(chart(page)).toHaveCount(0);

    await labControls(page).getByRole("button", { name: "Replay" }).click();
    await expect(endingLine(page)).toHaveCount(0);
    await expect(endingLine(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await expect(chart(page)).toHaveCount(0);
    expect(dayPosts()).toBe(0);

    await page.getByRole("button", { name: "Write it again" }).click();
    await waitForTheDay(page);
    await expect(place(page, "Oden in Katamachi")).toBeVisible();
    expect(dayPosts()).toBe(1);
  });

  test("Write it again on a day written by hand plays it again from its file, which the route has not", async ({
    page,
  }) => {
    const dayPosts = countDayPosts(page);
    await page.goto(URL);
    await chooseEnding(page, "error-mid-plan");
    await expect(endingLine(page)).toBeVisible({ timeout: DAY_TIMEOUT_MS });

    await page.getByRole("button", { name: "Write it again" }).click();
    await waitForTheDay(page);
    await expect(place(page, "Obanzai along Pontocho")).toBeVisible();
    expect(dayPosts()).toBe(0);
  });

  for (const ending of ["length-in-swaps", "dropped-in-swaps"]) {
    test(`${ending}: every stop is kept, those after the cut with one bead, and the hint shows`, async ({
      page,
    }) => {
      await page.goto(URL);
      await chooseEnding(page, ending);
      await waitForTheDay(page);

      const sliders = stopSliders(page);
      await expect(sliders).toHaveCount(8);
      const beads: number[] = [];
      for (const slider of await sliders.all()) {
        beads.push(await slider.locator("..").locator("[data-candidate]").count());
      }
      // Swaps stream after every stop, in the stops' order: those before the cut keep
      // theirs, and every stop after it shows only its own bead.
      const firstAlone = beads.indexOf(0);
      expect(firstAlone, `beads per stop: ${beads.join(" ")}`).toBeGreaterThan(0);
      expect(beads.slice(0, firstAlone).every((count) => count > 0)).toBe(true);
      expect(beads.slice(firstAlone).every((count) => count === 0)).toBe(true);
      // "click" with a mouse, "tap" on a touch screen.
      await expect(page.getByText(/a word to change it/).filter({ visible: true })).toHaveCount(1);
    });
  }

  test("refused: the rows that had landed leave", async ({ page }) => {
    await page.goto(URL);
    await chooseEnding(page, "refused-mid-plan");
    const rows = page.getByRole("list", { name: "The day", exact: true }).getByRole("listitem");

    // A row is a zero-height box its words hang from, so it is counted rather than seen.
    await expect
      .poll(() => rows.count(), { timeout: DAY_TIMEOUT_MS, intervals: [50] })
      .toBeGreaterThan(0);
    await expect(rows).toHaveCount(0, { timeout: DAY_TIMEOUT_MS });
    await expect(chart(page)).toHaveCount(0);
    // Never offered again: no retry, and the written days besides it.
    await expect(endingLine(page)).toHaveText(WORDS.refused);
    await expect(page.getByRole("button", { name: "Write it again" })).toHaveCount(0);
    await expect(writtenDays(page)).toHaveText(BESIDES_KYOTO);
  });

  for (const [ending, words] of [
    ["error-mid-plan", WORDS.unfinished],
    ["invalid", WORDS.unfinished],
    ["dropped-mid-plan", WORDS.dropped],
    ["offline", WORDS.dropped],
  ] as const) {
    test(`${ending}: no chart, a line that offers the day again, and the other written days`, async ({
      page,
    }) => {
      await page.goto(URL);
      await chooseEnding(page, ending);

      await expect(endingLine(page)).toHaveText(words, { timeout: DAY_TIMEOUT_MS });
      await expect(chart(page)).toHaveCount(0);
      // One control, named for what it does; its comma sits inside it, unheard.
      await expect(endingLine(page).getByRole("button")).toHaveText(["Write it again,"]);
      await expect(endingLine(page).getByRole("button")).toHaveAccessibleName("Write it again");
      await expect(writtenDays(page)).toHaveText(BESIDES_KYOTO);
    });
  }

  test("Write it again from the keyboard gives the focus to the day's city word", async ({
    page,
  }) => {
    await page.goto(URL);
    await chooseEnding(page, "error-mid-plan");
    const retry = endingLine(page).getByRole("button", { name: "Write it again" });

    await retry.focus({ timeout: DAY_TIMEOUT_MS });
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { level: 1 }).getByRole("button", { name: /^Kyoto/ }),
    ).toBeFocused();
  });

  test("rejected: a written day that did not come is offered again, and nothing else", async ({
    page,
  }) => {
    await page.goto(URL);
    await chooseEnding(page, "rejected", "Kanazawa");

    await expect(endingLine(page)).toHaveText(WORDS.busy, { timeout: DAY_TIMEOUT_MS });
    await expect(chart(page)).toHaveCount(0);
    await expect(endingLine(page).getByRole("button")).toHaveText(["Write it again"]);
    await expect(writtenDays(page)).toHaveCount(0);
  });

  test("limited: Lantern rests, with the three written days and no chart", async ({ page }) => {
    await page.goto(URL);
    await chooseEnding(page, "limited");

    await expect(endingLine(page)).toHaveText(WORDS.resting, { timeout: DAY_TIMEOUT_MS });
    await expect(chart(page)).toHaveCount(0);
    await expect(endingLine(page).getByRole("button")).toHaveCount(0);
    await expect(writtenDays(page)).toHaveText(BESIDES_KYOTO);
  });

  test("Tab goes on from the Ending toggle into its panel, in the panel's order", async ({
    page,
  }) => {
    await page.goto(URL);
    const controls = labControls(page);
    await controls.getByRole("button", { name: "Ending" }).focus();
    await page.keyboard.press("Enter");

    for (const name of ["Day", "Ending", "Pace", "Re-plans"]) {
      await page.keyboard.press("Tab");
      await expect(controls.getByRole("combobox", { name })).toBeFocused();
    }
  });

  test("the lab's strip is one 33 px line on a 390 px phone, and its theme reaches the day", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL);
    const controls = labControls(page);

    for (const theme of ["light", "dark"]) {
      await controls.getByRole("button", { name: theme, exact: true }).click();
      await expect(page.locator(`[data-theme="${theme}"] header`)).toHaveCount(1);
      const strip = await controls.boundingBox();
      expect(Math.round(strip?.height ?? 0)).toBe(33);
      const tops = await controls
        .getByRole("button")
        .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top));
      expect(new Set(tops).size).toBe(1);
    }
  });
});

/** The phone and the laptop a day's layout is measured at. */
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };

/**
 * A day played whole on the bench at a phone's or a laptop's size, its panel shut so it
 * stands over no row: the product's own day, for a day written by hand, which has no address.
 */
async function openOnTheBench(
  page: Page,
  city: string,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  await chooseEnding(page, "finished", city);
  await labControls(page).getByRole("button", { name: "Ending" }).click();
  await waitForTheDay(page);
}

/** How far a sheet that rises past the chart's top keeps under the header's last line. */
const SHEET_UNDER_HEADER_PX = 8;

test("on a laptop no sheet makes Lisbon's page taller: Miradouro's opens above its name, Carmo's keeps under the header", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Measured on a 1440 × 900 laptop");
  // Lisbon's day, written by hand, has no address of the site's; the bench plays it in the
  // product's own day, and no start has a sheet the header keeps under it on a laptop.
  await openOnTheBench(page, "Lisbon", LAPTOP);
  const pageHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
  const closed = await pageHeight();
  const list = page.getByRole("list", { name: "The day" });
  // The header's last line: the date, the sun and the hint.
  const lastLine = page.locator("header p", { hasText: "click a word to change it" }).first();

  await list.getByRole("button", { name: /^Convento do Carmo/ }).click();
  const carmo = page.getByRole("region", { name: "About Convento do Carmo" });
  await expect(carmo).toBeFocused();
  expect(await pageHeight()).toBe(closed);
  const [carmoBox, lineBox] = await Promise.all([carmo.boundingBox(), lastLine.boundingBox()]);
  if (!carmoBox || !lineBox) throw new Error("The sheet or the header did not render");
  expect(carmoBox.y).toBeGreaterThanOrEqual(lineBox.y + lineBox.height + SHEET_UNDER_HEADER_PX);
  await page.keyboard.press("Escape");
  await expect(carmo).toHaveCount(0);

  // At 336 px Miradouro's had room on neither side and made the page 62 px taller; at its
  // least of 448 px it says the same in fewer lines, and fits above its name.
  const name = list.getByRole("button", { name: /^Miradouro de Santa Catarina/ });
  await name.click();
  const miradouro = page.getByRole("region", { name: "About Miradouro de Santa Catarina" });
  await expect(miradouro).toBeFocused();
  expect(await pageHeight()).toBe(closed);
  const [miradouroBox, nameBox] = await Promise.all([miradouro.boundingBox(), name.boundingBox()]);
  if (!miradouroBox || !nameBox) throw new Error("The sheet or its name did not render");
  expect(miradouroBox.y).toBeLessThan(nameBox.y);
  await page.keyboard.press("Escape");
  await expect(miradouro).toHaveCount(0);
  expect(await pageHeight()).toBe(closed);
});

test("the time axis carries the light, and the sunset's minute stands by its sun where it has room", async ({
  page,
  isMobile,
}) => {
  // Kyoto's, written by hand, on the bench: no start's sunset has room for its minute.
  await openOnTheBench(page, "Kyoto", isMobile ? PHONE : LAPTOP);

  // Gold to the sunset, then dotted to the frame's end; nothing is laid across the rows.
  const runs = await page.locator("line[data-light]").evaluateAll((all) =>
    all
      .map((run) => ({ light: run.getAttribute("data-light"), y: Number(run.getAttribute("y1")) }))
      .sort((a, b) => a.y - b.y)
      .map((run) => run.light),
  );
  expect(runs).toEqual(["golden", "dark"]);
  await expect(page.locator("rect[data-light]")).toHaveCount(0);

  // On a phone the sunset falls 13 px from a stop's time, under the 18 its minute needs: the
  // sun stands alone, and the header says its minute.
  const sunset = page.locator('[data-sun="sunset"]');
  await expect(sunset).toBeAttached();
  await expect(sunset.getByText("16:53")).toHaveCount(isMobile ? 0 : 1);
});

/** A sun this much into a line of words, top or bottom, stands on that line. */
const SAME_LINE_PX = 2;

// The days written by hand, on the bench: no start's place is visited in its best light.
for (const day of ["Kyoto", "Lisbon", "Alicante"]) {
  test(`${day}'s best-light suns keep to their names' last words, never alone on a line`, async ({
    page,
    isMobile,
  }) => {
    await openOnTheBench(page, day, isMobile ? PHONE : LAPTOP);

    const suns = await page.getByRole("list", { name: "The day" }).evaluate(
      (list, sameLine) =>
        [...list.querySelectorAll('button[aria-expanded] svg[aria-label^="Best light"]')].map(
          (sun) => {
            const name = sun.closest(".type-name");
            const box = sun.getBoundingClientRect();
            const button = sun.closest("button")!.getBoundingClientRect();
            const walker = document.createTreeWalker(name ?? sun, NodeFilter.SHOW_TEXT);
            let isBesideWords = false;
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const line of range.getClientRects()) {
                const isSameLine =
                  line.bottom > box.top + sameLine && line.top < box.bottom - sameLine;
                if (line.width > 0 && isSameLine) isBesideWords = true;
              }
            }
            return { name: name?.textContent ?? "", isBesideWords, past: box.right - button.right };
          },
        ),
      SAME_LINE_PX,
    );

    // Kyoto's Gion Shirakawa, written by hand, filled a phone's column: its sun stood alone
    // under its name.
    expect(suns.length).toBeGreaterThan(0);
    for (const sun of suns) {
      expect(sun.isBesideWords, `${sun.name}'s sun beside its words`).toBe(true);
      expect(sun.past, `${sun.name}'s sun inside its column`).toBeLessThanOrEqual(0);
    }
  });
}
