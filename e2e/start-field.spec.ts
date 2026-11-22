import type { JSHandle } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";
import { openLive } from "./live-page";
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

/** Every status added to the page already holding words, each by its words, since the last press. */
interface StatusLog {
  bornFull: string[];
}

/**
 * Logs each status the page adds already holding its words: whether a screen reader says a
 * status born full depends on the reader and the browser, where it says a change of words in
 * a status that stood.
 */
async function logStatusesBornFull(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = window as unknown as StatusLog;
    log.bornFull = [];
    const STATUS = "[role=status], output";
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const added = [...(node.matches(STATUS) ? [node] : []), ...node.querySelectorAll(STATUS)];
          for (const status of added) {
            const words = status.textContent ?? "";
            if (/\S/.test(words)) log.bornFull.push(words);
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

/**
 * Asks with `text` from the field once the page has hydrated, and returns the statuses that
 * stood before the press, the log of those born full cleared for it.
 */
async function askKeepingStatuses(page: Page, text: string): Promise<JSHandle<Element[]>> {
  // The index is drawn once the page has hydrated, and a field filled before then is emptied.
  await expect(
    page.getByRole("heading", { name: "No city in mind? Start from one of these" }),
  ).toBeVisible();
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill(text);
  const standing = await page.evaluateHandle(() => {
    (window as unknown as StatusLog).bornFull = [];
    return [...document.querySelectorAll("[role=status], output")];
  });
  await field.press("Enter");
  return standing;
}

/** `said` is the words of a status that stood before the press, and no status was born full. */
async function expectSaidInPlace(
  page: Page,
  standing: JSHandle<Element[]>,
  said: string,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        ([statuses, words]) =>
          statuses.some((status) => status.isConnected && status.textContent === words),
        [standing, said] as const,
      ),
    )
    .toBe(true);
  expect(await page.evaluate(() => (window as unknown as StatusLog).bornFull)).toEqual([]);
}

/** Answers the page's reading of a text with `answer`, as the intake route would. */
async function answerTheIntake(page: Page, answer: IntakeResult): Promise<void> {
  await page.route("**/api/intake", (route) => route.fulfill({ json: answer }));
}

test.describe("each answer without a day, and the city's question, is said in a status that stood", () => {
  test.beforeEach(async ({ page }) => {
    await logStatusesBornFull(page);
  });

  test("with live generation off, as the site is served", async ({ page }) => {
    await page.goto("/");
    const standing = await askKeepingStatuses(page, "Reykjavik");

    await expectSaidInPlace(
      page,
      standing,
      "Lantern isn't writing new days right now. Start from one of the days below.",
    );
  });

  test("with live generation on, a text Lantern will not plan", async ({ page }) => {
    await answerTheIntake(page, { kind: "refused" });
    await openLive(page, "/");
    const standing = await askKeepingStatuses(page, "a quiet day somewhere");

    await expectSaidInPlace(
      page,
      standing,
      "Lantern can't plan that day. Start from one of the days below.",
    );
    await expect(page.getByRole("textbox", { name: "Where, and anything else" })).toBeFocused();
  });

  test("with live generation on, the city's question", async ({ page }) => {
    await answerTheIntake(page, {
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
    });
    await openLive(page, "/");
    const standing = await askKeepingStatuses(page, "Portland, a lively day");

    await expectSaidInPlace(
      page,
      standing,
      "A lively day in …? Portland, Oregon, United States, or Portland, Maine, United States.",
    );
    await expect(page.getByRole("textbox", { name: "Which city?" })).toBeFocused();
  });
});
