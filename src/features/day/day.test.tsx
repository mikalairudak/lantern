import { act, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST, START_REQUESTS } from "@/lib/days/written/quick-starts";
import { writtenDayAt } from "@/lib/days/written/days";
import { writtenVersionOf } from "@/lib/days/written/version";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import {
  dayText,
  simulateDayStream,
  type StreamEnding,
  type StreamPace,
} from "@/lib/stream/simulate-day-stream";
import { FRAME_INSETS } from "@/features/abacus/geometry";
import { Day, type DayHandle } from "./day";
import {
  BUSY,
  CONNECTION_DROPPED,
  NOT_WRITING_YET,
  REFUSED_LINE,
  RESTING,
  UNFINISHED,
} from "./not-yet";
import { requestSentenceOf, widestClauses } from "./sentence";
import { DayStage } from "./day-stage";
import { TAKE_THIS_DAY } from "./day-menu";

const ORIGIN = "http://lantern.test";
/** Large deltas and no pauses, so a day streams in a few frames. */
const QUICK: Partial<StreamPace> = { deltaChars: 64 };
/** Well after the beat a day written again waits before its date and axes. */
const AFTER_THE_BEAT_MS = 600;
/** A stream lands, then the stops land and settle; reduced motion keeps that short. */
const DAY_TIMEOUT = { timeout: 5000 };
/**
 * A day streamed at a slow pace takes 2 s alone and 6 s inside a full run on a machine
 * loaded past its cores (load 48 on 18), the same with the day's end as without it.
 */
const SLOW_DAY_TIMEOUT = { timeout: 12_000 };
const CHART_WIDTH = 448;
const CHART_HEIGHT = 640;
/** Kanazawa's day asks for 07:00 to 23:00, in minutes. */
const HOURS_ASKED_IN_KANAZAWA = 16 * 60;
/** From 21:00, the hour after its last visit, to the 23:00 asked. */
const HOURS_CUT_IN_KANAZAWA = 2 * 60;
/** Inside the first set of versions, after every stop is written. */
const IN_THE_SWAPS = dayText(KANAZAWA_START_DAY.day).indexOf('"alternatives"') + 200;

/** Skips the header's unseen copy, which holds its room. */
const SEEN = { ignore: "[aria-hidden] *" };

/** How the route is answered: as it answers, or with one ending of the simulator. */
const route = vi.hoisted(() => ({
  pace: {} as Partial<StreamPace>,
  endings: [] as StreamEnding[],
  status: null as number | null,
}));

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

/** The visitor asks for reduced motion, as the e2e run does: only the stream takes time. */
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

async function answer(path: string, init: RequestInit): Promise<Response> {
  if (route.status !== null) return new Response(null, { status: route.status });
  const ending = route.endings.shift();
  if (ending) {
    return simulateDayStream({
      day: KANAZAWA_START_DAY.day,
      ending,
      pace: QUICK,
      signal: init.signal ?? undefined,
    });
  }
  return answerDayRequest(new Request(new URL(path, ORIGIN), init), {
    ...QUICK,
    ...route.pace,
  });
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
  route.pace = {};
  route.endings = [];
  route.status = null;
});

const headline = () => screen.getByRole("heading", { level: 1 });

/** A phone's room under the header for a written day, as a browser would measure it. */
const HELD_ROOM_PX = 412;
/** A stream that starts this late leaves the next day's room unknown while a test looks. */
const SLOW_START_MS = 800;

/** The box under the masthead that holds the header's room, which the chart stands under. */
function headerRoom(): HTMLElement {
  const room = document.querySelector<HTMLElement>("header > .mt-5");
  if (!room) throw new Error("No room under the masthead");
  return room;
}

/** What the room holds: its height floor, when it keeps the day before's room. */
function roomFloor(): HTMLElement {
  const floor = headerRoom().querySelector<HTMLElement>(":scope > div > div");
  if (!floor) throw new Error("No content in the header's room");
  return floor;
}

/** jsdom has no layout, so the room reports the height a browser would give it. */
function holdsRoomOf(room: HTMLElement, height: number): void {
  vi.spyOn(room, "getBoundingClientRect").mockReturnValue({ height } as DOMRect);
}

/** The facts line on screen, before its unseen copy under the header. */
function factsLine(): HTMLElement {
  const line = document.querySelector<HTMLElement>("header p.type-note");
  if (!line) throw new Error("No facts line");
  return line;
}

/** What a day that ended without one says, on screen: the notice's line under the headline. */
function endingLine(): HTMLElement {
  const line = document.querySelector<HTMLElement>("header p.text-quote");
  if (!line) throw new Error("No ending line");
  return line;
}

/** What a screen reader is told from the header: the notice's line, once, from its status. */
function heardLine(): HTMLElement {
  const status = document.querySelector<HTMLElement>("header p.sr-only[role=status]");
  if (!status) throw new Error("No status in the header");
  return status;
}

/** Waits until the notice's line is on screen and has been said to a screen reader. */
async function expectNotice(line: string): Promise<void> {
  await waitFor(() => expect(endingLine()).toHaveTextContent(line), DAY_TIMEOUT);
  expect(heardLine()).toHaveTextContent(line);
  expect(endingLine()).not.toHaveAttribute("role");
}

/** The written days the header offers in place of the day, by their sentences. */
/** The written days a notice offers over a day that is not one of them: the starts'. */
const OFFERED_SENTENCES = START_REQUESTS.map(requestSentenceOf);
/** The written days a notice over Kanazawa's own offers: every one but its own. */
const SENTENCES_BESIDES_KANAZAWA = START_REQUESTS.filter(
  (request) => request !== KANAZAWA_START_REQUEST,
).map(requestSentenceOf);

function writtenDaysOffered(): string[] {
  const list = document.querySelector("header ul");
  return list
    ? within(list as HTMLElement)
        .getAllByRole("button")
        .map((day) => day.textContent ?? "")
    : [];
}

/** Waits until the day is written and still, when its words can be changed. */
async function waitForTheDay(wait = DAY_TIMEOUT): Promise<void> {
  await waitFor(
    () =>
      expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    wait,
  );
}

async function renderWritten() {
  const user = userEvent.setup();
  render(<Day first={KANAZAWA_START_REQUEST} />);
  await waitForTheDay();
  return user;
}

describe("a written day's page whose play ends without the day", () => {
  const KANAZAWA = writtenDayAt("kanazawa")!;
  const ENDINGS_SAID = [CONNECTION_DROPPED, UNFINISHED, BUSY, REFUSED_LINE, RESTING];
  /** Inside the stops, before the last is whole: nothing of the day is saved from there. */
  const IN_THE_STOPS = dayText(KANAZAWA_START_DAY.day).indexOf('"stops"') + 600;
  const PLAYS_ENDED: readonly [string, StreamEnding | null, number | null][] = [
    ["offline before its first word", { kind: "offline" }, null],
    ["dropped among its stops", { kind: "dropped", at: IN_THE_STOPS }, null],
    ["cut by an error among its stops", { kind: "cut", at: IN_THE_STOPS, by: "error" }, null],
    ["refused", { kind: "refused", at: 0 }, null],
    ["rejected", { kind: "rejected" }, null],
    ["limited", { kind: "limited" }, null],
    ["answered by a server failure", null, 503],
  ];

  it.each(PLAYS_ENDED)(
    "draws its own day whole and says no ending when its play is %s",
    async (_name, ending, status) => {
      if (ending) route.endings = [ending];
      route.status = status;
      render(
        <Day
          first={KANAZAWA_START_REQUEST}
          written={{
            itinerary: KANAZAWA.itinerary,
            version: writtenVersionOf(KANAZAWA.itinerary),
            checks: {},
          }}
        />,
      );

      await waitForTheDay();
      const rows = within(screen.getByRole("list", { name: "The day" })).getAllByRole("listitem");
      expect(rows).toHaveLength(KANAZAWA.itinerary.stops.length);
      for (const said of ENDINGS_SAID) expect(screen.queryByText(said)).toBeNull();
    },
  );
});

describe("the day", () => {
  it("says the request before the first word, then Lantern's words and the line, then the date, the chart and the sun", async () => {
    route.pace = { startDelayMs: 200 };
    render(<Day first={KANAZAWA_START_REQUEST} />);

    expect(headline()).toHaveTextContent(/^A calm Saturday in Kanazawa, early start$/);
    // The date and the chart wait for the header's room, known once the line about the day
    // is whole, so nothing under the headline rides down as it arrives.
    const seenFacts = [...document.querySelectorAll("header p.type-note")].filter(
      (line) => line.closest("[aria-hidden]") === null,
    );
    expect(seenFacts).toEqual([]);
    expect(screen.queryByRole("group", { name: /The day's energy/ })).not.toBeInTheDocument();
    // Room is held for the sun's times before the first place gives them.
    expect(screen.getAllByText("sunrise 00:00").length).toBeGreaterThan(0);

    await waitFor(
      () =>
        expect(headline()).toHaveTextContent(
          "A calm Saturday in Kanazawa, on foot, early start, early dinner, home by eleven, with anyone",
        ),
      DAY_TIMEOUT,
    );
    expect(screen.getByText(/^A calm Saturday in Kanazawa that starts/, SEEN)).toBeInTheDocument();
    await waitFor(() => expect(factsLine()).toHaveTextContent(/^Sat 7 Nov/), DAY_TIMEOUT);
    // The chart with it, once it has measured the room it is drawn in.
    expect(
      await screen.findByRole("group", { name: /The day's energy/ }, DAY_TIMEOUT),
    ).toBeInTheDocument();
    await waitForTheDay();
    expect(factsLine()).toHaveTextContent("sunrise 06:23");
    expect(factsLine()).toHaveTextContent("sunset 16:52");
    expect(factsLine()).toHaveTextContent("assumed by Lantern");
    expect(screen.getAllByText("Oden in Katamachi").length).toBeGreaterThan(0);
  });

  it("tells screen readers the day is being written while nothing arrives", async () => {
    route.pace = { startDelayMs: 1500 };
    render(<Day first={KANAZAWA_START_REQUEST} />);

    expect(await screen.findByText("Writing the day", undefined, DAY_TIMEOUT)).toHaveAttribute(
      "role",
      "status",
    );
    await waitForTheDay();
    expect(screen.queryByText("Writing the day")).not.toBeInTheDocument();
  });

  it("runs the waiting light through the headline until the model's first words, where the waiting line has no place yet", async () => {
    route.pace = { startDelayMs: 1500 };
    render(<Day first={KANAZAWA_START_REQUEST} />);

    // Silent before its first words, the day has drawn nothing under the headline, and the
    // light the waiting line would carry runs through the headline's words (`docs/decisions.md`,
    // "A row's words go where its bead comes to rest, and rows ease rather than jump").
    await screen.findByText("Writing the day", undefined, DAY_TIMEOUT);
    expect(headline()).toHaveClass("words-lit");
    expect(screen.queryByRole("group", { name: /The day's energy/ })).not.toBeInTheDocument();

    // The words arrive, and the light leaves the headline for good.
    await waitFor(
      () => expect(headline()).toHaveTextContent(/^A calm Saturday in Kanazawa, on foot/),
      DAY_TIMEOUT,
    );
    expect(headline()).not.toHaveClass("words-lit");
    await waitForTheDay();
    expect(headline()).not.toHaveClass("words-lit");
  });

  it("lights the headline as it stands, before the silence the waiting line waits for", async () => {
    route.pace = { startDelayMs: 1500 };
    render(<Day first={KANAZAWA_START_REQUEST} />);

    // The wait for the model's first words is always longer than a silence: the headline is
    // lit from the frame it stands whole, while the status a silence brings has not come.
    await waitFor(() => expect(headline()).toHaveClass("words-lit"), DAY_TIMEOUT);
    expect(screen.queryByText("Writing the day")).not.toBeInTheDocument();
  });

  it("names the part of the day being written while a placed stop waits for its words", async () => {
    // Even deltas with no silence in them: a stop's words, its light last (`docs/decisions.md`,
    // "Field order is render order"), take about 300 characters, over half a second at this
    // pace, past the silence before the waiting line; under reduced motion its row waits for them
    // all, unseen.
    route.pace = { deltaChars: 32, deltaDelayMs: 60 };
    const view = render(<Day first={KANAZAWA_START_REQUEST} />);
    const day = await screen.findByRole("list", { name: "The day" }, DAY_TIMEOUT);

    const waiting = await screen.findByText("the morning", undefined, DAY_TIMEOUT);
    expect(waiting.closest("[data-waiting]")).not.toBeNull();
    // The frame drawn, the light is the waiting line's, not the headline's.
    expect(headline()).not.toHaveClass("words-lit");
    // The row it waits for lands whole, after it.
    const landed = within(day).queryAllByRole("listitem").length;
    await waitFor(
      () => expect(within(day).getAllByRole("listitem").length).toBeGreaterThan(landed),
      DAY_TIMEOUT,
    );
    view.unmount();
  });

  it("keeps a changed word with live generation off, and says what it would have re-planned", async () => {
    const user = await renderWritten();

    await user.click(within(headline()).getByRole("button", { name: "early dinner" }));
    await user.click(screen.getByRole("option", { name: "eating late" }));

    expect(headline()).toHaveTextContent("early dinner, home by eleven");
    await waitFor(() =>
      expect(factsLine()).toHaveTextContent(
        "Lantern isn't re-planning days right now, so dinner stays as written",
      ),
    );
  });

  it("takes a word no stop names as the visitor's at once, live or not, and says every stop stays", async () => {
    const user = await renderWritten();

    await user.click(within(headline()).getByRole("button", { name: "with anyone" }));
    await user.click(screen.getByRole("option", { name: "with family" }));

    expect(headline()).toHaveTextContent("home by eleven, with family");
    await waitFor(() =>
      expect(factsLine()).toHaveTextContent("every stop stays, fit for any company"),
    );
  });

  it("takes an assumed word as the visitor's when they choose it again", async () => {
    const user = await renderWritten();
    const onFoot = within(headline()).getByRole("button", { name: "on foot" });
    expect(onFoot).toHaveClass("decoration-dotted");

    await user.click(onFoot);
    await user.click(screen.getByRole("option", { name: "on foot" }));

    expect(within(headline()).getByRole("button", { name: "on foot" })).not.toHaveClass(
      "decoration-dotted",
    );
    expect(factsLine()).not.toHaveTextContent("click a word to change it");
  });

  it("marks an energy the intake assumed as Lantern's, until the visitor chooses it", async () => {
    const user = userEvent.setup();
    const request: DayRequest = { ...KANAZAWA_START_REQUEST, energySource: "assumed" };
    const written = normalizeDay(request, KANAZAWA_START_DAY.day);
    if (!written.ok) throw new Error(written.reason);
    render(
      <DayStage
        request={request}
        partial={null}
        outcome={{ kind: "complete", itinerary: written.itinerary }}
        isStreaming={false}
        isChosen={false}
        onPlay={() => undefined}
        onRetry={() => undefined}
      />,
    );
    await waitForTheDay();
    const calm = within(headline()).getByRole("button", { name: "calm" });
    expect(calm).toHaveClass("decoration-dotted");

    await user.click(calm);
    await user.click(screen.getByRole("option", { name: "calm" }));

    expect(within(headline()).getByRole("button", { name: "calm" })).not.toHaveClass(
      "decoration-dotted",
    );
  });

  it("takes a city the visitor types over one Lantern assumed as theirs", async () => {
    const user = userEvent.setup();
    const request: DayRequest = { ...KANAZAWA_START_REQUEST, citySource: "assumed" };
    const written = normalizeDay(request, KANAZAWA_START_DAY.day);
    if (!written.ok) throw new Error(written.reason);
    const onPlay = vi.fn();
    render(
      <DayStage
        request={request}
        partial={null}
        outcome={{ kind: "complete", itinerary: written.itinerary }}
        isStreaming={false}
        isChosen={false}
        onPlay={onPlay}
        onRetry={() => undefined}
      />,
    );
    await waitForTheDay();

    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    await user.keyboard("Porto{Enter}");

    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({ city: "Porto", citySource: "chosen" }),
    );
  });

  it("re-picks the day from the versions already written when the energy word changes", async () => {
    const user = await renderWritten();

    await user.click(within(headline()).getByRole("button", { name: "calm" }));
    await user.click(screen.getByRole("option", { name: "lively" }));

    expect(headline()).toHaveTextContent("A lively Saturday in Kanazawa");
    await waitFor(() =>
      expect(screen.getAllByText("Seafood Grills in Omicho").length).toBeGreaterThan(0),
    );
    // On the chart; the list to read beside it names the planned version among the others.
    const chart = screen.getByRole("list", { name: "The day" });
    expect(
      within(chart).queryByText("Seafood Bowls at Omicho Market", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("titles the tab with the energy re-picked on the day, and keeps the day's address", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/day/kanazawa");
    render(<Day first={KANAZAWA_START_REQUEST} isAddressed />);
    await waitForTheDay();
    expect(document.title).toBe("A calm Saturday in Kanazawa, early start · Lantern");

    await user.click(within(headline()).getByRole("button", { name: "calm" }));
    await user.click(screen.getByRole("option", { name: "lively" }));

    expect(headline()).toHaveTextContent("A lively Saturday in Kanazawa");
    expect(document.title).toBe("A lively Saturday in Kanazawa, early start · Lantern");
    expect(window.location.pathname).toBe("/day/kanazawa");
    window.history.replaceState(null, "", "/");
  });

  it("plays another written day from the city word, whole sentence and all", async () => {
    const user = await renderWritten();

    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    expect(screen.getByRole("button", { name: /^Kanazawa\s*this day$/ })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));

    expect(headline()).toHaveTextContent("A lively Saturday in Bologna");
    await waitFor(() => expect(headline()).toHaveTextContent("with friends"), DAY_TIMEOUT);
    expect(within(headline()).getByRole("button", { name: "Bologna" })).toHaveFocus();
    await waitForTheDay();
    expect(headline()).toHaveTextContent("on foot, slow morning");
  });

  it("holds the room the day before had under the next day's header until its own is known", async () => {
    const day = createRef<DayHandle>();
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} ref={day} />);
    await waitForTheDay();
    holdsRoomOf(headerRoom(), HELD_ROOM_PX);
    // Bologna's stream waits before its first word, as a slow start does, so its room is unknown.
    route.pace = { startDelayMs: SLOW_START_MS };

    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));

    // Bologna's header keeps Kanazawa's room, so the chart under it stays where it stood...
    expect(headline()).toHaveTextContent("A lively Saturday in Bologna");
    expect(roomFloor().style.minHeight).toBe(`${HELD_ROOM_PX}px`);
    // ...until its line about the day is written, when its own room takes over and its stops land.
    await waitForTheDay();
    expect(roomFloor().style.minHeight).toBe("");

    // A replay writes the day again from its empty frame.
    holdsRoomOf(headerRoom(), HELD_ROOM_PX);
    act(() => day.current?.replay());
    expect(roomFloor().style.minHeight).toBe("");
  });

  it("moves through the city list with the arrows, and closes it on Escape or Tab", async () => {
    const user = await renderWritten();
    const city = within(headline()).getByRole("button", { name: "Kanazawa" });

    // Opened at the day on screen, Kanazawa's, the third written day.
    await user.click(city);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /^Madrid/ })).toHaveFocus();
    // Up past the first day, round to the field.
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("textbox", { name: "Somewhere else" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Where" })).not.toBeInTheDocument();
    expect(city).toHaveFocus();

    await user.click(city);
    screen.getByRole("textbox", { name: "Somewhere else" }).focus();
    await user.tab();
    expect(screen.queryByRole("group", { name: "Where" })).not.toBeInTheDocument();
  });

  it("closes the city list when the day on screen is chosen again", async () => {
    const user = await renderWritten();
    const city = within(headline()).getByRole("button", { name: "Kanazawa" });

    await user.click(city);
    await user.click(screen.getByRole("button", { name: /^Kanazawa\s*this day$/ }));

    expect(screen.queryByRole("group", { name: "Where" })).not.toBeInTheDocument();
    expect(city).toHaveFocus();
  });

  it("says a city Lantern has no day for back as asked, with the days that are written", async () => {
    const user = await renderWritten();

    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    expect(screen.getByRole("textbox", { name: "Somewhere else" })).toHaveFocus();
    await user.keyboard("Paris{Enter}");

    expect(headline()).toHaveTextContent(/^A calm Saturday in Paris, early start$/);
    await expectNotice(NOT_WRITING_YET);
    expect(screen.queryByRole("group", { name: /The day's energy/ })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "A quiet Saturday in Nafplio, slow morning" }),
    );
    expect(headline()).toHaveTextContent("A quiet Saturday in Nafplio");
    await waitForTheDay();
    expect(
      screen.getAllByRole("button", { name: /^Coffee on Staikopoulou/ }).length,
    ).toBeGreaterThan(0);
  });

  it("takes a typed city that is written as its written day, and ignores an empty one", async () => {
    const user = await renderWritten();

    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    await user.keyboard("   {Enter}");
    expect(screen.getByRole("group", { name: "Where" })).toBeInTheDocument();
    await user.keyboard("bologna{Enter}");

    await waitFor(() => expect(headline()).toHaveTextContent("with friends"), DAY_TIMEOUT);
    expect(headline()).toHaveTextContent("A lively Saturday in Bologna");
  });

  it("says Lantern is resting when its own cap answers, with the starts' days", async () => {
    route.status = 429;
    render(<Day first={KANAZAWA_START_REQUEST} />);

    await expectNotice(RESTING);
    expect(writtenDaysOffered()).toEqual(OFFERED_SENTENCES);
  });

  it("never shows the date or axes of a day written again that ends within its first beat", async () => {
    route.endings = [{ kind: "cut", at: 400, by: "error" }];
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} />);
    const retry = await screen.findByRole("button", { name: "Write it again" }, DAY_TIMEOUT);
    route.status = 429;
    let isDayShown = false;
    const note = () => {
      const date = screen.queryByText(/^Sat 14 Nov/, SEEN);
      if (date || screen.queryByRole("group", { name: /The day's energy/ })) isDayShown = true;
    };
    const watch = new MutationObserver(note);
    watch.observe(document.body, { subtree: true, childList: true, characterData: true });

    await user.click(retry);

    // Played in place of a day that ended without one, it waits a beat for its date and
    // axes; its own notice is there whole first, and stays past the beat.
    await expectNotice(RESTING);
    await act(() => new Promise((resolve) => window.setTimeout(resolve, AFTER_THE_BEAT_MS)));
    watch.disconnect();
    expect(endingLine()).toHaveTextContent(RESTING);
    expect(isDayShown).toBe(false);
  });

  it("says a day it could not finish, and writes it again on request", async () => {
    route.endings = [{ kind: "cut", at: 400, by: "error" }];
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} />);

    const retry = await screen.findByRole("button", { name: "Write it again" }, DAY_TIMEOUT);
    expect(endingLine()).toHaveTextContent(
      `${UNFINISHED} Write it again, or open one it has written:`,
    );
    expect(writtenDaysOffered()).toEqual(SENTENCES_BESIDES_KANAZAWA);
    // No place came, so no sun's times will: the room held for them is let go.
    expect(screen.queryByText("sunrise 00:00")).not.toBeInTheDocument();
    await user.click(retry);

    await waitForTheDay();
    expect(screen.queryByRole("button", { name: "Write it again" })).not.toBeInTheDocument();
    // As after choosing a written day, the focus comes back to the day's city word.
    expect(within(headline()).getByRole("button", { name: /^Kanazawa/ })).toHaveFocus();
  });

  it("says the connection dropped, and offers the day again", async () => {
    route.endings = [{ kind: "offline" }];
    render(<Day first={KANAZAWA_START_REQUEST} />);

    await screen.findByRole("button", { name: "Write it again" }, DAY_TIMEOUT);
    expect(endingLine()).toHaveTextContent(
      `${CONNECTION_DROPPED} Write it again, or open one it has written:`,
    );
  });

  it("offers no retry for a day Lantern will not plan, and only the other written days", async () => {
    route.endings = [{ kind: "refused", at: 400 }];
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} />);

    await expectNotice(`${REFUSED_LINE} Open one it has written:`);
    expect(screen.queryByRole("button", { name: "Write it again" })).not.toBeInTheDocument();
    expect(writtenDaysOffered()).toEqual(SENTENCES_BESIDES_KANAZAWA);

    await user.click(
      screen.getByRole("button", { name: "A quiet Saturday in Nafplio, slow morning" }),
    );
    expect(headline()).toHaveTextContent("A quiet Saturday in Nafplio");
    await waitForTheDay();
  });

  it("says a written day that did not come is busy, and over another city that it is not written", async () => {
    route.endings = [{ kind: "rejected" }];
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} />);

    const retry = await screen.findByRole("button", { name: "Write it again" }, DAY_TIMEOUT);
    expect(endingLine()).toHaveTextContent(`${BUSY} Write it again`);
    expect(writtenDaysOffered()).toEqual([]);
    expect(screen.queryByText(NOT_WRITING_YET)).not.toBeInTheDocument();

    await user.click(retry);
    await waitForTheDay();
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    await user.keyboard("Paris{Enter}");

    await expectNotice(NOT_WRITING_YET);
    expect(screen.queryByText(BUSY, { exact: false })).not.toBeInTheDocument();
  });

  it("keeps the room it held for any day's clauses once its own stream has ended", async () => {
    render(<Day first={KANAZAWA_START_REQUEST} />);

    await waitForTheDay();
    // Unseen under the header: the longest clauses the curve could add to any day, held for
    // the whole run, so the room never closes under rows already written.
    const reserve = [...document.querySelectorAll("header [aria-hidden]")]
      .map((copy) => copy.textContent ?? "")
      .join(" ");
    for (const clause of widestClauses()) expect(reserve).toContain(clause);
  });

  it("ends the chart's frame on the whole hour after the last stop once the day is written", async () => {
    // A stream that takes its time, so the frame, drawn once the line about the day is whole,
    // is read before the day is written.
    route.pace = { deltaChars: 1024, deltaDelayMs: 20 };
    render(<Day first={KANAZAWA_START_REQUEST} />);

    // While the day is written its frame keeps the hours asked, 07:00 to 23:00.
    const chart = await screen.findByRole("group", { name: /The day's energy/ });
    expect(chart).toHaveAttribute("aria-busy", "true");
    const asked = Number(chart.getAttribute("height"));
    expect(asked).toBe(CHART_HEIGHT);
    await waitForTheDay(SLOW_DAY_TIMEOUT);

    // Its last visit ends at 20:15, so the frame now ends at 21:00, at the pace it kept.
    const pace = (CHART_HEIGHT - FRAME_INSETS) / HOURS_ASKED_IN_KANAZAWA;
    expect(asked - Number(chart.getAttribute("height"))).toBeCloseTo(pace * HOURS_CUT_IN_KANAZAWA);
  });

  it("keeps what a cut stream wrote, and lets its words be changed", async () => {
    route.endings = [{ kind: "cut", at: IN_THE_SWAPS, by: "length" }];
    render(<Day first={KANAZAWA_START_REQUEST} />);

    await waitForTheDay();
    expect(factsLine()).toHaveTextContent("click a word to change it");
  });

  it("replays the request on screen, not the one it landed on", async () => {
    const day = createRef<DayHandle>();
    const user = userEvent.setup();
    render(<Day first={KANAZAWA_START_REQUEST} ref={day} />);
    await waitForTheDay();
    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));
    await waitForTheDay();
    vi.mocked(fetch).mockClear();

    act(() => day.current?.replay());

    await waitForTheDay();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ city: "Bologna" });
    expect(headline()).toHaveTextContent("A lively Saturday in Bologna");
  });
});
