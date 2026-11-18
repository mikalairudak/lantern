import { act, render, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { salvagedDay } from "@/lib/stream/read-day-stream";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { formatClock, parseClock } from "@/lib/time/clock";
import { partialAt } from "@/features/itinerary/stream-frames";
import { DayStage } from "./day-stage";
import { READING_LIST_LABEL } from "./reading-list";
import { DAY_VIEW_ATTRIBUTE } from "./view-choice";

// The page's clocks are the test's from before anything loads: Motion takes the frame loop it
// draws on as its module is read.
vi.hoisted(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
});

/**
 * The plan under reduced motion while a day is written (`docs/decisions.md`, "A day can be read
 * as a list, written as the chart is"): a row lands once its words are final, whole, and its
 * versions come in when they are written; nothing on it is ever drawn that the stream changes.
 * The page is given the day's stream a frame at a time, on the test's clock.
 */

const TEXT = dayText(KANAZAWA_START_DAY.day);
const STOP_COUNT = KANAZAWA_START_DAY.day.stops.length;
/** Where the versions begin in the stream: every stop is written by then. */
const VERSIONS_AT = TEXT.indexOf('"alternatives"');
/** How much of the stream each frame adds: a frame or two to a stop. */
const STEP_CHARS = 480;
/**
 * How long each frame stands on the test's clock: longer than a stop's beat (0.3 s) and a
 * piece of the header's pen (0.15 s), so the page lets in all it would by the next frame.
 */
const FRAME_MS = 400;
/**
 * How long a frame given at once, with nothing before it, stands: the header's pen and every
 * stop's beat, which let in the rows it holds one after another.
 */
const LANDED_MS = 5000;
/** After the stream ends: the page's last step and anything it waits a frame or two for. */
const SETTLED_MS = 1000;
const NO_OP = () => undefined;
/** Skips what a screen reader does not hear: the versions drawn beside a stop. */
const UNHEARD = "[aria-hidden]";

const written = normalizeDay(KANAZAWA_START_REQUEST, KANAZAWA_START_DAY.day);
if (!written.ok) throw new Error(written.reason);
const WHOLE_DAY: Itinerary = written.itinerary;

/** What a stop's row says of it, from the finished day: its time, name, end and line. */
interface OwnWords {
  time: string;
  name: string;
  until: string;
  line: string;
}

const OWN_WORDS: ReadonlyMap<string, OwnWords> = new Map(
  WHOLE_DAY.stops.map((stop) => [
    stop.id,
    {
      time: stop.startTime,
      name: stop.primary.name,
      until: `until ${formatClock((parseClock(stop.startTime) ?? 0) + stop.durationMinutes)}`,
      line: stop.primary.summary,
    },
  ]),
);

class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: 448, height: 640 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

function reducedMotion(query: string): MediaQueryList {
  return {
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

/** What the page is given in one frame of the stream. */
interface StreamFrame {
  /** How much of the stream's text it holds. */
  at: number;
  partial: PartialDay | null;
  outcome: DayOutcome | null;
}

/** Each step of the stream's text, as the page reads it, worked out once. */
let partials: Map<number, PartialDay>;

/** The stream's frames up to `at`, each `STEP_CHARS` on from the last. */
function framesTo(at: number): StreamFrame[] {
  return [...partials.keys()]
    .filter((offset) => offset <= at)
    .map((offset) => ({ at: offset, partial: partials.get(offset)!, outcome: null }));
}

/** The salvaged day of a stream that stopped after `at` characters, as the page reads it. */
async function salvageAt(at: number): Promise<Itinerary | null> {
  const day = await salvagedDay(TEXT.slice(0, at));
  if (day === null) return null;
  const normalized = normalizeDay(KANAZAWA_START_REQUEST, day);
  return normalized.ok ? normalized.itinerary : null;
}

/** The step of the stream's text at or before `at`. */
function stepBefore(at: number): number {
  return Math.floor(at / STEP_CHARS) * STEP_CHARS;
}

/** A character offset mid-way through a stop's one line: the stop is placed, its row is not final. */
function midLineOf(stop: number): number {
  const summary = KANAZAWA_START_DAY.day.stops[stop]!.place.summary;
  return TEXT.indexOf(JSON.stringify(summary).slice(0, -1)) + Math.floor(summary.length / 2);
}

beforeAll(async () => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
  const offsets = Array.from(
    { length: Math.floor(TEXT.length / STEP_CHARS) },
    (_, index) => (index + 1) * STEP_CHARS,
  );
  partials = new Map(
    await Promise.all(
      offsets.map(async (at): Promise<[number, PartialDay]> => [at, await partialAt(TEXT, at)]),
    ),
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
beforeEach(() => {
  document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
});

/** The plan's rows on the page, by their stop. */
function planRows(): HTMLElement[] {
  const list = document.querySelector(`ol[aria-label="${READING_LIST_LABEL}"]`);
  return list ? [...list.querySelectorAll<HTMLElement>(":scope > li[data-stop]")] : [];
}

/** Whether a row says its versions: the arrows to swipe it to one. */
function hasVersions(row: HTMLElement): boolean {
  return within(row)
    .queryAllByRole("button")
    .some((arrow) =>
      /^(Quieter|Livelier|Same energy): /.test(arrow.getAttribute("aria-label") ?? ""),
    );
}

/**
 * The words a row says of its own stop, as heard: without the versions drawn beside it, the
 * arrows that name them or the hint that tells how to swipe.
 */
function ownTextOf(row: HTMLElement): string {
  const copy = row.cloneNode(true) as HTMLElement;
  for (const other of copy.querySelectorAll(`${UNHEARD}, button, .sr-only`)) other.remove();
  return copy.textContent ?? "";
}

/** Fails unless a row says its own stop's time, name, end and line, as the finished day does. */
function expectOwnWords(row: HTMLElement): void {
  const id = row.getAttribute("data-stop") ?? "";
  const own = OWN_WORDS.get(id);
  expect(own, id).toBeDefined();
  const text = ownTextOf(row);
  // The time in its gutter, then the name beside the rail, which says nothing.
  expect(text, id).toContain(`${own!.time}${own!.name}`);
  expect(text, id).toContain(own!.until);
  expect(text, id).toContain(own!.line);
}

/** What the plan showed, frame by frame, from a row's landing on. */
interface PlanSeen {
  /** The stream's length in the frame the first row landed. */
  firstRowAt: number | null;
  /** The rows on the plan in each frame, by their stops. */
  rowsByFrame: string[][];
  /** Each row that landed without its versions, by its stop. */
  bare: Set<string>;
  /** Each row whose versions came in, by its stop. */
  versioned: Set<string>;
  /** What the line under the plan said while the versions were written. */
  versionLines: string[];
}

/** Reads the plan as it stands now, checking every row it shows against the finished day. */
function lookAtThePlan(seen: PlanSeen, at: number): void {
  const rows = planRows();
  if (rows.length > 0 && seen.firstRowAt === null) seen.firstRowAt = at;
  const ids = rows.map((row) => row.getAttribute("data-stop") ?? "");
  for (const [index, row] of rows.entries()) {
    expectOwnWords(row);
    const id = ids[index]!;
    const isNew = !seen.rowsByFrame.some((frame) => frame.includes(id));
    if (isNew) {
      expect(within(row).getByRole("heading", { level: 2 })).toHaveTextContent(
        OWN_WORDS.get(id)!.name,
      );
      if (!hasVersions(row)) seen.bare.add(id);
    }
    if (hasVersions(row)) seen.versioned.add(id);
  }
  seen.rowsByFrame.push(ids);
  for (const line of document.querySelectorAll("[data-under-chart] p")) {
    const text = line.textContent ?? "";
    if (text.startsWith("Writing quieter")) seen.versionLines.push(text);
  }
}

/** Moves the test's clock on, letting the page do all it would meanwhile. */
async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Presses the view switch's button for a view. */
async function switchTo(view: "Plan" | "Chart"): Promise<void> {
  const views = document.querySelector<HTMLElement>('[role="group"][aria-label="View"]');
  if (!views) throw new Error("No view switch");
  await act(async () => {
    within(views).getByRole("button", { name: view }).click();
  });
}

/** How a play gives its frames. */
interface PlayOptions {
  /** How long each frame stands; `FRAME_MS` for a stream given step by step. */
  frameMs?: number;
  /** Runs once a frame has stood, before the plan is read, as a press mid-stream. */
  afterFrame?: (at: number) => Promise<void>;
}

/**
 * Plays the stream's frames on the page, each standing `frameMs`, then its end, and reads the
 * plan after each.
 */
async function play(
  frames: readonly StreamFrame[],
  ending: StreamFrame | null,
  { frameMs = FRAME_MS, afterFrame }: PlayOptions = {},
): Promise<PlanSeen> {
  const seen: PlanSeen = {
    firstRowAt: null,
    rowsByFrame: [],
    bare: new Set(),
    versioned: new Set(),
    versionLines: [],
  };
  const stageAt = (frame: StreamFrame) => (
    <DayStage
      request={KANAZAWA_START_REQUEST}
      partial={frame.partial}
      outcome={frame.outcome}
      isStreaming={frame.outcome === null}
      isChosen={false}
      onPlay={NO_OP}
      onRetry={NO_OP}
    />
  );
  const view = render(stageAt({ at: 0, partial: null, outcome: null }));
  try {
    await wait(FRAME_MS);
    for (const frame of [...frames, ...(ending ? [ending] : [])]) {
      view.rerender(stageAt(frame));
      await wait(frame.outcome === null ? frameMs : SETTLED_MS);
      await afterFrame?.(frame.at);
      lookAtThePlan(seen, frame.at);
    }
  } finally {
    view.unmount();
  }
  return seen;
}

/** The whole stream, ending with the finished day. */
function wholeStream(): { frames: StreamFrame[]; ending: StreamFrame } {
  const frames = framesTo(TEXT.length);
  const last = frames.at(-1)!;
  return {
    frames,
    ending: {
      at: TEXT.length,
      partial: last.partial,
      outcome: { kind: "complete", itinerary: WHOLE_DAY },
    },
  };
}

describe("the plan under reduced motion", () => {
  let whole: PlanSeen;
  beforeAll(async () => {
    const { frames, ending } = wholeStream();
    whole = await play(frames, ending);
  });

  it("lands a row while the stops are still written, before any of their versions", () => {
    expect(whole.firstRowAt).not.toBeNull();
    expect(whole.firstRowAt!).toBeLessThan(VERSIONS_AT);
    expect(whole.rowsByFrame.at(-1)).toHaveLength(STOP_COUNT);
  });

  it("lands each row with its own words, keeps them, and adds only its versions", () => {
    // Every frame's rows said their own stop's words as the finished day says them
    // (`lookAtThePlan`); each landed bare, and its versions came in after.
    const landed = whole.rowsByFrame.at(-1)!;
    expect([...whole.bare].sort()).toEqual([...landed].sort());
    expect([...whole.versioned].sort()).toEqual([...landed].sort());
  });

  it("counts the versions against every row on the plan, on a day whose every stop is kept as written", () => {
    expect(whole.versionLines.length).toBeGreaterThan(0);
    for (const line of whole.versionLines) {
      expect(line).toMatch(new RegExp(`of\\s${STOP_COUNT}\\sstops$`));
    }
  });

  const CUTS: readonly [string, number, (itinerary: Itinerary | null) => DayOutcome][] = [
    [
      "cut mid-way through a stop's line",
      midLineOf(5),
      (itinerary) => ({ kind: "cut", itinerary }),
    ],
    [
      "dropped mid-way through a stop's line",
      midLineOf(6),
      (itinerary) => ({ kind: "disconnected", itinerary }),
    ],
    ["refused mid-way through a stop's line", midLineOf(6), () => ({ kind: "refused" })],
    ["cut inside the versions", VERSIONS_AT + 400, (itinerary) => ({ kind: "cut", itinerary })],
    [
      "dropped inside the versions",
      VERSIONS_AT + 400,
      (itinerary) => ({ kind: "disconnected", itinerary }),
    ],
  ];

  it.each(CUTS)(
    "shows only rows with their own final words when the stream is %s",
    async (_name, at, outcomeOf) => {
      // The stream as it stood a step before it stopped, its rows let in, then its end. The
      // frames before are the whole stream's, each row checked there.
      const before = stepBefore(at);
      const partial = await partialAt(TEXT, at);
      const ending = { at, partial, outcome: outcomeOf(await salvageAt(at)) };
      const seen = await play(
        [{ at: before, partial: partials.get(before)!, outcome: null }],
        ending,
      );

      // Every row checked in both frames against the finished day (`lookAtThePlan`).
      expect(seen.firstRowAt).not.toBeNull();
    },
  );

  it.each<[string, DayOutcome]>([
    ["offline", { kind: "disconnected", itinerary: null }],
    ["rejected", { kind: "unavailable" }],
    ["limited", { kind: "limited" }],
  ])("shows no row when the stream is %s before its first word", async (_name, outcome) => {
    const seen = await play([], { at: 0, partial: null, outcome });

    expect(seen.firstRowAt).toBeNull();
  });

  it.each(["Plan", "Chart"] as const)(
    "shows the rows a plan on show would after a switch to the chart and back, from the %s",
    async (from) => {
      // Mid-way through the stops, before any of their versions: away from the plan in one
      // frame, and back on it in the next.
      const away = stepBefore(midLineOf(3));
      const back = stepBefore(midLineOf(5));
      expect(back).toBeLessThan(VERSIONS_AT);
      const frames = [away, back].map((at) => ({ at, partial: partials.get(at)!, outcome: null }));
      const stayed = await play(frames, null, { frameMs: LANDED_MS });
      if (from === "Chart") document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, "chart");
      const seen = await play(frames, null, {
        frameMs: LANDED_MS,
        afterFrame: async (at) => {
          if (at === away && from === "Plan") await switchTo("Chart");
          if (at === back) await switchTo("Plan");
        },
      });

      // Drawn again, the plan stands with the rows a plan that stayed on show has, their
      // versions still to come.
      expect(stayed.rowsByFrame.at(-1)!.length).toBeGreaterThan(0);
      expect(seen.rowsByFrame.at(-1)).toEqual(stayed.rowsByFrame.at(-1));
      expect(seen.versioned.size).toBe(0);
    },
  );

  it("draws a day drawn whole with every row and its versions from its first frame", () => {
    render(
      <DayStage
        request={KANAZAWA_START_REQUEST}
        partial={null}
        outcome={{ kind: "complete", itinerary: WHOLE_DAY }}
        isStreaming={false}
        isChosen={false}
        isDrawnWhole
        onPlay={NO_OP}
        onRetry={NO_OP}
      />,
    );

    const rows = planRows();
    expect(rows).toHaveLength(STOP_COUNT);
    expect(rows.every(hasVersions)).toBe(true);
    for (const row of rows) expectOwnWords(row);
  });
});
