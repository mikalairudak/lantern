import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { writtenDayAt } from "@/lib/days/written/days";
import { routeSourceFor } from "@/features/itinerary/day-route";
import type { DaySource } from "@/features/itinerary/use-day-stream";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { IntakeReader, IntakeResult } from "@/lib/schema/intake.schema";
import { Day, type WrittenGist } from "./day";
import { INDEX_LABEL } from "./start-index";
import { writtenPool } from "./written-pool";

/**
 * Forward to a day left behind the start screen, after a request asked there took the stream and
 * was then dropped: the day comes back whole, as the visitor left it, never empty and waiting.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
const LONG_TEST_MS = 20_000;
const POOL: readonly WrittenGist[] = writtenPool();

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

const fetchDay = vi.fn((path: string, init: RequestInit) =>
  answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 }),
);

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", fetchDay);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  fetchDay.mockClear();
  window.history.replaceState(null, "", "/");
});
afterEach(() => vi.useRealTimers());
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });
const dayList = () => screen.getByRole("list", { name: "The day" });
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

/** A route that answers only once released. */
function holdDay(): () => void {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  fetchDay.mockImplementationOnce(async (path, init) => {
    await released;
    return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
  });
  return release;
}

/** A source that takes the request and sends nothing until it is stopped. */
function silentSourceFor(request: DayRequest): DaySource {
  return {
    request,
    open: (signal) =>
      new Promise<Response>((_, reject) =>
        signal.addEventListener("abort", () =>
          reject(new DOMException("The day was stopped", "AbortError")),
        ),
      ),
  };
}

const PARIS_STOPS = writtenDayAt("paris")!.itinerary.stops.length;

/** How much of a day's text comes before it falls silent: its header and its first stops. */
const STILL_WRITTEN_AT = 1500;
/** A stream's event that carries some of the day's text. */
const TEXT_EVENT = '"type":"text-delta"';

/** The day's text an event of the stream carries, if any. */
function textOf(event: string): string {
  if (!event.includes(TEXT_EVENT)) return "";
  const data = event.slice(event.indexOf("{"), event.lastIndexOf("}") + 1);
  return (JSON.parse(data) as { delta?: string }).delta ?? "";
}

/**
 * `response` falling silent once its text has passed `from` characters, until the page stops
 * it: a day still being written for as long as the test runs.
 */
function silentAfterText(response: Response, from: number): Response {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const never = new Promise<void>(() => undefined);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      for (const event of decoder.decode(value, { stream: true }).split(/(?<=\n\n)/)) {
        if (sent > from) await never;
        controller.enqueue(encoder.encode(event));
        sent += textOf(event).length;
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return new Response(body, { status: response.status, headers: response.headers });
}

/** Paris pressed on the start screen and written to its end, then Back to the start screen. */
async function playParisThenBack(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(cityWord("Paris"));
  await waitFor(() => expect(window.location.pathname).toBe("/day/paris"));
  await waitForTheDay();
  act(() => window.history.back());
  await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
}

describe("Forward to the first day after a request on the start screen behind it", () => {
  it(
    "brings Paris back whole when the visitor tries to type a new text while a pressed city is on its way",
    async () => {
      const user = userEvent.setup();
      const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
      render(<Day start={{ pool: POOL, read }} isAddressed />);
      await playParisThenBack(user);
      holdDay();
      await user.click(cityWord("Rome"));
      await waitFor(() => expect(fetchDay).toHaveBeenCalledTimes(2));
      const field = screen.getByRole("textbox", { name: "Where, and anything else" });

      // The field is read-only while a day is on its way, so no reading drops that day.
      expect(field).toHaveAttribute("readonly");
      await user.type(field, "Lisbon{Enter}");
      expect(read).not.toHaveBeenCalled();

      act(() => window.history.forward());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
      expect(within(dayList()).getAllByRole("listitem")).toHaveLength(PARIS_STOPS);
      await waitForTheDay();
    },
    LONG_TEST_MS,
  );

  it(
    "brings Paris back whole once a new reading dropped the day asked behind it",
    async () => {
      // The field stays editable while a day is on its way only for a request Lantern has not
      // written with live generation off, whose line keeps reading (`ask`): Kyoto, from a source
      // that holds it pending, then dropped by a new reading.
      const readings: IntakeResult[] = [
        { kind: "request", request: KYOTO_REQUEST, readings: [], unplaced: [] },
        { kind: "unavailable" },
      ];
      const read = vi.fn<IntakeReader>(async () => readings.shift()!);
      const sourceFor = (request: DayRequest): DaySource =>
        request.city === KYOTO_REQUEST.city ? silentSourceFor(request) : routeSourceFor(request);
      const user = userEvent.setup();
      render(<Day start={{ pool: POOL, read }} sourceFor={sourceFor} isAddressed />);
      await playParisThenBack(user);
      const field = screen.getByRole("textbox", { name: "Where, and anything else" });
      await user.type(field, "Kyoto{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
      // Pending: the start screen still stands, and the field takes another text.
      expect(headline()).toHaveTextContent(/^One day in a city/);
      expect(field).not.toHaveAttribute("readonly");

      await user.clear(field);
      await user.type(field, "Somewhere{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2));

      act(() => window.history.forward());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
      // Long past any landing: Forward draws the day as it stands, whole.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      });
      expect(within(dayList()).queryAllByRole("listitem")).toHaveLength(PARIS_STOPS);
      expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
      );
    },
    LONG_TEST_MS,
  );

  it(
    "leaves the start screen ready for a text after Forward stops a reading under way and Back returns to it",
    async () => {
      const readings: Promise<IntakeResult>[] = [
        Promise.resolve({ kind: "request", request: KYOTO_REQUEST, readings: [], unplaced: [] }),
        new Promise<IntakeResult>(() => undefined),
      ];
      const read = vi.fn<IntakeReader>(() => readings.shift()!);
      const sourceFor = (request: DayRequest): DaySource =>
        request.city === KYOTO_REQUEST.city ? silentSourceFor(request) : routeSourceFor(request);
      const user = userEvent.setup();
      render(<Day start={{ pool: POOL, read }} sourceFor={sourceFor} isAddressed />);
      await playParisThenBack(user);
      const field = screen.getByRole("textbox", { name: "Where, and anything else" });
      await user.type(field, "Kyoto{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
      await user.clear(field);
      await user.type(field, "Somewhere{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(field).toHaveAttribute("readonly"));

      act(() => window.history.forward());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

      expect(screen.getByRole("textbox", { name: "Where, and anything else" })).not.toHaveAttribute(
        "readonly",
      );
    },
    LONG_TEST_MS,
  );

  it(
    "brings a day drawn whole from memory back on Forward as the visitor left it, its open stop included",
    async () => {
      const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
      const user = userEvent.setup();
      render(<Day start={{ pool: POOL, read }} isAddressed />);
      await user.click(cityWord("Paris"));
      await waitFor(() => expect(window.location.pathname).toBe("/day/paris"));
      await waitForTheDay();
      await user.click(within(headline()).getByRole("button", { name: "Paris" }));
      await user.click(screen.getByRole("button", { name: /^Bologna/ }));
      await waitFor(() => expect(window.location.pathname).toBe("/day/bologna"));
      await waitForTheDay();
      // Back to Paris, drawn whole from memory, and one of its stops opened.
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
      await waitForTheDay();
      const [first] = within(dayList()).getAllByRole("button");
      await user.click(first!);
      const opened = screen.getByRole("region", { name: /^About / }).getAttribute("aria-label");
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

      act(() => window.history.forward());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
      expect(screen.getByRole("region", { name: /^About / })).toHaveAttribute("aria-label", opened);
      expect(fetchDay).toHaveBeenCalledTimes(2);
    },
    LONG_TEST_MS,
  );
});

describe("Forward to a day left writing behind the start screen", () => {
  /** Paris in six deltas, a silence after each: the first takes the page among its stops. */
  const PARIS_PACE = { deltaChars: 3200, deltaDelayMs: 1200 };
  const PARIS_TIMEOUT = { timeout: 15_000 };

  it(
    "says the day is being written once back on the day, for a silence that fell unheard behind",
    async () => {
      fetchDay.mockImplementationOnce((path, init) =>
        answerDayRequest(new Request(new URL(path, ORIGIN), init), PARIS_PACE),
      );
      // How often the header's status came to say it where a screen reader hears it, and how
      // often the waiting line came behind the start screen.
      let heard = 0;
      let linesBehind = 0;
      const said = new Map<Element, string>();
      let isLineShown = false;
      const listen = () => {
        const line = document.querySelector("[data-waiting]");
        if (line && !isLineShown && line.closest("[aria-hidden=true]")) linesBehind += 1;
        isLineShown = line !== null;
        for (const status of document.querySelectorAll("header p[role=status]")) {
          const text = status.textContent ?? "";
          const isHeard = status.closest("[aria-hidden=true], [inert]") === null;
          if (isHeard && text === "Writing the day" && said.get(status) !== text) heard += 1;
          said.set(status, text);
        }
      };
      const observer = new MutationObserver(listen);
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      try {
        const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
        const user = userEvent.setup();
        render(<Day start={{ pool: POOL, read }} isAddressed />);
        await user.click(cityWord("Paris"));
        await waitFor(() => expect(window.location.pathname).toBe("/day/paris"));
        act(() => window.history.back());
        await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

        // Forward once the next words have come behind the start screen, a silence after the
        // first: every stop is in, and the silence after them has not yet fallen.
        const behind = screen.getByRole("list", { name: "The day", hidden: true });
        await waitFor(
          () =>
            expect(within(behind).getAllByRole("listitem", { hidden: true })).toHaveLength(
              PARIS_STOPS,
            ),
          PARIS_TIMEOUT,
        );
        expect(linesBehind).toBeGreaterThanOrEqual(1);
        expect(heard).toBe(0);
        act(() => window.history.forward());
        await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
        await waitFor(
          () =>
            expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
              "aria-busy",
              "false",
            ),
          PARIS_TIMEOUT,
        );
      } finally {
        listen();
        observer.disconnect();
      }

      expect(heard).toBe(1);
      expect(screen.queryByText("Writing the day")).not.toBeInTheDocument();
    },
    LONG_TEST_MS,
  );
});

describe("the focus on Forward", () => {
  it(
    "goes to the city word when Forward brings back the day behind the start screen while it is still written",
    async () => {
      // The day falls silent after its first stops, so it is still written when Forward brings
      // it back, however long the steps before take.
      fetchDay.mockImplementationOnce(async (path, init) =>
        silentAfterText(
          await answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 }),
          STILL_WRITTEN_AT,
        ),
      );
      const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
      const user = userEvent.setup();
      render(<Day start={{ pool: POOL, read }} isAddressed />);
      await user.click(cityWord("Paris"));
      await waitFor(() => expect(window.location.pathname).toBe("/day/paris"), DAY_TIMEOUT);
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

      act(() => window.history.forward());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
      // Still written: not every stop has come.
      expect(screen.queryAllByRole("listitem").length).toBeLessThan(PARIS_STOPS);
      expect(within(headline()).getByRole("button", { name: "Paris" })).toHaveFocus();
    },
    LONG_TEST_MS,
  );

  it(
    "goes to the city word when Forward brings back the day behind the start screen",
    async () => {
      const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
      const user = userEvent.setup();
      render(<Day start={{ pool: POOL, read }} isAddressed />);
      await playParisThenBack(user);
      expect(headline()).toHaveFocus();

      act(() => window.history.forward());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
      expect(within(headline()).getByRole("button", { name: "Paris" })).toHaveFocus();
    },
    LONG_TEST_MS,
  );
});
