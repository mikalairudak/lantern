import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Ref } from "react";
import { expect, vi } from "vitest";
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
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { REPLAN_ROUTE } from "@/features/itinerary/replan-route";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import type { ReplanRequest } from "@/lib/replan/request";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { Day, type DayHandle } from "./day";
import { INTAKE_ROUTE, readIntakeRoute } from "./intake-route";
import { replanEndedOf } from "./not-yet";
import { StartDay } from "./start-day";
import { writtenPool } from "./written-pool";

/**
 * What the `day-live-*.test.tsx` files share: the start screen and the day with live generation
 * on, against stand-ins of both routes. The intake answers what each test gives it, and the day
 * route streams Kyoto's day for any request whose city it would write, a written day's or one
 * the intake signed, and answers any other with the 403 the live route sends. Each file mocks
 * the product's event sender itself, since Vitest hoists `vi.mock` within the file that calls
 * it, and calls the three functions at the end of this module from its own hooks.
 */

const ORIGIN = "http://lantern.test";
export const DAY_TIMEOUT = { timeout: 5000 };
export const POOL = writtenPool();

export const LISBON: DayRequest = {
  ...KYOTO_REQUEST,
  city: "Lisbon",
  citySource: "chosen",
  timezone: "Europe/Lisbon",
  date: "2026-11-14",
  energy: "calm",
  energySource: "chosen",
};
export const SIGNED_LISBON = {
  city: "Lisbon",
  timezone: "Europe/Lisbon",
  signature: "lisbon-signed",
};
/** Kyoto has no written day: the intake signs it as any city. */
export const SIGNED_KYOTO = { city: "Kyoto", timezone: "Asia/Tokyo", signature: "kyoto-signed" };
/** The signatures the stand-in intake hands out, by city and zone, as the day route checks them. */
const SIGNATURES = new Map<string, string>(
  [
    SIGNED_LISBON,
    SIGNED_KYOTO,
    { city: "Portland", timezone: PORTLAND_OREGON.timezone, signature: "oregon-signed" },
    { city: "Portland", timezone: PORTLAND_MAINE.timezone, signature: "maine-signed" },
  ].map((signed) => [signedKeyOf(signed), signed.signature]),
);

export const NO_WORDS: IntakeWords = {
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
export const intakeReplies: IntakeReply[] = [];
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
export const dayReplies: DayReply[] = [];

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
export const intakeTexts: string[] = [];

/** Each day the route was asked for, with the signature it carried. */
export const dayPosts: { request: DayRequest; signature: string | null }[] = [];
/** Each targeted re-plan the route was asked for, with the signature it carried. */
export const replanPosts: { body: ReplanRequest; signature: string | null; signal: AbortSignal }[] =
  [];
/**
 * The re-plans the route answers, in turn, or "limited" for our limit met; with none left it
 * answers a 409, as for a word whose windows hold most of the day, and the page asks for the
 * whole day.
 */
export const replanReplies: (GeneratedReplan | CutReplan | HeldReplan | "limited")[] = [];

const HTTP_TOO_MANY_REQUESTS = 429;

/** The ids the day route names its next answers by, in turn, as the log does once live. */
export const dayIds: string[] = [];

/** A day's answer with the id the log keeps it under. */
async function withDayId(answer: Promise<Response> | Response, id: string): Promise<Response> {
  const response = await answer;
  const headers = new Headers(response.headers);
  headers.set(DAY_ID_HEADER, id);
  return new Response(response.body, { status: response.status, headers });
}

/** The re-plan's id in the log, as its answer names it: the merged day's address. */
export const REPLAN_ID = "5d7c3b1e-2a4f-4c6d-8e9a-0b1c2d3e4f5a";
/** Someone else's day, opened from their link. */
export const SHARED_DAY_ID = "8a1f2b3c-4d5e-4f60-8172-93a4b5c6d7e8";
/** Kyoto's day as a visitor's, kept in the log: no day the site has written. */
export const KYOTO_KEPT = { request: KYOTO_REQUEST, itinerary: KYOTO_ITINERARY };
/** The visitor's own Kyoto day, as the log names it. */
export const KYOTO_DAY_ID = "3e5b7d9f-1a2c-4e6f-8b0d-2c4e6a8b0d1f";
/** A day asked for after the re-plan merged, as the log names it. */
export const NEXT_DAY_ID = "7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";

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
  const replanId = readReplanId();
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
  const replanId = readReplanId();
  if (replanId !== null) headers.set(DAY_ID_HEADER, replanId);
  return new Response(body, { headers });
}

/**
 * Reads the id the re-plan's answer names, null for an answer that names none: a file whose
 * tests change it hands its own variable's reader to `stubLiveRoutes`, as a module's import
 * cannot be assigned.
 */
let readReplanId: () => string | null = () => REPLAN_ID;

/** Notes whether any row of the day was ever struck through while it watched. */
export function watchStruck(list: HTMLElement): { wasStruck: () => boolean; stop: () => void } {
  let isStruck = list.querySelector(".line-through") !== null;
  const observer = new MutationObserver(() => {
    if (list.querySelector(".line-through") !== null) isStruck = true;
  });
  observer.observe(list, { subtree: true, childList: true, attributes: true });
  return { wasStruck: () => isStruck, stop: () => observer.disconnect() };
}

/** What an element shows: its letters, but not those holding room unseen in their place. */
export function seenTextOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(".invisible")) text += node.textContent ?? "";
  }
  return text;
}

export async function answerRoutes(path: string, init: RequestInit): Promise<Response> {
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
    if (replan === "limited") return new Response(null, { status: HTTP_TOO_MANY_REQUESTS });
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

export const headline = () => screen.getByRole("heading", { level: 1 });
export const dayList = () => screen.getByRole("list", { name: "The day" });
export const planList = () => screen.getByRole("list", { name: "The day, to read" });
/** The line under the field, as the start screen says it. */
export const saysBack = (sentence: string) =>
  screen.findByText((_, element) => element?.tagName === "P" && element.textContent === sentence);

export function renderLive(...replies: IntakeReply[]) {
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

export async function ask(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  await user.type(screen.getByRole("textbox", { name: "Where, and anything else" }), text);
  await user.click(screen.getByRole("button", { name: "Plan this day" }));
}

export const answered = (body: IntakeRouteAnswer, status = 200): IntakeReply => ({ status, body });

/** Waits until the day is written and still, when its words can be changed. */
export async function waitForTheDay(): Promise<void> {
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
export async function landOnKanazawa(...replies: IntakeReply[]) {
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
export async function landOnMadrid() {
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
export function factsLineText(): string | null {
  return (
    [...document.querySelectorAll<HTMLElement>("header p.type-note")].find(
      (each) => each.closest("[aria-hidden]") === null,
    )?.textContent ?? null
  );
}

export async function askForKyoto(
  handle?: Ref<DayHandle>,
): Promise<ReturnType<typeof userEvent.setup>> {
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
export async function changeWord(
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
export async function takeProposal(
  user: ReturnType<typeof userEvent.setup>,
  answer: string,
): Promise<void> {
  const radio = await waitFor(() => {
    const found = screen.getAllByRole("radio", {
      name: `${answer} Take, proposed`,
    })[0];
    if (!found) throw new Error(`No proposal of ${answer} to take`);
    return found;
  }, DAY_TIMEOUT);
  await user.click(radio);
}

/**
 * Takes the day before back from the chart's fork row, once the proposal is taken: the row,
 * folded, shows no "Take", so the answer is named by its words and its state alone.
 */
export async function takeBack(
  user: ReturnType<typeof userEvent.setup>,
  answer: string,
): Promise<void> {
  const radio = screen.getAllByRole("radio", { name: `${answer}, the day before` })[0];
  if (!radio) throw new Error(`No day before of ${answer} to take back`);
  await user.click(radio);
}

/** Every row of the day's chart as it reads, in order. */
export const rowTexts = () =>
  within(dayList())
    .getAllByRole("listitem")
    .map((row) => row.textContent);

/** What a fork row says of Madrid's whole day asked "with family", ended without one. */
export function endedSaid(ending: Parameters<typeof replanEndedOf>[0]): string {
  return replanEndedOf(ending, "company", "whole");
}

/** The visitor's days as this browser keeps them, by id and how each stands. */
export const keptDays = () =>
  readYourDays(window.localStorage).map(({ id, ending }) => [id, ending]);

/**
 * Stands in for what jsdom lacks and for both routes, for a file's every test. A file whose
 * tests change the re-plan's id passes a reader of it.
 */
export function stubLiveRoutes(replanIdOf: () => string | null = () => REPLAN_ID): void {
  readReplanId = replanIdOf;
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", vi.fn(answerRoutes));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
}

/** Forgets what the routes were asked and told to answer, before each test. */
export function forgetLiveAsks(): void {
  intakeReplies.length = 0;
  intakeTexts.length = 0;
  dayPosts.length = 0;
  dayReplies.length = 0;
  replanPosts.length = 0;
  replanReplies.length = 0;
  dayIds.length = 0;
  window.history.replaceState(null, "", "/");
}

/** Puts back what `stubLiveRoutes` stood in for, once a file's tests are done. */
export function unstubLiveRoutes(): void {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}
