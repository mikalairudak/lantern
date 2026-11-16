import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { writtenDayAt } from "@/lib/days/written/days";
import { BOLOGNA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import type { ProductEvent } from "@/lib/events/event.schema";
import { sendProductEvent } from "@/lib/events/send-event";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import type { DaySource } from "@/features/itinerary/use-day-stream";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { IntakeReader, IntakeResult } from "@/lib/schema/intake.schema";
import { Day, type WrittenGist } from "./day";
import { TAKE_THIS_DAY } from "./day-menu";
import { writtenPool } from "./written-pool";
import { INDEX_LABEL } from "./start-index";
import { readYourDays } from "./your-days";
import { YOUR_DAYS_HEADING } from "./your-days-list";

/**
 * One of the visitor's days pressed in "Your days" on the start screen, the day the page still
 * holds, while another day asked there is on its way or its text still read: the day pressed
 * stays on screen, and the one asked before gives way to it, as Forward makes it give way.
 */

vi.mock("@/lib/events/send-event", () => ({ sendProductEvent: vi.fn() }));

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
/** A test that streams two days and comes back through both. */
const LONG_TEST_MS = 20_000;
/** Longer than a day asked takes to turn the page once its words have come. */
const A_MOMENT_MS = 1300;
const POOL: readonly WrittenGist[] = writtenPool();
/** Rome's day as the log names it: the visitor's own, listed on the start screen. */
const ROME_ID = "0b6c6f1e-3d2a-4e8b-9a51-6f0c2d7e4a19";
/** Paris's day as the log names it, where its answer names one. */
const PARIS_ID = "5d7f9b1c-2e4a-4c6e-8a0b-3d5f7b9c1e2a";
const ROME_STOPS = writtenDayAt("rome")!.itinerary.stops.length;
const PARIS_LINE = "Opening a calm Sunday in Paris, slow morning, with a partner";

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

/** The day route; the log, asked how a day left while it was written ended, has nothing yet. */
const fetchDay = vi.fn((path: string, init: RequestInit) =>
  path.startsWith(`${DAY_ROUTE}/`)
    ? Promise.resolve(new Response(null, { status: 404 }))
    : answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 }),
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
  vi.mocked(sendProductEvent).mockClear();
  isParisNamed = false;
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });
const dayList = () => screen.getByRole("list", { name: "The day" });
const field = () => screen.getByRole("textbox", { name: "Where, and anything else" });
const cityWord = (city: string) =>
  within(screen.getByRole("list", { name: INDEX_LABEL })).getByRole("button", {
    name: new RegExp(`^${city} `),
  });
const saidBack = (sentence: string) => (_: string, element: Element | null) =>
  element?.tagName === "P" && element.textContent === sentence;
const saysBack = (sentence: string) => screen.findByText(saidBack(sentence));
const sentEvents = () => vi.mocked(sendProductEvent).mock.calls.map(([event]) => event);
const isAboutADay = (event: ProductEvent) =>
  event.kind === "day-opened" || event.kind === "day-left" || event.kind === "day-ended";

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

/** Rome's answer with its row in the log named, as a live day's is. */
function namedRome(answer: Response): Response {
  const headers = new Headers(answer.headers);
  headers.set(DAY_ID_HEADER, ROME_ID);
  return new Response(answer.body, { status: answer.status, headers });
}

/** The route's day; Rome's answer names its row in the log, as a live day's does. */
function namedSourceFor(request: DayRequest): DaySource {
  return {
    request,
    open: async (signal) => {
      if (request.city === "Paris" && isParisNamed) return namedSilentParis(signal);
      // A day Lantern has not written, with live generation off: nothing comes until it is let go.
      if (request.city === KYOTO_REQUEST.city) return new Promise<Response>(() => undefined);
      const answer = await fetchDay(DAY_ROUTE, {
        method: "POST",
        body: JSON.stringify(request),
        signal,
      });
      return request.city === "Rome" ? namedRome(answer) : answer;
    },
  };
}

/** Paris's answer names its row in the log, then nothing comes until the page lets it go. */
let isParisNamed = false;

function namedSilentParis(signal: AbortSignal): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal.addEventListener("abort", () => controller.error(signal.reason));
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream", [DAY_ID_HEADER]: PARIS_ID },
  });
}

/** A route that answers only once released, so the day asked stays on its way meanwhile. */
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

/**
 * A route whose next day streams its first half, then holds the rest until the gate opens, so
 * the day is still being written when the visitor leaves it.
 */
function holdDayHalfway(): () => void {
  let open = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  fetchDay.mockImplementationOnce(async (path, init) => {
    const whole = await answerDayRequest(new Request(new URL(path, ORIGIN), init), {
      deltaChars: 64,
    });
    const text = await whole.text();
    const half = text.indexOf("\n\n", text.length / 2) + 2;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(text.slice(0, half)));
        await gate;
        controller.enqueue(encoder.encode(text.slice(half)));
        controller.close();
      },
    });
    return new Response(body, { headers: whole.headers });
  });
  return open;
}

/** A reader whose answer lands when the test says so. */
function heldReader() {
  let answer: (result: IntakeResult) => void = () => undefined;
  const read = vi.fn<IntakeReader>(
    () => new Promise<IntakeResult>((resolve) => (answer = resolve)),
  );
  return { read, land: (result: IntakeResult) => answer(result) };
}

/** Plays another written day from the headline's city word. */
async function chooseCity(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  await user.click(within(headline()).getByRole("button", { name: from }));
  await user.click(screen.getByRole("button", { name: new RegExp(`^${to}`) }));
}

/** Rome's row in "Your days" on the start screen. */
async function romeInYourDays(): Promise<HTMLElement> {
  const yours = await screen.findByRole("list", { name: YOUR_DAYS_HEADING });
  return within(yours).getByRole("button", { name: /Rome/ });
}

/** The visitor's days this browser keeps, by id and how each ended. */
const keptDays = () => readYourDays(window.localStorage).map(({ id, ending }) => [id, ending]);

/**
 * Rome played and left for Bologna, then brought back from memory with its id, then Back to the
 * start screen behind it, where Paris is pressed and held on its way: the route's answer for
 * Paris, released when the test says so.
 */
async function parisOnItsWayOverRome(
  user: ReturnType<typeof userEvent.setup>,
  isCounted = false,
): Promise<() => void> {
  const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
  render(
    <Day
      start={{ pool: POOL, read }}
      sourceFor={namedSourceFor}
      isAddressed
      isCounted={isCounted}
    />,
  );
  await user.click(cityWord("Rome"));
  await waitFor(() => expect(window.location.pathname).toBe(`/day/${ROME_ID}`));
  await waitForTheDay();
  await chooseCity(user, "Rome", "Bologna");
  await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Saturday in Bologna/));
  await waitForTheDay();
  act(() => window.history.back());
  await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
  act(() => window.history.back());
  await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
  const release = isParisNamed ? () => undefined : holdDay();
  await user.click(cityWord("Paris"));
  await saysBack(PARIS_LINE);
  return release;
}

describe("a day opened from Your days while another is asked on the start screen", () => {
  it(
    "keeps the day opened from Your days when a text read before the press lands",
    async () => {
      const user = userEvent.setup();
      const { read, land } = heldReader();
      render(<Day start={{ pool: POOL, read }} sourceFor={namedSourceFor} isAddressed />);
      await user.click(cityWord("Rome"));
      await waitFor(() => expect(window.location.pathname).toBe(`/day/${ROME_ID}`));
      await waitForTheDay();
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      await user.type(field(), "Bologna{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledOnce());

      await user.click(await romeInYourDays());

      // The day pressed is the page's: the one it still holds, at its own address.
      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
      land({ kind: "request", request: BOLOGNA_START_REQUEST, readings: [], unplaced: [] });
      await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
      expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/);
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);

      // Back, the start screen reads nothing: its field keeps the text, ready to be asked again.
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      expect(field()).toHaveValue("Bologna");
      expect(field()).not.toHaveAttribute("readonly");
    },
    LONG_TEST_MS,
  );

  it(
    "keeps the day opened from Your days when a day asked before the press turns its page",
    async () => {
      const user = userEvent.setup();
      const release = await parisOnItsWayOverRome(user);

      await user.click(await romeInYourDays());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
      release();
      await waitFor(() => expect(fetchDay).toHaveBeenCalledTimes(3));
      await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
      expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/);
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
    },
    LONG_TEST_MS,
  );

  it(
    "keeps the day opened from Your days when the day asked before answers in the same moment as the press",
    async () => {
      const user = userEvent.setup();
      const release = await parisOnItsWayOverRome(user);
      const rome = await romeInYourDays();

      act(() => {
        release();
        fireEvent.click(rome);
      });

      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
      expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/);
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
      expect(within(dayList()).getAllByRole("listitem")).toHaveLength(ROME_STOPS);
    },
    LONG_TEST_MS,
  );

  it(
    "shows the start screen on Back with no day on its way, and the day opened on Forward",
    async () => {
      const user = userEvent.setup();
      await parisOnItsWayOverRome(user);
      await user.click(await romeInYourDays());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));

      act(() => window.history.back());

      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      // Paris was let go: the start screen no longer says it back, and its field takes a text.
      expect(screen.queryByText(saidBack(PARIS_LINE))).not.toBeInTheDocument();
      expect(field()).not.toHaveAttribute("readonly");

      act(() => window.history.forward());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
      expect(within(dayList()).getAllByRole("listitem")).toHaveLength(ROME_STOPS);
    },
    LONG_TEST_MS,
  );

  it(
    "tells the day let go as left, once, and what the visitor does next as done on the day pressed",
    async () => {
      const user = userEvent.setup();
      await parisOnItsWayOverRome(user, true);
      const before = sentEvents().length;

      await user.click(await romeInYourDays());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));

      const since = sentEvents().slice(before);
      expect(since.filter(isAboutADay)).toEqual([
        {
          kind: "day-left",
          city: "paris",
          via: "pressed",
          written: true,
          stage: "before-first-stop",
        },
      ]);
      expect(since.filter((event) => event.kind === "menu-opened")).toEqual([
        expect.objectContaining({ kind: "menu-opened", city: "rome" }),
      ]);
    },
    LONG_TEST_MS,
  );

  it(
    "keeps the row of a live day let go once its answer named it, listed on the start screen on Back",
    async () => {
      isParisNamed = true;
      const user = userEvent.setup();
      await parisOnItsWayOverRome(user);
      await waitFor(() => expect(keptDays()).toContainEqual([PARIS_ID, "writing"]));

      await user.click(await romeInYourDays());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));

      // Let go, it is still written to its end on the server: its row stays the way back to it.
      expect(keptDays()).toEqual([
        [PARIS_ID, "writing"],
        [ROME_ID, "written"],
      ]);
      act(() => window.history.back());
      const yours = await screen.findByRole("list", { name: YOUR_DAYS_HEADING });
      expect(within(yours).getAllByRole("button", { name: /Paris|Rome/ })).toHaveLength(2);
    },
    LONG_TEST_MS,
  );
});

describe("a day opened from Your days after a day asked on the start screen was dropped there", () => {
  it(
    "tells what the visitor does next as done on the day pressed, not on the day dropped",
    async () => {
      const user = userEvent.setup();
      const readings: IntakeResult[] = [
        { kind: "request", request: KYOTO_REQUEST, readings: [], unplaced: [] },
        { kind: "unavailable" },
      ];
      const read = vi.fn<IntakeReader>(async () => readings.shift()!);
      render(<Day start={{ pool: POOL, read }} sourceFor={namedSourceFor} isAddressed isCounted />);
      await user.click(cityWord("Rome"));
      await waitFor(() => expect(window.location.pathname).toBe(`/day/${ROME_ID}`));
      await waitForTheDay();
      await chooseCity(user, "Rome", "Bologna");
      await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Saturday in Bologna/));
      await waitForTheDay();
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      // Kyoto is asked and on its way, then dropped by a new text, which reads as nothing.
      await user.type(field(), "Kyoto{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
      await user.clear(field());
      await user.type(field(), "Somewhere{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
      const before = sentEvents().length;

      await user.click(await romeInYourDays());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));

      const since = sentEvents().slice(before);
      expect(since.filter(isAboutADay)).toEqual([]);
      expect(since.filter((event) => event.kind === "menu-opened")).toEqual([
        expect.objectContaining({ kind: "menu-opened", city: "rome" }),
      ]);
    },
    LONG_TEST_MS,
  );
});

describe("a day opened from Your days with nothing asked on the start screen", () => {
  it(
    "brings back the day as it stands, asking the route for nothing and telling nothing",
    async () => {
      const user = userEvent.setup();
      const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
      render(<Day start={{ pool: POOL, read }} sourceFor={namedSourceFor} isAddressed isCounted />);
      await user.click(cityWord("Rome"));
      await waitFor(() => expect(window.location.pathname).toBe(`/day/${ROME_ID}`));
      await waitForTheDay();
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      const events = sentEvents().length;

      await user.click(await romeInYourDays());

      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
      expect(within(dayList()).getAllByRole("listitem")).toHaveLength(ROME_STOPS);
      expect(fetchDay).toHaveBeenCalledOnce();
      expect(sentEvents().slice(events).filter(isAboutADay)).toEqual([]);
    },
    LONG_TEST_MS,
  );

  it(
    "lets the day opened write on to its end when a text read before the press is dropped",
    async () => {
      const user = userEvent.setup();
      const { read, land } = heldReader();
      const openGate = holdDayHalfway();
      render(<Day start={{ pool: POOL, read }} sourceFor={namedSourceFor} isAddressed />);
      await user.click(cityWord("Rome"));
      await waitFor(() => expect(window.location.pathname).toBe(`/day/${ROME_ID}`), DAY_TIMEOUT);
      // Still being written as the visitor goes Back.
      await waitFor(
        () =>
          expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
            "aria-busy",
            "true",
          ),
        DAY_TIMEOUT,
      );
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      await user.type(field(), "Bologna{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledOnce());

      await user.click(await romeInYourDays());
      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      act(() => openGate());

      await waitForTheDay();
      expect(within(dayList()).getAllByRole("listitem")).toHaveLength(ROME_STOPS);
      land({ kind: "request", request: BOLOGNA_START_REQUEST, readings: [], unplaced: [] });
      await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
      expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/);
      expect(fetchDay).toHaveBeenCalledOnce();
    },
    LONG_TEST_MS,
  );
});

/** The test environment's jsdom, whose console hears what jsdom cannot do. */
interface JsdomWithConsole {
  virtualConsole: {
    on: (event: "jsdomError", listener: (error: Error) => void) => void;
    off: (event: "jsdomError", listener: (error: Error) => void) => void;
  };
}

/**
 * Frames held back until the test runs them, so it can tell what lands in a frame from what the
 * visitor does before the page draws it.
 */
function holdFrames(): { runFrame: () => void; restore: () => void } {
  const queued = new Map<number, FrameRequestCallback>();
  let next = 0;
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    next += 1;
    queued.set(next, callback);
    return next;
  });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
    queued.delete(handle);
  });
  return {
    runFrame: () => {
      const now = [...queued.values()];
      queued.clear();
      for (const callback of now) callback(performance.now());
    },
    restore: () => {
      request.mockRestore();
      cancel.mockRestore();
    },
  };
}

describe("a day opened from Your days in the moment the start screen's own answer lands", () => {
  it(
    "keeps the day pressed when the frame that gives the page to the day asked has run and is not yet drawn",
    async () => {
      const user = userEvent.setup();
      const release = await parisOnItsWayOverRome(user);
      const rome = await romeInYourDays();
      const frames = holdFrames();
      try {
        await act(async () => {
          release();
          await new Promise((resolve) => setTimeout(resolve, 300));
        });
        // Paris's words have come: the next frame gives it the page.
        act(() => frames.runFrame());
        expect(headline()).toHaveTextContent(/^One day in a city/);

        act(() => {
          frames.runFrame();
          fireEvent.click(rome);
        });
      } finally {
        frames.restore();
      }

      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
      expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/);
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
      expect(within(dayList()).getAllByRole("listitem")).toHaveLength(ROME_STOPS);
    },
    LONG_TEST_MS,
  );

  it(
    "keeps the day pressed when a text read before the press has just asked its day, not yet drawn",
    async () => {
      const user = userEvent.setup();
      const { read, land } = heldReader();
      render(<Day start={{ pool: POOL, read }} sourceFor={namedSourceFor} isAddressed />);
      await user.click(cityWord("Rome"));
      await waitFor(() => expect(window.location.pathname).toBe(`/day/${ROME_ID}`));
      await waitForTheDay();
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      await user.type(field(), "Bologna{Enter}");
      await waitFor(() => expect(read).toHaveBeenCalledOnce());
      const rome = await romeInYourDays();

      await act(async () => {
        land({ kind: "request", request: BOLOGNA_START_REQUEST, readings: [], unplaced: [] });
        for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
        fireEvent.click(rome);
      });

      await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
      await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
      expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/);
      expect(window.location.pathname).toBe(`/day/${ROME_ID}`);
      act(() => window.history.back());
      await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
      expect(field()).not.toHaveAttribute("readonly");
    },
    LONG_TEST_MS,
  );
});

describe("a day opened from Your days that the page no longer holds", () => {
  it(
    "loads the day's own address when a day asked on the start screen cut it off mid-stream",
    async () => {
      // jsdom loads no other address: it tells its console a navigation was asked of it, and stays.
      const navigations: string[] = [];
      const noteNavigation = (error: Error) => {
        if (error.message.startsWith("Not implemented: navigation"))
          navigations.push(error.message);
      };
      const { virtualConsole } = (globalThis as unknown as { jsdom: JsdomWithConsole }).jsdom;
      virtualConsole.on("jsdomError", noteNavigation);
      try {
        const user = userEvent.setup();
        const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
        holdDayHalfway();
        render(<Day start={{ pool: POOL, read }} sourceFor={namedSourceFor} isAddressed />);
        await user.click(cityWord("Rome"));
        await waitFor(() => expect(window.location.pathname).toBe(`/day/${ROME_ID}`), DAY_TIMEOUT);
        act(() => window.history.back());
        await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
        // Paris's post is held; the log, asked how Rome ended once Paris takes the stream, answers.
        const routeDay = fetchDay.getMockImplementation()!;
        fetchDay.mockImplementation((path, init) =>
          path === DAY_ROUTE ? new Promise<Response>(() => undefined) : routeDay(path, init),
        );
        onTestFinished(() => {
          fetchDay.mockImplementation(routeDay);
        });
        await user.click(cityWord("Paris"));
        await saysBack(PARIS_LINE);

        await user.click(await romeInYourDays());

        expect(navigations).toHaveLength(1);
        expect(window.location.pathname).toBe("/");
        // Nothing is drawn in the address's place meanwhile: the day asked is let go with the page.
        expect(headline()).toHaveTextContent(/^One day in a city/);
      } finally {
        virtualConsole.off("jsdomError", noteNavigation);
      }
    },
    LONG_TEST_MS,
  );
});
