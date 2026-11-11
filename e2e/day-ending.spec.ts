import {
  CPU_RATE,
  expect,
  test,
  type Locator,
  type Page,
  waitMs,
  chooseTheChart,
} from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/**
 * How a day with a chart on screen leaves when its stream ends without one: the chart and
 * what the header says of the day fade as one piece, the header takes the notice's room in
 * one step once the day has gone to the eye, a word of the visitor's that the step moves
 * glides to its place, and the notice is written in. A day asked for while the notice or
 * the chart fades waits for the fade, then is drawn at its place, its date and axes a beat
 * later, and the focus moves once, from the control pressed to its city word; a day asked
 * for from one that finished draws its date and axes at once. Sampled every frame on the
 * ending bench, at a phone's 390 px and a laptop's 1440 px.
 */

const URL = "/lab/concepts/day";
/** The route lands a written day in about twelve seconds; a cold dev server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };
/** Less than this between two frames is a sub-pixel rounding, not a move. */
const STILL_PX = 0.5;
/** A move of this much or more over two frames or fewer is a step, not a glide. */
const STEP_PX = 4;
const STEP_FRAMES = 2;
/** A fade seen as one: the chart's opacity passes through at least this many values. */
const FADE_VALUES = 3;
/** Under reduced motion the chart is there, then gone: its opacity takes no third value. */
const REDUCED_OPACITIES = 2;
/** What fades with the chart is drawn at the chart's opacity, give or take this. */
const SAME_OPACITY = 0.02;
/**
 * At or under this as read, text is gone to the eye and may leave the page. The day steps
 * at 0.01, but a frame reads what Motion drew the frame before, about twice that, or more
 * after a frame the browser dropped; on a page whose CPU is slowed the spring runs on
 * further between two frames read (`pnpm e2e:busy` read a comma at 0.0505 the frame before
 * it went), so the margin grows with the slowing.
 */
const GONE_OPACITY = 0.05 * CPU_RATE;
/** Drawn whole: what stays in the header while the day fades. */
const WHOLE_OPACITY = 0.999;
/**
 * A word of the headline that moves less than this in all after the step holds still; one
 * that moves more glides, however short its way. A glide's largest frame is about a twelfth
 * of its way, so judged by its largest frame a glide under some 35 px read as still.
 */
const STILL_WORD_PX = 3;
/**
 * A word that glides goes no more than this share of its way in any one 60 Hz frame of its
 * glide (`glideStepOf`). Its glide's largest is about a twelfth.
 */
const GLIDE_SHARE = 1 / 5;
/** A 60 Hz frame: a glide's moves are timed by so many of them between two frames read. */
const SIXTY_HZ_FRAME_MS = 1000 / 60;
/**
 * The notice's pen sets off one beat after the step, give or take a frame. What follows the
 * beat, the header's render and the pen's first tick, takes up to two frames on a quiet
 * machine, and as many times more as the page's CPU is slowed: `pnpm e2e:busy`, at twice as
 * slow, drew the first letter four frames after the frame the beat fell in, at a steady
 * 17 ms a frame. A frame more is allowed, since a busy test machine drops one now and then.
 * Counted in frames after the beat's, so a pen that waited for something else, a glide of
 * 400 ms or a second beat, still fails.
 */
const PEN_BEAT_MS = 150;
const FRAME_MS = 17;
const PEN_WORK_FRAMES = 2;
const DROPPED_FRAMES = 1;
/** The route the bench's days are asked of after their first play. */
const DAY_ROUTE = "/api/day";
const KYOTO = "A calm Saturday in Kyoto";
/** The bench's day for the endings a written day meets: its retry asks the route, as on its address. */
const KANAZAWA = "A calm Saturday in Kanazawa, early start";
const LISBON = "A lively Saturday in Lisbon, with friends";
/** The start a list or a notice offers first, chosen from either. */
const BOLOGNA = "A lively Saturday in Bologna, with friends";
const ALICANTE = "A calm Saturday in Alicante";

/** A piece of text the header shows, as drawn. */
interface Piece {
  text: string;
  opacity: number;
}

/** A line under the headline, as drawn: what it shows, at the opacity its box is drawn at. */
interface Line {
  line: "notice" | "offered" | "dek" | "facts";
  text: string;
  opacity: number;
}

/** A word of the headline, by its words and how many times they came before it. */
interface Word {
  key: string;
  x: number;
  y: number;
}

/** One frame as drawn at its start. */
interface Frame {
  t: number;
  /** The chart's opacity as composed with every box round it; null once it is gone. */
  chart: number | null;
  /** Where the chart's top stands on the page; null once it is gone. */
  chartTop: number | null;
  /** Which chart this is, numbered the first time it is seen. */
  chartId: number | null;
  /** Which header this is, numbered the first time it is seen: each run draws its own. */
  headerId: number | null;
  /** The chart says it is leaving. */
  isLeaving: boolean;
  /** How tall the header stands on the page, pushing what follows. */
  header: number;
  /** How tall the header's lines stand, under its masthead. */
  lines: number;
  /** The headline, the line about the day and the facts line as shown; null when absent. */
  headline: string;
  dek: string | null;
  facts: string | null;
  /** Every piece of text of the headline, the line about the day and the facts line. */
  pieces: Piece[];
  /** What the unseen copies of the day's lines hold room for: what has arrived, written or not. */
  reserved: string;
  /** The lines under the headline that show any text: the notice, its days, the day's. */
  under: Line[];
  /** Where the facts line's top, with the date, stands on the page; null when absent. */
  date: number | null;
  /** Every word of the headline, where it stands on the page. */
  words: Word[];
  /** What the pen has written of the notice's line, and all it says. */
  notice: string | null;
  noticeWhole: string | null;
  /** The notice's opacity as composed with every box round it. */
  noticeOpacity: number | null;
  /** The role the notice's line on screen has, if any. */
  noticeRole: string | null;
  /** What a screen reader is told from the header's status. */
  heard: string | null;
  /** What the pen has written of the days the notice offers, and all they say. */
  offered: string | null;
  offeredWhole: string | null;
  /** The notice is out of reach of the hand and the keyboard. */
  isNoticeInert: boolean;
  /** The notice is out of the hand's reach. */
  isNoticeOutOfReach: boolean;
  /** The focus is on the headline's city word. */
  isCityFocused: boolean;
  /** Which element has the focus, numbered the first time it has it, and its words. */
  focusId: number | null;
  focusName: string;
  /** The city word's list of other cities, at the opacity it is drawn at; null when closed. */
  listOpacity: number | null;
  /** Each row of the day, from the top of the day. */
  rows: number[];
  /** The letters the day's rows show, their pens' written words included. */
  rowLetters: number;
}

/** The focus as it moved: to which element, numbered as `Frame` numbers it, and when. */
interface FocusMove {
  t: number;
  focusId: number;
  focusName: string;
}

declare global {
  interface Window {
    endingFrames: Frame[];
    focusMoves: FocusMove[];
    /** When the test pressed something, by `performance.now()`: for durations and the focus. */
    pressedAt: number | null;
    /**
     * How many frames were sampled before the press, so the frames from this index on are
     * those read after it. Not their times: a frame is timed when it begins, and the browser
     * handles a press before it runs the frame's callbacks, so the first frame to show a
     * press can be timed before it.
     */
    pressedFrame: number | null;
  }
}

async function sampleEveryFrame(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.endingFrames = [];
    window.focusMoves = [];
    window.pressedAt = null;
    window.pressedFrame = null;
    let charts = 0;
    let headers = 0;
    let focused = 0;
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
    const tick = (time: number) => {
      // Worked out once a frame for each box, as every piece asks it of its boxes.
      const opacities = new Map<Element, number>();
      const composedOpacity = (element: Element | null): number => {
        if (!element) return 1;
        const known = opacities.get(element);
        if (known !== undefined) return known;
        const opacity =
          Number(getComputedStyle(element).opacity) * composedOpacity(element.parentElement);
        opacities.set(element, opacity);
        return opacity;
      };
      // The text a line shows: its letters, but not those standing unseen in their place,
      // nor the city word's open list.
      const seenNodesOf = (element: Element | null): Text[] => {
        if (!element) return [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.parentElement?.closest('.opacity-0, .invisible, [role="group"]')) {
            nodes.push(node as Text);
          }
        }
        return nodes;
      };
      const seenTextOf = (element: Element | null): string | null =>
        element
          ? seenNodesOf(element)
              .map((node) => node.textContent ?? "")
              .join("")
          : null;
      const header = document.querySelector("header");
      if (header && !header.dataset.sampledHeader) {
        headers += 1;
        header.dataset.sampledHeader = String(headers);
      }
      const list = document.querySelector('[role="group"][aria-label="Where"]');
      const live = (selector: string) =>
        [...(header?.querySelectorAll(selector) ?? [])].find(
          (element) => element.closest("[aria-hidden]") === null,
        ) ?? null;
      // The chart is drawn as an SVG, numbered on its own element.
      const chart = document.querySelector<SVGElement>(
        'svg[role="group"][aria-label^="The day\'s energy"]',
      );
      if (chart && !chart.dataset.sampled) {
        charts += 1;
        chart.dataset.sampled = String(charts);
      }
      const day = document.querySelector('ol[aria-label="The day"]');
      const dayTop = day?.getBoundingClientRect().top ?? 0;
      const headline = live("h1");
      const dek = live("p.text-dek");
      const facts = live("p.type-note.text-muted");
      const notice = live("p.text-quote");
      const offered = header?.querySelector("ul") ?? null;
      const pieces = [headline, dek, facts].flatMap((line) =>
        seenNodesOf(line)
          .filter((node) => /\S/.test(node.textContent ?? ""))
          .map((node) => ({
            text: node.textContent ?? "",
            opacity: composedOpacity(node.parentElement),
          })),
      );
      const seen = new Map<string, number>();
      const words = seenNodesOf(headline).flatMap((node) =>
        [...(node.textContent ?? "").matchAll(/\S+/g)].map((match) => {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const box = range.getBoundingClientRect();
          const times = seen.get(match[0]) ?? 0;
          seen.set(match[0], times + 1);
          return { key: `${match[0]}#${times}`, x: box.left, y: box.top + window.scrollY };
        }),
      );
      window.endingFrames.push({
        t: time,
        chart: chart ? composedOpacity(chart) : null,
        chartTop: chart ? chart.getBoundingClientRect().top + window.scrollY : null,
        chartId: chart ? Number(chart.dataset.sampled) : null,
        headerId: header ? Number(header.dataset.sampledHeader) : null,
        isLeaving: document.querySelector('[data-exit="fading"]') !== null,
        header: header?.closest(".max-w-page > *")?.getBoundingClientRect().height ?? 0,
        lines: header?.querySelector(":scope > .mt-5")?.getBoundingClientRect().height ?? 0,
        headline: seenTextOf(headline) ?? "",
        dek: seenTextOf(dek),
        facts: seenTextOf(facts),
        pieces,
        // The day's lines only, under the masthead: the theme's hint keeps unseen copies too.
        reserved: [...(header?.querySelectorAll(":scope > .mt-5 .invisible[aria-hidden]") ?? [])]
          .map((copy) => copy.textContent ?? "")
          .join("|"),
        under: (
          [
            ["notice", notice],
            ["offered", offered],
            ["dek", dek],
            ["facts", facts],
          ] as const
        ).flatMap(([line, element]) => {
          const text = seenTextOf(element) ?? "";
          return /\S/.test(text) ? [{ line, text, opacity: composedOpacity(element) }] : [];
        }),
        date: facts ? facts.getBoundingClientRect().top + window.scrollY : null,
        words,
        notice: seenTextOf(notice),
        noticeWhole: notice?.textContent ?? null,
        noticeOpacity: notice ? composedOpacity(notice) : null,
        noticeRole: notice?.getAttribute("role") ?? null,
        heard: header?.querySelector("p.sr-only[role=status]")?.textContent ?? null,
        offered: seenTextOf(offered),
        offeredWhole: offered?.textContent ?? null,
        isNoticeInert: notice?.closest("[inert]") != null,
        isNoticeOutOfReach: notice ? getComputedStyle(notice).pointerEvents === "none" : false,
        isCityFocused: document.activeElement?.closest('h1 [data-word="city"]') != null,
        focusId: focusIdOf(document.activeElement),
        focusName: nameOf(document.activeElement),
        listOpacity: list ? composedOpacity(list) : null,
        rows: [...(day?.querySelectorAll(":scope > li") ?? [])].map(
          (row) => row.getBoundingClientRect().top - dayTop,
        ),
        rowLetters: (seenTextOf(day) ?? "").length,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function framesOf(page: Page): Promise<Frame[]> {
  return page.evaluate(() => window.endingFrames.slice());
}

/** Ends the bench's next first play of `city`'s day as `ending`, ten times faster. */
async function chooseEnding(page: Page, ending: string, city = "Kanazawa"): Promise<void> {
  const controls = page.getByRole("complementary", { name: "Lab controls" });
  await controls.getByRole("button", { name: "Ending" }).click();
  await controls.getByRole("combobox", { name: "Day" }).selectOption(city);
  await controls.getByRole("combobox", { name: "Pace" }).selectOption("Ten times faster");
  await controls.getByRole("combobox", { name: "Ending" }).selectOption(ending);
  await controls.getByRole("button", { name: "Ending" }).click();
}

/** Presses a control in the header by what it says, and notes when, and after which frame. */
async function press(page: Page, name: string): Promise<void> {
  await page.evaluate((startsWith) => {
    const control = [...document.querySelectorAll("header button")].find(
      (button) =>
        button.closest("[aria-hidden]") === null && button.textContent?.startsWith(startsWith),
    );
    if (!(control instanceof HTMLElement)) throw new Error(`No "${startsWith}" to press`);
    window.pressedAt = performance.now();
    window.pressedFrame = window.endingFrames.length;
    control.click();
  }, name);
}

/**
 * Presses a control as a hand does, which gives it the focus, and notes when, and after
 * which frame. Told where it stands, it presses there at once, as a press that has to land
 * inside a fade does; otherwise it waits for the control as Playwright does.
 */
async function pressByHand(page: Page, control: Locator, at?: { x: number; y: number }) {
  await page.evaluate(() => {
    document.addEventListener(
      "pointerdown",
      () => {
        window.pressedAt = performance.now();
        window.pressedFrame = window.endingFrames.length;
      },
      { capture: true, once: true },
    );
  });
  if (at) await page.mouse.click(at.x, at.y);
  else await control.click();
}

/** The last press: when it came, and how many frames were sampled before it. */
interface Press {
  at: number;
  frame: number;
}

async function pressOf(page: Page): Promise<Press> {
  const press = await page.evaluate(() => ({ at: window.pressedAt, frame: window.pressedFrame }));
  if (press.at === null || press.frame === null) throw new Error("Nothing was pressed");
  return { at: press.at, frame: press.frame };
}

/** Waits until the notice has taken the place of the day's lines, its pen not yet down. */
async function waitForTheStep(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const frame = window.endingFrames.at(-1);
      return frame !== undefined && frame.chart === null && frame.noticeWhole !== null;
    },
    null,
    { timeout: DAY_TIMEOUT_MS, polling: "raf" },
  );
}

/** Waits until the pen has written the notice whole, the days it offers too. */
async function waitForTheNotice(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const frame = window.endingFrames.at(-1);
      return (
        frame !== undefined &&
        frame.chart === null &&
        frame.notice !== null &&
        frame.notice === frame.noticeWhole &&
        frame.offered === frame.offeredWhole &&
        !frame.isNoticeInert
      );
    },
    null,
    { timeout: DAY_TIMEOUT_MS, polling: "raf" },
  );
}

/** The moments of an exit: the frame before the fade, its first frame, and the step. */
interface Exit {
  frames: Frame[];
  /** The last frame drawn whole, before the fade. */
  before: number;
  /** The first frame of the fade. */
  fade: number;
  /** The first frame without the chart, in which the notice takes the day's place. */
  step: number;
}

function exitOf(all: readonly Frame[]): Exit {
  const leaving = all.findIndex((frame) => frame.isLeaving);
  expect(leaving, "the chart never left").toBeGreaterThan(0);
  const frames = all.slice(leaving - 1);
  const fade = frames.findIndex((frame) => frame.chart !== null && frame.chart < 1);
  const step = frames.findIndex((frame, index) => index > fade && frame.chart === null);
  expect(fade, "the chart never faded").toBeGreaterThan(0);
  expect(step, "the chart never went").toBeGreaterThan(fade);
  return { frames, before: fade - 1, fade, step };
}

/**
 * The runs of frames in which the header moves, each with how many frames it lasted and its
 * largest move. A glide may rest a frame and go on.
 */
function movesOf(heights: readonly number[]): { at: number; frames: number; px: number }[] {
  const moves: { at: number; frames: number; px: number }[] = [];
  let run: { at: number; frames: number; px: number } | null = null;
  const moveAt = (index: number) =>
    Math.abs((heights[index] ?? 0) - (heights[index - 1] ?? heights[index] ?? 0));
  for (let index = 1; index < heights.length; index += 1) {
    const px = moveAt(index);
    if (px >= STILL_PX) {
      run = run ?? { at: index, frames: 0, px: 0 };
      run.frames += 1;
      run.px = Math.max(run.px, px);
    } else if (run && moveAt(index + 1) < STILL_PX) {
      moves.push(run);
      run = null;
    }
  }
  if (run) moves.push(run);
  return moves;
}

/** How many times each piece of text stands in a frame, so one that leaves is missed. */
function countsOf(pieces: readonly Piece[]): Map<string, Piece[]> {
  const counts = new Map<string, Piece[]>();
  for (const piece of pieces) counts.set(piece.text, [...(counts.get(piece.text) ?? []), piece]);
  return counts;
}

/** The pieces of one frame missing from the next, as they were drawn before they went. */
function leftBetween(from: Frame, to: Frame): Piece[] {
  const after = countsOf(to.pieces);
  return [...countsOf(from.pieces)].flatMap(([text, pieces]) =>
    pieces.slice(after.get(text)?.length ?? 0),
  );
}

/** The header's lines changing 4 px or more within two frames: steps, by their first frame. */
function linesStepsOf(frames: readonly Frame[]): number[] {
  const steps: number[] = [];
  const changeAt = (index: number) =>
    Math.abs(frames[index]!.lines - (frames[index - 1] ?? frames[index]!).lines);
  let run: { at: number; frames: number; px: number } | null = null;
  const close = () => {
    if (run && run.frames <= STEP_FRAMES && run.px >= STEP_PX) steps.push(run.at);
    run = null;
  };
  for (let index = 1; index < frames.length; index += 1) {
    const px = changeAt(index);
    if (px >= STILL_PX) {
      run = run ?? { at: index, frames: 0, px: 0 };
      run.frames += 1;
      run.px = Math.max(run.px, px);
    } else if (index + 1 >= frames.length || changeAt(index + 1) < STILL_PX) {
      close();
    }
  }
  close();
  return steps;
}

/** Nothing under the headline is seen: the notice, its days and the day's lines are gone. */
function isNothingSeenUnder(frame: Frame): boolean {
  return frame.under.every((line) => line.opacity <= GONE_OPACITY);
}

/**
 * The lines under the headline whose text is no longer all there in the next frame, as they
 * were drawn before: a line that went, or one some of whose letters did.
 */
function linesCutBetween(from: Frame, to: Frame): Line[] {
  return from.under.filter(
    (was) => !to.under.some((now) => now.line === was.line && now.text.startsWith(was.text)),
  );
}

function lettersOf(frame: Frame): number {
  return (
    frame.headline.length + (frame.dek ?? "").length + (frame.facts ?? "").length + frame.rowLetters
  );
}

/** A word's move from one frame to the next, and how many 60 Hz frames lie between them. */
interface WordStep {
  move: number;
  frames: number;
}

/** How far each word of the headline moves from frame to frame, after `from`. */
function wordTracksOf(frames: readonly Frame[]): Map<string, WordStep[]> {
  const tracks = new Map<string, WordStep[]>();
  frames.slice(1).forEach((frame, index) => {
    const last = frames[index]!;
    for (const word of frame.words) {
      const was = last.words.find((each) => each.key === word.key);
      if (!was) continue;
      const steps = tracks.get(word.key) ?? [];
      steps.push({
        move: Math.hypot(word.x - was.x, word.y - was.y),
        frames: (frame.t - last.t) / SIXTY_HZ_FRAME_MS,
      });
      tracks.set(word.key, steps);
    }
  });
  return tracks;
}

/**
 * The most a word goes in a 60 Hz frame of its glide, each frame read alone or with a frame
 * beside it where that is less. Motion springs a glide on from when it is set, by the clock:
 * a frame drawn late carries the word on by all the time since, and the frame after it, read
 * before Motion's next batch, shows it standing. On a busy machine Lisbon's "with friends"
 * went 23 px and then none where its glide goes 9 a frame, and 27 and then 2 over the five
 * frames the page stalled for. A word that jumps its way in a frame and then stands goes
 * half of it a frame even so.
 */
function glideStepOf(steps: readonly WordStep[]): number {
  return Math.max(
    ...steps.map((step, index) => {
      const besides = [steps[index - 1], steps[index + 1]].flatMap((beside) =>
        beside ? [(step.move + beside.move) / (step.frames + beside.frames)] : [],
      );
      return Math.min(step.move / step.frames, ...besides);
    }),
  );
}

/**
 * Every rule a day's exit keeps (`docs/decisions.md`, "The stream reports how it ended"), frame by
 * frame: the fade as one piece with nothing else changing, the step once the day has gone to the
 * eye, a word that moves gliding, the notice's pen a beat later or once that word rests, heard once
 * and reachable only once written. Returns whether a word glided.
 */
function expectTheExit(all: readonly Frame[], visitors: string): { hasGlided: boolean } {
  const { frames, before, fade, step } = exitOf(all);
  const drawn = frames[before]!;
  const fading = frames.slice(fade, step);
  const at = (index: number) => `${Math.round(frames[index]!.t - frames[fade]!.t)} ms`;

  // The whole chart fades on its spring, and nothing in it moves before it has gone.
  const opacities = new Set(fading.map((frame) => frame.chart));
  expect(opacities.size, `opacities: ${[...opacities].join(" ")}`).toBeGreaterThanOrEqual(
    FADE_VALUES,
  );
  for (const frame of frames.slice(before, step)) {
    expect(frame.rows.length).toBe(drawn.rows.length);
    frame.rows.forEach((top, index) =>
      expect(Math.abs(top - (drawn.rows[index] ?? 0)), `row ${index}`).toBeLessThan(STILL_PX),
    );
  }

  // What the header says of the day fades with the chart, at its opacity, or stays whole.
  fading.forEach((frame, index) => {
    for (const piece of frame.pieces) {
      const isWithTheChart = Math.abs(piece.opacity - (frame.chart ?? 0)) <= SAME_OPACITY;
      expect(
        piece.opacity >= WHOLE_OPACITY || isWithTheChart,
        `"${piece.text}" at ${piece.opacity} against the chart's ${frame.chart}, ${at(fade + index)}`,
      ).toBe(true);
    }
  });
  // No piece shown leaves in one frame: only one already gone to the eye.
  for (let index = fade; index <= step; index += 1) {
    for (const piece of leftBetween(frames[index - 1]!, frames[index]!)) {
      expect(piece.opacity, `"${piece.text}" left at ${at(index)}`).toBeLessThanOrEqual(
        GONE_OPACITY,
      );
    }
  }
  // The pens stand still from the frame the ending is drawn: from then until the day has
  // gone, not one letter is written or unwritten, and while it fades the header holds its
  // height.
  const letters = frames.slice(1, step).map(lettersOf);
  expect(new Set(letters).size, `letters: ${letters.join(" ")}`).toBe(1);
  frames
    .slice(before, step)
    .forEach((frame, index) =>
      expect(
        Math.abs(frame.header - drawn.header),
        `the header's height, ${frame.header} against ${drawn.header}, ${at(before + index)}`,
      ).toBeLessThan(STILL_PX),
    );

  // The step takes the notice's room in one frame, nothing visible standing under the
  // headline, and the header moves no more after it.
  const after = frames.slice(step - 1);
  const headerMoves = movesOf(after.map((frame) => frame.header));
  expect(headerMoves.length, JSON.stringify(headerMoves)).toBeLessThanOrEqual(1);
  expect(headerMoves[0]?.frames ?? 1, JSON.stringify(headerMoves)).toBeLessThanOrEqual(STEP_FRAMES);
  expect(frames.at(-1)!.headline).toBe(visitors);

  // After the step, a word of the headline holds still, or glides to its place.
  const tracks = wordTracksOf(after);
  let restsAt = step;
  for (const [word, steps] of tracks) {
    const moves = steps.map((step) => step.move);
    const way = moves.reduce((sum, move) => sum + move, 0);
    if (way < STILL_WORD_PX) continue;
    // A glide: never a large share of its way in one frame, and over many frames.
    expect(glideStepOf(steps), `${word}: ${moves.map(Math.round).join(" ")}`).toBeLessThanOrEqual(
      way * GLIDE_SHARE,
    );
    restsAt = Math.max(restsAt, step - 1 + moves.findLastIndex((move) => move >= STILL_PX) + 1);
  }
  const hasGlided = restsAt > step;

  // The notice's first letter comes a beat after the step, or once a moved word has come to
  // rest, and never with the lines it replaces.
  const firstLetter = frames.findIndex((frame) => (frame.notice ?? "").length > 0);
  expect(firstLetter).toBeGreaterThan(step);
  if (hasGlided) {
    expect(firstLetter, `rests ${at(restsAt)}, writes ${at(firstLetter)}`).toBeGreaterThanOrEqual(
      restsAt,
    );
  } else {
    expect(frames[firstLetter]!.t - frames[step]!.t).toBeGreaterThanOrEqual(PEN_BEAT_MS - FRAME_MS);
    const beat = frames[step]!.t + PEN_BEAT_MS - FRAME_MS;
    const atTheBeat = frames.findIndex((frame, index) => index > step && frame.t >= beat);
    expect(
      firstLetter,
      `the beat drawn ${at(atTheBeat)}, the first letter ${at(firstLetter)}`,
    ).toBeLessThanOrEqual(atTheBeat + PEN_WORK_FRAMES * CPU_RATE + DROPPED_FRAMES);
  }
  for (const frame of frames.slice(step)) {
    expect(frame.dek).toBeNull();
    expect(frame.facts).toBeNull();
    if (frame.notice !== null) expect(frame.noticeWhole!.startsWith(frame.notice)).toBe(true);
    if (frame.offered !== null) expect(frame.offeredWhole!.startsWith(frame.offered)).toBe(true);
  }

  // Screen and hearing apart: the line on screen is no live region, and a screen reader is
  // told the notice's whole line once, in the step. It stands until the pen has written the
  // notice, then falls quiet for good, as the page says it: never a fragment. The notice is
  // out of reach until the pen has written it whole.
  const line = frames.at(-1)!.noticeWhole;
  let isQuiet = false;
  for (const frame of frames.slice(step)) {
    expect(frame.noticeRole).toBeNull();
    const isWritten = frame.notice === frame.noticeWhole && frame.offered === frame.offeredWhole;
    if (!isWritten) {
      expect(frame.isNoticeInert).toBe(true);
      expect(frame.heard).toBe(line);
    }
    if (frame.heard === "") isQuiet = true;
    else {
      expect(isQuiet).toBe(false);
      expect(frame.heard).toBe(line);
    }
  }
  expect(frames.at(-1)!.isNoticeInert).toBe(false);
  return { hasGlided };
}

/** Endings without a day once the header's room is known: the chart is drawn, then fades. */
const ENDINGS_WITH_THE_CHART = ["error-mid-plan", "dropped-mid-plan", "refused-mid-plan"];
/**
 * Endings before the header's room is known, ten times faster: before any text, or a day of
 * one stop and a blank line about the day, played whole before the header comes to rest.
 */
const ENDINGS_BEFORE_THE_ROOM = ["offline", "invalid", "rejected", "limited"];

/**
 * A day that ends before its header's room is known never draws its chart: from the first
 * frame of the run that ends, no chart stands, and the notice is written in over nothing.
 */
function expectNoChartDrawn(all: readonly Frame[]): void {
  const run = all.at(-1)!.headerId;
  const from = all.findIndex((frame) => frame.headerId === run);
  expect(from, "the run's header never drawn").toBeGreaterThanOrEqual(0);
  const frames = all.slice(from);
  const drawn = frames.findIndex((frame) => frame.chart !== null || frame.isLeaving);
  expect(drawn, `a chart at ${Math.round((frames[drawn]?.t ?? 0) - frames[0]!.t)} ms`).toBe(-1);
  expect(frames.at(-1)!.notice).toBe(frames.at(-1)!.noticeWhole);
}

/**
 * A written day chosen from the city word of a day that finished is drawn whole in the
 * frame the last one goes: from the press until its stream first writes, no frame stands
 * without a date or axes.
 */
async function expectDrawnAtOnceFromAFinishedDay(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  const headline = page.getByRole("heading", { level: 1 });
  // The bench's first day, Kyoto's, played whole.
  await headline.getByRole("button", { name: "Kyoto", exact: true }).click();
  const bologna = page
    .getByRole("group", { name: "Where" })
    .getByRole("button", { name: /^Bologna/ });

  await pressByHand(page, bologna);

  await expect(headline).toHaveText(BOLOGNA, { timeout: DAY_TIMEOUT_MS });
  // Lantern's first word arrives with the new day's stream, from the route.
  await expect(headline).not.toHaveText(BOLOGNA, { timeout: DAY_TIMEOUT_MS });
  const { at: pressedAt, frame: pressedFrame } = await pressOf(page);
  const after = (await framesOf(page)).slice(pressedFrame);
  // A press is a discrete event: the new day is drawn by the next frame.
  const drawn = after.findIndex((frame) => frame.headline === BOLOGNA);
  expect(drawn, "the new day never drawn").toBeGreaterThanOrEqual(0);
  for (const frame of after) {
    const at = `${Math.round(frame.t - pressedAt)} ms after the press`;
    expect(frame.date, `no date ${at}`).not.toBeNull();
    expect(frame.chart, `no axes ${at}`).not.toBeNull();
    expect(frame.chart!, `axes unseen ${at}`).toBeGreaterThan(GONE_OPACITY);
  }
}

/**
 * The focus from the press to rest, frame by frame and move by move: wherever the press
 * left it, the control pressed by a hand, until the next day is drawn, then on that day's
 * city word, having moved once.
 */
async function expectFocusMovesOnce(
  page: Page,
  pressedAt: number,
  after: readonly Frame[],
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

/**
 * The new day's date and axes: drawn a beat after the day is, at their place, and still
 * until its stream first changes the header: by the words it brings, which the header's
 * unseen copies hold room for and its row opens before the pen writes them in, or by the
 * words written. Returns when each was first drawn, after the day.
 */
function expectDrawnInPlace(
  after: readonly Frame[],
  drawn: number,
): { dateMs: number; axesMs: number | null } {
  const dateAt = after.findIndex((frame, index) => index >= drawn && frame.date !== null);
  expect(dateAt, "the date never drawn").toBeGreaterThan(drawn);
  const shown = after[dateAt]!;
  const streams = after.findIndex(
    (frame, index) =>
      index > dateAt &&
      (frame.headline !== shown.headline ||
        frame.facts !== shown.facts ||
        frame.reserved !== shown.reserved),
  );
  expect(streams).toBeGreaterThan(dateAt);
  const dateMs = shown.t - after[drawn]!.t;
  expect(dateMs, "the date drawn before the beat").toBeGreaterThanOrEqual(PEN_BEAT_MS - FRAME_MS);
  const axesAt = after.findIndex((frame, index) => index >= drawn && frame.chartTop !== null);
  const axesMs = axesAt < 0 ? null : after[axesAt]!.t - after[drawn]!.t;
  if (axesMs !== null) {
    expect(axesMs, "the axes drawn before the beat").toBeGreaterThanOrEqual(PEN_BEAT_MS - FRAME_MS);
  }
  const still = after.slice(drawn, streams);
  still.slice(1).forEach((frame, index) => {
    const last = still[index]!;
    if (frame.date !== null && last.date !== null) {
      expect(Math.abs(frame.date - last.date), "the date moved").toBeLessThanOrEqual(STILL_PX);
    }
    if (frame.chartTop !== null && last.chartTop !== null) {
      expect(Math.abs(frame.chartTop - last.chartTop), "the axes moved").toBeLessThanOrEqual(
        STILL_PX,
      );
    }
  });
  return { dateMs, axesMs };
}

test.describe("with motion", { tag: "@frame" }, () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await page.setViewportSize(isMobile ? PHONE : LAPTOP);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await sampleEveryFrame(page);
    await page.goto(URL);
  });

  for (const [city, visitors] of [
    ["Kyoto", KYOTO],
    ["Lisbon", LISBON],
    ["Alicante", ALICANTE],
  ] as const) {
    for (const ending of ENDINGS_WITH_THE_CHART) {
      test(`${city}, ${ending}: the day fades as one piece, then the notice writes in`, async ({
        page,
      }) => {
        await chooseEnding(page, ending, city);
        await waitForTheNotice(page);

        expectTheExit(await framesOf(page), visitors);
      });
    }
    for (const ending of ENDINGS_BEFORE_THE_ROOM) {
      test(`${city}, ${ending}: no chart is drawn, and the notice writes in`, async ({ page }) => {
        await chooseEnding(page, ending, city);
        await waitForTheNotice(page);

        expectNoChartDrawn(await framesOf(page));
      });
    }
  }

  test("a written day chosen from a finished day draws its date and axes at once", async ({
    page,
  }) => {
    test.slow();
    await expectDrawnAtOnceFromAFinishedDay(page);
  });

  test("Lisbon's with friends glides to its place, and the pen waits for it", async ({ page }) => {
    await chooseEnding(page, "error-mid-plan", "Lisbon");
    await waitForTheNotice(page);

    expect(expectTheExit(await framesOf(page), LISBON).hasGlided).toBe(true);
  });

  test("Tab never lands in the notice while its pen writes it", async ({ page }) => {
    await chooseEnding(page, "error-mid-plan");
    await waitForTheStep(page);
    const headline = page.getByRole("heading", { level: 1 });

    // The visitor's last word in the headline, the start Kanazawa's day was asked with.
    await headline.getByRole("button", { name: "early start", exact: true }).focus();
    await page.keyboard.press("Tab");

    const isInNotice = await page.evaluate(
      () => document.activeElement?.closest("header p.text-quote, header ul") != null,
    );
    const frame = (await framesOf(page)).at(-1)!;
    expect(frame.notice === frame.noticeWhole && frame.offered === frame.offeredWhole).toBe(false);
    expect(isInNotice).toBe(false);
    await waitForTheNotice(page);
    await headline.getByRole("button", { name: "early start", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Write it again" })).toBeFocused();
  });

  test("Write it again: the notice fades, then the day is drawn at its place and streams", async ({
    page,
  }) => {
    test.slow();
    await chooseEnding(page, "error-mid-plan");
    await waitForTheNotice(page);

    await pressByHand(page, page.getByRole("button", { name: "Write it again" }));

    await expectGoesOnFromTheNotice(page, KANAZAWA, (frame) => frame.notice === frame.noticeWhole);
  });

  test("Write it again before the notice is written: the day is drawn in one step", async ({
    page,
  }) => {
    test.slow();
    await chooseEnding(page, "error-mid-plan");
    await waitForTheStep(page);

    // Pressed as a script would: the hand cannot reach it until it is written.
    await press(page, "Write it again");

    await expectGoesOnFromTheNotice(page, KANAZAWA, (frame) => frame.notice === "");
  });

  test("Write it again while the notice is written in: it fades as it stands", async ({ page }) => {
    test.slow();
    await chooseEnding(page, "error-mid-plan");
    await page.waitForFunction(() => (window.endingFrames.at(-1)?.notice ?? "").length > 0, null, {
      timeout: DAY_TIMEOUT_MS,
      polling: "raf",
    });

    await press(page, "Write it again");

    await expectGoesOnFromTheNotice(page, KANAZAWA, (frame) => (frame.notice ?? "").length > 0);
  });

  test("a written day chosen from the notice: the notice fades, then that day streams", async ({
    page,
  }) => {
    test.slow();
    await chooseEnding(page, "error-mid-plan");
    await waitForTheNotice(page);

    await pressByHand(page, page.getByRole("button", { name: BOLOGNA }));

    await expectGoesOnFromTheNotice(page, BOLOGNA, (frame) => frame.notice === frame.noticeWhole);
  });

  test("pressed again while the notice fades, the first press plays one day", async ({ page }) => {
    test.slow();
    await chooseEnding(page, "error-mid-plan");
    await waitForTheNotice(page);
    const asked: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new globalThis.URL(request.url()).pathname === DAY_ROUTE) {
        asked.push(request.postData() ?? "");
      }
    });

    await press(page, "Write it again");
    const first = await pressOf(page);
    // As a script would, the notice being out of the hand's reach while it fades.
    await press(page, "Write it again");
    await press(page, BOLOGNA);
    const last = await pressOf(page);

    await expect(page.locator("header p.text-quote")).toHaveCount(0, { timeout: DAY_TIMEOUT_MS });
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const frames = await framesOf(page);
    // Every press came while the notice still stood.
    expect(frames[last.frame - 1]!.noticeWhole).not.toBeNull();
    const charts = new Set(
      frames
        .slice(first.frame)
        .filter((frame) => frame.chartId !== null)
        .map((f) => f.chartId),
    );
    expect(charts.size, "days drawn after the presses").toBe(1);
    expect(asked, "days asked of the route").toHaveLength(1);
    expect(JSON.parse(asked[0]!)).toMatchObject({ city: "Kanazawa" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A calm Saturday in Kanazawa",
    );
  });

  test("a written day chosen from the city word while the chart fades waits for the fade", async ({
    page,
  }) => {
    test.slow();
    await chooseEnding(page, "error-mid-plan");
    const headline = page.getByRole("heading", { level: 1 });
    await headline.getByRole("button", { name: "Kanazawa", exact: true }).click();
    const bologna = page
      .getByRole("group", { name: "Where" })
      .getByRole("button", { name: /^Bologna/ });
    await expect(bologna).toBeVisible();
    // Where the row stands as the chart starts to fade, read in that frame, so the press
    // lands inside the fade.
    const at = await (
      await page.waitForFunction(
        () => {
          if (document.querySelector('[data-exit="fading"]') === null) return null;
          const row = [
            ...document.querySelectorAll('[role="group"][aria-label="Where"] button'),
          ].find((button) => button.textContent?.startsWith("Bologna"));
          const box = row?.getBoundingClientRect();
          return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
        },
        null,
        { timeout: DAY_TIMEOUT_MS, polling: "raf" },
      )
    ).jsonValue();
    if (!at) throw new Error("No Bologna in the city's list");

    await pressByHand(page, bologna, at);

    await expectGoesOnFromTheChart(page, BOLOGNA);
  });
});

/**
 * After a press while the chart fades: it came while the chart was fading, the fade goes on
 * to the eye's end as it stands, nothing else moving and no notice drawn, the list it was
 * chosen from fading as the notice would, and the focus held on the row pressed. Then, in
 * one step, the new day is drawn, its date and axes a beat later at their place, its city
 * word holding the focus, which moved once. Then the new day streams to its end.
 */
async function expectGoesOnFromTheChart(page: Page, sentence: string): Promise<void> {
  const { at: pressedAt, frame: pressedFrame } = await pressOf(page);
  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toHaveText(sentence, { timeout: DAY_TIMEOUT_MS });
  // Lantern's first word arrives with the new day's stream, from the route.
  await expect(headline).not.toHaveText(sentence, { timeout: DAY_TIMEOUT_MS });
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );

  const frames = await framesOf(page);
  const pressedOn = frames[pressedFrame - 1]!;
  expect(pressedOn.isLeaving, `pressed on ${JSON.stringify(pressedOn)}`).toBe(true);
  const after = frames.slice(pressedFrame);
  const drawn = after.findIndex((frame) => frame.headerId !== pressedOn.headerId);
  expect(drawn, "the chart was cut in the frame of the press").toBeGreaterThan(0);
  const fading = after.slice(0, drawn);

  // The chart fades on as it stood, through to the eye's end, and is never cut while seen.
  const leftChart = pressedOn.chartId;
  const opacities = new Set(
    frames.filter((frame) => frame.chartId === leftChart && frame.chart! < 1).map((f) => f.chart),
  );
  expect(opacities.size, `opacities: ${[...opacities].join(" ")}`).toBeGreaterThanOrEqual(
    FADE_VALUES,
  );
  for (const frame of fading) {
    expect(frame.chartId, "the chart cut while it faded").toBe(leftChart);
    expect(frame.noticeWhole, "the notice drawn").toBeNull();
    expect(
      Math.abs(frame.header - pressedOn.header),
      "the header moved while the chart faded",
    ).toBeLessThan(STILL_PX);
    expect(frame.headline).toBe(pressedOn.headline);
    expect(frame.listOpacity, "the list it was chosen from, cut").not.toBeNull();
  }
  expect(fading.at(-1)!.chart).toBeLessThanOrEqual(GONE_OPACITY);
  expect(fading.at(-1)!.listOpacity).toBeLessThanOrEqual(GONE_OPACITY);
  for (const frame of after.slice(drawn)) {
    expect(frame.chartId === leftChart, "the chart that left, shown again").toBe(false);
    expect(frame.noticeWhole).toBeNull();
  }

  // One step: the new day's headline and its lines' room, nothing seen under the headline.
  expect(after[drawn]!.headline).toBe(sentence);
  expect(after[drawn]!.date).toBeNull();
  expect(after[drawn]!.chart).toBeNull();
  const run = [pressedOn, ...after];
  const lines = run.map((frame) => Math.round(frame.lines)).join(" ");
  const steps = linesStepsOf(run);
  expect(steps.length, lines).toBeLessThanOrEqual(1);
  for (const at of steps) expect(isNothingSeenUnder(run[at - 1]!), lines).toBe(true);

  const { dateMs, axesMs } = expectDrawnInPlace(after, drawn);
  test.info().annotations.push({
    type: "measured",
    description: `chart ${[...opacities].length} values, drawn ${Math.round(after[drawn]!.t - pressedAt)} ms after the press, date ${Math.round(dateMs)} ms and axes ${axesMs === null ? "never" : `${Math.round(axesMs)} ms`} after the day`,
  });
  await expectFocusMovesOnce(page, pressedAt, after, drawn, sentence.match(/ in (\w+)/)![1]!);
}

/**
 * After a press on the notice: it came where `wasPressedWhile` says, and the notice fades as
 * it stands, never cut, out of the hand's reach, while the headline holds. Only once it has
 * gone to the eye is the new day drawn: the header's lines step only where nothing seen
 * stands under the headline, and no piece of text leaves the header seen. Its date and axes
 * come a beat later, at their place, and hold still until its stream first changes the
 * header; the focus stays where the press left it until then, and moves once, to the city
 * word. Then the new day streams to its end.
 */
async function expectGoesOnFromTheNotice(
  page: Page,
  sentence: string,
  wasPressedWhile: (frame: Frame) => boolean,
): Promise<void> {
  const { at: pressedAt, frame: pressedFrame } = await pressOf(page);
  const headline = page.getByRole("heading", { level: 1 });
  await expect(page.locator("header p.text-quote")).toHaveCount(0, { timeout: DAY_TIMEOUT_MS });
  // Lantern's first word arrives with the new day's stream, from the route.
  await expect(headline).not.toHaveText(sentence, { timeout: DAY_TIMEOUT_MS });
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );

  const frames = await framesOf(page);
  const pressedOn = frames[pressedFrame - 1]!;
  expect(wasPressedWhile(pressedOn), `pressed on ${JSON.stringify(pressedOn)}`).toBe(true);
  const after = frames.slice(pressedFrame);
  // The new day is drawn in the frame the notice goes; the notice stands until then.
  const drawn = after.findIndex((frame) => frame.noticeWhole === null);
  expect(drawn, "the notice was cut in the frame of the press").toBeGreaterThan(0);
  const fading = after.slice(0, drawn);
  for (const frame of fading) {
    expect(frame.noticeWhole).toBe(pressedOn.noticeWhole);
    expect(frame.headline).toBe(pressedOn.headline);
    expect(frame.isNoticeOutOfReach).toBe(true);
  }
  expect(after[drawn]!.headerId).not.toBe(pressedOn.headerId);
  expect(after[drawn]!.headline).toBe(sentence);

  // The notice fades on its spring, as it stands, and goes only once gone to the eye.
  const opacities = new Set(fading.map((frame) => frame.noticeOpacity));
  expect(opacities.size, `opacities: ${[...opacities].join(" ")}`).toBeGreaterThanOrEqual(
    FADE_VALUES,
  );
  expect(fading.at(-1)!.noticeOpacity).toBeLessThanOrEqual(GONE_OPACITY);
  expect(new Set(fading.map((frame) => `${frame.notice}|${frame.offered}`)).size).toBe(1);

  // Until the new day's stream first changes its header: no piece of text under the
  // headline leaves seen, and the lines step only over nothing seen.
  const { dateMs, axesMs } = expectDrawnInPlace(after, drawn);
  const shownAt = after.findIndex((frame, index) => index >= drawn && frame.date !== null);
  const streams = after.findIndex(
    (frame, index) =>
      index > shownAt &&
      (frame.headline !== after[shownAt]!.headline || frame.facts !== after[shownAt]!.facts),
  );
  const run = [pressedOn, ...after.slice(0, streams)];
  run.slice(1).forEach((frame, index) => {
    for (const cut of linesCutBetween(run[index]!, frame)) {
      expect(cut.opacity, `"${cut.text}" cut`).toBeLessThanOrEqual(GONE_OPACITY);
    }
  });
  const lines = run.map((frame) => Math.round(frame.lines)).join(" ");
  for (const at of linesStepsOf(run)) expect(isNothingSeenUnder(run[at - 1]!), lines).toBe(true);
  test.info().annotations.push({
    type: "measured",
    description: `notice ${opacities.size} values, drawn ${Math.round(after[drawn]!.t - pressedAt)} ms after the press, date ${Math.round(dateMs)} ms and axes ${axesMs === null ? "never" : `${Math.round(axesMs)} ms`} after the day`,
  });
  await expectFocusMovesOnce(page, pressedAt, after, drawn, sentence.match(/ in (\w+)/)![1]!);
}

test.describe("under reduced motion", { tag: "@frame" }, () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await page.setViewportSize(isMobile ? PHONE : LAPTOP);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await sampleEveryFrame(page);
    await page.goto(URL);
  });

  test("the day leaves in one step, opacity included", async ({ page }) => {
    await chooseEnding(page, "error-mid-plan");
    await waitForTheStep(page);

    const frames = await framesOf(page);
    const opacities = new Set(
      frames.flatMap((frame) => (frame.chart === null ? [] : [frame.chart])),
    );
    expect(opacities.size, `opacities: ${[...opacities].join(" ")}`).toBeLessThanOrEqual(
      REDUCED_OPACITIES,
    );
    // The frame the chart is gone in has the notice whole, heard, and nothing of the day's
    // lines; its controls are in reach at once.
    const last = frames.findLastIndex((frame) => frame.chart !== null);
    const step = frames[last + 1]!;
    expect(step.notice).toBe(step.noticeWhole);
    expect(step.heard).toBe(step.noticeWhole);
    expect(step.isNoticeInert).toBe(false);
    expect(step.facts).toBeNull();
    expect(step.headline).toBe(KANAZAWA);
  });

  test("a written day chosen from a finished day draws its date and axes at once", async ({
    page,
  }) => {
    test.slow();
    await expectDrawnAtOnceFromAFinishedDay(page);
  });

  test("Write it again draws the day in place of the notice in one step", async ({ page }) => {
    await chooseEnding(page, "error-mid-plan");
    await waitForTheStep(page);

    await pressByHand(page, page.getByRole("button", { name: "Write it again" }));

    const headline = page.getByRole("heading", { level: 1 });
    await expect(headline.getByRole("button", { name: "Kanazawa", exact: true })).toBeFocused();
    await expect(page.locator("header p.text-quote")).toHaveCount(0);
    await expect(page.getByRole("group", { name: /The day's energy/ })).toBeVisible();
    const { at: pressedAt, frame: pressedFrame } = await pressOf(page);
    const frames = await framesOf(page);
    // The first frame after the press has the new day and no notice, which never faded; its
    // date and axes come a beat later.
    const after = frames.slice(pressedFrame);
    expect(after[0]!.noticeWhole).toBeNull();
    expect(after[0]!.headline).toBe(KANAZAWA);
    for (const frame of frames) {
      if (frame.noticeOpacity !== null) expect(frame.noticeOpacity).toBe(1);
    }
    const dateAt = after.findIndex((frame) => frame.date !== null);
    expect(after[dateAt]!.t - after[0]!.t).toBeGreaterThanOrEqual(PEN_BEAT_MS - FRAME_MS);
    await expectFocusMovesOnce(page, pressedAt, after, 0, "Kanazawa");
  });
});
