import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, createRef, StrictMode, type Ref } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { isWrittenRequest } from "@/lib/days/written/requests";
import { CITY_SIGNATURE_HEADER, type IntakeRouteAnswer } from "@/lib/intake/signed-city";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { dayText, simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { sendProductEvent } from "@/lib/events/send-event";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import { REPLAN_ROUTE } from "@/features/itinerary/replan-route";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { Day, type DayHandle } from "./day";
import { INTAKE_ROUTE, readIntakeRoute } from "./intake-route";
import { isKeptSeen } from "./seen-days";
import { readYourDays } from "./your-days";
import { writtenPool } from "./written-pool";

/**
 * A page another route hides while a day or a part's proposal is written, then shows again.
 * With `cacheComponents` on, Next hides the route a client navigation leaves in React's
 * `<Activity>` and keeps it: its effects are cleaned up as it hides and run again as it shows
 * ("Navigation with Activity" in Next's cacheComponents docs), so these tests hide the page
 * the same way. The day and the proposal read on while the page is hidden, nothing is asked of
 * a route twice, and the page shown again holds them as far as they have been written, or
 * whole. React's Strict Mode runs a page's effects twice as it mounts, which asks nothing twice
 * either.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
const LONG_TEST_MS = 20_000;
const POOL = writtenPool();

const SIGNED_KYOTO = { city: "Kyoto", timezone: "Asia/Tokyo", signature: "kyoto-signed" };
const KYOTO_DAY_ID = "3e5b7d9f-1a2c-4e6f-8b0d-2c4e6a8b0d1f";
const REPLAN_ID = "5d7c3b1e-2a4f-4c6d-8e9a-0b1c2d3e4f5a";

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

const intakeReplies: { status: number; body: IntakeRouteAnswer }[] = [];
/**
 * "slow": header and first stops, then, unless stopped first, the rest once the test lets it
 * go, as a live model writes on; "late": the same, answered only once the test lets it go.
 */
const dayReplies: ("slow" | "late")[] = [];
const dayIds: string[] = [];
const dayPosts: { request: DayRequest; signature: string | null; signal: AbortSignal }[] = [];
/** A re-plan sent so far, then, unless stopped first, the rest once the test lets it go. */
interface SlowReplan {
  slow: GeneratedReplan;
  at: number;
}
const replanReplies: (GeneratedReplan | SlowReplan)[] = [];
const replanPosts: { signal: AbortSignal }[] = [];

vi.mock("@/lib/events/send-event", () => ({ sendProductEvent: vi.fn() }));

const SLOW_AT = 2400;
/**
 * What each answer holds back until the test lets it go, so no test's clock decides whether a
 * day is still being written when its page is hidden: the rest of a slow answer, and the
 * whole of a late one.
 */
const heldBack: (() => void)[] = [];
const letGo = () => {
  for (const release of heldBack.splice(0)) release();
};

/** Sends `first`, then, unless the signal stops it, `rest` and the stream's end. */
function slowBody(first: string, rest: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(first));
      signal.addEventListener("abort", () => controller.error(signal.reason));
      heldBack.push(() => {
        if (signal.aborted) return;
        controller.enqueue(encoder.encode(rest));
        controller.close();
      });
    },
  });
}

const sse = (data: string) => `data: ${data}\n\n`;
const textDelta = (id: string, delta: string) =>
  sse(JSON.stringify({ type: "text-delta", id, delta }));

function slowDayResponse(signal: AbortSignal): Response {
  const text = dayText(KYOTO_DAY.day);
  const first = textDelta("day", text.slice(0, SLOW_AT));
  const rest =
    textDelta("day", text.slice(SLOW_AT)) +
    sse(JSON.stringify({ type: "finish", finishReason: "stop" })) +
    sse("[DONE]");
  return new Response(slowBody(first, rest, signal), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** The slow answer, sent only once the test lets it go, unless stopped first. */
function lateDayResponse(signal: AbortSignal): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    signal.addEventListener("abort", () =>
      reject(new DOMException("The day was stopped", "AbortError")),
    );
    heldBack.push(() => {
      if (!signal.aborted) resolve(slowDayResponse(signal));
    });
  });
}

function replanStreamOf(reply: GeneratedReplan | SlowReplan, signal: AbortSignal): Response {
  const isSlow = "slow" in reply;
  const whole = JSON.stringify(isSlow ? reply.slow : reply);
  const cut = isSlow ? Math.floor(whole.length * reply.at) : whole.length;
  const deltasOf = (text: string) => {
    let sent = "";
    for (let start = 0; start < text.length; start += 200) {
      sent += textDelta("t", text.slice(start, start + 200));
    }
    return sent;
  };
  const opening =
    sse(JSON.stringify({ type: "start" })) + sse(JSON.stringify({ type: "text-start", id: "t" }));
  const ending =
    sse(JSON.stringify({ type: "text-end", id: "t" })) +
    sse(JSON.stringify({ type: "finish" })) +
    sse("[DONE]");
  const headers = new Headers({ "Content-Type": "text/event-stream" });
  headers.set(DAY_ID_HEADER, REPLAN_ID);
  if (!isSlow) return new Response(opening + deltasOf(whole) + ending, { headers });
  const first = opening + deltasOf(whole.slice(0, cut));
  const rest = deltasOf(whole.slice(cut)) + ending;
  return new Response(slowBody(first, rest, signal), { headers });
}

async function withDayId(answer: Promise<Response> | Response, id: string): Promise<Response> {
  const response = await answer;
  const headers = new Headers(response.headers);
  headers.set(DAY_ID_HEADER, id);
  return new Response(response.body, { status: response.status, headers });
}

async function answerRoutes(path: string, init: RequestInit): Promise<Response> {
  const id = path === DAY_ROUTE ? dayIds.shift() : undefined;
  const answer = answerRoute(path, init);
  return id === undefined ? answer : withDayId(answer, id);
}

async function answerRoute(path: string, init: RequestInit): Promise<Response> {
  if (path === INTAKE_ROUTE) {
    const reply = intakeReplies.shift();
    if (reply === undefined) throw new Error("The intake was asked once more than the test said");
    return Response.json(reply.body, { status: reply.status });
  }
  const signal = init.signal ?? new AbortController().signal;
  if (path === REPLAN_ROUTE) {
    replanPosts.push({ signal });
    const replan = replanReplies.shift();
    if (replan === undefined) return Response.json({ reason: "most of the day" }, { status: 409 });
    return replanStreamOf(replan, signal);
  }
  if (path.startsWith(`${DAY_ROUTE}/`)) return new Response(null, { status: 404 });
  if (path !== DAY_ROUTE) throw new Error(`Nothing answers ${path}`);
  const request = JSON.parse(String(init.body)) as DayRequest;
  const signature = new Headers(init.headers).get(CITY_SIGNATURE_HEADER);
  dayPosts.push({ request, signature, signal });
  if (isWrittenRequest(request)) {
    return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
  }
  if (signature !== SIGNED_KYOTO.signature) return new Response(null, { status: 403 });
  const reply = dayReplies.shift();
  if (reply === "slow") return slowDayResponse(signal);
  if (reply === "late") return lateDayResponse(signal);
  return simulateDayStream({
    day: KYOTO_DAY.day,
    ending: { kind: "finished" },
    pace: { deltaChars: 64 },
    signal,
  });
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
  heldBack.length = 0;
  vi.mocked(sendProductEvent).mockClear();
  intakeReplies.length = 0;
  dayReplies.length = 0;
  dayIds.length = 0;
  dayPosts.length = 0;
  replanReplies.length = 0;
  replanPosts.length = 0;
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });
const dayList = () => screen.getByRole("list", { name: "The day" });
const energyGroup = () => screen.getByRole("group", { name: /The day's energy/ });
const keptDays = () => readYourDays(window.localStorage).map(({ id, ending }) => [id, ending]);
/** How each day the page has ended was told to have ended. */
const endingsSent = () =>
  vi
    .mocked(sendProductEvent)
    .mock.calls.flatMap(([event]) => (event.kind === "day-ended" ? [event.outcome] : []));
/** Whether every post to the day's route is still being read, none of them stopped. */
const isNoDayStopped = () => dayPosts.every(({ signal }) => !signal.aborted);

async function waitForTheDay(): Promise<void> {
  await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
  await waitFor(() => expect(energyGroup()).toHaveAttribute("aria-busy", "false"), DAY_TIMEOUT);
}

/** Kyoto's day whole, every one of its stops on the chart. */
function expectKyotoWhole(): void {
  expect(energyGroup()).toHaveAttribute("aria-busy", "false");
  expect(within(dayList()).getAllByRole("listitem")).toHaveLength(KYOTO_DAY.day.stops.length);
}

interface Hideable {
  user: ReturnType<typeof userEvent.setup>;
  hide: () => void;
  show: () => void;
  /** Another page shows, as Privacy opens, and Back shows this one again at once. */
  hideAndShow: () => void;
}

/**
 * The start screen, live, inside the Activity boundary another route's navigation toggles: a
 * page that counts its events, as the product's does.
 */
function renderHideable(handle?: Ref<DayHandle>): Hideable {
  const user = userEvent.setup();
  const page = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <Day
        start={{ pool: POOL, read: readIntakeRoute }}
        isLive
        isAddressed
        isCounted
        ref={handle}
      />
    </Activity>
  );
  const { rerender } = render(page("visible"));
  const hide = () => act(() => rerender(page("hidden")));
  const show = () => act(() => rerender(page("visible")));
  return {
    user,
    hide,
    show,
    hideAndShow: () => {
      hide();
      show();
    },
  };
}

async function askKyoto(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  intakeReplies.push({
    status: 200,
    body: {
      kind: "request",
      request: KYOTO_REQUEST,
      readings: [],
      unplaced: [],
      signed: [SIGNED_KYOTO],
    },
  });
  await user.type(screen.getByRole("textbox", { name: "Where, and anything else" }), "Kyoto");
  await user.click(screen.getByRole("button", { name: "Plan this day" }));
}

/** Long enough for an answer let go to be read and drawn. */
const READ_MS = 400;
const DRAWN_MS = 1500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * Lets every answer go and waits for the page to take it: twice, since a late answer, once it
 * answers, holds back the rest of its own text.
 */
const settle = () =>
  act(async () => {
    letGo();
    await wait(READ_MS);
    letGo();
    await wait(DRAWN_MS);
  });

/** How long the page stays hidden: a moment, or until what it was writing has ended. */
type HiddenFor = "a moment" | "past the end";

/** Kyoto's day from the start screen, taken the page and still being written. */
async function dayMidStream(): Promise<Hideable> {
  const page = renderHideable();
  dayReplies.push("slow");
  await askKyoto(page.user);
  // The day took the page, its header and first stops written, the rest still to come.
  await waitFor(() => expect(headline()).toHaveTextContent(/in Kyoto/), DAY_TIMEOUT);
  await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
  expect(energyGroup()).toHaveAttribute("aria-busy", "true");
  return page;
}

async function hideThenShow(page: Hideable, hidden: HiddenFor): Promise<void> {
  if (hidden === "a moment") {
    page.hideAndShow();
    await settle();
    return;
  }
  page.hide();
  await settle();
  page.show();
}

/** Kyoto's day whole, then a part's proposal asked and still being written. */
async function proposalMidStream(): Promise<Hideable> {
  const page = renderHideable();
  dayIds.push(KYOTO_DAY_ID);
  await askKyoto(page.user);
  await waitForTheDay();
  replanReplies.push({ slow: KYOTO_SLOW_MORNING, at: 0.62 });
  await page.user.click(within(headline()).getByRole("button", { name: "early start" }));
  await page.user.click(screen.getByRole("option", { name: "slow morning" }));
  await waitFor(
    () =>
      expect(
        screen.getAllByRole("radio", { name: "slow morning, being written" })[0],
      ).toBeDefined(),
    DAY_TIMEOUT,
  );
  expect(livelyButton()).toHaveAttribute("aria-disabled", "true");
  return page;
}

const livelyButton = () =>
  within(screen.getByRole("group", { name: "How lively the day is" })).getByRole("button", {
    name: "lively",
  });

/** The proposal whole beside the day, and the fork's other words free again. */
async function expectProposalWhole(): Promise<void> {
  await waitFor(
    () => expect(screen.getAllByRole("radio", { name: "slow morning, proposed" })[0]).toBeDefined(),
    DAY_TIMEOUT,
  );
  expect(screen.queryAllByRole("radio", { name: "slow morning, being written" })).toHaveLength(0);
  expect(livelyButton()).not.toHaveAttribute("aria-disabled", "true");
  // One re-plan asked, read to its end.
  expect(replanPosts).toHaveLength(1);
  expect(replanPosts[0]?.signal.aborted).toBe(false);
}

describe("a day written while its page is hidden by another route", () => {
  it(
    "writes a day taken from the start screen to its end when nothing hides the page",
    async () => {
      await dayMidStream();
      await settle();

      expectKyotoWhole();
      expect(dayPosts).toHaveLength(1);
    },
    LONG_TEST_MS,
  );

  it.each<HiddenFor>(["a moment", "past the end"])(
    "writes a day taken from the start screen to its end, asked once, when the page is hidden for %s",
    async (hidden) => {
      const page = await dayMidStream();

      await hideThenShow(page, hidden);

      await waitForTheDay();
      expectKyotoWhole();
      // A day the route writes to its end anyway is never asked, or paid for, twice.
      expect(dayPosts).toHaveLength(1);
      expect(isNoDayStopped()).toBe(true);
    },
    LONG_TEST_MS,
  );

  it(
    "keeps the day's row writing while the page is hidden past its end, then written, seen and told ended once the page shows it whole",
    async () => {
      dayIds.push(KYOTO_DAY_ID);
      const page = await dayMidStream();
      await waitFor(() => expect(keptDays()).toEqual([[KYOTO_DAY_ID, "writing"]]));

      page.hide();
      await settle();
      // Nothing the page does as it draws the day runs while it is hidden: the day has ended,
      // but no one has seen its end.
      expect(keptDays()).toEqual([[KYOTO_DAY_ID, "writing"]]);
      expect(isKeptSeen(KYOTO_DAY_ID)).toBe(false);
      expect(endingsSent()).toEqual([]);

      page.show();
      await waitForTheDay();
      expectKyotoWhole();
      expect(keptDays()).toEqual([[KYOTO_DAY_ID, "written"]]);
      expect(isKeptSeen(KYOTO_DAY_ID)).toBe(true);
      expect(endingsSent()).toEqual(["complete"]);
      expect(dayPosts).toHaveLength(1);
    },
    LONG_TEST_MS,
  );

  it(
    "asks the route once for a day on its way on the start screen, which takes the page whole once the page shows again",
    async () => {
      const page = renderHideable();
      dayReplies.push("late");
      await askKyoto(page.user);
      await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
      expect(headline()).toHaveTextContent(/^One day in a city/);

      page.hideAndShow();
      await settle();

      await waitForTheDay();
      expect(headline()).toHaveTextContent(/in Kyoto/);
      expectKyotoWhole();
      expect(dayPosts).toHaveLength(1);
      expect(isNoDayStopped()).toBe(true);
    },
    LONG_TEST_MS,
  );

  it(
    "asks nothing again of a day played from the day on screen, nor of the whole day a changed word writes from it",
    async () => {
      const handle = createRef<DayHandle>();
      const page = renderHideable(handle);
      await askKyoto(page.user);
      await waitForTheDay();
      // The same day written again, from its empty frame, then a word the whole day is written
      // again for, still being written as the page is hidden.
      act(() => handle.current?.replay());
      await waitFor(() => expect(dayPosts).toHaveLength(2), DAY_TIMEOUT);
      await waitForTheDay();
      dayReplies.push("slow");
      await page.user.click(within(headline()).getByRole("button", { name: "with anyone" }));
      await page.user.click(screen.getByRole("option", { name: "with family" }));
      await waitFor(() => expect(dayPosts).toHaveLength(3), DAY_TIMEOUT);
      expect(handle.current?.replan()).toMatchObject({ status: "writing", reach: "whole" });

      page.hideAndShow();
      await settle();

      await waitFor(() => expect(handle.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
      expect(dayPosts).toHaveLength(3);
      expect(isNoDayStopped()).toBe(true);

      // The day asked for again by the visitor is asked of the route again, once.
      act(() => handle.current?.replay());
      await waitFor(() => expect(dayPosts).toHaveLength(4), DAY_TIMEOUT);
      await waitForTheDay();
      expect(dayPosts).toHaveLength(4);
    },
    LONG_TEST_MS,
  );
});

describe("a part's proposal written while its page is hidden by another route", () => {
  it(
    "ends a part's proposal when nothing hides the page",
    async () => {
      await proposalMidStream();
      await settle();

      await expectProposalWhole();
    },
    LONG_TEST_MS,
  );

  it.each<HiddenFor>(["a moment", "past the end"])(
    "ends a part's proposal, the fork free again, when the page is hidden for %s",
    async (hidden) => {
      const page = await proposalMidStream();

      await hideThenShow(page, hidden);

      await expectProposalWhole();
    },
    LONG_TEST_MS,
  );
});

describe("a day played as React's Strict Mode mounts its page, running its effects twice", () => {
  it(
    "asks the route once, and writes the day to its end",
    async () => {
      render(
        <StrictMode>
          <Day first={KANAZAWA_START_REQUEST} />
        </StrictMode>,
      );

      await waitForTheDay();
      expect(headline()).toHaveTextContent(/in Kanazawa/);
      expect(dayPosts).toHaveLength(1);
      expect(isNoDayStopped()).toBe(true);
    },
    LONG_TEST_MS,
  );
});
