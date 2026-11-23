import { expect, test, type Page } from "./fixtures";
import { openLive } from "./live-page";
import { expectSaidOnceAsChange, logStatuses } from "./status-log";
import { NOTICE_HEARD_MS } from "../src/features/day/notice-status";
import { PORTLAND_MAINE, PORTLAND_OREGON } from "../src/lib/fixtures/city-readings";
import { MAX_INTAKE_TEXT_CHARS, type IntakeResult } from "../src/lib/schema/intake.schema";

test.use({ reducedMotion: "reduce" });

// Lantern reads at most this much of a text, and answered a longer one with an error no one
// could act on: the field takes no more, and says how much room is left near its end.
test("the start field takes no more than Lantern reads, and says so", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("textbox", { name: "Where, and anything else" });

  await field.fill("a".repeat(MAX_INTAKE_TEXT_CHARS + 1));

  await expect(field).toHaveValue("a".repeat(MAX_INTAKE_TEXT_CHARS));
  await expect(field).toHaveAccessibleDescription("0 left");
  await expect(page.getByText("0 left")).toBeVisible();
});

/**
 * Where the index's heading stands under the question, from the form's top. The index is drawn
 * once the page has hydrated, after the question, so the measure waits for its heading.
 */
async function indexHeadingOf(page: Page): Promise<number> {
  await expect(
    page.getByRole("heading", { name: "No city in mind? Start from one of these" }),
  ).toBeVisible();
  return page.evaluate(() => {
    const form = document.querySelector("main form")!.getBoundingClientRect();
    const heading = document.querySelector("main section[aria-labelledby] h2")!;
    return heading.getBoundingClientRect().top - form.top;
  });
}

// The line under the field says one thing at a time: the count takes the example's place in
// the example's room, so the keystroke that brings it in moves nothing under the field.
test("the room left takes the example's place and moves nothing under the field", async ({
  page,
}) => {
  await page.goto("/");
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  const example = page.getByRole("status").filter({ hasText: /^For example:/ });

  await field.fill("a".repeat(MAX_INTAKE_TEXT_CHARS - 41));
  await expect(example).toBeVisible();
  const before = await indexHeadingOf(page);

  await field.fill("a".repeat(MAX_INTAKE_TEXT_CHARS - 40));
  await expect(page.getByText("40 left")).toBeVisible();
  await expect(example).toHaveCount(0);
  expect(await indexHeadingOf(page)).toBeCloseTo(before, 1);
});

/**
 * How far the index's heading may move when an ending lands, with live generation on: the height
 * an ending adds at the page's edge in the quote's size, two lines of it on a Pixel 7 and one on a
 * laptop, with a pixel's play (`docs/decisions.md`, "The start screen asks its question as one
 * line"). An ending set in a narrower column takes a line more and passes it.
 */
const ENDING_MOVE_BAR = { phone: 28.3 + 1, laptop: 4.6 + 1 };

test("an ending stands at the page's edge and moves the index no further than the bar", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  // Live generation on, as production runs: the note, the one thing it does not draw at rest,
  // is hidden, not removed, so the page's own render still owns it.
  await page
    .getByText("Lantern isn't writing new days right now.", { exact: true })
    .evaluate((note: HTMLElement) => {
      note.style.display = "none";
    });
  const rest = await indexHeadingOf(page);
  const field = page.getByRole("textbox", { name: "Where, and anything else" });

  // A city no written day is for: with live generation off it can write no day.
  await field.fill("Reykjavik");
  await field.press("Enter");
  const ending = page.locator("main form").getByText("Start from one of the days below.", {
    exact: false,
  });
  await expect(ending).toBeVisible();

  const moved = (await indexHeadingOf(page)) - rest;
  expect(moved).toBeLessThanOrEqual(isMobile ? ENDING_MOVE_BAR.phone : ENDING_MOVE_BAR.laptop);
  // At the page's edge, where "A day in" starts, not in the field's column.
  const edges = await ending.evaluate((line) => {
    const form = line.closest("form")!.getBoundingClientRect();
    return line.getBoundingClientRect().left - form.left;
  });
  expect(edges).toBe(0);
});

/**
 * Asks with `text` from the field once the page has hydrated, and returns the moment of the
 * press on the page's clock.
 */
async function askFromTheField(page: Page, text: string): Promise<number> {
  // The index is drawn once the page has hydrated, and a field filled before then is emptied.
  await expect(
    page.getByRole("heading", { name: "No city in mind? Start from one of these" }),
  ).toBeVisible();
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill(text);
  const pressedAt = await page.evaluate(() => performance.now());
  await field.press("Enter");
  return pressedAt;
}

/**
 * `said` was said once, as a change of words in a status that stood before the press, held for
 * `NOTICE_HEARD_MS` and then quiet, and no status came onto the page holding words since: whether
 * a screen reader says a status born full depends on the reader and the browser. The line seen,
 * `seen`, stays once the status is quiet.
 */
async function expectSaidInPlace(
  page: Page,
  pressedAt: number,
  said: string,
  seen: string,
): Promise<void> {
  await expectSaidOnceAsChange(page, said, NOTICE_HEARD_MS, pressedAt);
  const log = await page.evaluate(() => window.statusLog);
  const saying = log.find((entry) => entry.t >= pressedAt && entry.text === said)!;
  const born = log.find((entry) => entry.id === saying.id && entry.kind === "added")!;
  expect(born.t, "the status that says it stood before the press").toBeLessThan(pressedAt);
  const bornFull = log.filter(
    (entry) => entry.t >= pressedAt && entry.kind === "added" && /\S/.test(entry.text),
  );
  expect(bornFull).toEqual([]);
  await expect(page.locator("main form").getByText(seen, { exact: false })).toBeVisible();
}

/** The intake's answer to "Portland, a lively day": which of two Portlands. */
const PORTLAND_ASKED: IntakeResult = {
  kind: "question",
  key: "city",
  readings: [PORTLAND_OREGON, PORTLAND_MAINE],
  words: {
    date: null,
    energy: "lively",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: null,
  },
  unplaced: [],
};

/** Answers the page's reading of a text with `answer`, as the intake route would. */
async function answerTheIntake(page: Page, answer: IntakeResult): Promise<void> {
  await page.route("**/api/intake", (route) => route.fulfill({ json: answer }));
}

test.describe("each answer without a day, and the city's question, is said in a status that stood", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(logStatuses);
  });

  test("with live generation off, as the site is served", async ({ page }) => {
    await page.goto("/");
    const pressedAt = await askFromTheField(page, "Reykjavik");

    await expectSaidInPlace(
      page,
      pressedAt,
      "Lantern isn't writing new days right now. Start from one of the days below.",
      "Lantern isn't writing new days right now.",
    );
  });

  test("with live generation on, a text Lantern will not plan", async ({ page }) => {
    await answerTheIntake(page, { kind: "refused" });
    await openLive(page, "/");
    const pressedAt = await askFromTheField(page, "a quiet day somewhere");

    await expectSaidInPlace(
      page,
      pressedAt,
      "Lantern can't plan that day. Start from one of the days below.",
      "Lantern can't plan that day.",
    );
    await expect(page.getByRole("textbox", { name: "Where, and anything else" })).toBeFocused();
  });

  test("with live generation on, the city's question", async ({ page }) => {
    await answerTheIntake(page, PORTLAND_ASKED);
    await openLive(page, "/");
    const pressedAt = await askFromTheField(page, "Portland, a lively day");

    await expectSaidInPlace(
      page,
      pressedAt,
      "A lively day in …? Portland, Oregon, United States, or Portland, Maine, United States.",
      "A lively day in …?",
    );
    await expect(page.getByRole("textbox", { name: "Which city?" })).toBeFocused();
  });
});

/** How long the intake takes to read a text the second time it is asked. */
const SECOND_READ_MS = 2500;
/**
 * How long the read is said at least: well under its wait, so a stall between the press and the
 * frame the line turns to reading, as on a slow machine, leaves it held long enough.
 */
const SECOND_READ_HELD_MS = 1000;

test.describe("a text asked again after an ending is said as read from a status that stood", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(logStatuses);
  });

  const planButton = (page: Page) => page.getByRole("button", { name: "Plan this day" });
  for (const [how, press] of [
    [
      "Enter on the button the focus is on",
      async (page: Page) => {
        await page.keyboard.press("Tab");
        await expect(planButton(page)).toBeFocused();
        await page.keyboard.press("Enter");
      },
    ],
    ["a click on the button", (page: Page) => planButton(page).click()],
  ] as const) {
    test(`by ${how}`, async ({ page }) => {
      // Refused, then read as the written intake reads it, into a written day's request: the line
      // turns from the read to the day on its way, which the line says itself.
      let reads = 0;
      await page.route("**/api/intake", async (route) => {
        reads += 1;
        if (reads === 1) return route.fulfill({ json: { kind: "refused" } satisfies IntakeResult });
        await new Promise((done) => setTimeout(done, SECOND_READ_MS));
        return route.continue();
      });
      await openLive(page, "/");
      await askFromTheField(page, "Kanazawa, on foot");
      await expect(
        page.locator("main form").getByText("Lantern can't plan that day.", { exact: false }),
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Where, and anything else" })).toBeFocused();

      const pressedAt = await page.evaluate(() => performance.now());
      await press(page);
      await expectSaidOnceAsChange(page, "Reading what you wrote", SECOND_READ_HELD_MS, pressedAt);
      // Until the read falls quiet: the day that takes the page then draws statuses of its own.
      const log = await page.evaluate(() => window.statusLog);
      const read = log.find((entry) => entry.t >= pressedAt && entry.text.includes("Reading"))!;
      const born = log.find((entry) => entry.id === read.id && entry.kind === "added")!;
      expect(born.t, "the status that says it stood before the press").toBeLessThan(pressedAt);
      const readQuietAt = log.find((entry) => entry.id === read.id && entry.t > read.t)!.t;
      const bornFull = log.filter(
        (entry) =>
          entry.t >= pressedAt &&
          entry.t <= readQuietAt &&
          entry.kind === "added" &&
          /\S/.test(entry.text),
      );
      expect(bornFull, "a status came onto the page holding words").toEqual([]);
    });
  }
});

/** The focus as each frame finds it, by `performance.now()`. */
interface FocusFrame {
  t: number;
  tag: string;
  name: string;
}

declare global {
  interface Window {
    focusFrames: FocusFrame[];
  }
}

/** Logs where the focus is at each frame from the page's start. Run as an init script. */
function logFocusFrames(): void {
  const frames: FocusFrame[] = [];
  window.focusFrames = frames;
  const sample = () => {
    const focused = document.activeElement;
    frames.push({
      t: performance.now(),
      tag: focused?.tagName ?? "",
      name: focused?.getAttribute("aria-label") ?? focused?.textContent ?? "",
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

/** How long the day's route is held after a city is chosen: well inside the start's own cap. */
const DAY_HELD_MS = 1500;
/** Frames the wait must be sampled through at least, so an empty sample cannot pass. */
const FRAMES_SAMPLED_AT_LEAST = 20;

test.describe("a city chosen among those a shared name could be", () => {
  /**
   * Opens the city's question for "Portland, a lively day", live, with the day's route held until
   * `release` is called; it then answers that it cannot write the day, as the e2e server would.
   */
  async function askWhichPortland(page: Page): Promise<{ release: () => void }> {
    let release = () => {};
    const held = new Promise<void>((done) => {
      release = done;
    });
    await page.route("**/api/day", async (route) => {
      await held;
      await route.fulfill({ status: 503 });
    });
    await page.addInitScript(logFocusFrames);
    await page.addInitScript(logStatuses);
    await answerTheIntake(page, PORTLAND_ASKED);
    await openLive(page, "/");
    await askFromTheField(page, "Portland, a lively day");
    await expect(page.getByRole("textbox", { name: "Which city?" })).toBeFocused();
    return { release };
  }

  const oregon = (page: Page) =>
    page.getByRole("button", { name: "Portland, Oregon, United States" });
  const writing = (page: Page) => page.getByRole("button", { name: "Writing", exact: true });

  test("at Enter, hands the focus to the button through the wait, then to the city word", async ({
    page,
  }) => {
    const { release } = await askWhichPortland(page);
    await oregon(page).focus();
    const pressedAt = await page.evaluate(() => performance.now());
    await page.keyboard.press("Enter");

    await expect(writing(page)).toBeFocused();
    // A key's press draws the ring the typed path draws on the same button.
    expect(await writing(page).evaluate((button) => button.matches(":focus-visible"))).toBe(true);
    await page.waitForTimeout(DAY_HELD_MS);
    const releasedAt = await page.evaluate(() => performance.now());
    const waited = await page.evaluate(
      ([from, to]) => window.focusFrames.filter((frame) => frame.t > from && frame.t < to),
      [pressedAt, releasedAt] as const,
    );
    expect(waited.length).toBeGreaterThanOrEqual(FRAMES_SAMPLED_AT_LEAST);
    expect(waited.filter((frame) => frame.tag === "BODY")).toEqual([]);
    expect(waited.at(-1)).toMatchObject({ tag: "BUTTON", name: "Writing" });
    // The day set off is said once, as a change of a status that stood before the press.
    const log = await page.evaluate(() => window.statusLog);
    const said = log.filter(
      (entry) => entry.t >= pressedAt && entry.text.startsWith("Writing a lively"),
    );
    expect(said, "the day set off, said once").toHaveLength(1);
    expect(said[0]!.kind, "a status put on the page already holding the line").toBe("changed");
    const born = log.find((entry) => entry.id === said[0]!.id && entry.kind === "added")!;
    expect(born.t, "the status that says it stood before the press").toBeLessThan(pressedAt);

    release();
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest('h1 [data-word="city"]') != null),
      )
      .toBe(true);
  });

  test("at a click, hands the focus to the button with no ring drawn", async ({ page }) => {
    const { release } = await askWhichPortland(page);
    await oregon(page).click();

    await expect(writing(page)).toBeFocused();
    expect(await writing(page).evaluate((button) => button.matches(":focus-visible"))).toBe(false);
    release();
  });
});
