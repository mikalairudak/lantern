import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import {
  dayText,
  simulateDayStream,
  type StreamEnding,
  type StreamPace,
} from "@/lib/stream/simulate-day-stream";
import { Day } from "./day";
import { RESTING, UNFINISHED } from "./not-yet";
import { PEN_BEAT_MS } from "./use-pen";

/**
 * How a day leaves when its stream ends without one, with motion: the day this file plays
 * has no reduced motion, unlike `day.test.tsx`, so the chart's fade and the header's glide
 * run on Motion's frames.
 */

const ORIGIN = "http://lantern.test";
/** The fade, the glide and the pen, on jsdom's frames. */
const EXIT_TIMEOUT = { timeout: 5000 };
const CHART_WIDTH = 448;
const CHART_HEIGHT = 640;
/** Before the first stop: the chart is drawn, with no row on it yet. */
const BEFORE_THE_STOPS = 400;
/** Where Kyoto's stops begin in its text: past it, its line about the day is whole. */
const STOPS_BEGIN = dayText(KANAZAWA_START_DAY.day).indexOf('"stops":');
/** The first play as the route would answer it: quickly, in many small pieces. */
const BRISK: Partial<StreamPace> = { deltaChars: 64 };
/** Long after the beat a day played in place of one that ended waits for its date. */
const AFTER_THE_BEAT_MS = PEN_BEAT_MS * 4;

/**
 * A press made while the chart fades has to land inside the fade, and the product's fade
 * is over in a fifth of a second: on a machine busy with other runs, the hand's press took
 * longer and found the chart gone. A test that presses meanwhile sets this, which slows
 * the snappy spring for that test alone; the order of what happens is the product's.
 */
const fade = vi.hoisted(() => ({ seconds: null as number | null }));
vi.mock("@/lib/tokens/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tokens/motion")>();
  return {
    ...actual,
    SPRINGS: {
      ...actual.SPRINGS,
      get snappy() {
        return fade.seconds === null
          ? actual.SPRINGS.snappy
          : { ...actual.SPRINGS.snappy, visualDuration: fade.seconds };
      },
    },
  };
});
/** Long enough for a press on the busiest machine, short enough to end in `EXIT_TIMEOUT`. */
const SLOW_FADE_SECONDS = 1.5;

/** jsdom has no layout, so the chart's container reports a laptop-sized box. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CHART_WIDTH, height: CHART_HEIGHT } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

/** The visitor has no preference about motion. */
function noPreference(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

/** An error before the first stop, with the chart on screen. */
const CUT_BEFORE_THE_STOPS: StreamEnding = { kind: "cut", at: BEFORE_THE_STOPS, by: "error" };
/** An error halfway through the line about the day, before the header's room is known. */
const CUT_IN_THE_DEK: StreamEnding = { kind: "cut", at: 200, by: "error" };
/** At or under this, a box has gone to the eye: the day steps at 0.01. */
const FADED_OPACITY = 0.01;
/** Our own limit, answered at once. */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * The first play is cut before its first stop, with the chart on screen: once its line about
 * the day is whole its text waits for `firstHold`, as a stream that has fallen silent before
 * it ends, since the chart is drawn only once the header's room is known. Any play after it
 * is answered by the route, or with `laterStatus` when one is set.
 */
let isFirstPlay = true;
let firstEnding = CUT_BEFORE_THE_STOPS;
let firstHold: () => Promise<void> = untilTheChart;
let laterStatus: number | null = null;
async function answer(path: string, init: RequestInit): Promise<Response> {
  if (!isFirstPlay && laterStatus !== null) {
    return new Response(null, { status: laterStatus });
  }
  if (isFirstPlay) {
    isFirstPlay = false;
    const played = await simulateDayStream({
      day: KANAZAWA_START_DAY.day,
      ending: firstEnding,
      pace: BRISK,
      signal: init.signal ?? undefined,
    });
    return heldAfterText(played, firstHold(), STOPS_BEGIN);
  }
  return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
}

/** A stream's event that carries some of the day's text. */
const TEXT_EVENT = '"type":"text-delta"';

/** The day's text an event of the stream carries, if any. */
function textOf(event: string): string {
  if (!event.includes(TEXT_EVENT)) return "";
  const data = event.slice(event.indexOf("{"), event.lastIndexOf("}") + 1);
  return (JSON.parse(data) as { delta?: string }).delta ?? "";
}

/**
 * `response` with every event after its text has passed `from` characters held back until
 * `hold` resolves: the stream falls silent there, for as long as the page takes to show it.
 */
function heldAfterText(response: Response, hold: Promise<void>, from: number): Response {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      for (const event of decoder.decode(value, { stream: true }).split(/(?<=\n\n)/)) {
        if (sent > from) await hold;
        controller.enqueue(encoder.encode(event));
        sent += textOf(event).length;
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return new Response(body, { status: response.status, headers: response.headers });
}

/** Resolves once the page shows its waiting line, however long its pen and silence take. */
function untilTheWaitingLine(): Promise<void> {
  return untilShown(() => document.querySelector("[data-waiting]") !== null);
}

/** Resolves once the page shows its chart, however long the header's pen takes. */
function untilTheChart(): Promise<void> {
  return untilShown(() => chart() !== null);
}

/** Resolves once `isShown` holds of the page. */
function untilShown(isShown: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (isShown()) {
      resolve();
      return;
    }
    const watch = new MutationObserver(() => {
      if (!isShown()) return;
      watch.disconnect();
      resolve();
    });
    watch.observe(document.body, { subtree: true, childList: true, attributes: true });
  });
}

/** The opacity an element is drawn at, as every box round it composes it. */
function opacityOf(element: Element): number {
  let opacity = 1;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const own = node instanceof HTMLElement ? node.style.opacity : "";
    opacity *= own === "" ? 1 : Number(own);
  }
  return opacity;
}

function chart(): HTMLElement | null {
  return screen.queryByRole("group", { name: /The day's energy/ });
}

/** The facts line on screen, with the date, rather than its unseen copy. */
function seenFactsLine(): HTMLElement | null {
  const lines = [...document.querySelectorAll<HTMLElement>("header p.type-note")];
  return lines.find((line) => line.closest("[aria-hidden]") === null) ?? null;
}

/** Everything the page drew, noted at every change from now until `stop`. */
function watchThePage(note: () => void): { stop: () => void } {
  const watch = new MutationObserver(note);
  watch.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  note();
  return { stop: () => watch.disconnect() };
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", noPreference);
  vi.stubGlobal("fetch", vi.fn(answer));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = () => undefined;
});
// Each test plays its own first day: one that fails leaves nothing to the next.
beforeEach(() => {
  isFirstPlay = true;
  firstEnding = CUT_BEFORE_THE_STOPS;
  firstHold = untilTheChart;
  laterStatus = null;
});
afterEach(() => {
  fade.seconds = null;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a day that ends without one, with motion", () => {
  it("draws no chart for a day that ends before its header's room is known", async () => {
    firstEnding = CUT_IN_THE_DEK;
    let isChartSeen = false;
    const page = watchThePage(() => {
      if (chart() || document.querySelector("[data-exit]")) isChartSeen = true;
    });
    render(<Day first={KANAZAWA_START_REQUEST} />);

    // The header steps to its notice over nothing: no frame comes for a frame and fades.
    await waitFor(
      () => expect(document.querySelector("header p.text-quote")).toHaveTextContent(UNFINISHED),
      EXIT_TIMEOUT,
    );
    page.stop();
    expect(isChartSeen).toBe(false);
  });

  it("fades its chart while the header keeps its lines, then writes the notice in", async () => {
    render(<Day first={KANAZAWA_START_REQUEST} />);
    const leaving = await waitFor(() => {
      const fading = document.querySelector('[data-exit="fading"]');
      expect(fading).not.toBeNull();
      return fading;
    }, EXIT_TIMEOUT);

    // While it fades the chart is there, inert, and the header still says the day.
    expect(leaving).toContainElement(chart());
    expect(leaving).toHaveAttribute("inert");
    expect(screen.queryByRole("button", { name: "Write it again" })).not.toBeInTheDocument();
    expect(document.querySelector("header p.type-note")).toHaveTextContent(/^Sat 7 Nov/);

    // Once it has gone, the notice stands in the header's lines, written in by the pen, and
    // a screen reader is told its line once.
    await waitFor(() => expect(chart()).not.toBeInTheDocument(), EXIT_TIMEOUT);
    const line = `${UNFINISHED} Write it again, or open one it has written:`;
    const notice = document.querySelector<HTMLElement>("header p.text-quote");
    expect(notice).toHaveTextContent(line);
    expect(screen.getByRole("status")).toHaveTextContent(line);
    await waitFor(() => expect(notice?.querySelector(".opacity-0")).toBeNull(), EXIT_TIMEOUT);
  });

  it("keeps the waiting line of a day that ends in a silence, fading with the chart", async () => {
    // Cut only once the silence after its line about the day has shown the waiting line,
    // however long the header's pen and the silence take on a busy machine.
    firstHold = untilTheWaitingLine;
    render(<Day first={KANAZAWA_START_REQUEST} />);

    const leaving = await waitFor(() => {
      const fading = document.querySelector('[data-exit="fading"]');
      expect(fading).not.toBeNull();
      return fading;
    }, EXIT_TIMEOUT);

    // The stream ended in a silence, so the line stands where the next row would have
    // landed, and goes with the chart rather than in the frame the stream ended.
    expect(leaving?.querySelector("[data-waiting]")).not.toBeNull();
    expect(document.querySelector("header p.sr-only[role=status]")).toHaveTextContent(
      "Writing the day",
    );
    await waitFor(() => expect(chart()).not.toBeInTheDocument(), EXIT_TIMEOUT);
    expect(document.querySelector("[data-waiting]")).toBeNull();
  });

  it("fades the notice when it is written again, the focus on the retry until the next day takes it", async () => {
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} />);
    const retry = await screen.findByRole("button", { name: "Write it again" }, EXIT_TIMEOUT);
    const notice = document.querySelector<HTMLElement>("header p.text-quote");
    // Written whole, so the hand can reach it.
    await waitFor(() => expect(notice?.closest("[inert]")).toBeNull(), EXIT_TIMEOUT);
    const plays = vi.mocked(fetch).mock.calls.length;
    const focused: Element[] = [];
    const noteFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) focused.push(event.target);
    };

    // Pressed, then again while the notice fades, as only a script could: it is out of the
    // hand's reach.
    await user.click(retry);
    document.addEventListener("focusin", noteFocus);
    retry.click();

    // The press decides at once, and the notice fades as it stands, under the headline. The
    // focus stays on the retry, which fades with it: inert, it would drop the focus.
    expect(retry).toHaveFocus();
    expect(notice?.closest(".pointer-events-none")).not.toBeNull();
    expect(notice?.closest("[inert]")).toBeNull();
    await waitFor(() => expect(opacityOf(notice!)).toBeLessThan(1), EXIT_TIMEOUT);
    expect(notice).toBeInTheDocument();
    expect(retry).toHaveFocus();

    // Once it has gone, the day written again takes the focus to its city word, once.
    await waitFor(() => expect(notice).not.toBeInTheDocument(), EXIT_TIMEOUT);
    const city = within(screen.getByRole("heading", { level: 1 })).getByRole("button", {
      name: /^Kanazawa/,
    });
    expect(city).toHaveFocus();
    document.removeEventListener("focusin", noteFocus);
    expect(focused).toEqual([city]);
    // One day played for the two presses.
    expect(vi.mocked(fetch).mock.calls.length).toBe(plays + 1);
    expect(screen.queryByText(UNFINISHED, { exact: false })).not.toBeInTheDocument();
  });

  it("lets the chart's fade finish before a day chosen meanwhile, which takes its place", async () => {
    const user = userEvent.setup();
    fade.seconds = SLOW_FADE_SECONDS;
    render(<Day first={KANAZAWA_START_REQUEST} />);
    const headline = () => screen.getByRole("heading", { level: 1 });
    await user.click(within(headline()).getByRole("button", { name: /^Kanazawa/ }));
    const leaving = await waitFor(() => {
      const fading = document.querySelector<HTMLElement>('[data-exit="fading"]');
      expect(fading).not.toBeNull();
      return fading!;
    }, EXIT_TIMEOUT);
    const plays = vi.mocked(fetch).mock.calls.length;
    const bologna = screen.getByRole("button", { name: /^Bologna/ });
    await user.click(bologna);
    expect(bologna).toHaveFocus();
    const focused: Element[] = [];
    const noteFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) focused.push(event.target);
    };
    document.addEventListener("focusin", noteFocus);
    let lastOpacity = opacityOf(leaving);
    let hasNotice = false;
    const page = watchThePage(() => {
      if (leaving.isConnected) lastOpacity = opacityOf(leaving);
      if (document.querySelector("header p.text-quote")) hasNotice = true;
    });

    // The press waits: the chart goes on fading, the list it was chosen from stands, and
    // the focus stays on the row chosen.
    expect(vi.mocked(fetch).mock.calls.length).toBe(plays);
    expect(leaving).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Where" })).toBeInTheDocument();

    // Once the chart has gone to the eye, the day chosen takes its place, never the notice,
    // and its city word takes the focus, once.
    await waitFor(
      () => expect(headline()).toHaveTextContent(/^A lively Saturday in Bologna, with friends/),
      EXIT_TIMEOUT,
    );
    page.stop();
    document.removeEventListener("focusin", noteFocus);
    expect(leaving).not.toBeInTheDocument();
    expect(lastOpacity).toBeLessThanOrEqual(FADED_OPACITY);
    expect(hasNotice).toBe(false);
    const city = within(headline()).getByRole("button", { name: /^Bologna/ });
    expect(city).toHaveFocus();
    expect(focused).toEqual([city]);
    expect(vi.mocked(fetch).mock.calls.length).toBe(plays + 1);
  });

  it("never shows the date or axes of a day written again that ends within its first beat", async () => {
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} />);
    const retry = await screen.findByRole("button", { name: "Write it again" }, EXIT_TIMEOUT);
    const notice = document.querySelector<HTMLElement>("header p.text-quote");
    await waitFor(() => expect(notice?.closest("[inert]")).toBeNull(), EXIT_TIMEOUT);
    laterStatus = HTTP_TOO_MANY_REQUESTS;
    await user.click(retry);
    await waitFor(() => expect(notice).not.toBeInTheDocument(), EXIT_TIMEOUT);
    let isDayShown = false;
    const page = watchThePage(() => {
      if (seenFactsLine() || chart() || document.querySelector("[data-exit]")) isDayShown = true;
    });

    // Played in place of a day that ended without one, its date and axes wait a beat; it
    // ends sooner, so its notice is written in over nothing seen, and stays.
    await waitFor(
      () => expect(document.querySelector("header p.text-quote")).toHaveTextContent(RESTING),
      EXIT_TIMEOUT,
    );
    await new Promise((resolve) => window.setTimeout(resolve, AFTER_THE_BEAT_MS));
    page.stop();
    expect(document.querySelector("header p.text-quote")).toHaveTextContent(RESTING);
    expect(isDayShown).toBe(false);
  });
});
