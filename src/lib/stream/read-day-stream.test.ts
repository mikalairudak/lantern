// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { EDGE_DAYS, REFUSED_DAY, REPAIRED_DAY } from "@/lib/fixtures/edge/edge-days";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import {
  ALICANTE_ESCAPED_DAY,
  ESCAPED_DAYS,
  type RecordedDay,
} from "@/lib/fixtures/live/escaped-days";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { textsIn } from "@/lib/quality/path";
import { inSchemaOrder } from "@/lib/schema/in-schema-order";
import {
  GeneratedDaySchema,
  type DayRequest,
  type GeneratedDay,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { DayOutcome, PartialDay } from "./outcome";
import { readDayStream } from "./read-day-stream";
import {
  dayText,
  simulateDayStream,
  type StreamEnding,
  type StreamPace,
} from "./simulate-day-stream";

// In schema order, as the stream writes it, so a part of the day is found in its text as it is.
const { request } = KYOTO_DAY;
const day = inSchemaOrder(GeneratedDaySchema, KYOTO_DAY.day);
const TEXT = dayText(day);
// Large deltas keep the suite fast; one test below streams token-sized ones.
const QUICK: Partial<StreamPace> = { deltaChars: 64 };
const SLOW_START_MS = 50;
// Timers may fire a millisecond or two early.
const TIMER_SLACK_MS = 5;
// Token-sized deltas mean thousands of partial parses: well under a second alone, but past
// Vitest's 5 s default when e2e or another session's gate shares the CPU.
const TOKEN_SIZED_TIMEOUT_MS = 20_000;

interface Played {
  outcome: DayOutcome;
  partials: PartialDay[];
}

interface PlayOptions {
  playedDay?: GeneratedDay;
  pace?: Partial<StreamPace>;
  signal?: AbortSignal;
  onPartial?: (partial: PartialDay) => void;
}

async function play(ending: StreamEnding, options: PlayOptions = {}): Promise<Played> {
  const { playedDay = day, pace = QUICK, signal, onPartial } = options;
  const partials: PartialDay[] = [];
  const outcome = await readDayStream({
    request,
    response: simulateDayStream({ day: playedDay, ending, pace, signal }),
    onPartial: (partial) => {
      partials.push(partial);
      onPartial?.(partial);
    },
    signal,
  });
  return { outcome, partials };
}

function startOf(value: unknown): number {
  const start = TEXT.indexOf(JSON.stringify(value));
  if (start === -1) throw new Error("Not in the day's text");
  return start;
}

function endOf(value: unknown): number {
  return startOf(value) + JSON.stringify(value).length;
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Nothing at index ${index}`);
  return item;
}

function itineraryOf(generated: GeneratedDay, dayRequest: DayRequest = request): Itinerary {
  const result = normalizeDay(dayRequest, generated);
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary;
}

/** A UI message stream of the given events, as the route sends one. */
function eventResponse(events: readonly object[], status = 200): Promise<Response> {
  const lines = [...events.map((event) => JSON.stringify(event)), "[DONE]"];
  const body = lines.map((line) => `data: ${line}\n\n`).join("");
  return Promise.resolve(new Response(body, { status }));
}

// A set with two options, past the first stops, to cut inside of.
const SET_INDEX = day.alternatives.findIndex(
  (set, index) => index >= 2 && set.options.length === 2,
);
const SET = at(day.alternatives, SET_INDEX);
const FIRST_OPTION = at(SET.options, 0);
const SECOND_OPTION = at(SET.options, 1);

/** The day as the salvage rule keeps it when the stream stops inside `SET`. */
function keptUpTo(optionCount: number): Itinerary {
  const earlier = day.alternatives.slice(0, SET_INDEX);
  const kept = { ...SET, options: SET.options.slice(0, optionCount) };
  return itineraryOf({ ...day, alternatives: optionCount > 0 ? [...earlier, kept] : earlier });
}

const IN_DEK = startOf(day.dek) + 10;
const IN_STOPS = startOf(at(day.stops, 3)) + 40;
const AFTER_STOPS = endOf(day.stops);
const IN_SECOND_OPTION = startOf(SECOND_OPTION.reason) + 10;
const BETWEEN_OPTIONS = endOf(FIRST_OPTION);

describe.each([...CURATED_DAYS, ...EDGE_DAYS])(
  "the day in $request.city on $request.date",
  (planned) => {
    it("streams to complete, with the itinerary the normalizer builds", async () => {
      const outcome = await readDayStream({
        request: planned.request,
        response: simulateDayStream({
          day: planned.day,
          ending: { kind: "finished" },
          pace: QUICK,
        }),
        onPartial: () => undefined,
      });
      expect(outcome).toEqual({
        kind: "complete",
        itinerary: itineraryOf(planned.day, planned.request),
      });
    });
  },
);

describe("partials", () => {
  it("can show a stop that the finished day drops, while the other ids hold", async () => {
    const partials: PartialDay[] = [];
    const outcome = await readDayStream({
      request: REPAIRED_DAY.request,
      response: simulateDayStream({
        day: REPAIRED_DAY.day,
        ending: { kind: "finished" },
        pace: QUICK,
      }),
      onPartial: (partial) => partials.push(partial),
    });
    expect(partials.at(-1)?.stops).toHaveLength(REPAIRED_DAY.day.stops.length);
    const ids = outcome.kind === "complete" ? outcome.itinerary.stops.map((stop) => stop.id) : [];
    expect(ids).toHaveLength(REPAIRED_DAY.day.stops.length - 1);
    expect(ids).not.toContain("stop-5");
    expect(ids).toContain("stop-6");
  });

  it(
    "arrive in schema order, with strings cut mid-word and numbers still growing",
    { timeout: TOKEN_SIZED_TIMEOUT_MS },
    async () => {
      const { partials } = await play({ kind: "finished" }, { pace: {} });
      expect(partials.length).toBeGreaterThan(TEXT.length / 8);

      const firstDek = partials.find((partial) => partial.dek)?.dek ?? "";
      expect(day.dek.startsWith(firstDek)).toBe(true);
      expect(firstDek.length).toBeLessThan(day.dek.length);

      const stopCounts = partials.map((partial) => partial.stops?.length ?? 0);
      expect(stopCounts).toEqual([...stopCounts].sort((a, b) => a - b));
      expect(stopCounts.at(-1)).toBe(day.stops.length);

      const finalLat = at(day.stops, 0).place.coordinates.lat;
      const lats = partials.map((partial) => partial.stops?.[0]?.place?.coordinates?.lat);
      expect(lats).toContain(finalLat);
      expect(lats.some((lat) => lat !== undefined && lat !== finalLat)).toBe(true);
    },
  );

  it("wait through a slow start", async () => {
    const started = performance.now();
    let firstAt = 0;
    await play(
      { kind: "finished" },
      {
        pace: { ...QUICK, startDelayMs: SLOW_START_MS },
        onPartial: () => {
          firstAt ||= performance.now();
        },
      },
    );
    expect(firstAt - started).toBeGreaterThanOrEqual(SLOW_START_MS - TIMER_SLACK_MS);
  });
});

describe("nothing arrives", () => {
  it("is unavailable when the provider rejects the call", async () => {
    expect(await play({ kind: "rejected" })).toEqual({
      outcome: { kind: "unavailable" },
      partials: [],
    });
  });

  it("is limited when our own cap answers", async () => {
    expect((await play({ kind: "limited" })).outcome).toEqual({ kind: "limited" });
  });

  it("is disconnected when the request never reaches the server", async () => {
    expect(await play({ kind: "offline" })).toEqual({
      outcome: { kind: "disconnected", itinerary: null },
      partials: [],
    });
  });

  it.each(["error", "timeout"] as const)(
    "is unavailable when %s ends it before any text",
    async (by) => {
      expect((await play({ kind: "cut", at: 0, by })).outcome).toEqual({ kind: "unavailable" });
    },
  );
});

describe("refused", () => {
  it("is refused even after the start of a day arrived", async () => {
    const { outcome, partials } = await play({ kind: "refused", at: IN_STOPS });
    expect(outcome).toEqual({ kind: "refused" });
    expect(partials.length).toBeGreaterThan(0);
  });
});

describe("cut by the server", () => {
  it.each([
    ["in the dek", IN_DEK],
    ["in the stops", IN_STOPS],
    ["after the last stop, before the swaps", AFTER_STOPS],
  ])("keeps nothing when it stops %s", async (_where, cutAt) => {
    const { outcome } = await play({ kind: "cut", at: cutAt, by: "length" });
    expect(outcome).toEqual({ kind: "cut", itinerary: null });
  });

  it.each(["length", "error", "timeout"] as const)(
    "keeps the day without the missing swaps when %s stops it in the swaps",
    async (by) => {
      const { outcome } = await play({ kind: "cut", at: IN_SECOND_OPTION, by });
      expect(outcome).toEqual({ kind: "cut", itinerary: keptUpTo(1) });
    },
  );

  it("drops the last option received even when it arrived whole", async () => {
    const { outcome } = await play({ kind: "cut", at: BETWEEN_OPTIONS, by: "length" });
    expect(outcome).toEqual({ kind: "cut", itinerary: keptUpTo(0) });
  });
});

describe("disconnected", () => {
  it("keeps the day without the missing swaps when the connection drops in them", async () => {
    const { outcome } = await play({ kind: "dropped", at: IN_SECOND_OPTION });
    expect(outcome).toEqual({ kind: "disconnected", itinerary: keptUpTo(1) });
  });

  it("keeps nothing when it drops in the stops", async () => {
    const { outcome } = await play({ kind: "dropped", at: IN_STOPS });
    expect(outcome).toEqual({ kind: "disconnected", itinerary: null });
  });
});

describe("invalid", () => {
  it("is invalid when the normalizer refuses the finished day", async () => {
    const outcome = await readDayStream({
      request: REFUSED_DAY.request,
      response: simulateDayStream({ day: REFUSED_DAY.day, ending: { kind: "finished" } }),
      onPartial: () => undefined,
    });
    expect(outcome).toEqual({
      kind: "invalid",
      reason: "the line about the day is blank",
      isEmpty: false,
    });
  });

  it("is invalid, not cut, when the finished day breaks the schema", async () => {
    const broken = structuredClone(day);
    Object.assign(at(broken.stops, 0).place, { kind: "temple" });
    const { outcome } = await play({ kind: "finished" }, { playedDay: broken });
    expect(outcome).toMatchObject({ kind: "invalid", isEmpty: false });
    expect(outcome.kind === "invalid" && outcome.reason).toMatch(/^stops\[0\]\.place\.kind: /);
  });

  // `docs/decisions.md`, "A day has at least one stop": the one invalid day given back.
  it("says a day whose stops the model closed with none in them is empty", async () => {
    const empty = { ...day, stops: [], alternatives: [] };

    const { outcome } = await play({ kind: "finished" }, { playedDay: empty });

    expect(outcome).toMatchObject({ kind: "invalid", isEmpty: true });
    expect(outcome.kind === "invalid" && outcome.reason).toMatch(/^stops: /);
  });

  it("does not call a day empty when the model wrote stops the normalizer could not show", async () => {
    const untimed = { ...day, stops: day.stops.map((stop) => ({ ...stop, startTime: "soon" })) };

    const { outcome } = await play({ kind: "finished" }, { playedDay: untimed });

    expect(outcome).toEqual({ kind: "invalid", reason: "no stop could be shown", isEmpty: false });
  });
});

describe("the caller aborts", () => {
  it("rejects with the abort and gives no outcome", async () => {
    const controller = new AbortController();
    const played = play(
      { kind: "finished" },
      { signal: controller.signal, onPartial: () => controller.abort() },
    );
    await expect(played).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("events the simulator does not send", () => {
  const WHOLE_DAY = [{ type: "text-delta", id: "t", delta: TEXT }];

  async function read(response: Promise<Response>): Promise<DayOutcome> {
    return readDayStream({ request, response, onPartial: () => undefined });
  }

  it("is unavailable on a server error status or an empty body", async () => {
    expect(await read(eventResponse([], 500))).toEqual({ kind: "unavailable" });
    expect(await read(Promise.resolve(new Response(null)))).toEqual({ kind: "unavailable" });
  });

  it("counts a finish without a reason, or with another one, as the model's stop", async () => {
    const complete = { kind: "complete", itinerary: itineraryOf(day) };
    expect(await read(eventResponse([...WHOLE_DAY, { type: "finish" }]))).toEqual(complete);
    expect(
      await read(eventResponse([...WHOLE_DAY, { type: "finish", finishReason: "other" }])),
    ).toEqual(complete);
  });

  it("is invalid when the model stops before its JSON closes", async () => {
    const events = [
      { type: "text-delta", id: "t", delta: TEXT.slice(0, IN_STOPS) },
      { type: "finish", finishReason: "stop" },
    ];
    expect(await read(eventResponse(events))).toEqual({
      kind: "invalid",
      reason: "the day ended before its JSON closed",
      isEmpty: false,
    });
  });

  it("is cut when the server aborts after some text", async () => {
    const events = [
      { type: "text-delta", id: "t", delta: TEXT.slice(0, IN_SECOND_OPTION) },
      { type: "abort", reason: "timeout" },
      { type: "finish", finishReason: "stop" },
    ];
    expect(await read(eventResponse(events))).toEqual({ kind: "cut", itinerary: keptUpTo(1) });
  });
});

describe("a recorded day whose letters came escaped twice", () => {
  // Sonnet wrote "á" as `\\u00e1`, which parses to the text `\u00e1` (`escaped-letters.ts`).
  const ESCAPE = "\\\\u00e1";
  const DELTA_CHARS = 64;
  const { outputText } = ALICANTE_ESCAPED_DAY;
  const IN_DEK = outputText.indexOf(ESCAPE);
  const writtenDek = (JSON.parse(outputText) as GeneratedDay).dek;
  const DEK_BEFORE_ESCAPE = writtenDek.slice(0, writtenDek.indexOf("\\u00e1"));

  /** The recording streamed as the model wrote it, whole or cut by max tokens at `at`. */
  async function playRecorded(recorded: RecordedDay, at?: number): Promise<Played> {
    const text = recorded.outputText.slice(0, at);
    const deltas = Array.from({ length: Math.ceil(text.length / DELTA_CHARS) }, (_, index) =>
      text.slice(index * DELTA_CHARS, (index + 1) * DELTA_CHARS),
    );
    const finishReason = at === undefined ? "stop" : "length";
    const partials: PartialDay[] = [];
    const outcome = await readDayStream({
      request: recorded.request,
      response: eventResponse([
        ...deltas.map((delta) => ({ type: "text-delta", id: "t", delta })),
        { type: "finish", finishReason },
      ]),
      onPartial: (partial) => partials.push(partial),
    });
    return { outcome, partials };
  }

  function backslashesIn(value: unknown): string[] {
    return textsIn(value)
      .filter(({ text }) => text.includes("\\"))
      .map(({ path, text }) => `${path}: ${text}`);
  }

  it.each(ESCAPED_DAYS)(
    "shows $source with letters, never escapes, in each partial and the finished day",
    async (recorded) => {
      const { outcome, partials } = await playRecorded(recorded);

      expect(outcome.kind).toBe("complete");
      expect(partials.flatMap(backslashesIn)).toEqual([]);
      expect(backslashesIn(outcome)).toEqual([]);
    },
  );

  it("writes the recorded days' names and lines as the cities spell them", async () => {
    const texts = await Promise.all(
      ESCAPED_DAYS.map(async (recorded) => {
        const { outcome } = await playRecorded(recorded);
        return textsIn(outcome).map(({ text }) => text);
      }),
    );

    expect(texts.flat()).toEqual(
      expect.arrayContaining([
        "Castillo de Santa Bárbara",
        "Vermut and tapas around Plaza de Gabriel Miró",
        "Rambla de Méndez Núñez",
        expect.stringContaining("cheese and chouriço."),
      ]),
    );
  });

  // `\\u00e1` is seven characters: a cut after any of the first six leaves the letter unwritten.
  it.each([1, 2, 3, 4, 5, 6])(
    "shows no part of an escape the stream cut %i characters into it",
    async (into) => {
      const { partials } = await playRecorded(ALICANTE_ESCAPED_DAY, IN_DEK + into);

      expect(partials.at(-1)?.dek).toBe(DEK_BEFORE_ESCAPE);
    },
  );

  it("shows the letter as soon as its escape is whole", async () => {
    const { partials } = await playRecorded(ALICANTE_ESCAPED_DAY, IN_DEK + ESCAPE.length);

    expect(partials.at(-1)?.dek).toBe(`${DEK_BEFORE_ESCAPE}á`);
  });
});
