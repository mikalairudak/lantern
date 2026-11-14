import { act, render, screen, waitFor, within } from "@testing-library/react";
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
import { PORTLAND_MAINE, PORTLAND_OREGON, SAINT_PETERSBURGS } from "@/lib/fixtures/city-readings";
import { BOLOGNA_START_DAY } from "@/lib/days/written/bologna";
import { BOLOGNA_START_REQUEST, KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { Day, START_WORDS_CAP_MS, type WrittenGist } from "./day";
import { StartDay } from "./start-day";
import { writtenDayAt } from "@/lib/days/written/days";
import { writtenPool } from "./written-pool";
import { INDEX_LABEL } from "./start-index";
import { keepYourDay, readYourDays } from "./your-days";
import { shownEnergiesOf } from "./day-shape";
import { FORGET_YOUR_DAYS, YOUR_DAYS_HEADING } from "./your-days-list";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import type { DaySource } from "@/features/itinerary/use-day-stream";
import { ENERGY_LEVELS, type DayRequest, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import type { IntakeReader, IntakeResult, IntakeWords } from "@/lib/schema/intake.schema";
import { TAKE_THIS_DAY } from "./day-menu";

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
/** A test that streams a day and then plays two more. */
const LONG_TEST_MS = 20_000;
/** Longer than the moment the start screen once held a day for, which it no longer turns at. */
const A_MOMENT_MS = 1300;
const CHART_WIDTH = 448;
const CHART_HEIGHT = 640;

/** The written days as a page hands them over: normalized, ready to draw. */
const POOL: readonly WrittenGist[] = writtenPool();

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
beforeEach(() => fetchDay.mockClear());
afterEach(() => vi.useRealTimers());
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });

/** The zone the visitor's browser says it is in, for this test alone. */
function inTheVisitorsZone(timeZone: string): void {
  const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolvedOptions.call(this), timeZone };
  });
  onTestFinished(() => vi.mocked(Intl.DateTimeFormat.prototype.resolvedOptions).mockRestore());
}
const dayList = () => screen.getByRole("list", { name: "The day" });

/** The facts line on screen, before its unseen copy under the header. */
function factsLine(): HTMLElement {
  const line = document.querySelector<HTMLElement>("header p.type-note");
  if (!line) throw new Error("No facts line");
  return line;
}

const NO_WORDS: IntakeWords = {
  date: null,
  energy: "balanced",
  energySource: "assumed",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

function renderStart(
  reading: IntakeResult = { kind: "unavailable" },
  sourceFor?: (request: DayRequest) => DaySource,
) {
  const user = userEvent.setup();
  const read = vi.fn<IntakeReader>(async () => reading);
  render(<Day start={{ pool: POOL, read }} {...(sourceFor && { sourceFor })} />);
  return { user, read };
}

/** A route that takes the request and sends nothing back, as a model before its first words. */
const stallDay = () => fetchDay.mockImplementationOnce(() => new Promise<Response>(() => {}));
/**
 * A route that answers only once released, so the line saying a day back stays until the
 * test has read it, as the start screen waits for the day's words (`START_WORDS_CAP_MS`).
 * A route that answers at once
 * can stream the header whole, and so take the line away, in the timer that user-event or
 * Testing Library waits after a click or a find, which a loaded machine runs late.
 */
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
/** Characters of the line about the day a stalled route sends before it falls silent. */
const LINE_BEGUN_CHARS = 12;

/**
 * A route that sends the day as far as the first words of its line about the day and then
 * nothing more, as a model whose line is slow to come: Lantern's words for the headline are
 * whole, the line about the day is not.
 */
function stallInTheLine(): void {
  fetchDay.mockImplementationOnce(async (path, init) => {
    const whole = await answerDayRequest(new Request(new URL(path, ORIGIN), init), {
      deltaChars: 8,
    });
    const events = (await whole.text()).split("\n\n").filter((event) => event !== "");
    const sent: string[] = [];
    let text = "";
    for (const event of events) {
      sent.push(event);
      const data = event.startsWith("data: ") ? event.slice("data: ".length) : "";
      if (data === "" || data === "[DONE]") continue;
      const parsed = JSON.parse(data) as { type?: string; delta?: string };
      if (parsed.type === "text-delta") text += parsed.delta ?? "";
      const begun = text.indexOf('"dek":"');
      if (begun !== -1 && text.length - begun - '"dek":"'.length >= LINE_BEGUN_CHARS) break;
    }
    const body = new ReadableStream<Uint8Array>({
      start: (controller) =>
        controller.enqueue(new TextEncoder().encode(`${sent.join("\n\n")}\n\n`)),
    });
    return new Response(body, { status: whole.status, headers: whole.headers });
  });
}
/** The line under the field, with live generation off, for a text that asks for no written day. */
const NOT_YET_LINE = "Lantern isn't writing new days right now. Start from one of the days below.";
/** The line under the field, saying a day back as it is on its way. */
const saysBack = (sentence: string) =>
  screen.findByText((_, element) => element?.tagName === "P" && element.textContent === sentence);

/** A day in the start screen's index, by the city its day is written in, which its cell names. */
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

describe("the day under its start screen", () => {
  it("lands on the question and the index, with no day and no stream", async () => {
    renderStart();

    expect(headline()).toHaveTextContent(/^One day in a city/);
    expect(cityWord("Paris")).toHaveAccessibleName("Paris Calm Sunday slow morning");
    expect(cityWord("Tokyo")).toHaveAccessibleName("Tokyo Lively Saturday early start");
    // Nothing of a day is drawn, or asked for, until the visitor asks.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole("list", { name: "The day" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /The day's energy/ })).not.toBeInTheDocument();
    expect(fetchDay).not.toHaveBeenCalled();
  });

  it("writes a city's day where the question was when its word is pressed, its city word focused", async () => {
    const { user } = renderStart();

    await user.click(cityWord("Rome"));

    await waitFor(() =>
      expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome, on foot/),
    );
    expect(fetchDay).toHaveBeenCalledOnce();
    expect(within(headline()).getByRole("button", { name: /^Rome/ })).toHaveFocus();
    await waitForTheDay();
    expect(
      within(dayList()).getByRole("button", { name: /^Cornetti on Via Leonina/ }),
    ).toBeInTheDocument();
  });

  it("asks a city pressed on the date its day is shown on, not the date it was written for", async () => {
    // Wednesday 18 November in Rome: its Saturday is the 21st, a week after the one written for.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T09:00:00Z"));
    try {
      const { user } = renderStart();

      await user.click(cityWord("Rome"));

      await waitFor(() => expect(fetchDay).toHaveBeenCalledOnce());
      const [, init] = fetchDay.mock.calls[0]!;
      expect(JSON.parse(String(init.body))).toMatchObject({ city: "Rome", date: "2026-11-21" });
      await waitFor(() => expect(factsLine()).toHaveTextContent(/^Sat 21 Nov/));
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes the day a text asked for, and says back what it could not plan around", async () => {
    const { user, read } = renderStart({
      kind: "request",
      request: BOLOGNA_START_REQUEST,
      readings: [],
      unplaced: ["with my dog"],
    });

    await user.type(screen.getByRole("textbox"), "Bologna, with my dog{Enter}");

    expect(read).toHaveBeenCalledWith("Bologna, with my dog", expect.any(AbortSignal));
    await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Saturday in Bologna/));
    expect(screen.getAllByText("Lantern can't plan around “with my dog”.")[0]).toBeVisible();
    await waitForTheDay();
    expect(within(dayList()).getByText("Coffee along Via Drapperie")).toBeInTheDocument();
  });

  it("says the visitor's day back while it is on its way, then gives it the page", async () => {
    const release = holdDay();
    const { user } = renderStart({
      kind: "request",
      request: BOLOGNA_START_REQUEST,
      readings: [],
      unplaced: [],
    });

    await user.type(screen.getByRole("textbox"), "Bologna{Enter}");

    expect(await saysBack("Opening a lively Saturday in Bologna, with friends")).toBeVisible();
    expect(screen.getByRole("button", { name: "Opening" })).toBeInTheDocument();
    // The question keeps the visitor's words, and the written cities stay, while it is on its way.
    expect(screen.getByRole("textbox")).toHaveValue("Bologna");
    expect(cityWord("Paris")).toBeVisible();
    // The page turns once the day's own words have come.
    release();
    await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Saturday in Bologna/), {
      timeout: 3000,
    });
  });

  it("says a pressed city back while it is on its way, keeping what the field holds", async () => {
    const release = holdDay();
    const { user } = renderStart();
    await user.type(screen.getByRole("textbox"), "somewhere quiet");

    await user.click(cityWord("Paris"));

    expect(
      await saysBack("Opening a calm Sunday in Paris, slow morning, with a partner"),
    ).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("somewhere quiet");
    expect(screen.queryByRole("list", { name: "The day" })).not.toBeInTheDocument();
    release();
    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/), {
      timeout: 3000,
    });
  });

  it("writes the city pressed last when another is pressed while the first is on its way", async () => {
    stallDay();
    const releaseRome = holdDay();
    const { user } = renderStart();
    await user.click(cityWord("Tokyo"));
    await saysBack("Opening a lively Saturday in Tokyo, early start, alone");

    await user.click(cityWord("Rome"));
    await saysBack("Opening a balanced Saturday in Rome, eating late, with family");

    releaseRome();
    await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
    await waitForTheDay();
    expect(
      within(dayList()).getByRole("button", { name: /^Cornetti on Via Leonina/ }),
    ).toBeInTheDocument();
    expect(fetchDay).toHaveBeenCalledTimes(2);
  });

  it("asks a city pressed again while it is on its way only once", async () => {
    const release = holdDay();
    const { user } = renderStart();

    await user.click(cityWord("Tokyo"));
    await saysBack("Opening a lively Saturday in Tokyo, early start, alone");
    await user.click(cityWord("Tokyo"));
    release();

    await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Saturday in Tokyo/), {
      timeout: 3000,
    });
    expect(fetchDay).toHaveBeenCalledOnce();
  });

  it("writes a written day a text asks for from the route, as a city pressed does", async () => {
    const { user } = renderStart({
      kind: "request",
      request: KANAZAWA_START_REQUEST,
      readings: [],
      unplaced: [],
    });

    await user.type(screen.getByRole("textbox"), "Kanazawa{Enter}");

    await waitFor(() =>
      expect(headline()).toHaveTextContent(/^A calm Saturday in Kanazawa, on foot/),
    );
    expect(fetchDay).toHaveBeenCalledOnce();
  });

  it("asks for the city with no weekday, then writes the city's own today", async () => {
    // Half past three on Saturday afternoon UTC: still Saturday in most zones, already
    // Sunday in Tokyo, where this visitor is: their zone stands in for a city Lantern does
    // not know yet.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T15:30:00Z"));
    inTheVisitorsZone("Asia/Tokyo");
    const { user, read } = renderStart({
      kind: "question",
      key: "city",
      readings: [],
      words: { ...NO_WORDS, company: "family" },
      unplaced: [],
    });

    await user.type(screen.getByRole("textbox"), "a day with my kids{Enter}");
    const city = await screen.findByRole("textbox", { name: "Which city?" });
    // Until the city gives the day its zone, the question cannot know which day it is.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" && element.textContent === "A balanced day in …?, with family",
      ),
    ).toBeInTheDocument();
    await user.type(city, "Lisbon{Enter}");

    // Lantern has not written Lisbon, so the line never says the day is on its way, nor does
    // the button, whose unshown words share its cell hidden.
    expect(screen.queryByText(/^Opening/, { ignore: "[aria-hidden]" })).not.toBeInTheDocument();
    expect(read).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(headline()).toHaveTextContent(/^A balanced Sunday in Lisbon, with family$/),
    );
    // On screen, under the headline, and not only to a screen reader.
    expect(
      await screen.findByText(/Lantern isn't writing new days right now/, {
        selector: "p:not(.sr-only)",
      }),
    ).toBeInTheDocument();
  });

  it(
    "dots a city Lantern assumed, and offers the others its name could mean",
    async () => {
      const { user } = renderStart(
        {
          kind: "request",
          request: {
            ...BOLOGNA_START_REQUEST,
            city: "Portland",
            citySource: "assumed",
            timezone: PORTLAND_OREGON.timezone,
          },
          readings: [PORTLAND_OREGON, PORTLAND_MAINE],
          unplaced: [],
        },
        // With live generation on the route writes Portland's day; Bologna's stands in for it here,
        // under the Portland request's own words.
        (request) => ({
          request,
          open: (signal) =>
            answerDayRequest(
              new Request(new URL(DAY_ROUTE, ORIGIN), {
                method: "POST",
                body: JSON.stringify(BOLOGNA_START_REQUEST),
                signal,
              }),
              { deltaChars: 64 },
            ),
        }),
      );
      const city = () => within(headline()).getByRole("button", { name: "Portland" });
      const where = () => screen.getByRole("group", { name: "Where" });

      await user.type(screen.getByRole("textbox"), "portland, with friends{Enter}");
      await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Saturday in Portland/));
      // Lantern's, as its other assumptions are, and its key says so.
      expect(city()).toHaveClass("decoration-dotted");
      expect((await screen.findAllByText("assumed", undefined, DAY_TIMEOUT))[0]).toBeVisible();

      await user.click(city());
      expect(within(where()).getByRole("button", { name: /Oregon.*this day/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
      await user.click(within(where()).getByRole("button", { name: /Maine/ }));

      // The other one is the visitor's: no dots, and the list keeps both, this one marked.
      await waitFor(() => expect(city()).not.toHaveClass("decoration-dotted"));
      await user.click(city());
      expect(within(where()).getByRole("button", { name: /Maine.*this day/ })).toHaveAttribute(
        "aria-current",
        "true",
      );

      // A written day is a city of its own: the name's others go.
      await user.click(within(where()).getByRole("button", { name: /^Kanazawa/ }));
      await waitFor(() => expect(headline()).toHaveTextContent(/in Kanazawa/));
      await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
      expect(within(where()).queryByRole("button", { name: /^Portland/ })).not.toBeInTheDocument();
    },
    LONG_TEST_MS,
  );

  it(
    "moves a day planned for today to today in the other city of the name, never yesterday",
    async () => {
      // Evening in Florida, and already the next morning in Russia.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-13T23:30:00Z"));
      const [russia, florida] = SAINT_PETERSBURGS;
      if (!russia || !florida) throw new Error("Two Saint Petersburgs expected");
      const { user } = renderStart(
        {
          kind: "request",
          request: {
            ...BOLOGNA_START_REQUEST,
            city: "Saint Petersburg",
            citySource: "assumed",
            timezone: florida.timezone,
            date: "2026-11-13",
          },
          readings: [florida, russia],
          unplaced: [],
        },
        (request) => ({
          request,
          open: (signal) =>
            answerDayRequest(
              new Request(new URL(DAY_ROUTE, ORIGIN), {
                method: "POST",
                body: JSON.stringify(BOLOGNA_START_REQUEST),
                signal,
              }),
              { deltaChars: 64 },
            ),
        }),
      );
      const city = () => within(headline()).getByRole("button", { name: "Saint Petersburg" });
      const where = () => screen.getByRole("group", { name: "Where" });

      await user.type(screen.getByRole("textbox"), "saint petersburg, with friends{Enter}");
      await waitFor(() =>
        expect(headline()).toHaveTextContent(/^A lively Friday in Saint Petersburg/),
      );
      await user.click(city());
      await user.click(within(where()).getByRole("button", { name: /Russia/ }));

      await waitFor(() =>
        expect(headline()).toHaveTextContent(/^A lively Saturday in Saint Petersburg/),
      );
    },
    LONG_TEST_MS,
  );

  it("writes a city pressed in answer to the question as Lantern wrote it, keeping what was typed", async () => {
    stallDay();
    const { user } = renderStart({
      kind: "question",
      key: "city",
      readings: [],
      words: { ...NO_WORDS, company: "family" },
      unplaced: [],
    });

    await user.type(screen.getByRole("textbox"), "a day with my kids{Enter}");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Lis");
    await user.click(cityWord("Tokyo"));

    // The written day as it was written, not the words read: it is a day Lantern knows.
    expect(await saysBack("Opening a lively Saturday in Tokyo, early start, alone")).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("Lis");
  });

  /** A reader whose answer lands when the test says so. */
  function heldReader() {
    let answer: (result: IntakeResult) => void = () => undefined;
    const read = vi.fn<IntakeReader>(
      () => new Promise<IntakeResult>((resolve) => (answer = resolve)),
    );
    return { read, land: (result: IntakeResult) => answer(result) };
  }

  it("writes a city pressed while a text is read, and drops the reading", async () => {
    const user = userEvent.setup();
    const { read, land } = heldReader();
    render(<Day start={{ pool: POOL, read }} />);

    await user.type(screen.getByRole("textbox"), "Bologna{Enter}");
    await user.click(cityWord("Paris"));
    land({ kind: "request", request: BOLOGNA_START_REQUEST, readings: [], unplaced: [] });

    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
    await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
    expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/);
    expect(fetchDay).toHaveBeenCalledOnce();
  });

  it("answers a reader that fails as one that cannot read", async () => {
    const user = userEvent.setup();
    const read = vi.fn<IntakeReader>(async () => {
      throw new Error("The intake did not answer");
    });
    render(<Day start={{ pool: POOL, read }} />);

    await user.type(screen.getByRole("textbox"), "Paris{Enter}");

    expect(await saysBack(NOT_YET_LINE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan this day" })).toBeInTheDocument();
  });

  it("points to the written days when it can write none, and writes the one pressed", async () => {
    const { user } = renderStart({ kind: "unavailable" });

    await user.type(screen.getByRole("textbox"), "Lisbon{Enter}");
    expect(await saysBack(NOT_YET_LINE)).toBeVisible();
    await user.click(cityWord("Rome"));

    await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
    await waitForTheDay();
    expect(within(dayList()).getByText("Cornetti on Via Leonina")).toBeInTheDocument();
    expect(fetchDay).toHaveBeenCalledOnce();
  });
});

// `docs/decisions.md`, "The first screen asks one question, and no day is drawn until a press".
describe("the wait for the day's own words", () => {
  function renderHeld(
    read: IntakeReader = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" })),
  ) {
    const user = userEvent.setup();
    render(<Day start={{ pool: POOL, read }} />);
    return { user };
  }
  /** The copy of the field's words the light passes through, laid over the field. */
  const litWords = () => document.querySelector("textarea[name=text] + span[aria-hidden]");

  it("lights the visitor's words while they are read, and no longer once the day is on its way", async () => {
    stallDay();
    let land: (result: IntakeResult) => void = () => undefined;
    const read = vi.fn<IntakeReader>(() => new Promise((resolve) => (land = resolve)));
    const { user } = renderHeld(read);

    await user.type(screen.getByRole("textbox"), "Bologna{Enter}");
    await waitFor(() => expect(litWords()).toHaveTextContent("Bologna"));
    land({ kind: "request", request: BOLOGNA_START_REQUEST, readings: [], unplaced: [] });

    expect(await saysBack("Opening a lively Saturday in Bologna, with friends")).toBeVisible();
    expect(litWords()).toBeNull();
    expect(screen.getByRole("textbox")).toHaveValue("Bologna");
  });

  it("keeps the start screen until Lantern's words for the day have streamed", async () => {
    const release = holdDay();
    const { user } = renderHeld();

    await user.click(cityWord("Paris"));
    expect(
      await saysBack("Opening a calm Sunday in Paris, slow morning, with a partner"),
    ).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));
    expect(headline()).toHaveTextContent(/^One day in a city/);

    release();
    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
    await waitForTheDay();
  });

  it("gives the day the page once Lantern's words are whole, the line about the day still on its way, its frame waiting for that line's room", async () => {
    stallInTheLine();
    const { user } = renderHeld();

    await user.click(cityWord("Paris"));

    // Well before the cap: the turn waits for the sentence's words, not the line about the day.
    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/), {
      timeout: START_WORDS_CAP_MS / 2,
    });
    expect(screen.queryByRole("group", { name: /The day's energy/ })).not.toBeInTheDocument();
  });

  it("gives the day the page with what it has once the cap passes without its words, its date and axes waiting for its header's room", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    const release = holdDay();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
    render(<Day start={{ pool: POOL, read }} />);

    await user.click(cityWord("Paris"));
    expect(
      await saysBack("Opening a calm Sunday in Paris, slow morning, with a partner"),
    ).toBeVisible();
    act(() => vi.advanceTimersByTime(START_WORDS_CAP_MS - 100));
    // The page turns a frame after it is due, so two frames pass before it is read.
    await act(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(headline()).toHaveTextContent(/^One day in a city/);

    act(() => vi.advanceTimersByTime(200));
    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
    // Its line about the day has not arrived, so the room it takes is not known.
    expect(screen.queryByRole("group", { name: /The day's energy/ })).not.toBeInTheDocument();

    release();
    await waitForTheDay();
    expect(screen.getByRole("group", { name: /The day's energy/ })).toBeInTheDocument();
  });
});

describe("the line under the day, as the landing reads with live generation off", () => {
  const SAID_BACK = /Lantern can't plan around/;
  /** Characters of a day's text before its first stop is whole. */
  const CUT_BEFORE_A_STOP = 400;

  // The landing names the day it opens in the address, which outlives a test.
  afterEach(() => window.history.replaceState(null, "", "/"));

  function renderWritten() {
    const user = userEvent.setup();
    render(<StartDay pool={POOL} isLive={false} />);
    return user;
  }

  it("plays the example under the field with nothing said back", async () => {
    const user = renderWritten();
    const example = screen.getByRole("status").textContent?.replace("For example: ", "");

    await user.type(screen.getByRole("textbox"), `${example}{Enter}`);

    await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in London/));
    await waitForTheDay();
    expect(headline()).toHaveTextContent("with friends");
    expect(screen.queryByText(SAID_BACK)).not.toBeInTheDocument();
  });

  it("says back no phrase, not even one the day's own words do not say", async () => {
    const user = renderWritten();

    await user.type(screen.getByRole("textbox"), "Bologna, with my dog, slow morning{Enter}");

    await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Saturday in Bologna/));
    await waitForTheDay();
    expect(headline()).toHaveTextContent("slow morning");
    expect(screen.queryByText(SAID_BACK)).not.toBeInTheDocument();
  });

  it("asks a day it could not finish again as it was asked, its words and all", async () => {
    // The route stops before the first stop is written; asked again, it answers.
    fetchDay.mockImplementationOnce((_, init) =>
      simulateDayStream({
        day: BOLOGNA_START_DAY.day,
        ending: { kind: "cut", at: CUT_BEFORE_A_STOP, by: "error" },
        pace: { deltaChars: 64 },
        signal: init.signal ?? undefined,
      }),
    );
    const user = renderWritten();

    await user.type(screen.getByRole("textbox"), "Bologna, with my dog, slow morning{Enter}");
    await user.click(await screen.findByRole("button", { name: "Write it again" }, DAY_TIMEOUT));

    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    await waitForTheDay();
    expect(within(headline()).getByRole("button", { name: "slow morning" })).not.toHaveClass(
      "decoration-dotted",
    );
    expect(screen.queryByText(SAID_BACK)).not.toBeInTheDocument();
  });

  it.each([
    ["Kanazawa", "Kanazawa, an early dinner", "early dinner", "on foot"],
    ["Bologna", "Bologna, a slow morning", "slow morning", "on foot"],
  ])(
    "takes Lantern's word the text says as it is as the visitor's, on %s",
    async (_, text, said, other) => {
      const user = renderWritten();

      await user.type(screen.getByRole("textbox"), `${text}{Enter}`);

      await waitFor(() => expect(headline()).toHaveTextContent(said));
      await waitForTheDay();
      const word = (name: string) => within(headline()).getByRole("button", { name });
      expect(word(said)).not.toHaveClass("decoration-dotted");
      // Lantern's other words stay its own, and every word can still be changed.
      expect(word(other)).toHaveClass("decoration-dotted");
      expect(factsLine()).toHaveTextContent("assumed by Lantern");
      expect(factsLine()).toHaveTextContent("click a word to change it");
      expect(screen.queryByText(SAID_BACK)).not.toBeInTheDocument();
    },
  );
});

describe("the address, on a page that asks the day to keep it", () => {
  const TITLE_BEFORE = "A page's own title";

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    document.title = TITLE_BEFORE;
  });

  function renderAddressed() {
    const user = userEvent.setup();
    const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
    render(<Day start={{ pool: POOL, read }} isAddressed />);
    return user;
  }

  it("keeps the start screen's address while a pressed city's day is on its way", async () => {
    stallDay();
    const user = renderAddressed();
    expect(document.title).toBe("Lantern");

    await user.click(cityWord("Tokyo"));

    await saysBack("Opening a lively Saturday in Tokyo, early start, alone");
    expect(window.location.pathname).toBe("/");
    expect(document.title).toBe("Lantern");
  });

  it("names the day once it takes the page, as an address of its own after the start screen's", async () => {
    const user = renderAddressed();
    const entries = window.history.length;

    await user.click(cityWord("Paris"));

    await waitFor(() => expect(window.location.pathname).toBe("/day/paris"));
    expect(document.title).toBe("A calm Sunday in Paris, slow morning, with a partner · Lantern");
    // Pushed, so Back comes back to the start screen rather than leaving Lantern.
    expect(window.history.length).toBe(entries + 1);
  });

  it("shows the start screen on Back while the day writes on, and the day again on Forward", async () => {
    const user = renderAddressed();
    await user.click(cityWord("Paris"));
    await waitFor(() => expect(window.location.pathname).toBe("/day/paris"));

    act(() => window.history.back());

    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    expect(window.location.pathname).toBe("/");
    expect(document.title).toBe("Lantern");

    act(() => window.history.forward());

    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
    expect(window.location.pathname).toBe("/day/paris");
    // One day, played once: Back and Forward ask the route for nothing.
    expect(fetchDay).toHaveBeenCalledOnce();
  });

  it("brings the day back on Forward as the visitor left it, its energy and open stop included", async () => {
    const user = renderAddressed();
    await user.click(cityWord("Paris"));
    await waitForTheDay();
    await user.click(within(headline()).getByRole("button", { name: "calm" }));
    await user.click(screen.getByRole("option", { name: "lively" }));
    const [first] = within(dayList()).getAllByRole("button");
    // Lively, the first stop shows its livelier place, which its panel opens.
    const stop = writtenDayAt("paris")!.itinerary.stops[0]!;
    const rankOf = (place: { sensory: { energy: EnergyLevel } }) =>
      ENERGY_LEVELS.indexOf(place.sensory.energy);
    const name = stop.alternatives.find((version) => rankOf(version) > rankOf(stop.primary))!.name;
    await user.click(first!);
    expect(screen.getByRole("region", { name: /^About / })).toHaveAccessibleName(
      new RegExp(`^About ${name}`),
    );

    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    // The start screen's headline takes the focus the day had.
    expect(headline()).toHaveFocus();

    act(() => window.history.forward());
    // The same day, drawn as it stood: no landing played again, no word changed back.
    await waitFor(() => expect(headline()).toHaveTextContent(/^A lively Sunday in Paris/));
    expect(document.title).toBe("A lively Sunday in Paris, slow morning, with a partner · Lantern");
    expect(screen.getByRole("region", { name: /^About / })).toHaveAccessibleName(
      new RegExp(`^About ${name}`),
    );
    expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(fetchDay).toHaveBeenCalledOnce();
  });

  it("gives a city Lantern has not written the start screen's address again", async () => {
    const user = renderAddressed();
    await user.click(cityWord("Paris"));
    await waitForTheDay();

    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    await user.keyboard("Lisbon{Enter}");

    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Lisbon/));
    expect(window.location.pathname).toBe("/");
    expect(document.title).toBe("Lantern");
  });

  it("leaves the address and the title to a page that does not ask", async () => {
    const user = userEvent.setup();
    render(<Day start={{ pool: POOL, read: vi.fn<IntakeReader>() }} />);

    await user.click(cityWord("Paris"));

    await waitFor(() => expect(headline()).toHaveTextContent(/^A calm Sunday in Paris/));
    expect(window.location.pathname).toBe("/");
    expect(document.title).toBe(TITLE_BEFORE);
  });
});

describe("the visitor's own days", () => {
  const ID = "0b6c6f1e-3d2a-4e8b-9a51-6f0c2d7e4a19";

  /** The route's day, its answer naming its row in the log as a live day's does. */
  function namedSourceFor(request: DayRequest): DaySource {
    return {
      request,
      open: async (signal) => {
        const answer = await fetchDay(DAY_ROUTE, {
          method: "POST",
          body: JSON.stringify(request),
          signal,
        });
        const headers = new Headers(answer.headers);
        headers.set(DAY_ID_HEADER, ID);
        return new Response(answer.body, { status: answer.status, headers });
      },
    };
  }

  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("keeps a day with an id at its own address, and lists it on the start screen on Back", async () => {
    const user = userEvent.setup();
    const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
    render(<Day start={{ pool: POOL, read }} sourceFor={namedSourceFor} isAddressed />);

    await user.click(cityWord("Rome"));
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${ID}`));
    await waitForTheDay();
    const [kept] = readYourDays(window.localStorage);
    expect(kept).toMatchObject({ id: ID, ending: "written", request: { city: "Rome" } });
    expect(kept!.energies.length).toBeGreaterThan(0);

    act(() => window.history.back());

    const yours = await screen.findByRole("list", { name: YOUR_DAYS_HEADING });
    expect(within(yours).getByRole("button")).toHaveTextContent(
      /^A balanced Saturday in Rome, eating late, with family\. today$/,
    );
    await user.click(within(yours).getByRole("button"));
    await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
    expect(window.location.pathname).toBe(`/day/${ID}`);

    act(() => window.history.back());
    await user.click(await screen.findByRole("button", { name: FORGET_YOUR_DAYS }));
    expect(screen.queryByRole("list", { name: YOUR_DAYS_HEADING })).not.toBeInTheDocument();
    expect(readYourDays(window.localStorage)).toEqual([]);
  });

  it("says how a day left while it was written ended, asking the log once", async () => {
    const nafplio = writtenDayAt("nafplio")!;
    keepYourDay(window.localStorage, {
      id: ID,
      request: nafplio.request,
      startedAt: new Date().toISOString(),
      energies: ["calm"],
      ending: "writing",
      seconds: null,
    });
    const routeDay = fetchDay.getMockImplementation()!;
    fetchDay.mockImplementation((path, init) =>
      path === `/api/day/${ID}`
        ? Promise.resolve(
            Response.json({
              status: "written",
              ...nafplio,
              checks: {},
              writtenAt: new Date().toISOString(),
              seconds: 52,
              round: 0,
            }),
          )
        : routeDay(path, init),
    );
    try {
      const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
      render(<Day start={{ pool: POOL, read }} isAddressed />);

      const yours = await screen.findByRole("list", { name: YOUR_DAYS_HEADING });
      await waitFor(() => expect(within(yours).getByRole("button")).toHaveTextContent(/\. today$/));
      expect(readYourDays(window.localStorage)[0]?.energies).toEqual(
        shownEnergiesOf(nafplio.itinerary),
      );
      expect(fetchDay.mock.calls.filter(([path]) => path === `/api/day/${ID}`)).toHaveLength(1);
    } finally {
      fetchDay.mockImplementation(routeDay);
    }
  });
});
