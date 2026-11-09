import { expect, test, type Page } from "./fixtures";

const URL = "/lab/concepts/start";
/** A written day lands in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = 30_000;
/** A change of 4 px or more that lasts two frames or fewer is a step, not a glide. */
const STEP_PX = 4;
const STEP_FRAMES = 2;
/** Less than this between two frames is a sub-pixel rounding, not a move. */
const STILL_PX = 0.5;
const TALL_LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
/** What the start screen says over the cities Lantern has written. */
const WRITTEN_HEADING = "Or watch Lantern write a day it knows";
/** A fade seen as one: the notice's opacity passes through at least this many values. */
const FADE_VALUES = 3;
/**
 * At or under this as read, text is gone to the eye and may leave the page. It goes at
 * 0.01, but a frame reads what Motion drew the frame before, about twice that.
 */
const GONE_OPACITY = 0.05;
/** Long enough for a notice to leave, the next day to end and its notice to be written. */
const SAMPLED_MS = 6000;
/**
 * A day streamed from nothing draws its date and axes a beat after its run starts, give or
 * take a frame.
 */
const PEN_BEAT_MS = 150;
const FRAME_MS = 17;
/** Under reduced motion, as long as the press and the steps after it take, and more. */
const REDUCED_SAMPLED_MS = 1500;
const PORTLAND_LATE = "A lively Saturday in Portland, out late, with friends";

/** A line under the headline, as drawn: what it shows, at the opacity its box is drawn at. */
interface UnderLine {
  line: string;
  text: string;
  opacity: number;
}

/** One frame drawing a reading of the city played in place of a day that ended. */
interface LinesFrame {
  t: number;
  /** Which header this is, numbered the first time it is seen: each run draws its own. */
  headerId: number | null;
  /** How tall the header's lines stand. */
  lines: number;
  headline: string;
  /** The lines under the headline that show any text: the notice, its days, the day's. */
  under: UnderLine[];
  /** What the notice's pen has written of it and its days, and all they say; null when absent. */
  notice: string | null;
  noticeWhole: string | null;
  noticeOpacity: number | null;
  isNoticeInert: boolean;
  /** Where the facts line's top, with the date, and the chart's stand on the page. */
  date: number | null;
  chartTop: number | null;
  /** What a screen reader is told from the header's status. */
  heard: string;
  isCityFocused: boolean;
  /** Which element has the focus, numbered the first time it has it, and its words. */
  focusId: number | null;
  focusName: string;
  /** The notice is out of the hand's reach. */
  isNoticeOutOfReach: boolean;
  /** The city word's list of other cities is open. */
  isListOpen: boolean;
  /** The opacity that list is drawn at; null when closed. */
  listOpacity: number | null;
}

/** The focus as it moved, to which element, numbered as `LinesFrame` numbers it. */
interface FocusMove {
  t: number;
  focusId: number;
  focusName: string;
}

declare global {
  interface Window {
    /** When the visitor pressed, by `performance.now()`: for durations and the focus. */
    pressedAt: number | null;
    /**
     * How many frames were sampled before the press, so the frames from this index on are
     * those read after it. Not their times: a frame is timed when it begins, and the browser
     * handles a press before it runs the frame's callbacks, so the first frame to show a
     * press can be timed before it.
     */
    pressedFrame: number | null;
    /** Every move of the focus from the first sample on. */
    focusMoves: FocusMove[];
  }
}

/** The changes of a height that last two frames or fewer and go 4 px or more: steps. */
function stepsOf(heights: readonly number[]): { at: number; px: number }[] {
  const steps: { at: number; px: number }[] = [];
  const changeAt = (index: number) =>
    Math.abs((heights[index] ?? 0) - (heights[index - 1] ?? heights[index] ?? 0));
  let run: { at: number; frames: number; px: number } | null = null;
  const close = () => {
    if (run && run.frames <= STEP_FRAMES && run.px >= STEP_PX) steps.push(run);
    run = null;
  };
  for (let index = 1; index < heights.length; index += 1) {
    const px = changeAt(index);
    if (px >= STILL_PX) {
      run = run ?? { at: index, frames: 0, px: 0 };
      run.frames += 1;
      run.px = Math.max(run.px, px);
    } else if (changeAt(index + 1) < STILL_PX) {
      close();
    }
  }
  close();
  return steps;
}

/** What a day that ended without one says on screen, in place of its lines. */
function noticeLine(page: Page) {
  return page.locator("header p.text-quote");
}

/**
 * Each frame from now, until the next press has played a day that ended in a notice of its
 * own, written whole and said: the header's lines, what stands under the headline, the date
 * and the chart. The press is noted on the frames' clock.
 */
function sampleUntilTheNextNotice(page: Page, sampledMs = SAMPLED_MS): Promise<LinesFrame[]> {
  return page.evaluate(
    (sampledMs) =>
      new Promise<LinesFrame[]>((resolve) => {
        const frames: LinesFrame[] = [];
        const start = performance.now();
        window.pressedAt = null;
        window.pressedFrame = null;
        window.focusMoves = [];
        document.addEventListener(
          "pointerdown",
          () => {
            window.pressedAt = performance.now();
            window.pressedFrame = frames.length;
          },
          { capture: true, once: true },
        );
        let focused = 0;
        let headers = 0;
        const focusIdOf = (element: Element | null): number | null => {
          if (!(element instanceof HTMLElement) || element === document.body) return null;
          if (!element.dataset.sampledFocus) {
            focused += 1;
            element.dataset.sampledFocus = String(focused);
          }
          return Number(element.dataset.sampledFocus);
        };
        const nameOf = (element: Element | null): string =>
          element === document.body ? "" : (element?.textContent ?? "").trim();
        document.addEventListener(
          "focusin",
          (event) => {
            const focusId = focusIdOf(event.target as Element);
            if (focusId === null) return;
            window.focusMoves.push({
              t: performance.now(),
              focusId,
              focusName: nameOf(event.target as Element),
            });
          },
          { capture: true },
        );
        // What a line shows: not its letters standing unseen, nor the city word's open list.
        const seenTextOf = (element: Element | null): string | null => {
          if (!element) return null;
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let text = "";
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const box = node.parentElement;
            if (!box?.closest('.opacity-0, .invisible, [role="group"]')) text += node.textContent;
          }
          return text;
        };
        const opacityOf = (element: Element | null): number => {
          let opacity = 1;
          for (let node = element; node; node = node.parentElement) {
            opacity *= Number(getComputedStyle(node).opacity);
          }
          return opacity;
        };
        const tick = (time: number) => {
          const header = document.querySelector("header");
          if (header && !header.dataset.sampledHeader) {
            headers += 1;
            header.dataset.sampledHeader = String(headers);
          }
          const live = (selector: string) =>
            [...(header?.querySelectorAll(selector) ?? [])].find(
              (element) => element.closest("[aria-hidden]") === null,
            ) ?? null;
          const notice = live("p.text-quote");
          const offered = header?.querySelector("ul") ?? null;
          const facts = live("p.type-note.text-muted");
          const lines: [string, Element | null][] = [
            ["notice", notice],
            ["offered", offered],
            ["dek", live("p.text-dek")],
            ["facts", facts],
          ];
          const chart = document.querySelector(
            'svg[role="group"][aria-label^="The day\'s energy"]',
          );
          const noticeText = seenTextOf(notice);
          const list = document.querySelector('[role="group"][aria-label="Where"]');
          frames.push({
            t: time,
            headerId: header ? Number(header.dataset.sampledHeader) : null,
            lines: header?.querySelector(":scope > .mt-5")?.getBoundingClientRect().height ?? 0,
            headline: seenTextOf(live("h1")) ?? "",
            under: lines.flatMap(([line, element]) => {
              const text = seenTextOf(element) ?? "";
              return /\S/.test(text) ? [{ line, text, opacity: opacityOf(element) }] : [];
            }),
            notice: notice ? `${noticeText}${seenTextOf(offered) ?? ""}` : null,
            noticeWhole: notice ? `${notice.textContent}${offered?.textContent ?? ""}` : null,
            noticeOpacity: notice ? opacityOf(notice) : null,
            isNoticeInert: notice?.closest("[inert]") != null,
            date: facts ? facts.getBoundingClientRect().top + window.scrollY : null,
            chartTop: chart ? chart.getBoundingClientRect().top + window.scrollY : null,
            heard: header?.querySelector("p.sr-only[role=status]")?.textContent ?? "",
            isCityFocused: document.activeElement?.closest('h1 [data-word="city"]') != null,
            focusId: focusIdOf(document.activeElement),
            focusName: nameOf(document.activeElement),
            isNoticeOutOfReach: notice ? getComputedStyle(notice).pointerEvents === "none" : false,
            isListOpen: list !== null,
            listOpacity: list ? opacityOf(list) : null,
          });
          const last = frames.at(-1)!;
          const hasLeft = frames.some((frame) => frame.noticeWhole === null);
          const isSaid =
            last.notice !== null && last.notice === last.noticeWhole && last.heard === "";
          if ((hasLeft && isSaid) || performance.now() - start > sampledMs) resolve(frames);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    sampledMs,
  );
}

/** The press the sampler noted: when it came, and how many frames were sampled before it. */
async function pressOf(page: Page): Promise<{ at: number; frame: number }> {
  const press = await page.evaluate(() => ({ at: window.pressedAt, frame: window.pressedFrame }));
  if (press.at === null || press.frame === null) throw new Error("Nothing was pressed");
  return { at: press.at, frame: press.frame };
}

/** The changes of the header's lines that are steps, by the frame each starts in. */
function linesStepsOf(frames: readonly LinesFrame[]): number[] {
  return stepsOf(frames.map((frame) => frame.lines)).map((step) => step.at);
}

function isNothingSeenUnder(frame: LinesFrame): boolean {
  return frame.under.every((line) => line.opacity <= GONE_OPACITY);
}

/**
 * The focus from the press to rest, frame by frame and move by move: wherever the press
 * left it, the control pressed by a hand, until the next day is drawn, then on that day's
 * city word, having moved once.
 */
async function expectFocusMovesOnce(
  page: Page,
  pressedAt: number,
  after: readonly LinesFrame[],
  drawn: number,
  city: string,
): Promise<void> {
  const isCity = (name: string) => name.replace(/,$/, "") === city;
  const said = `focus: ${after.map((frame) => frame.focusName).join(" | ")}`;
  const ids = after.map((frame) => frame.focusId);
  const changes = ids.flatMap((id, index) => (index > 0 && id !== ids[index - 1] ? [index] : []));
  expect(changes.length, said).toBeLessThanOrEqual(1);
  if (changes.length === 1) expect(changes[0], said).toBe(drawn);
  for (const frame of after.slice(drawn)) {
    expect(frame.isCityFocused, said).toBe(true);
    expect(isCity(frame.focusName), said).toBe(true);
  }
  // Moves made between two frames count too. A hand's press gives the control it presses
  // the focus; from there the focus moves once more, to the city word.
  const moves = (await page.evaluate(() => window.focusMoves.slice())).filter(
    (move) => move.t >= pressedAt,
  );
  const fromThePress = moves[0] && !isCity(moves[0].focusName) ? moves.slice(1) : moves;
  expect(fromThePress.map((move) => move.focusName.replace(/,$/, ""))).toEqual([city]);
}

/** A place on the day, which shows its name on the chart and in the list. */
function place(page: Page, name: string) {
  return page.getByText(name, { exact: true }).first();
}

async function openStart(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
}

/** The cities Lantern has written, as words under the question. */
function writtenCities(page: Page) {
  return page.getByRole("list", { name: WRITTEN_HEADING });
}

function cityWord(page: Page, city: string) {
  return writtenCities(page).getByRole("button", { name: new RegExp(` in ${city}[,.]`) });
}

/** The lab's days at a warm live start's pace, so a day on its way stays on its way for the hold. */
async function streamAsLive(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Try" }).click();
  await page.getByRole("button", { name: "Warm", exact: true }).click();
  await page.getByRole("button", { name: "Try" }).click();
}

test("asks one question over the cities Lantern has written, with no day on screen", async ({
  page,
}) => {
  await openStart(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One day in a city, planned hour by hour, as quiet or as lively as you want it.",
  );
  await expect(page.getByRole("textbox", { name: "Where, and anything else" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan this day" })).toBeVisible();
  await expect(writtenCities(page).getByRole("button")).toHaveText([
    /^A lively Saturday in Bologna, with friends\.\s*Italy$/,
    /^A calm Sunday in Porto, slow morning\.\s*Portugal$/,
    /^A calm Saturday in Kanazawa, early start\.\s*Japan$/,
    /^A lively Saturday in Madrid, out late, with friends\.\s*Spain$/,
    /^A balanced Sunday in Utrecht, with family\.\s*Netherlands$/,
    /^A quiet Saturday in Nafplio, slow morning\.\s*Greece$/,
  ]);
  // No day, no chart and no stream until the visitor asks.
  await expect(page.locator('svg[role="group"]')).toHaveCount(0);
  await expect(page.getByRole("list", { name: "The day" })).toHaveCount(0);
});

test("a city's word writes its day where the question was, and the day's city word takes the focus", async ({
  page,
}) => {
  await openStart(page);

  await cityWord(page, "Nafplio").click();

  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toContainText("A quiet Saturday in Nafplio, on foot", {
    timeout: DAY_TIMEOUT_MS,
  });
  await expect(headline.getByRole("button", { name: "Nafplio", exact: true })).toBeFocused();
  await expect(place(page, "Coffee on Staikopoulou")).toBeVisible({ timeout: DAY_TIMEOUT_MS });
});

test("a field written in thickens and darkens its own line, lights its question, and moves nothing", async ({
  page,
}) => {
  await openStart(page);
  const ink = await page.evaluate(() => getComputedStyle(document.body).color);
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  const question = page.getByText("Where, and anything else", { exact: true });
  const look = async () => ({
    line: await field.evaluate((input) => {
      const style = getComputedStyle(input);
      return { width: style.borderBottomWidth, color: style.borderBottomColor };
    }),
    // A ring is a second shape round a line, and a field rings at a mouse's click too.
    ring: await field.evaluate((input) => getComputedStyle(input).outlineColor),
    question: await question.evaluate((span) => getComputedStyle(span).color),
    button: (await page.getByRole("button", { name: "Plan this day" }).boundingBox())?.y,
    example: (await page.getByText(/^For example:/).boundingBox())?.y,
  });
  const rest = await look();
  expect(rest.line.width).toBe("1px");
  expect(rest.question).not.toBe(ink);

  // A click, as most visitors come to it, then words.
  await field.click();
  await field.pressSequentially("Lisbon, slow morning");

  // The question's colour eases in.
  await expect.poll(() => question.evaluate((span) => getComputedStyle(span).color)).toBe(ink);
  const writing = await look();
  expect(writing.line).toEqual({ width: "2px", color: ink });
  const clear = await page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.color = "transparent";
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  expect(writing.ring).toBe(clear);
  expect(writing.question).toBe(ink);
  expect(writing.button).toBe(rest.button);
  expect(writing.example).toBe(rest.example);
});

/** Longer than the field at any width, so it wraps, and a field that changed width moves it. */
const LONG_TEXT =
  "Porto, with my dog, a slow morning with coffee somewhere quiet, a long lunch by the river, a cloister in the afternoon and somewhere calm to sit at dusk";

interface FieldFrame {
  label: string;
  width: number;
  height: number;
  /** How many lines its words take, as the field wraps them. */
  lines: number;
  /** Where its words start. */
  left: number;
  top: number;
}

/** Every frame from now until the day takes the field's place: the button's word and the field. */
function readField(page: Page): Promise<FieldFrame[]> {
  return page.evaluate(
    () =>
      new Promise<FieldFrame[]>((resolve) => {
        const seen: FieldFrame[] = [];
        const start = performance.now();
        const tick = () => {
          const field = document.querySelector<HTMLTextAreaElement>("textarea[name=text]");
          if (!field || performance.now() - start > 5000) return resolve(seen);
          const box = field.getBoundingClientRect();
          const style = getComputedStyle(field);
          const padding = Number.parseFloat(style.paddingBottom);
          seen.push({
            // The word it shows: the others share its cell unseen.
            label: document.querySelector<HTMLElement>("form button[type=submit]")?.innerText ?? "",
            width: box.width,
            height: box.height,
            lines: Math.round((field.clientHeight - padding) / Number.parseFloat(style.lineHeight)),
            left: box.left,
            top: box.top,
          });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

test("the field and its words hold still while the button says what Lantern is doing", async ({
  page,
}) => {
  await openStart(page);
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill(LONG_TEXT);

  const frames = readField(page);
  await field.press("Enter");
  const seen = await frames;

  // The text wraps in the field, and the button said each of its words.
  const [rest] = seen;
  expect(rest?.lines).toBeGreaterThan(1);
  expect(new Set(seen.map((frame) => frame.label))).toEqual(
    new Set(["Plan this day", "Reading", "Opening"]),
  );
  for (const frame of seen) {
    expect(frame.width, frame.label).toBeCloseTo(rest?.width ?? 0, 1);
    expect(frame.lines, frame.label).toBe(rest?.lines);
    expect(frame.left, frame.label).toBeCloseTo(rest?.left ?? 0, 1);
    expect(frame.top, frame.label).toBeCloseTo(rest?.top ?? 0, 1);
  }
});

test("the lit words lie on the field's own lines while they are read, through Tab too", async ({
  page,
}) => {
  await openStart(page);
  // At a cold start's pace, so the words are read long enough to leave the field.
  const tries = page.getByRole("button", { name: "Try", exact: true });
  await tries.click();
  await page.getByRole("group", { name: "Pace" }).getByRole("button", { name: "Cold" }).click();
  await tries.click();
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill(LONG_TEXT);
  await field.press("End");
  await field.press("Enter");
  await expect(page.getByRole("button", { name: "Reading" })).toBeVisible();

  // Where the lit copy of the words is drawn against where the field shows them.
  const offset = () =>
    page.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>("textarea[name=text]");
      const copy = document.querySelector<HTMLElement>(
        "textarea[name=text] + span[aria-hidden] > span",
      );
      if (!input || !copy) return null;
      const [field, words] = [input.getBoundingClientRect(), copy.getBoundingClientRect()];
      const line = Number.parseFloat(getComputedStyle(input).lineHeight);
      const padding = Number.parseFloat(getComputedStyle(input).paddingBottom);
      return {
        left: words.left - field.left,
        top: words.top - field.top,
        width: words.width - field.width,
        lines: Math.round((input.clientHeight - padding) / line),
        copyLines: Math.round((words.height - padding - 1) / line),
        scrollTop: input.scrollTop,
      };
    });
  const lying = { left: 0, top: 0, width: 0, scrollTop: 0 };
  const isLying = async () => {
    const seen = await offset();
    return (
      seen !== null &&
      seen.lines > 1 &&
      seen.lines === seen.copyLines &&
      seen.left === lying.left &&
      seen.top === lying.top &&
      seen.width === lying.width &&
      seen.scrollTop === lying.scrollTop
    );
  };
  await expect.poll(isLying).toBe(true);

  await page.keyboard.press("Tab");
  await expect(field).not.toBeFocused();
  await expect.poll(isLying).toBe(true);
});

test("the keyboard reaches the written cities after the question, ringed, and Enter writes one", async ({
  page,
}) => {
  await openStart(page);
  const ink = await page.evaluate(() => getComputedStyle(document.body).color);
  // The written cities come once the page has run, after the visitor's own days are read:
  // a Tab pressed before them went on past where they were to be (a full run, load past 30).
  for (const city of ["Bologna", "Nafplio"]) {
    await expect(cityWord(page, city)).toBeVisible();
    await expect(cityWord(page, city)).toBeEnabled();
  }
  await page.getByRole("textbox", { name: "Where, and anything else" }).focus();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Plan this day" })).toBeFocused();
  for (const city of ["Bologna", "Porto", "Kanazawa", "Madrid", "Utrecht", "Nafplio"]) {
    await page.keyboard.press("Tab");
    const word = cityWord(page, city);
    await expect(word).toBeFocused();
    const ring = await word.evaluate((each) => {
      const style = getComputedStyle(each);
      return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
    });
    expect(ring).toEqual({ width: "2px", style: "solid", color: ink });
  }
  await page.keyboard.press("Enter");

  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline.getByRole("button", { name: "Nafplio", exact: true })).toBeFocused({
    timeout: DAY_TIMEOUT_MS,
  });
});

test("keeps the visitor's words, and the cities, while a pressed city's day is on its way", async ({
  page,
}) => {
  await openStart(page);
  await streamAsLive(page);
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill("somewhere quiet");

  await cityWord(page, "Kanazawa").click();

  await expect(page.getByText("Opening a calm Saturday in Kanazawa, early start")).toBeVisible();
  await expect(field).toHaveValue("somewhere quiet");
  await expect(writtenCities(page).getByRole("button")).toHaveCount(6);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A calm Saturday in Kanazawa",
    {
      timeout: DAY_TIMEOUT_MS,
    },
  );
});

test("writes the day a text asks for, and with live generation off says nothing else back", async ({
  page,
}) => {
  await openStart(page);

  await page.getByRole("textbox").fill("Bologna, with my dog");
  await page.keyboard.press("Enter");

  // Read, the day is said back under the question while it is on its way.
  await expect(page.getByText("Opening a lively Saturday in Bologna, with friends")).toBeVisible();
  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toContainText("A lively Saturday in Bologna", { timeout: DAY_TIMEOUT_MS });
  await expect(place(page, "Coffee along Via Drapperie")).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await expect(page.getByText(/Lantern can't plan around/)).toHaveCount(0);
});

test("asks for the city it could not read, with the words it did", async ({ page }) => {
  await openStart(page);

  await page.getByRole("textbox").fill("a quiet day with my kids, nothing too early");
  await page.keyboard.press("Enter");

  const city = page.getByRole("textbox", { name: "Which city?" });
  await expect(city).toBeFocused();
  // No weekday until the city gives the day its zone.
  await expect(page.getByText("A calm day in …?, slow morning, with family")).toBeVisible();
});

test("lists the others an assumed city's name could mean, undotted under a notice", async ({
  page,
}) => {
  await openStart(page);
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill("portland, out late with friends");
  await field.press("Enter");

  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toContainText("A lively Saturday in Portland, out late, with friends");
  const city = headline.getByRole("button", { name: "Portland", exact: true });
  // Lantern assumed which Portland, but no day was planned on it: under the notice that no
  // day is written, none of Lantern's words is dotted, and the dots' key left with the facts.
  await expect(noticeLine(page).filter({ hasText: "isn't writing new days" })).toBeVisible();
  await expect(city).not.toHaveCSS("text-decoration-style", "dotted");

  await city.click();
  const where = page.getByRole("group", { name: "Where" });
  await expect(
    where.getByRole("button", { name: /Oregon, United States · this day/ }),
  ).toBeFocused();
  await where.getByRole("button", { name: /Maine, United States/ }).click();

  // The other Portland is the visitor's own choice, and it is this day now.
  await city.click();
  await expect(
    where.getByRole("button", { name: /Maine, United States · this day/ }),
  ).toBeFocused();
});

test("lets the notice go before another reading of the city is drawn, at its place", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(isMobile ? PHONE : TALL_LAPTOP);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(URL);
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill("portland, out late with friends");
  await field.press("Enter");
  await expect(noticeLine(page)).toContainText("isn't writing new days", {
    timeout: DAY_TIMEOUT_MS,
  });
  // Written whole, so its words are in reach.
  await expect(page.locator("header [inert]")).toHaveCount(0);
  const headline = page.getByRole("heading", { level: 1 });
  await headline.getByRole("button", { name: "Portland", exact: true }).click();
  const sampled = sampleUntilTheNextNotice(page);

  await page
    .getByRole("group", { name: "Where" })
    .getByRole("button", { name: /Maine, United States/ })
    .click();

  const frames = await sampled;
  const { at: pressedAt, frame: pressedFrame } = await pressOf(page);
  const pressedOn = frames[pressedFrame - 1]!;
  const after = frames.slice(pressedFrame);
  expect(pressedOn.notice).toBe(pressedOn.noticeWhole);
  // The headline holds.
  for (const frame of after) expect(frame.headline).toBe(PORTLAND_LATE);

  // The notice fades as it stands, out of the hand's reach, and goes only once gone to the
  // eye. The list the reading was chosen from leaves sight in the frame after the choice, as
  // every choice takes its word's place at once, and stays, unseen, holding the focus on the
  // row pressed, so no list's text lies over the headline as the notice fades.
  const drawn = after.findIndex((frame) => frame.headerId !== pressedOn.headerId);
  expect(drawn, "the notice was cut in the frame of the press").toBeGreaterThan(0);
  const fading = after.slice(0, drawn);
  for (const frame of fading) {
    expect(frame.noticeWhole).toBe(pressedOn.noticeWhole);
    expect(frame.notice).toBe(pressedOn.notice);
    expect(frame.isNoticeOutOfReach).toBe(true);
    expect(frame.isListOpen, "the city's list, unmounted").toBe(true);
    expect(frame.listOpacity, "the list, still seen").toBe(0);
  }
  const opacities = new Set(fading.map((frame) => frame.noticeOpacity));
  expect(opacities.size, `opacities: ${[...opacities].join(" ")}`).toBeGreaterThanOrEqual(
    FADE_VALUES,
  );
  expect(fading.at(-1)!.noticeOpacity).toBeLessThanOrEqual(GONE_OPACITY);
  expect(after[drawn]!.noticeWhole).toBeNull();
  expect(after[drawn]!.isListOpen).toBe(false);
  await expectFocusMovesOnce(page, pressedAt, after, drawn, "Portland");

  // No text under the headline is cut while seen, and the lines step only over nothing seen.
  frames.slice(1).forEach((frame, index) => {
    const was = frames[index]!;
    for (const line of was.under) {
      const isThere = frame.under.some(
        (now) => now.line === line.line && now.text.startsWith(line.text),
      );
      if (!isThere) expect(line.opacity, `"${line.text}" cut`).toBeLessThanOrEqual(GONE_OPACITY);
    }
  });
  const heights = frames.map((frame) => Math.round(frame.lines)).join(" ");
  for (const at of linesStepsOf(frames))
    expect(isNothingSeenUnder(frames[at - 1]!), heights).toBe(true);

  // The day played draws its date and axes a beat after it is drawn, at their place, and
  // they hold still until they have gone; a day that ends sooner never draws them.
  const ended = after.findIndex((frame, index) => index > drawn && frame.noticeWhole !== null);
  expect(ended).toBeGreaterThan(drawn);
  const shown = after.slice(drawn, ended);
  const endedMs = after[ended]!.t - after[drawn]!.t;
  const dateAt = shown.findIndex((frame) => frame.date !== null);
  const axesAt = shown.findIndex((frame) => frame.chartTop !== null);
  test.info().annotations.push({
    type: "measured",
    description: `drawn ${Math.round(after[drawn]!.t - pressedAt)} ms after the press, ended ${Math.round(endedMs)} ms after, date ${dateAt < 0 ? "never" : `${Math.round(shown[dateAt]!.t - shown[0]!.t)} ms`}, axes ${axesAt < 0 ? "never" : `${Math.round(shown[axesAt]!.t - shown[0]!.t)} ms`}`,
  });
  if (endedMs < PEN_BEAT_MS - FRAME_MS) expect(dateAt, "the date of a day already ended").toBe(-1);
  for (const at of [dateAt, axesAt].filter((index) => index >= 0)) {
    expect(shown[at]!.t - shown[0]!.t, "drawn before the beat").toBeGreaterThanOrEqual(
      PEN_BEAT_MS - FRAME_MS,
    );
  }
  shown.slice(1).forEach((frame, index) => {
    const last = shown[index]!;
    if (frame.date !== null && last.date !== null) {
      expect(Math.abs(frame.date - last.date), "the date moved").toBeLessThanOrEqual(STILL_PX);
    }
    if (frame.chartTop !== null && last.chartTop !== null) {
      expect(Math.abs(frame.chartTop - last.chartTop), "the axes moved").toBeLessThanOrEqual(
        STILL_PX,
      );
    }
  });

  // Its own notice is heard once, in its step, until the pen has written it, then no more.
  const notice = after.slice(ended);
  const line = notice.at(-1)!.noticeWhole;
  expect(notice.at(-1)!.notice).toBe(line);
  let isQuiet = false;
  for (const frame of notice) {
    if (frame.notice !== frame.noticeWhole) expect(frame.isNoticeInert).toBe(true);
    if (frame.heard === "") isQuiet = true;
    else {
      expect(isQuiet, "heard again").toBe(false);
      expect(line?.startsWith(frame.heard)).toBe(true);
    }
  }
  expect(isQuiet).toBe(true);
});

test("under reduced motion, another reading of the city takes the notice's place in one step", async ({
  page,
}) => {
  await openStart(page);
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  await field.fill("portland, out late with friends");
  await field.press("Enter");
  await expect(noticeLine(page)).toContainText("isn't writing new days", {
    timeout: DAY_TIMEOUT_MS,
  });
  const headline = page.getByRole("heading", { level: 1 });
  await headline.getByRole("button", { name: "Portland", exact: true }).click();
  const sampled = sampleUntilTheNextNotice(page, REDUCED_SAMPLED_MS);

  await page
    .getByRole("group", { name: "Where" })
    .getByRole("button", { name: /Maine, United States/ })
    .click();

  // The notice never fades, and the next day's says the same: whole in each frame it stands.
  const frames = await sampled;
  for (const frame of frames) {
    if (frame.noticeWhole === null) continue;
    expect(frame.noticeOpacity).toBe(1);
    expect(frame.notice).toBe(frame.noticeWhole);
  }
  await expect(headline.getByRole("button", { name: "Portland", exact: true })).toBeFocused();
  // The next day is drawn in the step after the press, and its date and axes a beat later:
  // a day that ends sooner never draws them.
  const { at: pressedAt, frame: pressedFrame } = await pressOf(page);
  const pressedOn = frames[pressedFrame - 1]!;
  const after = frames.slice(pressedFrame);
  const drawn = after.findIndex((frame) => frame.headerId !== pressedOn.headerId);
  expect(drawn).toBeGreaterThanOrEqual(0);
  // Its own notice may come before the next frame, when the route answers at once.
  const ended = after.findIndex((frame, index) => index >= drawn && frame.noticeWhole !== null);
  expect(ended).toBeGreaterThanOrEqual(drawn);
  const endedMs = after[ended]!.t - pressedAt;
  const shown = after.slice(drawn);
  const dateAt = shown.findIndex((frame) => frame.date !== null || frame.chartTop !== null);
  test.info().annotations.push({
    type: "measured",
    description: `drawn ${Math.round(after[drawn]!.t - pressedAt)} ms after the press, its notice ${Math.round(endedMs)} ms, date or axes ${dateAt < 0 ? "never" : `${Math.round(shown[dateAt]!.t - pressedAt)} ms`}`,
  });
  if (endedMs < PEN_BEAT_MS - FRAME_MS) {
    expect(dateAt, "the date or axes of a day already ended").toBe(-1);
  } else if (dateAt >= 0) {
    expect(shown[dateAt]!.t - pressedAt).toBeGreaterThanOrEqual(PEN_BEAT_MS - FRAME_MS);
  }
  await expectFocusMovesOnce(page, pressedAt, after, drawn, "Portland");
});
