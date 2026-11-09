import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CANDIDATE_ATTRIBUTE } from "@/features/abacus/chart-stop";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import type { ProductEvent } from "@/lib/events/event.schema";
import { sendProductEvent } from "@/lib/events/send-event";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST, MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import { isWrittenRequest } from "@/lib/days/written/requests";
import type { IntakeRouteAnswer } from "@/lib/intake/signed-city";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { Day } from "./day";
import { INTAKE_ROUTE } from "./intake-route";
import { StartDay } from "./start-day";
import { WRITTEN_HEADING } from "./start-header";
import { writtenVersionOf } from "@/lib/days/written/version";
import { keptSeenKeyOf, markSeen, seenKeyOf } from "./seen-days";
import type { KeptLanding } from "./kept-day";
import { writtenDayAt } from "@/lib/days/written/days";
import { writtenPool } from "./written-pool";

/**
 * The product's events as the page sends them, with the sender stubbed: each kind once, at
 * its moment. The routes are stand-ins: the day route streams a written day from its file
 * and any other as Kanazawa's day, and the intake answers what each test gives it.
 */

vi.mock("@/lib/events/send-event", () => ({ sendProductEvent: vi.fn() }));

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
/** Stops pulled on a day where every stop's would add only time: the second is not counted. */
const PULLS_A_DAY = 2;
const POOL = writtenPool();

const PORTO: DayRequest = {
  ...KANAZAWA_START_REQUEST,
  city: "Porto",
  timezone: "Europe/Lisbon",
  energy: "calm",
  energySource: "chosen",
};

const KANAZAWA_LINK = { city: "kanazawa", via: "link", written: true } as const;
/** A day the log kept, Kanazawa with family: the model's, at its own address. */
const KEPT_ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
const KEPT_REQUEST: DayRequest = { ...KANAZAWA_START_REQUEST, company: "family" };
const KEPT_ADDRESS = { city: "kanazawa", via: "kept", written: false } as const;

/** The kept day as its page lands it: whole, cut short with its first stops, or not finished. */
function keptLanding(ending: "complete" | "cut" | "failed"): KeptLanding {
  const itinerary = writtenDayAt("kanazawa")!.itinerary;
  const outcome =
    ending === "complete"
      ? { kind: "complete" as const, itinerary }
      : ending === "cut"
        ? { kind: "cut" as const, itinerary: { ...itinerary, stops: itinerary.stops.slice(0, 3) } }
        : { kind: "cut" as const, itinerary: null };
  return { id: KEPT_ID, request: KEPT_REQUEST, outcome, notice: null, checks: {}, round: 0 };
}

/**
 * How the day route answers the next day: at once, never, up to its first stops, or with
 * its stops closed empty.
 */
type DayReply = "streamed" | "stalled" | "held-after-first-stops" | "empty";
const dayReplies: DayReply[] = [];
const intakeReplies: IntakeRouteAnswer[] = [];

/** Kanazawa's day as the route streams it, held open halfway, with its first stops written. */
async function heldAfterFirstStops(): Promise<Response> {
  const whole = await simulateDayStream({
    day: KANAZAWA_START_DAY.day,
    ending: { kind: "finished" },
    pace: { deltaChars: 64 },
  });
  const text = await whole.text();
  // The end of the stream's event halfway through: its first stops are whole by then, and
  // under reduced motion a row lands once its words are.
  const end = text.indexOf("\n\n", text.length / 2) + 2;
  // Never closed: the model is still writing when the visitor goes.
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text.slice(0, end)));
    },
  });
  return new Response(body, { headers: whole.headers });
}

async function answerRoutes(path: string, init: RequestInit): Promise<Response> {
  if (path === INTAKE_ROUTE) {
    const reply = intakeReplies.shift();
    if (reply === undefined) throw new Error("The intake was asked once more than the test said");
    return Response.json(reply);
  }
  if (path !== DAY_ROUTE) throw new Error(`Nothing answers ${path}`);
  const reply = dayReplies.shift() ?? "streamed";
  if (reply === "stalled") return new Promise<Response>(() => {});
  if (reply === "held-after-first-stops") return heldAfterFirstStops();
  if (reply === "empty") {
    return simulateDayStream({
      day: { ...KANAZAWA_START_DAY.day, stops: [], alternatives: [] },
      ending: { kind: "finished" },
      pace: { deltaChars: 64 },
    });
  }
  const request = JSON.parse(String(init.body)) as DayRequest;
  if (isWrittenRequest(request)) {
    return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
  }
  return simulateDayStream({
    day: KANAZAWA_START_DAY.day,
    ending: { kind: "finished" },
    pace: { deltaChars: 64 },
    signal: init.signal ?? undefined,
  });
}

/** jsdom has no layout, so the chart's container reports a laptop-sized box. */
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

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", vi.fn(answerRoutes));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  vi.mocked(sendProductEvent).mockClear();
  dayReplies.length = 0;
  intakeReplies.length = 0;
  window.history.replaceState(null, "", "/");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Every event sent so far, in order. */
const sent = (): ProductEvent[] => vi.mocked(sendProductEvent).mock.calls.map(([event]) => event);
/** The events sent as the page goes away, by beacon. */
const sentLeaving = (): ProductEvent[] =>
  vi
    .mocked(sendProductEvent)
    .mock.calls.filter(([, options]) => options?.isLeaving === true)
    .map(([event]) => event);
const sentOf = (kind: ProductEvent["kind"]) => sent().filter((event) => event.kind === kind);

const headline = () => screen.getByRole("heading", { level: 1 });
const dayList = () => screen.getByRole("list", { name: "The day" });
const writtenCity = (city: string) =>
  within(screen.getByRole("list", { name: WRITTEN_HEADING })).getByRole("button", {
    name: new RegExp(` in ${city}[,.]`),
  });

/** Waits until the day is written and still, when its words and chart can be changed. */
async function waitForTheDay(): Promise<void> {
  await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
  await waitFor(
    () =>
      expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    DAY_TIMEOUT,
  );
}

async function landOnKanazawa({ isLive = false } = {}) {
  const user = userEvent.setup();
  render(<Day first={KANAZAWA_START_REQUEST} isLive={isLive} isCounted />);
  await waitForTheDay();
  return user;
}

/** Madrid's written day, live: its company names six of its seven stops, a whole day's word. */
async function landOnMadrid() {
  const user = userEvent.setup();
  render(<Day first={MADRID_START_REQUEST} isLive isCounted />);
  await waitForTheDay();
  return user;
}

async function changeWord(
  user: ReturnType<typeof userEvent.setup>,
  word: string,
  option: string,
): Promise<void> {
  await user.click(within(headline()).getByRole("button", { name: word }));
  await user.click(screen.getByRole("option", { name: option }));
}

const pageHides = () => window.dispatchEvent(new Event("pagehide"));

describe("the days played, as the product counts them", () => {
  it("opens a day landed on by its link once, and ends it once its outcome arrives", async () => {
    // Strict Mode plays the day on mount twice in development; it is one opening.
    render(
      <StrictMode>
        <Day first={KANAZAWA_START_REQUEST} isCounted />
      </StrictMode>,
    );

    await waitFor(() => expect(sent()).toEqual([{ kind: "day-opened", ...KANAZAWA_LINK }]));
    await waitForTheDay();
    expect(sent()).toEqual([
      { kind: "day-opened", ...KANAZAWA_LINK },
      { kind: "day-ended", ...KANAZAWA_LINK, outcome: "complete" },
    ]);
  });

  it("sends nothing from a page that does not count, as a lab's", async () => {
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} />);
    await waitForTheDay();

    await changeWord(user, "with …?", "with family");
    pageHides();

    expect(sendProductEvent).not.toHaveBeenCalled();
  });

  it("opens a start pressed on the start screen as pressed", async () => {
    const user = userEvent.setup();
    render(<StartDay pool={POOL} isLive={false} isCounted />);

    await user.click(writtenCity("Kanazawa"));
    await waitForTheDay();

    expect(sent()).toEqual([
      { kind: "day-opened", city: "kanazawa", via: "pressed", written: true },
      { kind: "day-ended", city: "kanazawa", via: "pressed", written: true, outcome: "complete" },
    ]);
  });

  it("counts the intake's answer, then opens the day it read as typed", async () => {
    intakeReplies.push({
      kind: "request",
      request: PORTO,
      readings: [],
      unplaced: [],
      signed: [{ city: "Porto", timezone: "Europe/Lisbon", signature: "porto-signed" }],
    });
    const user = userEvent.setup();
    render(<StartDay pool={POOL} isLive isCounted />);

    await user.type(screen.getByRole("textbox"), "Porto, a calm day{Enter}");
    await waitForTheDay();

    const porto = { city: "porto", via: "typed", written: false } as const;
    expect(sent()).toEqual([
      { kind: "intake-ended", outcome: "request" },
      { kind: "day-opened", ...porto },
      { kind: "day-ended", ...porto, outcome: "complete" },
    ]);
  });

  it("counts no intake with live generation off, where the text is read in the page", async () => {
    const user = userEvent.setup();
    render(<StartDay pool={POOL} isLive={false} isCounted />);

    await user.type(screen.getByRole("textbox"), "Kanazawa{Enter}");
    await waitForTheDay();

    expect(sentOf("intake-ended")).toEqual([]);
    expect(sentOf("day-opened")).toEqual([
      { kind: "day-opened", city: "kanazawa", via: "typed", written: true },
    ]);
  });

  it("leaves a day replaced before its first stop there, and opens the next", async () => {
    dayReplies.push("stalled");
    const user = userEvent.setup();
    render(<StartDay pool={POOL} isLive={false} isCounted />);

    await user.click(writtenCity("Bologna"));
    await user.click(writtenCity("Nafplio"));
    await waitForTheDay();

    const lisbon = { city: "bologna", via: "pressed", written: true } as const;
    const alicante = { city: "nafplio", via: "pressed", written: true } as const;
    expect(sent()).toEqual([
      { kind: "day-opened", ...lisbon },
      { kind: "day-left", ...lisbon, stage: "before-first-stop" },
      { kind: "day-opened", ...alicante },
      { kind: "day-ended", ...alicante, outcome: "complete" },
    ]);
  });

  it("leaves a day by beacon when the page goes with its stops on screen, and only once", async () => {
    dayReplies.push("held-after-first-stops");
    render(<Day first={KANAZAWA_START_REQUEST} isCounted />);
    await waitFor(
      () => expect(within(dayList()).queryAllByRole("listitem").length).toBeGreaterThan(0),
      DAY_TIMEOUT,
    );

    pageHides();
    pageHides();

    const left = { kind: "day-left", ...KANAZAWA_LINK, stage: "before-end" };
    expect(sentLeaving()).toEqual([left]);
    expect(sent()).toEqual([{ kind: "day-opened", ...KANAZAWA_LINK }, left]);
  });

  it("never leaves a day that has ended", async () => {
    await landOnKanazawa();

    pageHides();

    expect(sentOf("day-left")).toEqual([]);
  });

  it("opens a written day the notice offers as pressed, after the city typed that had none", async () => {
    const user = await landOnKanazawa();

    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getAllByRole("button", { name: "Plan another day" })[0]!);
    await user.keyboard("Atlantis{Enter}");
    const lisbon = await screen.findByRole("button", { name: /Bologna/ }, DAY_TIMEOUT);
    await user.click(lisbon);
    await waitForTheDay();

    const atlantis = { city: "atlantis", via: "word", written: false } as const;
    const lisbonDay = { city: "bologna", via: "pressed", written: true } as const;
    expect(sent().slice(2)).toEqual([
      { kind: "word-changed", city: "kanazawa", word: "city" },
      { kind: "day-opened", ...atlantis },
      { kind: "day-ended", ...atlantis, outcome: "unavailable" },
      { kind: "day-opened", ...lisbonDay },
      { kind: "day-ended", ...lisbonDay, outcome: "complete" },
    ]);
  });
});

describe("the gestures on a day, as the product counts them", () => {
  it("counts every word changed, the energy too, but not an assumption taken as it is", async () => {
    const user = await landOnKanazawa();

    await changeWord(user, "on foot", "on foot");
    await changeWord(user, "calm", "lively");
    await changeWord(user, "early dinner", "eating late");

    expect(sentOf("word-changed")).toEqual([
      { kind: "word-changed", city: "kanazawa", word: "energy" },
      { kind: "word-changed", city: "kanazawa", word: "dinner" },
    ]);
    // With live generation off a changed word plays no day.
    expect(sentOf("day-opened")).toHaveLength(1);
  });

  it("opens the day a changed word re-plans, live, as reached by the word", async () => {
    const user = await landOnMadrid();

    await changeWord(user, "with friends", "with family");
    await waitFor(() => expect(sentOf("day-ended")).toHaveLength(2), DAY_TIMEOUT);

    const replanned = { city: "madrid", via: "word", written: false } as const;
    expect(sent().slice(2)).toEqual([
      { kind: "word-changed", city: "madrid", word: "company" },
      { kind: "day-opened", ...replanned },
      { kind: "day-ended", ...replanned, outcome: "complete" },
    ]);
  });

  it("counts a word that changes no stop, and opens no day for it", async () => {
    const user = await landOnKanazawa({ isLive: true });

    await changeWord(user, "with …?", "with family");

    expect(sent().slice(2)).toEqual([{ kind: "word-changed", city: "kanazawa", word: "company" }]);
  });

  it("opens a kept day by its own address, and ends it as it was kept", async () => {
    render(<Day kept={keptLanding("complete")} isLive={false} isAddressed isCounted />);
    await waitFor(() => expect(sent()).toHaveLength(2), DAY_TIMEOUT);

    expect(sent()).toEqual([
      { kind: "day-opened", ...KEPT_ADDRESS },
      { kind: "day-ended", ...KEPT_ADDRESS, outcome: "complete" },
    ]);
  });

  it("opens a kept day once, drawn whole as one this device has seen", async () => {
    markSeen(keptSeenKeyOf(KEPT_ID));
    render(<Day kept={keptLanding("complete")} isLive={false} isAddressed isCounted />);
    await waitFor(() => expect(sent()).toHaveLength(2), DAY_TIMEOUT);

    expect(sentOf("day-opened")).toEqual([{ kind: "day-opened", ...KEPT_ADDRESS }]);
  });

  it("ends a kept day cut short with its stops as cut", async () => {
    render(<Day kept={keptLanding("cut")} isLive={false} isAddressed isCounted />);
    await waitFor(() => expect(sent()).toHaveLength(2), DAY_TIMEOUT);

    expect(sentOf("day-ended")).toEqual([{ kind: "day-ended", ...KEPT_ADDRESS, outcome: "cut" }]);
  });

  it("opens no day for a kept day's notice in its place", async () => {
    render(<Day kept={keptLanding("failed")} isLive={false} isAddressed isCounted />);
    await screen.findByText(/couldn.t finish this day/, {}, DAY_TIMEOUT);

    expect(sent()).toEqual([]);
  });

  it("ends a day this device has seen as it opens, whole, and never leaves it", async () => {
    const kanazawa = writtenDayAt("kanazawa")!;
    const version = writtenVersionOf(kanazawa.itinerary);
    markSeen(seenKeyOf("kanazawa", version));
    const user = userEvent.setup();
    render(
      <Day
        first={KANAZAWA_START_REQUEST}
        written={{ itinerary: kanazawa.itinerary, version, checks: {} }}
        isAddressed
        isCounted
      />,
    );
    await waitForTheDay();

    expect(sent()).toEqual([
      { kind: "day-opened", ...KANAZAWA_LINK },
      { kind: "day-ended", ...KANAZAWA_LINK, outcome: "complete" },
    ]);
    // Another city from the city word: the day seen whole was never left, nor counted so.
    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));
    await waitFor(() => expect(sentOf("day-opened")).toHaveLength(2), DAY_TIMEOUT);
    expect(sentOf("day-left")).toEqual([]);
  });

  // A day that came back empty is asked for again by the page, not the visitor: one opening.
  it("counts a day asked for again after it came back empty as one day, ended once", async () => {
    const user = await landOnMadrid();
    dayReplies.push("empty");

    await changeWord(user, "with friends", "with family");
    await waitFor(() => expect(sentOf("day-ended")).toHaveLength(2), DAY_TIMEOUT);
    await waitForTheDay();

    const replanned = { city: "madrid", via: "word", written: false } as const;
    expect(sent().slice(2)).toEqual([
      { kind: "word-changed", city: "madrid", word: "company" },
      { kind: "day-opened", ...replanned },
      { kind: "day-ended", ...replanned, outcome: "complete" },
    ]);
  });

  it("ends a day that came back empty twice as invalid, once", async () => {
    intakeReplies.push({
      kind: "request",
      request: PORTO,
      readings: [],
      unplaced: [],
      signed: [{ city: "Porto", timezone: "Europe/Lisbon", signature: "porto-signed" }],
    });
    dayReplies.push("empty", "empty");
    const user = userEvent.setup();
    render(<StartDay pool={POOL} isLive isCounted />);

    await user.type(screen.getByRole("textbox"), "Porto, a calm day{Enter}");
    await waitFor(() => expect(sentOf("day-ended")).toHaveLength(1), DAY_TIMEOUT);

    const porto = { city: "porto", via: "typed", written: false } as const;
    expect(sent()).toEqual([
      { kind: "intake-ended", outcome: "request" },
      { kind: "day-opened", ...porto },
      { kind: "day-ended", ...porto, outcome: "invalid" },
    ]);
  });

  it("counts the curve's first pull and a stop's first swap once each a day", async () => {
    const user = await landOnKanazawa();

    // Two stops, as the next test pulls: every stop's keys, 16 at about 100 ms each in jsdom,
    // ran this test past its 15 s under a loaded machine's full run, and a second pull already
    // shows the first is the one counted.
    const sliders = screen.getAllByRole("slider").slice(0, PULLS_A_DAY);
    expect(sliders).toHaveLength(PULLS_A_DAY);
    for (const slider of sliders) {
      slider.focus();
      await user.keyboard("{ArrowRight}{ArrowLeft}");
    }
    const beads = document.querySelectorAll(`[${CANDIDATE_ATTRIBUTE}]`);
    for (const bead of [...beads].slice(0, 3)) await user.click(bead);

    expect(sentOf("curve-dragged")).toEqual([{ kind: "curve-dragged", city: "kanazawa" }]);
    expect(sentOf("stop-swapped")).toEqual([{ kind: "stop-swapped", city: "kanazawa" }]);
  });

  it("counts each way the day is taken along once a day: its link sent, its route opened", async () => {
    const user = await landOnKanazawa();
    const route = await screen.findByRole("link", { name: "Walk it in Google Maps" }, DAY_TIMEOUT);
    // The map opens in a tab of its own, which jsdom has not.
    route.addEventListener("click", (event) => event.preventDefault());

    for (let press = 0; press < 2; press += 1) {
      await user.click(route);
      await user.click(screen.getByRole("button", { name: /^Copy link|^Copied/ }));
    }

    await waitFor(() => expect(sentOf("link-shared")).toHaveLength(1));
    expect(sentOf("link-shared")).toEqual([{ kind: "link-shared", city: "kanazawa" }]);
    expect(sentOf("route-opened")).toEqual([{ kind: "route-opened", city: "kanazawa" }]);
  });

  it("counts them again on the next day opened", async () => {
    const user = await landOnKanazawa();
    // Two stops a day, so a second pull on each day shows it is not counted again, as in the
    // test above. Each arrow key re-renders the chart, about 100 ms
    // in jsdom: every stop on both days, 32 keys, took 10 s of the 15 s limit in the full
    // run with coverage, and ran past it beside another session's commit.
    const pullTwoStops = async () => {
      const sliders = screen.getAllByRole("slider").slice(0, PULLS_A_DAY);
      expect(sliders).toHaveLength(PULLS_A_DAY);
      for (const slider of sliders) {
        slider.focus();
        await user.keyboard("{ArrowRight}{ArrowLeft}");
      }
    };
    await pullTwoStops();

    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));
    await waitFor(() => expect(headline()).toHaveTextContent(/in Bologna/), DAY_TIMEOUT);
    await waitForTheDay();
    await pullTwoStops();

    expect(sentOf("curve-dragged")).toEqual([
      { kind: "curve-dragged", city: "kanazawa" },
      { kind: "curve-dragged", city: "bologna" },
    ]);
  });
});
