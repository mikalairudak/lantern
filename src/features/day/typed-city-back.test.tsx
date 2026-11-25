import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { isWrittenRequest } from "@/lib/days/written/requests";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import { Day } from "./day";
import { writtenPool } from "./written-pool";
import { INDEX_LABEL } from "./start-index";
import { TAKE_THIS_DAY } from "./day-menu";
import { readYourDays } from "./your-days";
import type { StartReader, StartResult } from "./written-reader";

/**
 * Back to the start screen while the city word reads a city typed on it: the start screen is
 * what the visitor sees, so no day for that city is asked or played behind it.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
const POOL = writtenPool();
/** Longer than a reading's answer takes to play its day. */
const A_MOMENT_MS = 1300;

const LISBON: DayRequest = {
  ...KYOTO_REQUEST,
  city: "Lisbon",
  citySource: "chosen",
  timezone: "Europe/Lisbon",
  date: "2026-11-14",
  energy: "balanced",
  energySource: "chosen",
};
const SIGNED_LISBON = { city: "Lisbon", timezone: "Europe/Lisbon", signature: "lisbon-signed" };

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

/** Each day the route was asked for that Lantern has not written. */
const livePosts: DayRequest[] = [];

/**
 * The day route streams a written day from its file; any other it notes, and holds on its way
 * until stopped, as a live model before its first words.
 */
async function answerRoutes(path: string, init: RequestInit): Promise<Response> {
  if (path !== DAY_ROUTE) throw new Error(`Nothing answers ${path}`);
  const request = JSON.parse(String(init.body)) as DayRequest;
  if (isWrittenRequest(request)) {
    return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
  }
  livePosts.push(request);
  return new Promise<Response>((_, reject) =>
    init.signal?.addEventListener("abort", () =>
      reject(new DOMException("The day was stopped", "AbortError")),
    ),
  );
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", vi.fn(answerRoutes));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  livePosts.length = 0;
  window.history.replaceState(null, "", "/");
});
afterEach(() => window.history.replaceState(null, "", "/"));
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });
const cityWord = (city: string) =>
  within(screen.getByRole("list", { name: INDEX_LABEL })).getByRole("button", {
    name: new RegExp(`^${city} `),
  });

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

/** A reader whose answer lands when the test says so, and the signal of its last reading. */
function heldReader() {
  let answer: (result: StartResult) => void = () => undefined;
  let signal: AbortSignal | undefined;
  const read = vi.fn<StartReader>((_, given) => {
    signal = given;
    return new Promise<StartResult>((resolve) => (answer = resolve));
  });
  return { read, land: (result: StartResult) => answer(result), signal: () => signal };
}

/** Types a city on the day's city word, from the day's menu, as `day-live-start.test.tsx` does. */
async function typeCity(
  user: ReturnType<typeof userEvent.setup>,
  from: string,
  city: string,
): Promise<void> {
  await user.click(within(headline()).getByRole("button", { name: from }));
  await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
  await user.click(screen.getByRole("menuitem", { name: /New day/ }));
  await user.keyboard(`${city}{Enter}`);
}

/**
 * Madrid pressed on the start screen, written to its end, and "Lisbon" typed on its city word,
 * the reading under way: the reader's answer, held until landed, and its signal.
 */
async function readLisbonOnMadrid() {
  const user = userEvent.setup();
  const reader = heldReader();
  render(<Day start={{ pool: POOL, read: reader.read }} isLive isAddressed />);
  await user.click(cityWord("Madrid"));
  await waitFor(() => expect(window.location.pathname).toBe("/day/madrid"), DAY_TIMEOUT);
  await waitForTheDay();
  await typeCity(user, "Madrid", "Lisbon");
  await waitFor(() => expect(reader.read).toHaveBeenCalledWith("Lisbon", expect.any(AbortSignal)));
  const list = screen.getByRole("group", { name: "Where" });
  expect(within(list).getByRole("status")).toHaveTextContent("Reading");
  return { user, list, ...reader };
}

const LISBON_READ: StartResult = {
  kind: "request",
  request: LISBON,
  readings: [],
  unplaced: [],
  signed: [SIGNED_LISBON],
};

describe("Back to the start screen while the city word reads a typed city", () => {
  it("asks for no day of the typed city once Back has shown the start screen, the field focused", async () => {
    const { land, signal } = await readLisbonOnMadrid();
    expect(document.activeElement).toHaveAccessibleName("Somewhere else");

    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    // Which way the reading went at Back: stopped, or left to answer, and whether its list closed.
    const isStoppedAtBack = signal()?.aborted === true;
    const isListOpenAtBack = screen.queryByRole("group", { name: "Where", hidden: true }) !== null;
    land(LISBON_READ);
    await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));

    expect(headline()).toHaveTextContent(/^One day in a city/);
    expect({ isStoppedAtBack, isListOpenAtBack, livePosts }).toEqual({
      isStoppedAtBack: true,
      isListOpenAtBack: false,
      livePosts: [],
    });
    expect(readYourDays(window.localStorage)).toEqual([]);
  });

  it("asks for no day of the typed city once Back has shown the start screen, the list open with the focus nowhere", async () => {
    const { user, list, land, signal } = await readLisbonOnMadrid();
    // A press on the list's own blank space moves the focus nowhere and keeps the list open
    // (`city-word.tsx`), the reading still under way.
    await user.click(list);
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole("group", { name: "Where" })).toBe(list);
    expect(signal()?.aborted).toBe(false);

    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    const isStoppedAtBack = signal()?.aborted === true;
    const isListOpenAtBack = screen.queryByRole("group", { name: "Where", hidden: true }) !== null;
    land(LISBON_READ);
    await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));

    // The start screen is what the visitor still sees.
    expect(headline()).toHaveTextContent(/^One day in a city/);
    expect({ isStoppedAtBack, isListOpenAtBack, livePosts }).toEqual({
      isStoppedAtBack: true,
      isListOpenAtBack: false,
      livePosts: [],
    });
    expect(readYourDays(window.localStorage)).toEqual([]);
  });

  it("gives the city word back on Forward, its list closed, and reads a city typed again, the list open with the focus nowhere at Back", async () => {
    const { user, list, land, read } = await readLisbonOnMadrid();
    await user.click(list);
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

    act(() => window.history.forward());

    await waitFor(() => expect(headline()).toHaveTextContent(/Madrid/));
    const word = within(headline()).getByRole("button", { name: "Madrid" });
    expect(word).toHaveAttribute("aria-expanded", "false");
    await typeCity(user, "Madrid", "Lisbon");
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    land(LISBON_READ);
    await waitFor(() => expect(livePosts).toEqual([expect.objectContaining({ city: "Lisbon" })]));
  });

  it("reads a city typed again after Back and Forward, the reading stopped at Back by both the page and its list, the field focused", async () => {
    const { user, land, read, signal } = await readLisbonOnMadrid();
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    act(() => window.history.forward());
    await waitFor(() => expect(headline()).toHaveTextContent(/Madrid/));

    await typeCity(user, "Madrid", "Lisbon");
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));

    // The second reading is not stopped by anything left of the first.
    expect(signal()?.aborted).toBe(false);
    land(LISBON_READ);
    await waitFor(() => expect(livePosts).toEqual([expect.objectContaining({ city: "Lisbon" })]));
  });
});

describe("the start screen's own reading, as the browser shows the page again", () => {
  it("reads on and asks the day the text names", async () => {
    const user = userEvent.setup();
    const { read, land, signal } = heldReader();
    render(<Day start={{ pool: POOL, read }} isLive isAddressed />);
    await user.type(
      screen.getByRole("textbox", { name: "Where, and anything else" }),
      "Lisbon{Enter}",
    );
    await waitFor(() => expect(read).toHaveBeenCalledOnce());

    act(() => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    });

    expect(signal()?.aborted).toBe(false);
    land(LISBON_READ);
    await waitFor(() => expect(livePosts).toEqual([expect.objectContaining({ city: "Lisbon" })]));
  });
});
