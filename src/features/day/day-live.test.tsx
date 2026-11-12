import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type Ref } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PORTLAND_MAINE, PORTLAND_OREGON } from "@/lib/fixtures/city-readings";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST, MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import { isWrittenRequest } from "@/lib/days/written/requests";
import {
  CITY_SIGNATURE_HEADER,
  signedKeyOf,
  type IntakeRouteAnswer,
} from "@/lib/intake/signed-city";
import type { IntakeWords } from "@/lib/schema/intake.schema";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { dayText, simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import { readYourDays } from "./your-days";
import { forgetDays } from "./use-your-days";
import { keepCaveats, readCaveats } from "./caveats";
import { keptViewOf } from "./kept-day";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { REPLAN_ROUTE } from "@/features/itinerary/replan-route";
import { CANDIDATE_ATTRIBUTE } from "@/features/abacus/chart-stop";
import { KYOTO_ITINERARY, KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import { KYOTO_LATE_EVENING } from "@/lib/fixtures/replan/kyoto-evening";
import type { ReplanRequest } from "@/lib/replan/request";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { Day, type DayHandle } from "./day";
import { isKeptSeen } from "./seen-days";
import { INTAKE_ROUTE, readIntakeRoute } from "./intake-route";
import { replanEndedOf, replanningOf, UNFINISHED } from "./not-yet";
import { NOT_LIVE_NOTE } from "./start-header";
import { StartDay } from "./start-day";
import { writtenPool } from "./written-pool";
import { TAKE_THIS_DAY } from "./day-menu";

/**
 * The start screen and the day with live generation on, against stand-ins of both routes:
 * the intake answers what each test gives it, and the day route streams Kyoto's day for any
 * request whose city it would write, a written day's or one the intake signed, and answers
 * any other with the 403 the live route sends.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
const POOL = writtenPool();

const LISBON: DayRequest = {
  ...KYOTO_REQUEST,
  city: "Lisbon",
  citySource: "chosen",
  timezone: "Europe/Lisbon",
  date: "2026-11-14",
  energy: "calm",
  energySource: "chosen",
};
const SIGNED_LISBON = { city: "Lisbon", timezone: "Europe/Lisbon", signature: "lisbon-signed" };
/** Kyoto has no written day: the intake signs it as any city. */
const SIGNED_KYOTO = { city: "Kyoto", timezone: "Asia/Tokyo", signature: "kyoto-signed" };
/** The signatures the stand-in intake hands out, by city and zone, as the day route checks them. */
const SIGNATURES = new Map<string, string>(
  [
    SIGNED_LISBON,
    SIGNED_KYOTO,
    { city: "Portland", timezone: PORTLAND_OREGON.timezone, signature: "oregon-signed" },
    { city: "Portland", timezone: PORTLAND_MAINE.timezone, signature: "maine-signed" },
  ].map((signed) => [signedKeyOf(signed), signed.signature]),
);

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

/**
 * What the intake route answers next, in order: a status and its body, a lost connection, or
 * nothing until the reading is stopped.
 */
type IntakeReply = { status: number; body: IntakeRouteAnswer } | "offline" | "pending";
const intakeReplies: IntakeReply[] = [];
/**
 * How the route answers the next days a test asks for that Lantern has not written: a day
 * on its way until it is stopped, or an ending without one. Any other is Kyoto's day.
 */
type DayReply =
  | "pending"
  | "held"
  | "cut"
  | "limited"
  | "unavailable"
  | "offline"
  | "refused"
  | "empty"
  | DayRequest;
const dayReplies: DayReply[] = [];

const HTTP_SERVICE_UNAVAILABLE = 503;
/** Where a cut Kyoto day stops: among its swaps, with every stop written, so it is kept. */
const KYOTO_IN_THE_SWAPS = dayText(KYOTO_DAY.day).indexOf('"alternatives"') + 200;

/** The route's answer to a day asked with a reply set for it. */
function dayReplyOf(reply: DayReply, signal: AbortSignal | undefined): Promise<Response> {
  // A written day's own stream, as the route answers its request, for the request asked.
  if (typeof reply === "object") {
    const init = { method: "POST", body: JSON.stringify(reply), signal };
    return answerDayRequest(new Request(new URL(DAY_ROUTE, ORIGIN), init), { deltaChars: 64 });
  }
  switch (reply) {
    case "held":
      return Promise.resolve(heldDayResponse(signal));
    case "cut":
      return simulateDayStream({
        day: KYOTO_DAY.day,
        ending: { kind: "cut", at: KYOTO_IN_THE_SWAPS, by: "length" },
        pace: { deltaChars: 64 },
        signal,
      });
    case "pending":
      return new Promise<Response>((_, reject) =>
        signal?.addEventListener("abort", () =>
          reject(new DOMException("The day was stopped", "AbortError")),
        ),
      );
    case "unavailable":
      return Promise.resolve(new Response(null, { status: HTTP_SERVICE_UNAVAILABLE }));
    case "offline":
      return Promise.reject(new TypeError("Failed to fetch"));
    case "limited":
      return simulateDayStream({
        day: KYOTO_DAY.day,
        ending: { kind: "limited" },
        pace: { deltaChars: 64 },
        signal,
      });
    case "refused":
      return simulateDayStream({
        day: KYOTO_DAY.day,
        ending: { kind: "refused", at: 0 },
        pace: { deltaChars: 64 },
        signal,
      });
    case "empty":
      return Promise.resolve(emptyDayResponse());
  }
}

/** How long the empty day waits with its stops open: past a frame, or several. */
const OPEN_STOPS_MS = 300;
const STOPS_OPEN = '"stops":[';

/**
 * Kyoto's day as the model wrote it once live: its header whole and its stops opened, then,
 * as a live stream can wait between two tokens, closed with none in them. A day that took
 * the page once its header had streamed would have taken it during the wait.
 */
function emptyDayResponse(): Response {
  const text = dayText({ ...KYOTO_DAY.day, stops: [], alternatives: [] });
  const opened = text.indexOf(STOPS_OPEN) + STOPS_OPEN.length;
  const encoder = new TextEncoder();
  const event = (data: string) => encoder.encode(`data: ${data}\n\n`);
  const delta = (part: string) =>
    event(JSON.stringify({ type: "text-delta", id: "day", delta: part }));
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(delta(text.slice(0, opened)));
      await new Promise((resolve) => setTimeout(resolve, OPEN_STOPS_MS));
      controller.enqueue(delta(text.slice(opened)));
      controller.enqueue(event(JSON.stringify({ type: "finish", finishReason: "stop" })));
      controller.enqueue(event("[DONE]"));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}
/**
 * Kyoto's day as a live model streams it, its header and its first stops written, then
 * holding the rest back until the visitor lets it go.
 */
function heldDayResponse(signal: AbortSignal | undefined): Response {
  const text = dayText(KYOTO_DAY.day);
  const encoder = new TextEncoder();
  const event = (data: string) => encoder.encode(`data: ${data}\n\n`);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        event(JSON.stringify({ type: "text-delta", id: "day", delta: text.slice(0, HELD_AT) })),
      );
      signal?.addEventListener("abort", () => controller.error(signal.reason));
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}
/** How much of a held day's text arrives: its header and its first stops. */
const HELD_AT = 2400;
const intakeTexts: string[] = [];
/** Each day the route was asked for, with the signature it carried. */
const dayPosts: { request: DayRequest; signature: string | null }[] = [];
/** Each targeted re-plan the route was asked for, with the signature it carried. */
const replanPosts: { body: ReplanRequest; signature: string | null; signal: AbortSignal }[] = [];
/**
 * The re-plans the route answers, in turn; with none left it answers a 409, as for a word
 * whose windows hold most of the day, and the page asks for the whole day.
 */
const replanReplies: (GeneratedReplan | CutReplan | HeldReplan)[] = [];

/** The ids the day route names its next answers by, in turn, as the log does once live. */
const dayIds: string[] = [];

/** A day's answer with the id the log keeps it under. */
async function withDayId(answer: Promise<Response> | Response, id: string): Promise<Response> {
  const response = await answer;
  const headers = new Headers(response.headers);
  headers.set(DAY_ID_HEADER, id);
  return new Response(response.body, { status: response.status, headers });
}

/** The re-plan's id in the log, as its answer names it: the merged day's address. */
const REPLAN_ID = "5d7c3b1e-2a4f-4c6d-8e9a-0b1c2d3e4f5a";
/** Someone else's day, opened from their link. */
const SHARED_DAY_ID = "8a1f2b3c-4d5e-4f60-8172-93a4b5c6d7e8";
/** Kyoto's day as a visitor's, kept in the log: no day the site has written. */
const KYOTO_KEPT = { request: KYOTO_REQUEST, itinerary: KYOTO_ITINERARY };
/** The visitor's own Kyoto day, as the log names it. */
const KYOTO_DAY_ID = "3e5b7d9f-1a2c-4e6f-8b0d-2c4e6a8b0d1f";
/** A day asked for after the re-plan merged, as the log names it. */
const NEXT_DAY_ID = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";

/** How long a cut re-plan's stream falls silent before it drops. */
const CUT_SILENCE_MS = 300;

/** A re-plan the route streams only so far, then drops as a lost connection does. */
interface CutReplan {
  cut: GeneratedReplan;
  /** How much of its text arrives, 0 to 1. */
  at: number;
}

/** A re-plan the route streams only so far, then holds until the page lets it go. */
interface HeldReplan {
  held: GeneratedReplan;
  /** How much of its text arrives, 0 to 1. */
  at: number;
}

/** A re-plan's stream as the route sends it: its text in deltas, then its finish or its drop. */
function replanStreamOf(
  reply: GeneratedReplan | CutReplan | HeldReplan,
  signal: AbortSignal,
): Response {
  if ("held" in reply) return heldReplanOf(reply, signal);
  const isCut = "cut" in reply;
  const whole = JSON.stringify(isCut ? reply.cut : reply);
  const text = isCut ? whole.slice(0, Math.floor(whole.length * reply.at)) : whole;
  const events: object[] = [{ type: "start" }, { type: "text-start", id: "t" }];
  for (let start = 0; start < text.length; start += 200) {
    events.push({ type: "text-delta", id: "t", delta: text.slice(start, start + 200) });
  }
  if (!isCut) events.push({ type: "text-end", id: "t" }, { type: "finish" });
  const body = [...events.map((event) => JSON.stringify(event)), ...(isCut ? [] : ["[DONE]"])]
    .map((line) => `data: ${line}\n\n`)
    .join("");
  const headers = new Headers({ "Content-Type": "text/event-stream" });
  if (replanId !== null) headers.set(DAY_ID_HEADER, replanId);
  if (!isCut) return new Response(body, { headers });
  // It falls silent before it drops, as a live stream does, so what it wrote is drawn first.
  const dropped = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      await new Promise((resolve) => setTimeout(resolve, CUT_SILENCE_MS));
      controller.error(new TypeError("network error"));
    },
  });
  return new Response(dropped, { headers });
}

/** A held re-plan's stream: its text so far, then nothing until the page lets it go. */
function heldReplanOf({ held, at }: HeldReplan, signal: AbortSignal): Response {
  const whole = JSON.stringify(held);
  const text = whole.slice(0, Math.floor(whole.length * at));
  const events: object[] = [{ type: "start" }, { type: "text-start", id: "t" }];
  for (let start = 0; start < text.length; start += 200) {
    events.push({ type: "text-delta", id: "t", delta: text.slice(start, start + 200) });
  }
  const sent = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sent));
      signal.addEventListener("abort", () => controller.error(signal.reason));
    },
  });
  const headers = new Headers({ "Content-Type": "text/event-stream" });
  if (replanId !== null) headers.set(DAY_ID_HEADER, replanId);
  return new Response(body, { headers });
}

/** The id the re-plan's answer names; null for an answer that names none. */
let replanId: string | null = REPLAN_ID;

/** Notes whether any row of the day was ever struck through while it watched. */
function watchStruck(list: HTMLElement): { wasStruck: () => boolean; stop: () => void } {
  let isStruck = list.querySelector(".line-through") !== null;
  const observer = new MutationObserver(() => {
    if (list.querySelector(".line-through") !== null) isStruck = true;
  });
  observer.observe(list, { subtree: true, childList: true, attributes: true });
  return { wasStruck: () => isStruck, stop: () => observer.disconnect() };
}

/** What an element shows: its letters, but not those holding room unseen in their place. */
function seenTextOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(".invisible")) text += node.textContent ?? "";
  }
  return text;
}

async function answerRoutes(path: string, init: RequestInit): Promise<Response> {
  const id = path === DAY_ROUTE ? dayIds.shift() : undefined;
  const answer = answerRoute(path, init);
  return id === undefined ? answer : withDayId(answer, id);
}

async function answerRoute(path: string, init: RequestInit): Promise<Response> {
  if (path === INTAKE_ROUTE) {
    intakeTexts.push((JSON.parse(String(init.body)) as { text: string }).text);
    const reply = intakeReplies.shift();
    if (reply === undefined) throw new Error("The intake was asked once more than the test said");
    if (reply === "offline") throw new TypeError("Failed to fetch");
    if (reply === "pending") {
      return new Promise<Response>((_, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("The reading was stopped", "AbortError")),
        ),
      );
    }
    return Response.json(reply.body, { status: reply.status });
  }
  if (path === REPLAN_ROUTE) {
    const body = JSON.parse(String(init.body)) as ReplanRequest;
    const signal = init.signal ?? new AbortController().signal;
    const signature = new Headers(init.headers).get(CITY_SIGNATURE_HEADER);
    replanPosts.push({ body, signature, signal });
    const replan = replanReplies.shift();
    if (replan === undefined) return Response.json({ reason: "most of the day" }, { status: 409 });
    return replanStreamOf(replan, signal);
  }
  if (path !== DAY_ROUTE) throw new Error(`Nothing answers ${path}`);
  const request = JSON.parse(String(init.body)) as DayRequest;
  const signature = new Headers(init.headers).get(CITY_SIGNATURE_HEADER);
  dayPosts.push({ request, signature });
  if (isWrittenRequest(request)) {
    return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
  }
  const isWrittenCity = POOL.some(
    (written) =>
      written.request.city === request.city && written.request.timezone === request.timezone,
  );
  const isSigned = signature !== null && SIGNATURES.get(signedKeyOf(request)) === signature;
  if (!isWrittenCity && !isSigned) return new Response(null, { status: 403 });
  const reply = dayReplies.shift();
  if (reply !== undefined) return dayReplyOf(reply, init.signal ?? undefined);
  return simulateDayStream({
    day: KYOTO_DAY.day,
    ending: { kind: "finished" },
    pace: { deltaChars: 64 },
    signal: init.signal ?? undefined,
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
  intakeReplies.length = 0;
  intakeTexts.length = 0;
  dayPosts.length = 0;
  dayReplies.length = 0;
  replanPosts.length = 0;
  replanReplies.length = 0;
  dayIds.length = 0;
  replanId = REPLAN_ID;
  window.history.replaceState(null, "", "/");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });
const dayList = () => screen.getByRole("list", { name: "The day" });
/** The line under the field, as the start screen says it. */
const saysBack = (sentence: string) =>
  screen.findByText((_, element) => element?.tagName === "P" && element.textContent === sentence);

function renderLive(...replies: IntakeReply[]) {
  intakeReplies.push(...replies);
  const user = userEvent.setup();
  render(<StartDay pool={POOL} isLive />);
  return user;
}

/** The start screen as `StartDay` draws it once live, its day's handle given to the test. */
function renderLiveHandled(handle: Ref<DayHandle>, ...replies: IntakeReply[]) {
  intakeReplies.push(...replies);
  const user = userEvent.setup();
  render(<Day start={{ pool: POOL, read: readIntakeRoute }} isLive isAddressed ref={handle} />);
  return user;
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  await user.type(screen.getByRole("textbox", { name: "Where, and anything else" }), text);
  await user.click(screen.getByRole("button", { name: "Plan this day" }));
}

const answered = (body: IntakeRouteAnswer, status = 200): IntakeReply => ({ status, body });

/** Waits until the day is written and still, when its words can be changed. */
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

/** Kanazawa's written day, landed on with live generation on, its own post forgotten. */
async function landOnKanazawa(...replies: IntakeReply[]) {
  intakeReplies.push(...replies);
  const user = userEvent.setup();
  render(<Day first={KANAZAWA_START_REQUEST} isLive />);
  await waitForTheDay();
  dayPosts.length = 0;
  return user;
}

/**
 * Madrid's written day, landed on with live generation on, its own post forgotten: its
 * company names six of its seven stops, so a change of it writes the whole day again.
 */
async function landOnMadrid() {
  const user = userEvent.setup();
  render(<Day first={MADRID_START_REQUEST} isLive />);
  await waitForTheDay();
  dayPosts.length = 0;
  return user;
}

/**
 * Kyoto's day asked from the start screen, read by the intake and written live under its
 * signature: the visitor's own, kept in the log under the next id a test gives the route.
 * Kyoto has no written day, so a re-plan of it is read from the log. Its own post forgotten.
 */
/** The live facts line, outside every unseen reserve that holds its room. */
function factsLineText(): string | null {
  return (
    [...document.querySelectorAll<HTMLElement>("header p.type-note")].find(
      (each) => each.closest("[aria-hidden]") === null,
    )?.textContent ?? null
  );
}

async function askForKyoto(handle?: Ref<DayHandle>): Promise<ReturnType<typeof userEvent.setup>> {
  const reply = answered({
    kind: "request",
    request: KYOTO_REQUEST,
    readings: [],
    unplaced: [],
    signed: [SIGNED_KYOTO],
  });
  const user = handle === undefined ? renderLive(reply) : renderLiveHandled(handle, reply);
  await ask(user, "Kyoto");
  await waitForTheDay();
  dayPosts.length = 0;
  return user;
}

/** Changes a word of the headline to another of its options. */
async function changeWord(
  user: ReturnType<typeof userEvent.setup>,
  word: string,
  option: string,
): Promise<void> {
  await user.click(within(headline()).getByRole("button", { name: word }));
  await user.click(screen.getByRole("option", { name: option }));
}

/**
 * Takes the proposal from the fork's first row once it is whole: its answer, "proposed" until
 * then "being written", and taken by a press, as a hollow bead is.
 */
async function takeProposal(
  user: ReturnType<typeof userEvent.setup>,
  answer: string,
): Promise<void> {
  const radio = await waitFor(() => {
    const found = screen.getAllByRole("radio", { name: `${answer}, proposed` })[0];
    if (!found) throw new Error(`No proposal of ${answer} to take`);
    return found;
  }, DAY_TIMEOUT);
  await user.click(radio);
}

/** Takes the day before back from the fork's first row, once the proposal is taken. */
async function takeBack(user: ReturnType<typeof userEvent.setup>, answer: string): Promise<void> {
  const radio = screen.getAllByRole("radio", { name: `${answer}, the day before` })[0];
  if (!radio) throw new Error(`No day before of ${answer} to take back`);
  await user.click(radio);
}

/** Every row of the day's chart as it reads, in order. */
const rowTexts = () =>
  within(dayList())
    .getAllByRole("listitem")
    .map((row) => row.textContent);

/** What a fork row says of Madrid's whole day asked "with family", ended without one. */
function endedSaid(ending: Parameters<typeof replanEndedOf>[0]): string {
  return replanEndedOf(ending, "company", "whole");
}

describe("the start screen with live generation on", () => {
  it("says nothing under the question about whether Lantern writes", () => {
    renderLive();

    expect(screen.queryByText(NOT_LIVE_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByText(/one place at a time/)).not.toBeInTheDocument();
  });

  it("sends the text to the intake, and writes the day it read under the city's signature", async () => {
    const user = renderLive(
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: ["with my dog"],
        signed: [SIGNED_LISBON],
      }),
    );

    await ask(user, "Lisbon, a calm day, with my dog");

    expect(intakeTexts).toEqual(["Lisbon, a calm day, with my dog"]);
    await waitFor(
      () => expect(headline()).toHaveTextContent(/^A calm Saturday in Lisbon/),
      DAY_TIMEOUT,
    );
    expect(screen.getAllByText("Lantern can't plan around “with my dog”.")[0]).toBeVisible();
    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(dayPosts).toEqual([{ request: LISBON, signature: "lisbon-signed" }]);
    // A day Lantern has not written word for word keeps the start screen's address.
    expect(window.location.pathname).toBe("/");
  });

  it("asks which city a shared name is, and writes the one chosen under its own signature", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [PORTLAND_OREGON, PORTLAND_MAINE],
        words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
        unplaced: [],
        signed: [
          { city: "Portland", timezone: PORTLAND_OREGON.timezone, signature: "oregon-signed" },
          { city: "Portland", timezone: PORTLAND_MAINE.timezone, signature: "maine-signed" },
        ],
      }),
    );

    await ask(user, "Portland, a lively day");
    await user.click(await screen.findByRole("button", { name: /^Portland, Maine/ }));

    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({ city: "Portland", timezone: PORTLAND_MAINE.timezone }),
        signature: "maine-signed",
      },
    ]);
  });

  it("reads a city typed for the question through the intake, keeping the words it read", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "calm", energySource: "chosen", company: "family" },
        unplaced: [],
      }),
      answered({
        kind: "request",
        request: { ...LISBON, energy: "balanced", energySource: "assumed" },
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );

    await ask(user, "a calm day with my kids");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Lisbon{Enter}");

    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(intakeTexts).toEqual(["a calm day with my kids", "Lisbon"]);
    expect(headline()).toHaveTextContent(/^A calm Saturday in Lisbon, .*with family$/);
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({ city: "Lisbon", energy: "calm", company: "family" }),
        signature: "lisbon-signed",
      },
    ]);
  });

  it("reads the answer to the question in the city's own field, under the question", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "calm", energySource: "chosen", company: "family" },
        unplaced: [],
      }),
      "pending",
    );

    await ask(user, "a calm day with my kids");
    const field = await screen.findByRole("textbox", { name: "Which city?" });
    await user.type(field, "Lisbon{Enter}");

    await screen.findByRole("button", { name: "Reading" });
    expect(screen.getByRole("textbox", { name: "Which city?" })).toBe(field);
    expect(field).toHaveValue("Lisbon");
    expect(field).toHaveAttribute("readonly");
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "A calm day in Lisbon, with family",
      ),
    ).toBeInTheDocument();
  });

  it("gives the field back the focus when the answer to the question plays no day", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "calm", energySource: "chosen" },
        unplaced: [],
      }),
      answered({ kind: "refused" }),
    );

    await ask(user, "a calm day");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Atlantis{Enter}");

    await saysBack("Lantern can't plan that day. Start from one of the days below.");
    expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toHaveFocus();
  });

  it("plays a written city typed for the question without a second read", async () => {
    const user = renderLive(
      answered({
        kind: "question",
        key: "city",
        readings: [],
        words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
        unplaced: [],
      }),
    );

    await ask(user, "a lively day");
    await user.type(await screen.findByRole("textbox", { name: "Which city?" }), "Kanazawa{Enter}");

    await waitFor(() => expect(dayList()).toBeInTheDocument(), DAY_TIMEOUT);
    expect(intakeTexts).toEqual(["a lively day"]);
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({ city: "Kanazawa", energy: "lively" }),
        signature: null,
      },
    ]);
  });

  it.each([
    ["refused", answered({ kind: "refused" }), "Lantern can't plan that day."],
    [
      "limited, our own limit's 429",
      answered({ kind: "limited" }, 429),
      "Lantern has written all the days it can for now.",
    ],
    [
      "unavailable, a 503",
      answered({ kind: "unavailable" }, 503),
      "Lantern couldn't read that just now.",
    ],
    // A deploy without its key or salt answers as an intake that could not run.
    [
      "misconfigured, the same 503",
      answered({ kind: "unavailable" }, 503),
      "Lantern couldn't read that just now.",
    ],
    ["a lost connection", "offline" as const, "Lantern couldn't read that just now."],
  ])(
    "says an intake answered %s in its own words, and writes no day",
    async (_name, reply, said) => {
      const user = renderLive(reply);

      await ask(user, "Amsterdam");

      expect(await saysBack(`${said} Start from one of the days below.`)).toBeVisible();
      expect(screen.getByRole("textbox")).toHaveValue("Amsterdam");
      expect(dayPosts).toEqual([]);
    },
  );

  it("answers a body that is not an intake answer as a reading that could not run", async () => {
    const user = renderLive(answered({ kind: "nonsense" } as unknown as IntakeRouteAnswer));

    await ask(user, "Amsterdam");

    expect(
      await saysBack("Lantern couldn't read that just now. Start from one of the days below."),
    ).toBeVisible();
  });
});

// `docs/decisions.md`, "A day has at least one stop".
describe("a first day that comes back empty, with live generation on", () => {
  const ASKED_FOR_LISBON = answered({
    kind: "request",
    request: LISBON,
    readings: [],
    unplaced: [],
    signed: [SIGNED_LISBON],
  });

  it("is asked for once more under the same signature, and written", async () => {
    const user = renderLive(ASKED_FOR_LISBON);
    dayReplies.push("empty");

    await ask(user, "Lisbon, a calm day");

    await waitForTheDay();
    expect(dayPosts).toEqual([
      { request: LISBON, signature: "lisbon-signed" },
      { request: LISBON, signature: "lisbon-signed" },
    ]);
    expect(screen.queryByText(UNFINISHED, { exact: false })).not.toBeInTheDocument();
  });

  it("holds what the empty day wrote, and its city word the focus, while it is asked again", async () => {
    const user = renderLive(ASKED_FOR_LISBON);
    dayReplies.push("empty", "pending");

    await ask(user, "Lisbon, a calm day");

    // The empty day takes the page as any first day does, its city word the focus.
    // The line about the day is set unseen too, to measure its room: any copy is the line.
    expect(await screen.findAllByText(KYOTO_DAY.day.dek, {}, DAY_TIMEOUT)).not.toHaveLength(0);
    await waitFor(() => expect(document.activeElement?.closest("h1")).not.toBeNull());
    const city = document.activeElement;
    await waitFor(() => expect(dayPosts).toHaveLength(2), DAY_TIMEOUT);

    // Asked again, the day is never drawn from its empty frame: its line about the day stays,
    // and the city word that took the focus keeps it, rather than another taking it again.
    expect(screen.queryAllByText(KYOTO_DAY.day.dek)).not.toHaveLength(0);
    expect(city?.isConnected).toBe(true);
    expect(document.activeElement).toBe(city);
  });

  it("says Lantern couldn't finish it when it comes back empty again, asking no third time", async () => {
    const user = renderLive(ASKED_FOR_LISBON);
    dayReplies.push("empty", "empty");

    await ask(user, "Lisbon, a calm day");

    expect(await screen.findByText(UNFINISHED, { exact: false }, DAY_TIMEOUT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write it again" })).toBeVisible();
    expect(dayPosts).toHaveLength(2);
  });
});

describe("the city word with live generation on", () => {
  async function typeCity(user: ReturnType<typeof userEvent.setup>, city: string): Promise<void> {
    await user.click(within(headline()).getByRole("button", { name: "Kanazawa" }));
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.click(screen.getByRole("menuitem", { name: /Plan another day/ }));
    await user.keyboard(`${city}{Enter}`);
  }

  it("reads a city typed there through the intake, and writes its day under its signature", async () => {
    const user = await landOnKanazawa(
      answered({
        kind: "request",
        request: { ...LISBON, energy: "balanced" },
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );

    await typeCity(user, "Lisbon");

    await waitFor(() => expect(headline()).toHaveTextContent(/in Lisbon/), DAY_TIMEOUT);
    expect(intakeTexts).toEqual(["Lisbon"]);
    // The day's own words stay, in the zone the intake found.
    expect(dayPosts).toEqual([
      {
        request: expect.objectContaining({
          city: "Lisbon",
          timezone: "Europe/Lisbon",
          energy: KANAZAWA_START_REQUEST.energy,
        }),
        signature: "lisbon-signed",
      },
    ]);
  });

  it("plays a name that could mean several cities as the likeliest, Lantern's assumption", async () => {
    const user = await landOnKanazawa(
      answered({
        kind: "question",
        key: "city",
        readings: [PORTLAND_OREGON, PORTLAND_MAINE],
        words: NO_WORDS,
        unplaced: [],
        signed: [
          { city: "Portland", timezone: PORTLAND_OREGON.timezone, signature: "oregon-signed" },
        ],
      }),
    );

    await typeCity(user, "Portland");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(dayPosts[0]).toEqual({
      request: expect.objectContaining({
        city: "Portland",
        citySource: "assumed",
        timezone: PORTLAND_OREGON.timezone,
      }),
      signature: "oregon-signed",
    });
  });

  it("says in the word's list that a typed city is read, and stops reading it when the list closes", async () => {
    const user = await landOnKanazawa("pending");

    await typeCity(user, "Lisbon");

    const list = await screen.findByRole("group", { name: "Where" });
    expect(within(list).getByRole("status")).toHaveTextContent("Reading");
    expect(within(list).getByRole("textbox", { name: "Somewhere else" })).toHaveValue("Lisbon");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("group", { name: "Where" })).toBeNull());
    expect(intakeTexts).toEqual(["Lisbon"]);
    expect(dayPosts).toEqual([]);
    expect(headline()).toHaveTextContent(/in Kanazawa/);
  });

  it.each([
    [
      "no city",
      answered({ kind: "question", key: "city", readings: [], words: NO_WORDS, unplaced: [] }),
      "Lantern needs a city to plan the day.",
    ],
    ["refused", answered({ kind: "refused" }), "Lantern can't plan that day."],
    [
      "limited",
      answered({ kind: "limited" }, 429),
      "Lantern has written all the days it can for now.",
    ],
    ["offline", "offline" as const, "Lantern couldn't read that just now."],
  ])(
    "says in the word's list why a city the intake answered %s plays no day, and keeps the day",
    async (_name, reply, why) => {
      const user = await landOnKanazawa(reply);

      await typeCity(user, "Atlantis");

      const list = await screen.findByRole("group", { name: "Where" });
      await waitFor(() => expect(within(list).getByRole("status")).toHaveTextContent(why));
      const field = within(list).getByRole("textbox", { name: "Somewhere else" });
      expect(field).toHaveValue("Atlantis");
      expect(field).not.toHaveAttribute("readonly");
      expect(dayPosts).toEqual([]);
      expect(headline()).toHaveTextContent(/in Kanazawa/);
    },
  );
});

describe("a day the log keeps, with live generation on", () => {
  it("is seen by its id once watched to its end here, so its address opens it whole", async () => {
    dayIds.push(NEXT_DAY_ID);
    await askForKyoto();
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`));

    expect(isKeptSeen(NEXT_DAY_ID)).toBe(true);
  });
});

describe("a changed time word with live generation on", () => {
  it("proposes the morning beside the day, and takes it, the rest of the day where it was", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    const before = rowTexts();
    const kept = before.slice(2);

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    // The visitor's day is named by its id; the route reads it from the log.
    expect(replanPosts[0]?.body).toEqual({
      basis: { kind: "kept", id: KYOTO_DAY_ID },
      request: expect.objectContaining({ city: "Kyoto", start: "slow" }),
      changed: "start",
      round: 1,
      picks: {},
    });
    // No day was asked for again: the morning alone was proposed.
    expect(dayPosts).toEqual([]);
    // Whole, the proposal stands beside the day: every row of the day still there, the new
    // morning's beside them, the sentence saying both answers, the address the day's own.
    await waitFor(
      () =>
        expect(screen.getAllByRole("radio", { name: "slow morning, proposed" })[0]).toBeDefined(),
      DAY_TIMEOUT,
    );
    expect(before.every((text) => rowTexts().includes(text))).toBe(true);
    expect(within(dayList()).getByText(/^Shoren-in$/)).toBeInTheDocument();
    expect(headline()).toHaveTextContent("on foot, early start or slow morning, early dinner");
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);

    await takeProposal(user, "slow morning");

    await waitFor(
      () =>
        expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(
          /^09:00\s*Shoren-in/,
        ),
      DAY_TIMEOUT,
    );
    const rows = within(dayList()).getAllByRole("listitem");
    expect(rows[1]).toHaveTextContent(/^09:40\s*Awata Shrine/);
    expect(rows.slice(2).map((row) => row.textContent)).toEqual(kept);
    expect(screen.getAllByText(/^Shoren-in at nine and the shrine above it/)[0]).toBeVisible();
    expect(headline()).toHaveTextContent("on foot, slow morning, early dinner");
    // The taken day is the re-plan's in the log: its address, and a day of the visitor's own.
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`));
    expect(readYourDays(window.localStorage)[0]).toMatchObject({
      id: REPLAN_ID,
      request: { start: "slow" },
      ending: "written",
    });
    // Seen taken here, it opens whole at its address next time.
    await waitFor(() => expect(isKeptSeen(REPLAN_ID)).toBe(true), DAY_TIMEOUT);
  });

  it("shows the merged day's rows after an energy re-picked on the day before", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    await changeWord(user, "calm", "lively");
    await waitForTheDay();

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    // The re-plan's morning, not the stops the energy was re-picked among before it.
    const rows = within(dayList()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(/^09:00\s*Shoren-in/);
    expect(rows[1]).toHaveTextContent(/^09:40\s*Awata Shrine/);
    expect(dayList()).not.toHaveTextContent(/Honen-in/);
  });

  it("says in the facts line what the fork writes and where, then what is drawn beside the day, and gives the facts back once it is taken", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    const statusText = () => document.querySelector('header p[role="status"]')?.textContent;
    const before = factsLineText();
    const lines = [before];
    const statuses = new Set<string>();
    const observer = new MutationObserver(() => {
      const now = factsLineText();
      if (now !== lines.at(-1)) lines.push(now);
      statuses.add(statusText() ?? "");
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    observer.disconnect();
    // Where the visitor looks once they have pressed: what is written and where, a press away,
    // then what stands beside the day; the facts come back once a version is taken.
    expect(lines).toEqual([
      before,
      "Writing “slow morning” for the morning ·\u00A0see it at\u00A007:30",
      "“slow morning” drawn beside the morning ·\u00A0see it at\u00A007:30",
      before,
    ]);
    expect(statuses).toContain("re-planning the morning");
  });

  it("leaves the day untouched when its proposal drops, says why on its fork row, and asks again", async () => {
    replanReplies.push({ cut: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    const before = rowTexts();
    let wasPaired = false;
    const observer = new MutationObserver(() => {
      wasPaired ||= seenTextOf(headline()).includes("early start or slow morning");
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1));
    const row = () => document.querySelector('[data-fork-row="0"]');
    await waitFor(
      () => expect(row()).toHaveTextContent(/Lantern stopped part-way|The connection dropped/),
      DAY_TIMEOUT,
    );
    observer.disconnect();
    expect(wasPaired).toBe(true);
    // The day was never touched: its word, and every row as it was, the proposal's gone; and
    // where the visitor looks, why the word came back.
    expect(headline()).toHaveTextContent("on foot, early start, early dinner");
    expect(factsLineText()).toMatch(
      /^(Lantern stopped part-way|The connection dropped), so “early start” stays ·\u00A0Ask again$/,
    );
    await waitFor(() => expect(rowTexts()).toEqual(before), DAY_TIMEOUT);

    replanReplies.push(KYOTO_SLOW_MORNING);
    await user.click(within(row() as HTMLElement).getByRole("button", { name: "Ask again" }));

    await waitFor(() => expect(replanPosts).toHaveLength(2), DAY_TIMEOUT);
    await takeProposal(user, "slow morning");
    await waitFor(() =>
      expect(headline()).toHaveTextContent("on foot, slow morning, early dinner"),
    );
  });

  it("leaves no row for a re-plan that ended without a day, and keeps one cut off by the connection", async () => {
    // Every new stop written in the afternoon, outside the morning asked for: the merge drops them.
    replanReplies.push({
      ...KYOTO_SLOW_MORNING,
      stops: KYOTO_SLOW_MORNING.stops.map((stop) => ({ ...stop, startTime: "15:00" })),
    });
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1));
    await waitFor(() => expect(keptDays()).toEqual([[KYOTO_DAY_ID, "written"]]), DAY_TIMEOUT);
    await waitForTheDay();

    // Cut off by the connection, the server writes it on to its end: it waits among the days.
    replanReplies.push({ cut: KYOTO_SLOW_MORNING, at: 0.62 });
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(replanPosts).toHaveLength(2));
    await waitFor(
      () => expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Honen-in/),
      DAY_TIMEOUT,
    );
    expect(keptDays()).toEqual([
      [REPLAN_ID, "writing"],
      [KYOTO_DAY_ID, "written"],
    ]);
  });

  it("never leaves the merged day at the day before's address when its answer names no id", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    replanId = null;
    // The day before is in the log, at its own address.
    dayIds.push(NEXT_DAY_ID);
    const user = await askForKyoto();
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`));

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    // A link copied now would open the day as it was: the address leaves the old id, as a
    // day asked again without an id does.
    await waitFor(() => expect(headline()).toHaveTextContent(/slow morning/), DAY_TIMEOUT);
    await waitFor(() => expect(window.location.pathname).not.toBe(`/day/${NEXT_DAY_ID}`));
  });

  it("keeps a re-plan of a day opened from someone's link as the visitor's own", async () => {
    window.localStorage.clear();
    replanReplies.push(KYOTO_SLOW_MORNING);
    // Someone's Kyoto day, at its own address, which this browser never asked for.
    const view = keptViewOf(
      SHARED_DAY_ID,
      {
        status: "written",
        ...KYOTO_KEPT,
        checks: {},
        writtenAt: "2026-10-31T20:00:00.000Z",
        seconds: 46,
        round: 0,
      },
      null,
      false,
    );
    if (view.kind !== "day") throw new Error("Someone's day lands as a day");
    const user = userEvent.setup();
    render(<Day kept={view.landing} isLive isAddressed />);
    await waitForTheDay();
    expect(readYourDays(window.localStorage)).toEqual([]);

    await changeWord(user, "early start", "slow morning");

    // Re-planning it was one of the visitor's days: the merged day is theirs, at the top.
    await waitFor(
      () => expect(readYourDays(window.localStorage)[0]).toMatchObject({ id: REPLAN_ID }),
      DAY_TIMEOUT,
    );
  });

  it("sends the place a stop shows in place of its plan, by id, so the re-plan is written around it", async () => {
    const user = await landOnKanazawa();
    // A version of the day's last stop, which a slow morning keeps.
    const versions = [...document.querySelectorAll<SVGElement>(`[${CANDIDATE_ATTRIBUTE}]`)];
    const picked = versions
      .filter((bead) => /:a\d$/.test(bead.getAttribute(CANDIDATE_ATTRIBUTE) ?? ""))
      .at(-1);
    const placeId = picked?.getAttribute(CANDIDATE_ATTRIBUTE) ?? "";
    if (picked === undefined) throw new Error("Kanazawa's last stops have versions");
    await user.click(picked);

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts[0]?.body).toMatchObject({
      picks: { [placeId.split(":")[0] ?? ""]: placeId },
    });
  });

  it("names a written day by its address, which the route reads from its own file", async () => {
    // No re-plan to answer: the route sends the word back to re-plan the whole day.
    const user = await landOnKanazawa();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts[0]?.body).toEqual({
      basis: { kind: "written", slug: "kanazawa" },
      request: expect.objectContaining({ city: "Kanazawa", start: "slow" }),
      changed: "start",
      round: 1,
      picks: {},
    });
    // A written day's city in its own zone: the whole day asked again needs no signature.
    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(dayPosts[0]?.signature).toBeNull();
  });

  it("keeps the next day in the visitor's list after a proposal taken", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);

    // A word whose re-plan is the whole day: the route answers 409 and the day is asked again.
    dayIds.push(NEXT_DAY_ID);
    await changeWord(user, "with anyone", "with family");
    await takeProposal(user, "with family");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    await waitFor(() =>
      expect(readYourDays(window.localStorage).map((day) => day.id)).toContain(NEXT_DAY_ID),
    );
  });
});

/** The visitor's days as this browser keeps them, by id and how each stands. */
const keptDays = () => readYourDays(window.localStorage).map(({ id, ending }) => [id, ending]);

describe("a changed word's fork: taken, left and taken back, with live generation on", () => {
  beforeEach(() => window.localStorage.clear());

  it("re-plans a re-plan opened at its address in part, as the round after its record's", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    replanId = NEXT_DAY_ID;
    // The visitor's re-plan, reopened at its address: its record has taken one re-plan.
    const view = keptViewOf(
      REPLAN_ID,
      {
        status: "written",
        ...KYOTO_KEPT,
        checks: {},
        writtenAt: "2026-11-05T20:00:00.000Z",
        seconds: 34,
        round: 1,
      },
      null,
      false,
    );
    if (view.kind !== "day") throw new Error("A re-plan's record lands as a day");
    const user = userEvent.setup();
    render(<Day kept={view.landing} isLive isAddressed />);
    await waitForTheDay();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(replanPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts[0]?.body).toEqual({
      basis: { kind: "kept", id: REPLAN_ID },
      request: expect.objectContaining({ start: "slow" }),
      changed: "start",
      round: 2,
      picks: {},
    });
    // Proposed in part, never sent on to the whole day, and taken.
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    expect(dayPosts).toEqual([]);
  });

  it("keeps the day the visitor's while its proposal is written: whole, live, the proposal beside it", async () => {
    replanReplies.push({ held: KYOTO_SLOW_MORNING, at: 0.62 });
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const before = rowTexts();

    await changeWord(user, "early start", "slow morning");

    await waitFor(() => expect(day.current?.replan().status).toBe("writing"));
    expect(day.current?.replan().change).toEqual({
      word: "start",
      from: "early start",
      to: "slow morning",
    });
    expect(day.current?.replan().reach).toBe("part");
    // Named as its answer came: a row of its own, so no day paid for is lost.
    await waitFor(() =>
      expect(keptDays()).toEqual([
        [REPLAN_ID, "writing"],
        [KYOTO_DAY_ID, "written"],
      ]),
    );
    await waitFor(
      () => expect(within(dayList()).getByText(/^Shoren-in$/)).toBeInTheDocument(),
      DAY_TIMEOUT,
    );
    // Every row of the day stands as it was, and the day can be dragged and swapped.
    expect(before.every((text) => rowTexts().includes(text))).toBe(true);
    await waitFor(
      () =>
        expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
          "aria-busy",
          "false",
        ),
      DAY_TIMEOUT,
    );
    // The proposal cannot be taken until it is whole; the day keeps its address.
    const proposal = screen.getAllByRole("radio", { name: "slow morning, being written" })[0];
    expect(proposal).toHaveAttribute("aria-disabled", "true");
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
  });

  it("takes the day before back from memory, with no call, and the proposal again, in the run's place", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const entries = window.history.length;
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(day.current?.replan().status).toBe("taken");
    // Both versions are the visitor's days, each a row of its own.
    expect(keptDays()).toEqual([
      [REPLAN_ID, "written"],
      [KYOTO_DAY_ID, "written"],
    ]);
    const list = dayList();

    await takeBack(user, "early start");

    // The day before, from memory, at its own address: no model call, and no stage drawn anew.
    await waitFor(
      () => expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Honen-in/),
      DAY_TIMEOUT,
    );
    expect(dayList()).toBe(list);
    expect(replanPosts).toHaveLength(1);
    expect(dayPosts).toEqual([]);
    expect(headline()).toHaveTextContent("on foot, early start, early dinner");
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    expect(day.current?.replan().status).toBe("left");
    // Both still the visitor's, the day on screen now first.
    expect(keptDays()).toEqual([
      [KYOTO_DAY_ID, "written"],
      [REPLAN_ID, "written"],
    ]);
    await waitForTheDay();

    // The word's list takes the proposal again, as its fork row does.
    await changeWord(user, "early start", "slow morning");

    await waitFor(
      () => expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Shoren-in/),
      DAY_TIMEOUT,
    );
    expect(dayList()).toBe(list);
    expect(replanPosts).toHaveLength(1);
    expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`);
    expect(day.current?.replan().status).toBe("taken");
    // Each address replaced the last: Back leaves the day as it did before the change.
    expect(window.history.length).toBe(entries);
    await waitForTheDay();

    act(() => window.history.back());

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toBeVisible(),
    );
  });

  it("compares the version not taken beside the day again, and folds it", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const user = await askForKyoto();
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(within(dayList()).queryByText(/Honen-in/)).toBeNull();

    const compare = screen.getAllByRole("button", { name: "Compare" })[0];
    if (!compare) throw new Error("A fork taken offers to compare");
    await user.click(compare);

    // The day before's morning beside the day, its own sentence's pair, and nothing asked.
    await waitFor(() => expect(within(dayList()).getByText(/Honen-in/)).toBeInTheDocument());
    expect(headline()).toHaveTextContent("slow morning or early start");
    expect(compare).toHaveAttribute("aria-pressed", "true");
    expect(replanPosts).toHaveLength(1);

    await user.click(compare);
    await waitFor(() => expect(within(dayList()).queryByText(/Honen-in/)).toBeNull(), DAY_TIMEOUT);
    expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`);
  });

  it("keeps a proposal not taken among the visitor's days, and settles the fork with the next word", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    expect(keptDays()).toEqual([
      [REPLAN_ID, "written"],
      [KYOTO_DAY_ID, "written"],
    ]);

    replanId = NEXT_DAY_ID;
    await changeWord(user, "early dinner", "eating late");

    // The next word asks from the day on screen, the visitor's own, the round after its own.
    await waitFor(() => expect(replanPosts).toHaveLength(2), DAY_TIMEOUT);
    expect(replanPosts[1]?.body).toEqual(
      expect.objectContaining({ basis: { kind: "kept", id: KYOTO_DAY_ID }, round: 1 }),
    );
    expect(keptDays()).toContainEqual([REPLAN_ID, "written"]);
    expect(day.current?.replan().change?.word).toBe("dinner");
  });

  it("settles a proposal at once when the energy is re-picked, the re-picked day's own rows shown", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    expect(within(dayList()).getByText(/^Shoren-in$/)).toBeInTheDocument();

    await changeWord(user, "calm", "lively");

    expect(day.current?.replan().status).toBe("idle");
    expect(within(dayList()).queryByText(/^Shoren-in$/)).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(headline()).toHaveTextContent(/^A lively Saturday in Kyoto, on foot, early start,/);
    await waitForTheDay();
  });

  it("re-plans from the day before after taking it back, as the round after its own", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    act(() => {
      day.current?.replan().choose("from");
    });
    await waitForTheDay();

    await changeWord(user, "early dinner", "eating late");

    await waitFor(() => expect(replanPosts).toHaveLength(2), DAY_TIMEOUT);
    expect(replanPosts[1]?.body).toEqual({
      basis: { kind: "kept", id: KYOTO_DAY_ID },
      request: expect.objectContaining({ start: null, dinner: "late" }),
      changed: "dinner",
      round: 1,
      picks: {},
    });
  });

  it("takes back a second change to the first's day: its rows, address and round", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    dayIds.push(KYOTO_DAY_ID);
    const day = createRef<DayHandle>();
    const user = await askForKyoto(day);
    const entries = window.history.length;
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    // The second change, on the taken day, is the log's next re-plan, under an id of its own.
    replanId = NEXT_DAY_ID;
    replanReplies.push(KYOTO_LATE_EVENING);
    await changeWord(user, "home by eight", "out late");
    await takeProposal(user, "out late");
    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(replanPosts[1]?.body).toEqual(
      expect.objectContaining({ basis: { kind: "kept", id: REPLAN_ID }, round: 2 }),
    );
    expect(within(dayList()).getByText(/^Izakaya along Kiyamachi$/)).toBeInTheDocument();

    await changeWord(user, "out late", "home by eight");

    // The first change's day, not the one before both: its morning, its evening, its address.
    await waitFor(
      () => expect(within(dayList()).queryByText(/^Izakaya along Kiyamachi$/)).toBeNull(),
      DAY_TIMEOUT,
    );
    expect(within(dayList()).getAllByRole("listitem")[0]).toHaveTextContent(/Shoren-in/);
    expect(headline()).toHaveTextContent("slow morning");
    expect(headline()).toHaveTextContent("home by eight");
    expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`);
    expect(day.current?.replan().status).toBe("left");
    expect(window.history.length).toBe(entries);
    await waitForTheDay();

    await changeWord(user, "early dinner", "eating late");

    // Re-planned from the first change's day, as the round after its own.
    await waitFor(() => expect(replanPosts).toHaveLength(3), DAY_TIMEOUT);
    expect(replanPosts[2]?.body).toEqual({
      basis: { kind: "kept", id: REPLAN_ID },
      request: expect.objectContaining({ start: "slow", end: null, dinner: "late" }),
      changed: "dinner",
      round: 2,
      picks: {},
    });
  });

  it("holds the day before, rows and words, while a whole day is written", async () => {
    const day = createRef<DayHandle>();
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
    const user = await askForKyoto(day);
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    const sentence = seenTextOf(headline());
    dayReplies.push("held");

    await changeWord(user, "with anyone", "with family");

    // The new day's header and its first stops have streamed; the day before stays the day.
    await waitFor(() => expect(day.current?.replan().status).toBe("writing"), DAY_TIMEOUT);
    expect(day.current?.replan().reach).toBe("whole");
    await waitFor(() =>
      expect(keptDays()).toEqual([
        [NEXT_DAY_ID, "writing"],
        [KYOTO_DAY_ID, "written"],
      ]),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    // Only the pair was written in at the press: the rest of the headline stands.
    expect(seenTextOf(headline())).toBe(
      sentence.replace("with anyone", "with anyone or with family"),
    );
    // The day held keeps its own address while the new one is on its way.
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
  });

  it("lands a change of a day not written to its end with no fork, as there is no day before", async () => {
    const day = createRef<DayHandle>();
    dayReplies.push("cut");
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
    const user = await askForKyoto(day);

    await changeWord(user, "with anyone", "with family");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(headline()).toHaveTextContent(/with family$/);
    // No fork, so nothing offers a day before that is not there.
    expect(day.current?.replan()).toMatchObject({ status: "idle", change: null, reach: null });
    expect(day.current?.replan().choose("from")).toBe(false);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(dayPosts).toHaveLength(1);
  });

  it("proposes a whole day written again, the headline changing by its pair, then by its word once taken", async () => {
    const user = await landOnMadrid();
    // The headline's words as seen, without the list a word opens under it.
    const sentenceOf = () => {
      const list = headline().querySelector('[role="listbox"]')?.textContent ?? "";
      return seenTextOf(headline()).replace(list, "");
    };
    const before = sentenceOf();
    const sentences = [before];
    const observer = new MutationObserver(() => {
      const now = sentenceOf();
      if (now !== sentences.at(-1)) sentences.push(now);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    // The written day's own stream, under the request with the word changed.
    dayReplies.push(MADRID_START_REQUEST);

    await changeWord(user, "with friends", "with family");
    await takeProposal(user, "with family");

    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    observer.disconnect();
    // The pen wrote the pair in at the press, and the word taken stands alone at the end.
    const lead = before.slice(0, before.lastIndexOf("with friends"));
    expect(sentences).toContain(`${lead}with friends or with family`);
    expect(sentences.at(-1)).toBe(`${lead}with family`);
    for (const sentence of sentences) expect(sentence.startsWith(lead), sentence).toBe(true);
  });

  it("takes a whole day written again, drawn whole at its address, and takes the day before back", async () => {
    const day = createRef<DayHandle>();
    dayIds.push(KYOTO_DAY_ID, NEXT_DAY_ID);
    const user = await askForKyoto(day);
    await changeWord(user, "with anyone", "with family");
    await waitFor(() => expect(day.current?.replan().status).toBe("proposed"), DAY_TIMEOUT);
    // Whole, it waits to be taken: the day before still the day, at its own address.
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    expect(headline()).toHaveTextContent(/with anyone or with family$/);

    await takeProposal(user, "with family");

    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/));
    expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`);
    expect(day.current?.replan().status).toBe("taken");
    await waitForTheDay();

    act(() => {
      day.current?.replan().choose("from");
    });

    await waitFor(() => expect(headline()).toHaveTextContent(/with anyone$/));
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    expect(day.current?.replan().status).toBe("left");
    expect(dayPosts).toHaveLength(1);
    await waitForTheDay();

    act(() => {
      day.current?.replan().choose("to");
    });

    await waitFor(() => expect(headline()).toHaveTextContent(/with family$/));
    expect(window.location.pathname).toBe(`/day/${NEXT_DAY_ID}`);
    expect(day.current?.replan().status).toBe("taken");
    expect(dayPosts).toHaveLength(1);
    // Both versions are the visitor's days, each a row of its own.
    expect(keptDays()).toEqual([
      [NEXT_DAY_ID, "written"],
      [KYOTO_DAY_ID, "written"],
    ]);
  });
});

describe("a changed word with live generation on", () => {
  it("asks for the day again with the word changed, and writes it", async () => {
    const user = await landOnMadrid();

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    await takeProposal(user, "with family");
    // A written day's city in its own zone needs no signature.
    expect(dayPosts[0]).toEqual({
      request: { ...MADRID_START_REQUEST, company: "family" },
      signature: null,
    });
    // The day on screen holds its place until the new one's header has streamed.
    await waitFor(() => expect(headline()).toHaveTextContent(/, with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(screen.queryByText(/isn't re-planning/)).not.toBeInTheDocument();
  });

  it("re-plans whole a live day the log has not named, which the route could not read", async () => {
    const user = renderLive(
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: [],
        signed: [SIGNED_LISBON],
      }),
    );
    await ask(user, "Lisbon, a calm day");
    await waitForTheDay();
    dayPosts.length = 0;

    await changeWord(user, "early dinner", "eating late");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts).toEqual([]);
    expect(dayPosts[0]).toEqual({
      request: { ...LISBON, dinner: "late" },
      signature: "lisbon-signed",
    });
  });

  it("carries the city's signature, and the phrases said back, to the day asked again", async () => {
    const user = renderLive(
      answered({
        kind: "request",
        request: LISBON,
        readings: [],
        unplaced: ["with my dog"],
        signed: [SIGNED_LISBON],
      }),
    );
    // The day is kept in the log, so a re-plan can name it.
    dayIds.push(NEXT_DAY_ID);
    await ask(user, "Lisbon, a calm day, with my dog");
    await waitForTheDay();
    dayPosts.length = 0;
    const struck = watchStruck(dayList());

    await changeWord(user, "early dinner", "eating late");

    // Dinner rewrites its own stretch first, of the day the route reads from its log by id,
    // with no signature; the route answers that it holds most of the day (a 409), and the
    // page asks for the whole day under the city's signature.
    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    expect(replanPosts).toHaveLength(1);
    expect(replanPosts[0]).toMatchObject({
      body: {
        basis: { kind: "kept", id: NEXT_DAY_ID },
        request: { ...LISBON, dinner: "late" },
        changed: "dinner",
        round: 1,
      },
      signature: null,
    });
    expect(dayPosts[0]).toEqual({
      request: { ...LISBON, dinner: "late" },
      signature: "lisbon-signed",
    });
    // Sent on to the whole day, the dinner's stretch was never struck and taken back.
    struck.stop();
    expect(struck.wasStruck()).toBe(false);
    await waitFor(
      () => expect(headline()).toHaveTextContent(/in Lisbon, .*eating late/),
      DAY_TIMEOUT,
    );
    await waitForTheDay();
    expect(screen.getAllByText("Lantern can't plan around “with my dog”.")[0]).toBeVisible();
  });

  it("holds the day on screen while the day asked for is on its way, and says so", async () => {
    const user = await landOnMadrid();
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    dayReplies.push("pending");

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(1), DAY_TIMEOUT);
    // Heard from the header's status, while the facts line's end stands faded.
    expect(await screen.findByText(replanningOf("with family"))).toBeInTheDocument();
    // The day is the one that was there, not drawn again, its word changed in place.
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    await waitFor(() => expect(seenTextOf(headline())).toMatch(/with family$/));
    // The day stays the visitor's while the proposal is written, to drag and swap; no
    // second word changes meanwhile.
    expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await user.click(within(headline()).getByRole("button", { name: "eating late" }));
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(dayPosts).toHaveLength(1);
  });

  it.each([
    ["our limit", "limited"],
    ["a refusal", "refused"],
    ["the route unavailable", "unavailable"],
    ["the connection failed", "offline"],
  ] as const)(
    "keeps the day as it was when the day asked for ends in %s, and says why",
    async (_, reply) => {
      const user = await landOnMadrid();
      const firstStop = within(dayList()).getAllByRole("listitem")[0];
      dayReplies.push(reply);

      await changeWord(user, "with friends", "with family");

      const kind = reply === "offline" ? "disconnected" : reply;
      expect((await screen.findAllByText(endedSaid(kind), {}, DAY_TIMEOUT))[0]).toBeInTheDocument();
      expect(screen.queryByText(replanningOf("with family"))).not.toBeInTheDocument();
      expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
      expect(headline()).toHaveTextContent(/^A lively Sunday in Madrid.*with friends$/);
      expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
      );
    },
  );

  it("asks again from a day it kept, and writes the new one", async () => {
    const user = await landOnMadrid();
    dayReplies.push("unavailable");
    await changeWord(user, "with friends", "with family");
    await screen.findAllByText(endedSaid("unavailable"), {}, DAY_TIMEOUT);

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(2), DAY_TIMEOUT);
    await takeProposal(user, "with family");
    await waitFor(() => expect(headline()).toHaveTextContent(/, with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(screen.queryAllByText(endedSaid("unavailable"))).toEqual([]);
  });

  // `docs/decisions.md`, "A day has at least one stop".
  it("asks once more for a day that came back empty, holding the day on screen meanwhile", async () => {
    const user = await landOnMadrid();
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    dayReplies.push("empty", "pending");

    await changeWord(user, "with friends", "with family");

    await waitFor(() => expect(dayPosts).toHaveLength(2), DAY_TIMEOUT);
    expect(dayPosts[1]).toEqual(dayPosts[0]);
    // The empty day never took the page: the day asked from is still the one drawn.
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    await waitFor(() =>
      expect(seenTextOf(headline())).toMatch(/^A lively Sunday in Madrid.*with family$/),
    );
    expect(screen.getByText(replanningOf("with family"))).toBeInTheDocument();
    expect(screen.queryByText(UNFINISHED, { exact: false })).not.toBeInTheDocument();
  });

  it("writes the day asked for again once it streams, after an empty one", async () => {
    const user = await landOnMadrid();
    dayReplies.push("empty");

    await changeWord(user, "with friends", "with family");
    await takeProposal(user, "with family");

    await waitFor(() => expect(headline()).toHaveTextContent(/, with family$/), DAY_TIMEOUT);
    await waitForTheDay();
    expect(dayPosts).toHaveLength(2);
    expect(screen.queryByText(UNFINISHED, { exact: false })).not.toBeInTheDocument();
  });

  it("keeps the day as it was when the day asked for comes back empty twice, and says why", async () => {
    const user = await landOnMadrid();
    const firstStop = within(dayList()).getAllByRole("listitem")[0];
    dayReplies.push("empty", "empty");

    await changeWord(user, "with friends", "with family");

    expect(
      (await screen.findAllByText(endedSaid("invalid"), {}, DAY_TIMEOUT))[0],
    ).toBeInTheDocument();
    expect(dayPosts).toHaveLength(2);
    expect(within(dayList()).getAllByRole("listitem")[0]).toBe(firstStop);
    expect(headline()).toHaveTextContent(/^A lively Sunday in Madrid.*with friends$/);
  });

  it("re-picks the energy among the versions written, asking for no day", async () => {
    const user = await landOnKanazawa();

    await changeWord(user, "calm", "lively");

    expect(headline()).toHaveTextContent(/^A lively Saturday in Kanazawa/);
    expect(dayPosts).toEqual([]);
  });
});

describe("a day's caveats, kept on this device", () => {
  const SLOWLY = "Lantern can't plan around “she walks slowly”.";

  /** Kyoto's day asked from the start screen with a phrase Lantern cannot plan around. */
  async function askSlowly() {
    window.localStorage.clear();
    dayIds.push(KYOTO_DAY_ID);
    const user = renderLive(
      answered({
        kind: "request",
        request: KYOTO_REQUEST,
        readings: [],
        unplaced: ["she walks slowly"],
        signed: [SIGNED_KYOTO],
      }),
    );
    await ask(user, "Kyoto, she walks slowly");
    await waitForTheDay();
    return user;
  }

  /** The kept day under `id`, opened at its address on this device. */
  function openKept(id: string) {
    const view = keptViewOf(
      id,
      {
        status: "written",
        ...KYOTO_KEPT,
        checks: {},
        writtenAt: "2026-10-31T20:00:00.000Z",
        seconds: 46,
        round: 0,
      },
      null,
      false,
    );
    if (view.kind !== "day") throw new Error("A kept day lands as a day");
    render(<Day kept={view.landing} isLive isAddressed />);
  }

  it("keeps them under the day's id once its answer names it", async () => {
    await askSlowly();

    await waitFor(() =>
      expect(readCaveats(window.localStorage, KYOTO_DAY_ID)).toEqual(["she walks slowly"]),
    );
    expect(screen.getAllByText(SLOWLY)[0]).toBeVisible();
  });

  it("says them again where the day opens on this device: reloaded, from the list or at its link", async () => {
    window.localStorage.clear();
    keepCaveats(window.localStorage, KYOTO_DAY_ID, ["she walks slowly"]);

    openKept(KYOTO_DAY_ID);
    await waitForTheDay();

    expect(screen.getAllByText(SLOWLY)[0]).toBeVisible();
  });

  it("says none on a day this device kept none for, as someone's link opened here", async () => {
    window.localStorage.clear();
    keepCaveats(window.localStorage, KYOTO_DAY_ID, ["she walks slowly"]);

    openKept(SHARED_DAY_ID);
    await waitForTheDay();

    expect(screen.queryByText(SLOWLY)).toBeNull();
  });

  it("carries them to a re-plan merged into the day, under its own id", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    const user = await askSlowly();

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitFor(() =>
      expect(readCaveats(window.localStorage, REPLAN_ID)).toEqual(["she walks slowly"]),
    );
    expect(screen.getAllByText(SLOWLY)[0]).toBeVisible();
  });

  it("never keeps them again once the visitor's days are forgotten, through the next change", async () => {
    replanReplies.push(KYOTO_SLOW_MORNING);
    const user = await askSlowly();
    await waitFor(() =>
      expect(readCaveats(window.localStorage, KYOTO_DAY_ID)).toEqual(["she walks slowly"]),
    );

    act(() => forgetDays());
    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${REPLAN_ID}`), DAY_TIMEOUT);
    await waitForTheDay();
    expect(readCaveats(window.localStorage, REPLAN_ID)).toEqual([]);
    expect(readCaveats(window.localStorage, KYOTO_DAY_ID)).toEqual([]);
  });

  it("carries a kept day's, opened at its address, to its re-plan", async () => {
    window.localStorage.clear();
    keepCaveats(window.localStorage, KYOTO_DAY_ID, ["she walks slowly"]);
    replanReplies.push(KYOTO_SLOW_MORNING);
    openKept(KYOTO_DAY_ID);
    await waitForTheDay();
    const user = userEvent.setup();

    await changeWord(user, "early start", "slow morning");
    await takeProposal(user, "slow morning");

    await waitFor(() =>
      expect(readCaveats(window.localStorage, REPLAN_ID)).toEqual(["she walks slowly"]),
    );
  });
});
