import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { isWrittenRequest } from "@/lib/days/written/requests";
import {
  CITY_SIGNATURE_HEADER,
  signedKeyOf,
  type IntakeRouteAnswer,
} from "@/lib/intake/signed-city";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { dayText, simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { keepYourDay, readYourDays } from "./your-days";
import { INTAKE_ROUTE } from "./intake-route";
import { INDEX_LABEL } from "./start-index";
import { StartDay } from "./start-day";
import { FORGET_ANSWER, FORGET_ANSWER_WAIT_MS } from "./your-days-ledger";
import { FORGET_YOUR_DAYS, YOUR_DAYS_HEADING } from "./your-days-ledger-words";
import { writtenPool } from "./written-pool";

/** "Forget" takes a press only once a double press on "Forget these days" is over. */
const waitOutADoublePress = () => new Promise((done) => setTimeout(done, FORGET_ANSWER_WAIT_MS));

/**
 * The visitor's days with live generation on: a live day is one of them, a row of its own, from
 * the moment its answer names its id, whether it then takes the page, gives way to another day
 * before it does, or comes back empty and is asked again under a new id.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
const POOL = writtenPool();

const SIGNED_KYOTO = { city: "Kyoto", timezone: "Asia/Tokyo", signature: "kyoto-signed" };
const SIGNATURES = new Map<string, string>([[signedKeyOf(SIGNED_KYOTO), SIGNED_KYOTO.signature]]);
/** The visitor's Kyoto day, as the log names it, then a second one, or an empty attempt's. */
const KYOTO_DAY_ID = "3e5b7d9f-1a2c-4e6f-8b0d-2c4e6a8b0d1f";
const OTHER_DAY_ID = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

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

type IntakeReply = { status: number; body: IntakeRouteAnswer } | "pending";
const intakeReplies: IntakeReply[] = [];
/**
 * How the day route answers a live day, in turn; with none left it writes Kyoto whole.
 * - "named": at once, its headers naming the day's row in the log, then nothing until the page
 *   lets it go, as a live model before its first token.
 * - "gated": named at once, then the whole day once the test opens the gate.
 * - "empty": Kyoto's header whole and its stops opened, then closed with none in them.
 * - "late": only once the test lets it answer, whether or not the page still waits for it.
 */
type DayReply = "named" | "gated" | "empty" | "late";
const dayReplies: DayReply[] = [];
const dayIds: string[] = [];
const dayPosts: { request: DayRequest; signature: string | null }[] = [];
/** Each read of the log the start screen makes, by its path, for a day it lists as written. */
const logReads: string[] = [];
/** Resolved each time a "named" or "gated" answer's headers have been handed to the page. */
let onNamed: () => void = () => undefined;
let openGate: () => void = () => undefined;
let gate: Promise<void> = Promise.resolve();
let answerLate: () => void = () => undefined;

vi.mock("@/lib/events/send-event", () => ({ sendProductEvent: vi.fn() }));

const OPEN_STOPS_MS = 300;
const STOPS_OPEN = '"stops":[';

const encoder = new TextEncoder();
const event = (data: string) => encoder.encode(`data: ${data}\n\n`);
const delta = (part: string) =>
  event(JSON.stringify({ type: "text-delta", id: "day", delta: part }));
const finish = (controller: ReadableStreamDefaultController<Uint8Array>) => {
  controller.enqueue(event(JSON.stringify({ type: "finish", finishReason: "stop" })));
  controller.enqueue(event("[DONE]"));
  controller.close();
};
const eventStream = (body: ReadableStream<Uint8Array>) =>
  new Response(body, { headers: { "Content-Type": "text/event-stream" } });

function namedSilentResponse(signal: AbortSignal | undefined): Response {
  return eventStream(
    new ReadableStream<Uint8Array>({
      start(controller) {
        signal?.addEventListener("abort", () => controller.error(signal.reason));
      },
    }),
  );
}

function gatedResponse(signal: AbortSignal | undefined): Response {
  return eventStream(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        signal?.addEventListener("abort", () => controller.error(signal.reason));
        await gate;
        if (signal?.aborted) return;
        controller.enqueue(delta(dayText(KYOTO_DAY.day)));
        finish(controller);
      },
    }),
  );
}

function emptyDayResponse(): Response {
  const text = dayText({ ...KYOTO_DAY.day, stops: [], alternatives: [] });
  const opened = text.indexOf(STOPS_OPEN) + STOPS_OPEN.length;
  return eventStream(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(delta(text.slice(0, opened)));
        await new Promise((resolve) => setTimeout(resolve, OPEN_STOPS_MS));
        controller.enqueue(delta(text.slice(opened)));
        finish(controller);
      },
    }),
  );
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
    if (reply === "pending") {
      return new Promise<Response>((_, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("The reading was stopped", "AbortError")),
        ),
      );
    }
    return Response.json(reply.body, { status: reply.status });
  }
  // The start screen asks the log how a day left while written ended; nothing is there yet.
  if (path.startsWith(`${DAY_ROUTE}/`)) {
    logReads.push(path);
    return new Response(null, { status: 404 });
  }
  if (path !== DAY_ROUTE) throw new Error(`Nothing answers ${path}`);
  const request = JSON.parse(String(init.body)) as DayRequest;
  const signature = new Headers(init.headers).get(CITY_SIGNATURE_HEADER);
  dayPosts.push({ request, signature });
  if (isWrittenRequest(request)) {
    return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
  }
  const isSigned = signature !== null && SIGNATURES.get(signedKeyOf(request)) === signature;
  if (!isSigned) return new Response(null, { status: 403 });
  const signal = init.signal ?? undefined;
  const reply = dayReplies.shift();
  if (reply === "named" || reply === "gated") {
    const response = reply === "named" ? namedSilentResponse(signal) : gatedResponse(signal);
    queueMicrotask(() => onNamed());
    return response;
  }
  if (reply === "empty") return emptyDayResponse();
  if (reply === "late") {
    return new Promise<Response>((resolve) => {
      answerLate = () => resolve(namedSilentResponse(undefined));
    });
  }
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
  intakeReplies.length = 0;
  dayReplies.length = 0;
  dayIds.length = 0;
  dayPosts.length = 0;
  logReads.length = 0;
  gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });
const keptDays = () => readYourDays(window.localStorage).map(({ id, ending }) => [id, ending]);
const yourDaysList = () => screen.queryByRole("list", { name: YOUR_DAYS_HEADING });
const cityWord = (city: string) =>
  within(screen.getByRole("list", { name: INDEX_LABEL })).getByRole("button", {
    name: new RegExp(`^${city} `),
  });
const kyotoRead = (): IntakeReply => ({
  status: 200,
  body: {
    kind: "request",
    request: KYOTO_REQUEST,
    readings: [],
    unplaced: [],
    signed: [SIGNED_KYOTO],
  },
});

async function ask(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const field = screen.getByRole("textbox", { name: "Where, and anything else" });
  await user.clear(field);
  await user.type(field, text);
  await user.click(screen.getByRole("button", { name: "Plan this day" }));
}

/**
 * Kyoto asked from the start screen: read by the intake, posted under its signature, and
 * answered with its id in the log, then nothing more until the reply says, so it stays pending
 * on the start screen (its headline never streams whole; the 8 s cap is far off).
 */
async function askKyotoPendingWithItsId(
  user: ReturnType<typeof userEvent.setup>,
  { reply = "named", id = KYOTO_DAY_ID }: { reply?: "named" | "gated"; id?: string } = {},
): Promise<void> {
  intakeReplies.push(kyotoRead());
  dayReplies.push(reply);
  dayIds.push(id);
  const posts = dayPosts.length;
  const named = new Promise<void>((resolve) => {
    onNamed = resolve;
  });
  await ask(user, "Kyoto");
  await act(async () => {
    await named;
  });
  // A few turns more, so the hook has read the answer's headers into its state.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(dayPosts).toHaveLength(posts + 1);
  // Still the start screen: the day is pending.
  expect(headline()).toHaveTextContent(/^One day in a city/);
}

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

function renderLive(): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup();
  render(<StartDay pool={POOL} isLive />);
  return user;
}

describe("a live day pending on the start screen, among the visitor's days", () => {
  it("is kept as a row being written as soon as its answer names its id, and listed by no row while the start screen writes it", async () => {
    const user = renderLive();
    await askKyotoPendingWithItsId(user);

    await waitFor(() => expect(keptDays()).toEqual([[KYOTO_DAY_ID, "writing"]]));
    // The start screen's line says the day already, and a row arriving would move the page.
    expect(yourDaysList()).not.toBeInTheDocument();
    // The page writes it, so the start screen asks the log nothing of it.
    expect(logReads).toEqual([]);
  });

  it("keeps that one row as it takes the page and is written to its end, asked at the same time", async () => {
    const user = renderLive();
    await askKyotoPendingWithItsId(user, { reply: "gated" });
    await waitFor(() => expect(keptDays()).toEqual([[KYOTO_DAY_ID, "writing"]]));
    const [asked] = readYourDays(window.localStorage);

    act(() => openGate());
    await waitFor(() => expect(headline()).toHaveTextContent(/in Kyoto/), DAY_TIMEOUT);
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    await waitForTheDay();

    expect(keptDays()).toEqual([[KYOTO_DAY_ID, "written"]]);
    expect(readYourDays(window.localStorage)[0]?.startedAt).toBe(asked?.startedAt);
  });

  it("stays among the visitor's days when a quick start replaces it", async () => {
    const user = renderLive();
    await askKyotoPendingWithItsId(user);

    await user.click(cityWord("Rome"));

    await waitFor(() => expect(headline()).toHaveTextContent(/in Rome/), DAY_TIMEOUT);
    // Kyoto's post was let go: the server writes it to its end and counts it against the visitor.
    expect(dayPosts).toHaveLength(2);
    expect(keptDays()).toEqual([[KYOTO_DAY_ID, "writing"]]);
  });

  it("stays among the visitor's days when Forward brings the day before back", async () => {
    const user = renderLive();
    await user.click(cityWord("Rome"));
    await waitFor(() => expect(headline()).toHaveTextContent(/in Rome/), DAY_TIMEOUT);
    await waitForTheDay();
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
    await askKyotoPendingWithItsId(user);

    act(() => window.history.forward());

    await waitFor(() => expect(headline()).toHaveTextContent(/in Rome/), DAY_TIMEOUT);
    expect(dayPosts).toHaveLength(2);
    expect(keptDays()).toEqual([[KYOTO_DAY_ID, "writing"]]);
  }, 15_000);

  it("cannot be dropped by a new reading: the field is read-only while it is on its way", async () => {
    const user = renderLive();
    await askKyotoPendingWithItsId(user);
    const field = screen.getByRole("textbox", { name: "Where, and anything else" });

    expect(field).toHaveAttribute("readonly");
    await user.type(field, " again{Enter}");

    expect(field).toHaveValue("Kyoto");
  });

  it("goes with the rest when the visitor's days are forgotten, and is not kept again as it takes the page", async () => {
    // A day kept before, so the list and its "forget" stand while the new day is on its way.
    keepYourDay(window.localStorage, {
      id: OTHER_DAY_ID,
      request: KYOTO_REQUEST,
      startedAt: "2026-10-31T18:00:00.000Z",
      energies: [KYOTO_REQUEST.energy],
      ending: "written",
      seconds: 41,
    });
    const user = renderLive();
    await askKyotoPendingWithItsId(user, { reply: "gated" });
    await waitFor(() => expect(keptDays().map(([id]) => id)).toContain(KYOTO_DAY_ID));
    expect(within(yourDaysList() as HTMLElement).getAllByRole("link")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: FORGET_YOUR_DAYS }));
    // Asked once: nothing is forgotten until the answer.
    expect(yourDaysList()).toBeInTheDocument();
    await waitOutADoublePress();
    await user.click(screen.getByRole("button", { name: FORGET_ANSWER }));
    expect(yourDaysList()).not.toBeInTheDocument();
    act(() => openGate());
    await waitFor(() => expect(headline()).toHaveTextContent(/in Kyoto/), DAY_TIMEOUT);
    await waitForTheDay();

    expect(keptDays()).toEqual([]);
  });

  it("keeps a row of each of two live days asked one after the other, the newest first", async () => {
    const user = renderLive();
    intakeReplies.push(kyotoRead());
    dayIds.push(KYOTO_DAY_ID);
    await ask(user, "Kyoto");
    await waitFor(() => expect(headline()).toHaveTextContent(/in Kyoto/), DAY_TIMEOUT);
    await waitForTheDay();
    act(() => window.history.back());
    await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));

    await askKyotoPendingWithItsId(user, { id: OTHER_DAY_ID });

    await waitFor(() =>
      expect(keptDays()).toEqual([
        [OTHER_DAY_ID, "writing"],
        [KYOTO_DAY_ID, "written"],
      ]),
    );
  }, 15_000);
});

describe("a day whose answer names no id, with live generation on", () => {
  it("keeps no row for a written day, while it is on its way nor once it is whole", async () => {
    const user = renderLive();

    await user.click(cityWord("Rome"));
    expect(keptDays()).toEqual([]);
    await waitFor(() => expect(headline()).toHaveTextContent(/in Rome/), DAY_TIMEOUT);
    await waitForTheDay();

    expect(keptDays()).toEqual([]);
  });

  it("keeps no row for a live day left before its answer came, and gives its late id to no day", async () => {
    const user = renderLive();
    intakeReplies.push(kyotoRead());
    dayReplies.push("late");
    dayIds.push(KYOTO_DAY_ID);
    await ask(user, "Kyoto");
    await waitFor(() => expect(dayPosts).toHaveLength(1));

    await user.click(cityWord("Rome"));
    await waitFor(() => expect(headline()).toHaveTextContent(/in Rome/), DAY_TIMEOUT);
    await act(async () => {
      answerLate();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await waitForTheDay();

    expect(keptDays()).toEqual([]);
    expect(window.location.pathname).not.toBe(`/day/${KYOTO_DAY_ID}`);
  });
});

describe("the visitor's days in a browser that cannot keep them, with live generation on", () => {
  it("keeps nothing and plays on, a pending live day given way to a quick start", async () => {
    const refused = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded", "QuotaExceededError");
    });
    try {
      const user = renderLive();
      await askKyotoPendingWithItsId(user);
      expect(keptDays()).toEqual([]);

      await user.click(cityWord("Rome"));

      await waitFor(() => expect(headline()).toHaveTextContent(/in Rome/), DAY_TIMEOUT);
      await waitForTheDay();
      expect(keptDays()).toEqual([]);
      expect(yourDaysList()).not.toBeInTheDocument();
    } finally {
      refused.mockRestore();
    }
  });
});

describe("a live day that came back empty and was asked again", () => {
  it("keeps one row, the day asked again's, and none under the empty answer's id", async () => {
    intakeReplies.push(kyotoRead());
    dayReplies.push("empty");
    dayIds.push(OTHER_DAY_ID, KYOTO_DAY_ID);
    const user = renderLive();

    await ask(user, "Kyoto");
    await waitFor(
      () => expect(screen.getByRole("list", { name: "The day" })).toBeInTheDocument(),
      DAY_TIMEOUT,
    );
    await waitForTheDay();

    // The day was asked twice, and its second answer wrote it.
    expect(dayPosts).toHaveLength(2);
    expect(window.location.pathname).toBe(`/day/${KYOTO_DAY_ID}`);
    expect(keptDays()).toEqual([[KYOTO_DAY_ID, "written"]]);
  });

  it("keeps no row under the empty answer's id when the day asked again names none", async () => {
    intakeReplies.push(kyotoRead());
    dayReplies.push("empty");
    dayIds.push(OTHER_DAY_ID);
    const user = renderLive();

    await ask(user, "Kyoto");
    await waitFor(
      () => expect(screen.getByRole("list", { name: "The day" })).toBeInTheDocument(),
      DAY_TIMEOUT,
    );
    await waitForTheDay();

    expect(dayPosts).toHaveLength(2);
    expect(keptDays()).toEqual([]);
    expect(window.location.pathname).not.toBe(`/day/${OTHER_DAY_ID}`);
  });
});
