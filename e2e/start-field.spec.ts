import { expect, test, type Locator, type Page } from "./fixtures";
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

/** What the start's status over the form held, and what the field was described by, at once. */
interface SaidAndDescribed {
  t: number;
  said: string;
  describedBy: string | null;
}

declare global {
  interface Window {
    saidAndDescribed: SaidAndDescribed[];
  }
}

/**
 * Logs what the start's status over the form holds and the field's description together, at each
 * change of the page, by `performance.now()`, so no change between two reads from the test goes
 * unseen. Run as an init script.
 */
function logSaidAndDescribed(): void {
  const log: SaidAndDescribed[] = [];
  window.saidAndDescribed = log;
  const note = () => {
    const form = document.querySelector("main form");
    const field = form?.querySelector("textarea");
    if (!form || !field) return;
    const said = form.previousElementSibling?.textContent ?? "";
    const describedBy = field.getAttribute("aria-describedby");
    const last = log.at(-1);
    if (last?.said === said && last.describedBy === describedBy) return;
    log.push({ t: performance.now(), said, describedBy });
  };
  new MutationObserver(note).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-describedby"],
  });
}

/** When the status over the form fell quiet after saying an answer since `since`, if it has. */
function quietAtOf(page: Page, since: number): Promise<number | undefined> {
  return page.evaluate((since) => {
    const log = window.saidAndDescribed.filter((entry) => entry.t >= since);
    const saying = log.findIndex((entry) => entry.said !== "");
    if (saying === -1) return undefined;
    return log.slice(saying).find((entry) => entry.said === "")?.t;
  }, since);
}

/** Polls until the status has said an answer since `since` and fallen quiet. */
async function waitForTheStatusQuiet(page: Page, since: number): Promise<number> {
  await expect
    .poll(() => quietAtOf(page, since), { timeout: NOTICE_HEARD_MS * 2 })
    .toBeGreaterThan(since);
  return (await quietAtOf(page, since))!;
}

/**
 * The status said the answer, the field was never described while it did, and the description
 * joined only once the status had fallen quiet.
 */
async function expectDescribedOnceSaid(page: Page, since: number): Promise<void> {
  const sinceThePress = () =>
    page.evaluate((since) => window.saidAndDescribed.filter((entry) => entry.t >= since), since);
  await expect
    .poll(async () => (await sinceThePress()).some((entry) => entry.said !== ""), {
      message: "the status said the answer",
    })
    .toBe(true);
  await expect
    .poll(async () => (await sinceThePress()).some((entry) => entry.describedBy !== null))
    .toBe(true);
  const log = await sinceThePress();
  expect(
    log.filter((entry) => entry.said !== "" && entry.describedBy !== null),
    "described while said",
  ).toEqual([]);
}

/** How long the intake takes to answer where the focus moves while it reads. */
const INTAKE_HELD_MS = 1000;

test.describe("the field an answer without a day hands the focus back to is described by it", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(logSaidAndDescribed);
  });

  const leaveAndComeBack = async (page: Page) => {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Plan this day" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
  };

  test("with live generation on, by the ending, once the status has said it and the focus has left", async ({
    page,
  }) => {
    await answerTheIntake(page, { kind: "refused" });
    await openLive(page, "/");
    const pressedAt = await askFromTheField(page, "a quiet day somewhere");
    const field = page.getByRole("textbox", { name: "Where, and anything else" });
    await expect(field).toBeFocused();
    await waitForTheStatusQuiet(page, pressedAt);
    // Kept in the field through the hold, it is not described under the focus.
    await expect(field).toHaveAccessibleDescription("");

    await leaveAndComeBack(page);
    await expect(field).toBeFocused();
    await expect(field).toHaveAccessibleDescription(
      "Lantern can't plan that day. Start from one of the days below.",
    );
    await expectDescribedOnceSaid(page, pressedAt);
  });

  test("with live generation on, by the ending, where the focus left while the status said it", async ({
    page,
  }) => {
    await answerTheIntake(page, { kind: "refused" });
    await openLive(page, "/");
    const pressedAt = await askFromTheField(page, "a quiet day somewhere");
    const field = page.getByRole("textbox", { name: "Where, and anything else" });
    await expect(field).toBeFocused();
    await page.keyboard.press("Tab");
    const leftAt = await page.evaluate(() => performance.now());

    const quietAt = await waitForTheStatusQuiet(page, pressedAt);
    expect(quietAt, "the focus left while the status said the answer").toBeGreaterThan(leftAt);
    await expectDescribedOnceSaid(page, pressedAt);
    await page.keyboard.press("Shift+Tab");
    await expect(field).toHaveAccessibleDescription(
      "Lantern can't plan that day. Start from one of the days below.",
    );
  });

  test("with live generation on, by the cities the city's question offers", async ({ page }) => {
    await answerTheIntake(page, PORTLAND_ASKED);
    await openLive(page, "/");
    const pressedAt = await askFromTheField(page, "Portland, a lively day");
    const field = page.getByRole("textbox", { name: "Which city?" });
    await expect(field).toBeFocused();
    await waitForTheStatusQuiet(page, pressedAt);
    await expect(field).toHaveAccessibleDescription("");

    await leaveAndComeBack(page);
    await expect(field).toHaveAccessibleDescription(
      "Portland, Oregon, United States, or Portland, Maine, United States.",
    );
    await expectDescribedOnceSaid(page, pressedAt);
  });

  test("with live generation on, by the cities the city's question offers when it asks again", async ({
    page,
  }) => {
    let reads = 0;
    await page.route("**/api/intake", async (route) => {
      reads += 1;
      if (reads === 1) {
        return route.fulfill({
          json: { ...PORTLAND_ASKED, readings: [] } satisfies IntakeResult,
        });
      }
      await new Promise((done) => setTimeout(done, INTAKE_HELD_MS));
      return route.fulfill({ json: PORTLAND_ASKED });
    });
    await openLive(page, "/");
    await askFromTheField(page, "a lively day");
    const field = page.getByRole("textbox", { name: "Which city?" });
    await expect(field).toBeFocused();
    await field.fill("Portland");
    const pressedAt = await page.evaluate(() => performance.now());
    await field.press("Enter");
    await expect(
      page.getByRole("button", { name: "Portland, Oregon, United States" }),
    ).toBeVisible();
    await expect(field).toBeFocused();
    await waitForTheStatusQuiet(page, pressedAt);

    await leaveAndComeBack(page);
    await expect(field).toHaveAccessibleDescription(
      "Portland, Oregon, United States, or Portland, Maine, United States.",
    );
  });

  test("with live generation on, by nothing, where the focus left the button before the ending", async ({
    page,
  }) => {
    await page.route("**/api/intake", async (route) => {
      await new Promise((done) => setTimeout(done, INTAKE_HELD_MS));
      await route.fulfill({ json: { kind: "refused" } satisfies IntakeResult });
    });
    await openLive(page, "/");
    const pressedAt = await askFromTheField(page, "a quiet day somewhere");
    await expect(page.getByRole("button", { name: "Reading" })).toBeFocused();
    // Away from the button while the text is read: the ending hands nothing back.
    await page.keyboard.press("Tab");
    const field = page.getByRole("textbox", { name: "Where, and anything else" });
    await waitForTheStatusQuiet(page, pressedAt);

    await expect(field).not.toBeFocused();
    await expect(field).toHaveAccessibleDescription("");
    // The visitor's own way to the field, and away again, hands nothing back either.
    await field.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Plan this day" })).toBeFocused();
    await expect(field).toHaveAccessibleDescription("");
  });

  test("with live generation off, by nothing, the focus staying on the button", async ({
    page,
  }) => {
    await page.goto("/");
    const pressedAt = await askFromTheField(page, "Reykjavik");
    await expect(
      page.locator("main form").getByText("Start from one of the days below.", { exact: false }),
    ).toBeVisible();
    await waitForTheStatusQuiet(page, pressedAt);

    await expect(page.getByRole("button", { name: "Plan this day" })).toBeFocused();
    await expect(page.getByRole("textbox")).toHaveAccessibleDescription("");
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

/**
 * The day on its way, `said`, was said first as a change of words in a status that stood empty
 * before the press, and no status came onto the page holding words from the press until then.
 */
async function expectOnItsWaySaidAsChange(
  page: Page,
  said: RegExp,
  pressedAt: number,
): Promise<void> {
  const sinceThePress = () =>
    page.evaluate((since) => window.statusLog.filter((entry) => entry.t >= since), pressedAt);
  await expect
    .poll(async () => (await sinceThePress()).some((entry) => said.test(entry.text)))
    .toBe(true);
  const log = await sinceThePress();
  const saying = log.find((entry) => said.test(entry.text))!;
  expect(saying.kind, "a status put on the page already holding the line").toBe("changed");
  const born = (await page.evaluate(() => window.statusLog)).find(
    (entry) => entry.id === saying.id && entry.kind === "added",
  )!;
  expect(born.text, "the status as it came onto the page").toBe("");
  expect(born.t, "the status came onto the page before the press").toBeLessThan(pressedAt);
  const bornFull = log.filter(
    (entry) => entry.t <= saying.t && entry.kind === "added" && /\S/.test(entry.text),
  );
  expect(bornFull, "a status came onto the page holding words").toEqual([]);
}

test.describe("a day set on its way straight after an ending is said from a status that stood", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(logStatuses);
  });

  test("with live generation on, a city pressed in the index after a refusal", async ({ page }) => {
    await answerTheIntake(page, { kind: "refused" });
    await openLive(page, "/");
    await askFromTheField(page, "a quiet day somewhere");
    await expect(
      page.locator("main form").getByText("Lantern can't plan that day.", { exact: false }),
    ).toBeVisible();

    const pressedAt = await page.evaluate(() => performance.now());
    await page
      .getByRole("list", { name: "No city in mind? Start from one of these" })
      .getByRole("button")
      .first()
      .click();
    await expectOnItsWaySaidAsChange(page, /^Writing a /, pressedAt);
  });

  test("with live generation on, a city pressed in the index while the answer to the city's question is read", async ({
    page,
  }) => {
    let reads = 0;
    await page.route("**/api/intake", async (route) => {
      reads += 1;
      if (reads === 1) {
        return route.fulfill({ json: { ...PORTLAND_ASKED, readings: [] } satisfies IntakeResult });
      }
      // The answer is never read back, so its read stands until the press.
      return new Promise(() => undefined);
    });
    await openLive(page, "/");
    await askFromTheField(page, "a lively day");
    const field = page.getByRole("textbox", { name: "Which city?" });
    await expect(field).toBeFocused();
    // A city no written day is for, so the intake reads it.
    await field.fill("Reykjavik");
    await field.press("Enter");
    await expect(page.getByRole("button", { name: "Reading" })).toBeVisible();

    const pressedAt = await page.evaluate(() => performance.now());
    await page
      .getByRole("list", { name: "No city in mind? Start from one of these" })
      .getByRole("button")
      .first()
      .click();
    await expectOnItsWaySaidAsChange(page, /^Writing a /, pressedAt);
  });

  test("with live generation on, a city pressed in the index while the city's question stands", async ({
    page,
  }) => {
    await answerTheIntake(page, PORTLAND_ASKED);
    await openLive(page, "/");
    await askFromTheField(page, "Portland, a lively day");
    await expect(page.getByRole("textbox", { name: "Which city?" })).toBeFocused();

    const pressedAt = await page.evaluate(() => performance.now());
    await page
      .getByRole("list", { name: "No city in mind? Start from one of these" })
      .getByRole("button")
      .first()
      .click();
    await expectOnItsWaySaidAsChange(page, /^Writing a /, pressedAt);
  });

  test("with live generation off, a written day's text answered before its read is drawn", async ({
    page,
  }) => {
    await page.goto("/");
    await askFromTheField(page, "Reykjavik");
    await expect(
      page.locator("main form").getByText("Start from one of the days below.", { exact: false }),
    ).toBeVisible();

    const pressedAt = await askFromTheField(page, "London, with friends");
    await expectOnItsWaySaidAsChange(page, /^Opening a /, pressedAt);
  });
});

/**
 * The words of each status on the page as Chrome's accessibility tree gives them to a screen
 * reader: the texts under it, in order, as they are joined when it is said.
 */
async function chromeStatusWordsOf(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const textsUnder = (id: string): string[] => {
    const node = byId.get(id);
    if (!node || node.ignored) return [];
    if (node.role?.value === "StaticText") return [String(node.name?.value ?? "")];
    return (node.childIds ?? []).flatMap(textsUnder);
  };
  return nodes
    .filter((node) => !node.ignored && node.role?.value === "status")
    .map((node) => textsUnder(node.nodeId).join(""));
}

/** What the start's status over the form holds, as the page writes it. */
const overFormWordsOf = (page: Page) =>
  page.evaluate(() => document.querySelector("main form")!.previousElementSibling!.textContent);

/** Chrome's words for the day on its way, said from the status over the form, as it writes them. */
async function expectOnItsWayWordsWhole(page: Page): Promise<void> {
  const writing = async () =>
    (await chromeStatusWordsOf(page)).find((words) => words.startsWith("Writing "));
  await expect.poll(writing).toMatch(/^Writing an? \S+ \S+ in \S/);
  expect(await writing(), "a space Chrome lost").toBe(await overFormWordsOf(page));
}

test.describe("a day on its way is said from the start's status with every space between its words", () => {
  test.beforeEach(async ({ page }) => {
    // The day is never answered, so its line stands while it is read.
    await page.route("**/api/day", () => undefined);
  });

  test("with live generation on, a city pressed in the index after a refusal", async ({ page }) => {
    await answerTheIntake(page, { kind: "refused" });
    await openLive(page, "/");
    await askFromTheField(page, "a quiet day somewhere");
    await expect(
      page.locator("main form").getByText("Lantern can't plan that day.", { exact: false }),
    ).toBeVisible();

    await page
      .getByRole("list", { name: "No city in mind? Start from one of these" })
      .getByRole("button")
      .first()
      .click();
    await expectOnItsWayWordsWhole(page);
  });

  test("with live generation on, the city's question answered", async ({ page }) => {
    await answerTheIntake(page, PORTLAND_ASKED);
    await openLive(page, "/");
    await askFromTheField(page, "Portland, a lively day");

    await page.getByRole("button", { name: "Portland, Oregon, United States" }).click();
    await expectOnItsWayWordsWhole(page);
  });
});

/** An element the focus moved to, by `performance.now()`. */
interface FocusIn {
  t: number;
  tag: string;
}

declare global {
  interface Window {
    focusIns: FocusIn[];
  }
}

/** Logs each move of the focus from the page's start. Run as an init script. */
function logFocusIns(): void {
  const moves: FocusIn[] = [];
  window.focusIns = moves;
  document.addEventListener(
    "focusin",
    (event) => moves.push({ t: performance.now(), tag: (event.target as Element).tagName }),
    true,
  );
}

/** Past the time a status holds an answer, when the field it hands the focus to is described. */
const PAST_HEARD_MS = NOTICE_HEARD_MS + 500;

/** The ending a text no written day is for meets with live generation off, as said. */
const NOT_LIVE_ENDING_SAID =
  "Lantern isn't writing new days right now. Start from one of the days below.";

test.describe("with live generation off, a text asked after an ending leaves the focus on the button", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(logFocusIns);
    await page.addInitScript(logStatuses);
    await page.goto("/");
    await askFromTheField(page, "Reykjavik");
    await expect(
      page.locator("main form").getByText("Start from one of the days below.", { exact: false }),
    ).toBeVisible();
  });

  const fieldFocusedSince = (page: Page, since: number) =>
    page.evaluate(
      (since) => window.focusIns.filter((move) => move.t >= since && move.tag === "TEXTAREA"),
      since,
    );

  test("through the wait for a written day it opens, the ending not said again", async ({
    page,
  }) => {
    const pressedAt = await askFromTheField(page, "London, with friends");
    await page.waitForURL(/\/day\/london/);

    expect(await fieldFocusedSince(page, pressedAt), "the field took the focus").toEqual([]);
    const said = await page.evaluate(
      (since) => window.statusLog.filter((entry) => entry.t >= since).map((entry) => entry.text),
      pressedAt,
    );
    expect(said, "the ending said again").not.toContain(NOT_LIVE_ENDING_SAID);
  });

  test("when it ends without a day again", async ({ page }) => {
    const pressedAt = await askFromTheField(page, "Reykjavik");
    const planButton = page.getByRole("button", { name: "Plan this day" });
    await expect(planButton).toBeFocused();
    await page.waitForTimeout(PAST_HEARD_MS);

    expect(await fieldFocusedSince(page, pressedAt), "the field took the focus").toEqual([]);
    await expect(planButton).toBeFocused();
    await expect(page.getByRole("textbox")).toHaveAccessibleDescription("");
    await expectSaidOnceAsChange(page, NOT_LIVE_ENDING_SAID, NOTICE_HEARD_MS, pressedAt);
  });
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

  /** The city word in the headline has the focus, as it has once the day answers. */
  const cityWordFocused = (page: Page) =>
    page.evaluate(() => document.activeElement?.closest('h1 [data-word="city"]') != null);

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
    await expect(writing(page)).toBeFocused();
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
    await expect.poll(() => cityWordFocused(page)).toBe(true);
  });

  test(
    "at Enter, never lets the focus fall to the page in any frame of the wait",
    { tag: "@frame" },
    async ({ page }) => {
      const { release } = await askWhichPortland(page);
      await oregon(page).focus();
      const pressedAt = await page.evaluate(() => performance.now());
      await page.keyboard.press("Enter");

      await expect(writing(page)).toBeFocused();
      await page.waitForTimeout(DAY_HELD_MS);
      const releasedAt = await page.evaluate(() => performance.now());
      const waited = await page.evaluate(
        ([from, to]) => window.focusFrames.filter((frame) => frame.t > from && frame.t < to),
        [pressedAt, releasedAt] as const,
      );
      expect(waited.length).toBeGreaterThanOrEqual(FRAMES_SAMPLED_AT_LEAST);
      expect(waited.filter((frame) => frame.tag === "BODY")).toEqual([]);
      expect(waited.at(-1)).toMatchObject({ tag: "BUTTON", name: "Writing" });

      release();
      await expect.poll(() => cityWordFocused(page)).toBe(true);
    },
  );

  test("at a click, hands the focus to the button with no ring drawn", async ({ page }) => {
    const { release } = await askWhichPortland(page);
    await oregon(page).click();

    await expect(writing(page)).toBeFocused();
    expect(await writing(page).evaluate((button) => button.matches(":focus-visible"))).toBe(false);
    release();
    await expect.poll(() => cityWordFocused(page)).toBe(true);
  });
});

/** What a press with nothing in the field says, under the field and from the status over it. */
const NOTHING_TO_READ = "Name a city, or pick a day below.";

/** How wide an element is drawn: a pixel or none when it is kept for a screen reader alone. */
async function widthOf(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.width ?? 0;
}

/** Counts the page's reads of a text, answering each with `answer`. */
async function countTheIntake(page: Page, answer: IntakeResult): Promise<() => number> {
  let reads = 0;
  await page.route("**/api/intake", (route) => {
    reads += 1;
    return route.fulfill({ json: answer });
  });
  return () => reads;
}

test.describe("a press with nothing in the field says what is missing, from a status that stood", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(logStatuses);
  });

  for (const [how, press] of [
    [
      "a click on the button",
      (page: Page) => page.getByRole("button", { name: "Plan this day" }).click(),
    ],
    [
      "Enter in the field",
      async (page: Page) => {
        await page.getByRole("textbox", { name: "Where, and anything else" }).focus();
        await page.keyboard.press("Enter");
      },
    ],
  ] as const) {
    test(`by ${how}, the focus handed to the field, until the visitor types`, async ({ page }) => {
      const reads = await countTheIntake(page, { kind: "refused" });
      await openLive(page, "/");
      await expect(
        page.getByRole("heading", { name: "No city in mind? Start from one of these" }),
      ).toBeVisible();
      const field = page.getByRole("textbox", { name: "Where, and anything else" });

      const pressedAt = await page.evaluate(() => performance.now());
      await press(page);

      await expect(field).toBeFocused();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expectSaidInPlace(page, pressedAt, NOTHING_TO_READ, NOTHING_TO_READ);
      // The example stays in its status, heard as it stood, and unseen.
      const example = page.locator("main form p[role=status]", { hasText: /^For example:/ });
      expect(await widthOf(example)).toBeLessThanOrEqual(1);

      const typedAt = await page.evaluate(() => performance.now());
      await field.pressSequentially("Elche");
      await expect(page.getByText(NOTHING_TO_READ)).toHaveCount(0);
      expect(await widthOf(example)).toBeGreaterThan(1);
      await expect(field).not.toHaveAttribute("aria-invalid");
      const saidSince = await page.evaluate(
        (since) => window.statusLog.filter((entry) => entry.t >= since && /\S/.test(entry.text)),
        typedAt,
      );
      expect(saidSince, "said as the visitor types").toEqual([]);
      expect(reads(), "a text read").toBe(0);
    });
  }

  test("with live generation on, an answer of spaces alone to the city's question", async ({
    page,
  }) => {
    const reads = await countTheIntake(page, { ...PORTLAND_ASKED, readings: [] });
    await openLive(page, "/");
    await askFromTheField(page, "a lively day");
    const city = page.getByRole("textbox", { name: "Which city?" });
    await expect(city).toBeFocused();

    await city.fill("   ");
    const pressedAt = await page.evaluate(() => performance.now());
    await city.press("Enter");

    await expect(city).toBeFocused();
    await expect(city).toHaveAttribute("aria-invalid", "true");
    await expectSaidInPlace(page, pressedAt, NOTHING_TO_READ, NOTHING_TO_READ);
    expect(reads(), "the answer read").toBe(1);
  });
});

test.describe("an answer to the city's question that is still not a city", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(logStatuses);
  });

  test("stays in the field, and is said as not found from a status that stood", async ({
    page,
  }) => {
    const reads = await countTheIntake(page, { ...PORTLAND_ASKED, readings: [] });
    await openLive(page, "/");
    await askFromTheField(page, "a lively day");
    const city = page.getByRole("textbox", { name: "Which city?" });
    await expect(city).toBeFocused();

    await city.fill("Springfeld");
    const pressedAt = await page.evaluate(() => performance.now());
    await city.press("Enter");

    const line = "Lantern couldn't find “Springfeld”. Name a city, or pick one of the days below.";
    await expectSaidInPlace(page, pressedAt, `A lively day in …? ${line}`, line);
    await expect(city).toBeFocused();
    await expect(city).toHaveValue("Springfeld");
    await expect(city).toHaveAttribute("aria-invalid", "true");
    expect(reads()).toBe(2);

    // A typo put right: the field no longer holds the answer not found.
    await city.press("End");
    await city.press("Backspace");
    await expect(city).not.toHaveAttribute("aria-invalid");
  });
});

/**
 * Where the index's heading stands under the question at each width a press with nothing in the
 * field is measured at: a phone's narrowest and its usual, and a laptop's.
 */
const HOLD_WIDTHS = [
  { width: 360, height: 780, isPhone: true },
  { width: 390, height: 844, isPhone: true },
  { width: 1440, height: 900, isPhone: false },
] as const;

/** The start screen brought to a state, its field emptied, with live generation on or off. */
const HOLD_STATES: readonly {
  name: string;
  isLive: boolean;
  answer?: IntakeResult;
  asked?: string;
  field: string;
}[] = [
  {
    name: "the example, with live generation off",
    isLive: false,
    field: "Where, and anything else",
  },
  { name: "the example, with live generation on", isLive: true, field: "Where, and anything else" },
  {
    name: "the city asked for",
    isLive: true,
    answer: { ...PORTLAND_ASKED, readings: [] },
    asked: "a lively day",
    field: "Which city?",
  },
  {
    name: "the cities a shared name could be",
    isLive: true,
    answer: PORTLAND_ASKED,
    asked: "Portland, a lively day",
    field: "Which city?",
  },
  {
    name: "an ending",
    isLive: true,
    answer: { kind: "refused" },
    asked: "a quiet day somewhere",
    field: "Where, and anything else",
  },
];

test.describe("a press with nothing in the field moves nothing under it", () => {
  for (const size of HOLD_WIDTHS) {
    for (const state of HOLD_STATES) {
      test(`at ${size.width} px, over ${state.name}, at the press and at the first keystroke`, async ({
        page,
        isMobile,
      }) => {
        test.skip(isMobile !== size.isPhone, "measured once, in the project of its width");
        await page.setViewportSize({ width: size.width, height: size.height });
        if (state.answer) await answerTheIntake(page, state.answer);
        if (state.isLive) await openLive(page, "/");
        else await page.goto("/");
        const field = page.getByRole("textbox", { name: state.field });
        if (state.asked) await askFromTheField(page, state.asked);
        else await field.focus();
        await expect(field).toBeFocused();
        await expect(page.getByRole("button", { name: "Plan this day" })).toBeVisible();
        await field.fill("");
        const before = await indexHeadingOf(page);

        await field.press("Enter");
        await expect(field).toHaveAttribute("aria-invalid", "true");
        expect(await indexHeadingOf(page), "at the press").toBeCloseTo(before, 1);

        await field.pressSequentially("E");
        await expect(field).not.toHaveAttribute("aria-invalid");
        expect(await indexHeadingOf(page), "at the first keystroke").toBeCloseTo(before, 1);
      });
    }
  }
});
