import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { normalizeDay } from "@/lib/normalizer/normalize";
import {
  dayText,
  simulateDayStream,
  type StreamEnding,
  type StreamPace,
} from "@/lib/stream/simulate-day-stream";
import { Day } from "./day";
import { DayStage } from "./day-stage";
import { READING_LIST_LABEL } from "./reading-list";
import { DAY_VIEW_ATTRIBUTE } from "./view-choice";

/**
 * The plan under reduced motion while a day is written (`docs/decisions.md`, "A day can be read
 * as a list, written as the chart is"): a row lands once its words are final, whole, and its
 * versions come in when they are written; nothing on it is ever drawn that the stream changes.
 */

const TEXT = dayText(KANAZAWA_START_DAY.day);
const STOPS = KANAZAWA_START_DAY.day.stops;
/** Where the versions begin in the stream: every stop is written by then. */
const VERSIONS_AT = TEXT.indexOf('"alternatives"');
/**
 * Even deltas, slow enough that rows land while the stops are still written, and few, so a day
 * takes a few renders inside a full run on a busy machine.
 */
const PACE: Partial<StreamPace> = { deltaChars: 160, deltaDelayMs: 60 };
const DAY_TIMEOUT = { timeout: 60_000 };
/** A test that plays a day, slower inside a full run on a busy machine. */
const PLAY_TEST_MS = 90_000;
/** Long enough after a stream ends for a step under reduced motion to have been drawn. */
const SETTLED_MS = 600;

/** A character offset mid-way through a stop's one line: the stop is placed, its row is not final. */
function midLineOf(stop: number): number {
  const summary = STOPS[stop]!.place.summary;
  return TEXT.indexOf(JSON.stringify(summary).slice(0, -1)) + Math.floor(summary.length / 2);
}

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

/** The stream's text as far as it has been delivered to the page, and whether it has closed. */
const delivered = { text: "", isClosed: false };
let ending: StreamEnding = { kind: "finished" };

/** The route's answer, its body read on the way so a test knows how far the stream has come. */
async function answer(_path: string, init: RequestInit): Promise<Response> {
  const response = await simulateDayStream({
    day: KANAZAWA_START_DAY.day,
    ending,
    pace: PACE,
    signal: init.signal ?? undefined,
  });
  if (!response.body) {
    delivered.isClosed = true;
    return response;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const count = (chunk: Uint8Array) => {
    pending += decoder.decode(chunk, { stream: true });
    const events = pending.split("\n\n");
    pending = events.pop() ?? "";
    for (const event of events) {
      const data = event.replace(/^data: /, "");
      if (!data.startsWith("{")) continue;
      const part = JSON.parse(data) as { type?: string; delta?: string };
      if (part.type === "text-delta") delivered.text += part.delta ?? "";
    }
  };
  // Closed however it ends: a dropped connection errors rather than closing.
  const counted = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          delivered.isClosed = true;
          controller.close();
          return;
        }
        count(value);
        controller.enqueue(value);
      } catch (error) {
        delivered.isClosed = true;
        controller.error(error);
      }
    },
    cancel(reason) {
      delivered.isClosed = true;
      return reader.cancel(reason);
    },
  });
  return new Response(counted, { status: response.status, headers: response.headers });
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", vi.fn(answer));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
beforeEach(() => {
  ending = { kind: "finished" };
  delivered.text = "";
  delivered.isClosed = false;
  document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
});

/** The plan's rows on the page, by their stop. */
function planRows(): HTMLElement[] {
  const list = document.querySelector(`ol[aria-label="${READING_LIST_LABEL}"]`);
  return list ? [...list.querySelectorAll<HTMLElement>(":scope > li[data-stop]")] : [];
}

/** A row's own words as it reads them: its time, its name, what and where until when, its line. */
function wordsOf(row: HTMLElement): string {
  const box = row.querySelector("[data-row-at-rest]");
  return [
    box?.querySelector("span"),
    box?.querySelector("h2"),
    box?.querySelector("p.type-note"),
    box?.querySelector("p.type-prose"),
  ]
    .map((part) => part?.textContent ?? "")
    .join(" | ");
}

/** Whether a row says its versions: the arrows to swipe it to one. */
function hasVersions(row: HTMLElement): boolean {
  return [...row.querySelectorAll("button[aria-label]")].some((arrow) =>
    /^(Quieter|Livelier|Same energy): /.test(arrow.getAttribute("aria-label") ?? ""),
  );
}

/** What the plan showed, from a row's landing on, at every change of the page. */
interface PlanSeen {
  /** Each row's words as it landed, by its stop. */
  landed: Map<string, string>;
  /** Every set of words each row was drawn with, by its stop. */
  drawn: Map<string, Set<string>>;
  /** How far the stream had been delivered as the first row landed. */
  deliveredAtFirstRow: number | null;
  /** Each row that landed without its versions, by its stop. */
  bare: Set<string>;
  /** Each row whose versions came in, by its stop. */
  versioned: Set<string>;
  /** What the line under the plan said while the versions were written. */
  versionLines: string[];
}

function watchThePlan(): { seen: PlanSeen; stop: () => void } {
  const seen: PlanSeen = {
    landed: new Map(),
    drawn: new Map(),
    deliveredAtFirstRow: null,
    bare: new Set(),
    versioned: new Set(),
    versionLines: [],
  };
  const look = () => {
    for (const row of planRows()) {
      const id = row.getAttribute("data-stop") ?? "";
      const words = wordsOf(row);
      if (seen.landed.size === 0) seen.deliveredAtFirstRow = delivered.text.length;
      if (!seen.landed.has(id)) {
        seen.landed.set(id, words);
        if (!hasVersions(row)) seen.bare.add(id);
      }
      seen.drawn.set(id, new Set([...(seen.drawn.get(id) ?? []), words]));
      if (hasVersions(row)) seen.versioned.add(id);
    }
    for (const line of document.querySelectorAll("[data-under-chart] p")) {
      const text = line.textContent ?? "";
      if (text.startsWith("Writing quieter")) seen.versionLines.push(text);
    }
  };
  const observer = new MutationObserver(look);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  return {
    seen,
    stop: () => {
      look();
      observer.disconnect();
    },
  };
}

async function waitForTheDay(): Promise<void> {
  await waitFor(
    () =>
      expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    DAY_TIMEOUT,
  );
}

/** Plays Kanazawa's day to the end of its stream as `ending` says, watching its plan. */
async function play(until: () => Promise<void> = waitForTheDay): Promise<PlanSeen> {
  const watch = watchThePlan();
  try {
    render(<Day first={KANAZAWA_START_REQUEST} />);
    await until();
  } finally {
    watch.stop();
  }
  return watch.seen;
}

/** Waits for the stream to close and the page's step after it. */
async function untilTheStreamEnds(): Promise<void> {
  await waitFor(() => expect(delivered.isClosed).toBe(true), DAY_TIMEOUT);
  await act(() => new Promise((resolve) => setTimeout(resolve, SETTLED_MS)));
}

/** The plan of Kanazawa's day played whole, and each row's words at its end, by its stop. */
let whole: PlanSeen;
let finalWords: Map<string, string>;

describe("the plan under reduced motion", { timeout: PLAY_TEST_MS }, () => {
  beforeAll(async () => {
    const watch = watchThePlan();
    const view = render(<Day first={KANAZAWA_START_REQUEST} />);
    try {
      await waitForTheDay();
    } finally {
      watch.stop();
    }
    whole = watch.seen;
    finalWords = new Map(
      planRows().map((row) => [row.getAttribute("data-stop") ?? "", wordsOf(row)]),
    );
    view.unmount();
  }, PLAY_TEST_MS);

  it("lands a row while the stops are still written, before any of their versions", () => {
    expect(whole.deliveredAtFirstRow).not.toBeNull();
    expect(whole.deliveredAtFirstRow!).toBeLessThan(VERSIONS_AT);
    expect(whole.landed.size).toBe(STOPS.length);
  });

  it("never changes a landed row's words, and adds only its versions", () => {
    for (const [id, words] of whole.landed) {
      expect([...whole.drawn.get(id)!], id).toEqual([words]);
    }
    // Every stop of Kanazawa's day has versions, and each came in after its row had landed.
    expect([...whole.bare].sort()).toEqual([...whole.landed.keys()].sort());
    expect([...whole.versioned].sort()).toEqual([...whole.landed.keys()].sort());
  });

  it("counts the versions against the rows written, never against fewer", () => {
    expect(whole.versionLines.length).toBeGreaterThan(0);
    for (const line of whole.versionLines) {
      expect(line).toMatch(new RegExp(`of\\s${STOPS.length}\\sstops$`));
    }
  });

  const CUTS: readonly [string, StreamEnding][] = [
    [
      "cut by an error mid-way through a stop's line",
      { kind: "cut", at: midLineOf(5), by: "error" },
    ],
    [
      "cut on its length mid-way through a stop's line",
      { kind: "cut", at: midLineOf(6), by: "length" },
    ],
    ["dropped mid-way through a stop's line", { kind: "dropped", at: midLineOf(5) }],
    ["refused mid-way through a stop's line", { kind: "refused", at: midLineOf(6) }],
    ["cut inside the versions", { kind: "cut", at: VERSIONS_AT + 400, by: "timeout" }],
    ["dropped inside the versions", { kind: "dropped", at: VERSIONS_AT + 400 }],
  ];

  it.each(CUTS)(
    "shows only rows whose words are final when the stream is %s",
    async (_name, cut) => {
      ending = cut;
      const seen = await play(untilTheStreamEnds);

      // Rows landed while the stream was still written, each with the words the day comes to.
      expect(seen.landed.size).toBeGreaterThan(0);
      for (const [id, drawn] of seen.drawn) {
        expect([...drawn], id).toEqual([finalWords.get(id)]);
      }
    },
  );

  it.each<[string, StreamEnding]>([
    ["offline", { kind: "offline" }],
    ["rejected", { kind: "rejected" }],
    ["limited", { kind: "limited" }],
  ])("shows no row when the stream is %s before its first word", async (_name, nothing) => {
    ending = nothing;
    const seen = await play(async () => {
      await waitFor(
        () => expect(document.querySelector("header p.text-quote")).not.toBeNull(),
        DAY_TIMEOUT,
      );
    });

    expect(seen.landed.size).toBe(0);
  });

  it.each(["Plan", "Chart"] as const)(
    "shows the plan's rows as they stand after a switch to the chart and back, from the %s",
    async (from) => {
      const user = userEvent.setup();
      if (from === "Chart") document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, "chart");
      const views = () => screen.getByRole("group", { name: "View" });
      const watch = watchThePlan();
      try {
        render(<Day first={KANAZAWA_START_REQUEST} />);
        // Mid-way through the stops, before any of their versions.
        await waitFor(
          () => expect(delivered.text.length).toBeGreaterThan(midLineOf(4)),
          DAY_TIMEOUT,
        );
        if (from === "Plan") {
          await waitFor(() => expect(planRows().length).toBeGreaterThan(0), DAY_TIMEOUT);
          await user.click(within(views()).getByRole("button", { name: "Chart" }));
        }
        expect(delivered.text.length).toBeLessThan(VERSIONS_AT);
        await user.click(within(views()).getByRole("button", { name: "Plan" }));

        // Drawn again, the plan stands at once with the rows written so far, their versions
        // still to come, and lets in the rest as a plan that stayed on show does.
        const rows = planRows();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.some(hasVersions)).toBe(false);
        await waitFor(() => expect(planRows()).toHaveLength(STOPS.length), DAY_TIMEOUT);
      } finally {
        watch.stop();
      }
      for (const [id, drawn] of watch.seen.drawn) {
        expect([...drawn], id).toEqual([finalWords.get(id)]);
      }
    },
  );

  it("draws a day drawn whole with every row and its versions from its first frame", () => {
    const written = normalizeDay(KANAZAWA_START_REQUEST, KANAZAWA_START_DAY.day);
    if (!written.ok) throw new Error(written.reason);
    render(
      <DayStage
        request={KANAZAWA_START_REQUEST}
        partial={null}
        outcome={{ kind: "complete", itinerary: written.itinerary }}
        isStreaming={false}
        isChosen={false}
        isDrawnWhole
        onPlay={() => undefined}
        onRetry={() => undefined}
      />,
    );

    const rows = planRows();
    expect(rows).toHaveLength(STOPS.length);
    expect(rows.every(hasVersions)).toBe(true);
    expect(rows.map(wordsOf)).toEqual([...finalWords.values()]);
  });
});
