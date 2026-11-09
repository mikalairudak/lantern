// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { REFUSED_DAY } from "@/lib/fixtures/edge/edge-days";
import { ALICANTE_ESCAPED_DAY } from "@/lib/fixtures/live/escaped-days";
import {
  FIXTURE_REQUEST_ID,
  REJECTIONS,
  fakeClaude,
  rejectionNamed,
  type ClaudeAnswer,
  type ClaudeFailure,
} from "@/lib/fixtures/live/mock-claude";
import { textsIn } from "@/lib/quality/path";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { parseServerTiming } from "@/lib/server-timing";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import { readDayStream } from "@/lib/stream/read-day-stream";
import {
  dayText,
  dayTextOffsets,
  simulateDayStream,
  simulatedModel,
  type ModelEnding,
  type StreamPace,
} from "@/lib/stream/simulate-day-stream";
import { CITY_SIGNATURE_HEADER, KEPT_DAY_HEADER } from "@/lib/intake/signed-city";
import { citySignatureKey, signCity } from "./city-signature";
import { DAY_PROMPT_VERSION } from "./day-prompt";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { InMemoryGenerationLog } from "./generation-log";
import { InMemoryAppSpend, InMemoryVisitorLimits, type SpendCaps } from "./limits";
import { DAY_RESERVE_USD, SHADOW_RESERVE_USD, liveDayOf, type LiveDayDeps } from "./live-day";
import { costOf, DAY_MAX_OUTPUT_TOKENS, SHADOW_MAX_OUTPUT_TOKENS } from "./models";
import type { StreamingModel } from "./streamed-call";

// A request no written day matches, so with the flag on Claude writes it.
const LIVELY_KANAZAWA: DayRequest = { ...KANAZAWA_START_REQUEST, energy: "lively" };
const DAY = KANAZAWA_START_DAY.day;
const TEXT = dayText(DAY);
const OFFSETS = dayTextOffsets(DAY);
const QUICK: Partial<StreamPace> = { deltaChars: 64 };
const NOW = new Date("2026-11-19T10:00:00Z");
const ROUTE_URL = "http://lantern.test/api/day";
const VISITOR_ADDRESS = "203.0.113.7";

/** Claude Sonnet 5.5 and Haiku 5.5 through the real provider, answered by the fake API. */
function sonnet(answer: ClaudeAnswer): StreamingModel {
  return fakeClaude(answer).provider("claude-sonnet-5-5");
}

function haiku(answer: ClaudeAnswer): StreamingModel {
  return fakeClaude(answer).provider("claude-haiku-5-5");
}

function failing(failure: ClaudeFailure): ClaudeAnswer {
  return { kind: "failure", failure };
}

/** What a request body holds at a path of keys, or undefined where the path ends early. */
function valueAt(body: unknown, keys: readonly string[]): unknown {
  return keys.reduce<unknown>(
    (node, key) =>
      node !== null && typeof node === "object"
        ? (node as Record<string, unknown>)[key]
        : undefined,
    body,
  );
}

function post(body: DayRequest, signal?: AbortSignal, address = VISITOR_ADDRESS): Request {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": address },
    body: JSON.stringify(body),
    signal,
  });
}

/** A post for a city as the intake signs it, for its city and zone, with the bench's salt. */
async function signed(request: DayRequest, salt = "test-salt"): Promise<Request> {
  const { signature } = await signCity(await citySignatureKey(salt), request);
  const signedPost = post(request);
  signedPost.headers.set(CITY_SIGNATURE_HEADER, signature);
  return signedPost;
}

interface LoggedLine {
  event: string;
  fields: Record<string, unknown>;
}

interface Bench {
  deps: LiveDayDeps;
  generationLog: InMemoryGenerationLog;
  appSpend: InMemoryAppSpend;
  lines: LoggedLine[];
  /** Waits for the work the route leaves to `after()`: the pair's records and the spend. */
  afterResponse: () => Promise<void>;
}

interface BenchOptions {
  day?: StreamingModel;
  shadow?: StreamingModel;
  caps?: SpendCaps;
  dayLimit?: number;
}

function bench({
  day = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK }),
  shadow = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK }),
  caps = { dailyUsd: 10, monthlyUsd: null },
  dayLimit = 10,
}: BenchOptions = {}): Bench {
  const generationLog = new InMemoryGenerationLog();
  const appSpend = new InMemoryAppSpend(caps);
  const lines: LoggedLine[] = [];
  // Held until `afterResponse`, as Next's `after()` holds them until the response is sent.
  const scheduled: (() => Promise<void>)[] = [];
  let lastId = 0;
  const deps: LiveDayDeps = {
    config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
    models: { day, shadow },
    visitorLimits: new InMemoryVisitorLimits({ day: dayLimit, intake: 20 }),
    appSpend,
    generationLog,
    dayArchive: generationLog,
    schedule: (task) => {
      scheduled.push(task);
    },
    log: (event, fields) => lines.push({ event, fields }),
    now: () => NOW,
    newId: () => `id-${++lastId}`,
    maxRetries: 0,
  };
  return {
    deps,
    generationLog,
    appSpend,
    lines,
    afterResponse: async () => {
      await Promise.all(scheduled.splice(0).map((task) => task()));
    },
  };
}

interface Read {
  outcome: DayOutcome;
  frames: PartialDay[];
}

async function read(response: Promise<Response>, request = LIVELY_KANAZAWA): Promise<Read> {
  const frames: PartialDay[] = [];
  const outcome = await readDayStream({
    request,
    response,
    onPartial: (partial) => frames.push(partial),
  });
  return { outcome, frames };
}

function playLive(deps: LiveDayDeps, request = LIVELY_KANAZAWA): Promise<Read> {
  return read(answerDayRequest(post(request), QUICK, liveDayOf(deps)), request);
}

describe("the live day route's stream", () => {
  const inSwaps = (OFFSETS.options ?? 0) + 900;
  const inStops = OFFSETS.midPlan ?? 0;
  // Each ending a model makes, at the places in the day where the salvage rule differs,
  // with the outcome the simulator's own tests expect of it.
  const endings: [string, ModelEnding, DayOutcome["kind"], boolean][] = [
    ["finished", { kind: "finished" }, "complete", true],
    ["refused in the stops", { kind: "refused", at: inStops }, "refused", true],
    ["cut by max tokens in the stops", { kind: "cut", at: inStops, by: "length" }, "cut", true],
    ["cut by max tokens in the swaps", { kind: "cut", at: inSwaps, by: "length" }, "cut", true],
    ["cut by an error in the swaps", { kind: "cut", at: inSwaps, by: "error" }, "cut", true],
    ["cut by an error before any text", { kind: "cut", at: 0, by: "error" }, "unavailable", false],
    ["rejected before any text", { kind: "rejected" }, "unavailable", false],
  ];

  it.each(endings)(
    "reads as the simulator's does, frame by frame, when %s",
    async (_name, ending, kind, hasFrames) => {
      const { deps, afterResponse } = bench({
        day: simulatedModel({ day: DAY, ending, pace: QUICK }),
      });

      const live = await playLive(deps);
      const simulated = await read(simulateDayStream({ day: DAY, ending, pace: QUICK }));
      await afterResponse();

      expect(live.outcome.kind).toBe(kind);
      expect(live.frames.length > 0).toBe(hasFrames);
      expect(live.frames).toEqual(simulated.frames);
      expect(live.outcome).toEqual(simulated.outcome);
    },
  );

  it("keeps the day without its last swaps when cut in them, as the salvage rule says", async () => {
    const ending: ModelEnding = { kind: "cut", at: inSwaps, by: "length" };
    const { deps, afterResponse } = bench({
      day: simulatedModel({ day: DAY, ending, pace: QUICK }),
    });

    const { outcome } = await playLive(deps);
    await afterResponse();

    expect(outcome.kind === "cut" && outcome.itinerary?.stops).toHaveLength(DAY.stops.length);
  });

  it.each([
    ["a whole day", { text: TEXT }, "complete"],
    ["a refusal", { text: TEXT.slice(0, inStops), stopReason: "refusal" }, "refused"],
    ["max tokens in the stops", { text: TEXT.slice(0, inStops), stopReason: "max_tokens" }, "cut"],
    ["an error after text", { text: TEXT.slice(0, inSwaps), isCutByError: true }, "cut"],
    [
      "a stop reason not known yet, as the model's own stop",
      { text: TEXT, stopReason: "compaction" },
      "complete",
    ],
  ] as const)(
    "reads %s from Claude's own stream through the provider",
    async (_name, answer, kind) => {
      const { deps, afterResponse } = bench({ day: sonnet({ kind: "message", ...answer }) });

      const { outcome } = await playLive(deps);
      await afterResponse();

      expect(outcome.kind).toBe(kind);
    },
  );

  it("asks the provider for a day with thinking off, the schema as structured output and no temperature", async () => {
    const claude = fakeClaude({ kind: "message", text: TEXT });
    const { deps, afterResponse, generationLog } = bench({
      day: claude.provider("claude-sonnet-5-5"),
    });

    await playLive(deps);
    await afterResponse();

    const [body] = claude.requests;
    expect(body).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: DAY_MAX_OUTPUT_TOKENS,
      thinking: { type: "between_tools" },
      output_config: { format: { type: "json_schema" } },
      stream: true,
    });
    expect(body).not.toHaveProperty("temperature");
    expect(generationLog.records[0]?.warnings).toEqual([]);
  });

  // `docs/decisions.md`, "A day has at least one stop". Claude's decoder would hold `minItems: 1`,
  // but the installed provider strips every count before the call, so the model only reads it.
  it("sends the day's least count of stops as words, which the provider puts in for the keyword", async () => {
    const claude = fakeClaude({ kind: "message", text: TEXT });
    const { deps, afterResponse } = bench({ day: claude.provider("claude-sonnet-5-5") });

    await playLive(deps);
    await afterResponse();

    const stops = valueAt(claude.requests[0], [
      "output_config",
      "format",
      "schema",
      "properties",
      "stops",
    ]);
    expect(stops).not.toHaveProperty("minItems");
    expect(stops).toMatchObject({ description: expect.stringMatching(/\nmin items: 1\.$/) });
  });

  it("asks Haiku for the shadow with thinking disabled, which it accepts, under its own cap", async () => {
    const claude = fakeClaude({ kind: "message", text: TEXT });
    const { deps, afterResponse, generationLog } = bench({
      shadow: claude.provider("claude-haiku-5-5"),
    });

    await playLive(deps);
    await afterResponse();

    expect(claude.requests[0]).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: SHADOW_MAX_OUTPUT_TOKENS,
      thinking: { type: "disabled" },
    });
    expect(generationLog.records[1]?.warnings).toEqual([]);
  });
});

describe("a day whose letters came escaped twice", () => {
  // Sonnet's recorded text, through the real provider: it wrote "á" as `\\u00e1`.
  it("shows the visitor letters, and logs the text as written with each escaped string", async () => {
    const { request, outputText } = ALICANTE_ESCAPED_DAY;
    const claude = fakeClaude({ kind: "message", text: outputText });
    const { deps, afterResponse, generationLog } = bench({
      day: claude.provider("claude-sonnet-5-5"),
    });

    // Alicante has no written day: the intake signed its city.
    const { outcome, frames } = await read(
      answerDayRequest(await signed(request), QUICK, liveDayOf(deps)),
      request,
    );
    await afterResponse();

    expect(outcome.kind).toBe("complete");
    const shown = [...frames, outcome].flatMap((value) => textsIn(value));
    expect(shown.filter(({ text }) => text.includes("\\"))).toEqual([]);
    const record = generationLog.records.find(({ role }) => role === "day");
    expect(record?.outputText).toBe(outputText);
    const escaped = record?.checks?.find(({ id }) => id === "escaped-letters");
    expect(escaped).toMatchObject({ kind: "hard", passed: false });
    expect(escaped?.findings).toHaveLength(6);
  });

  it("counts the log's repairs on the day as the visitor is shown it", async () => {
    // Half an emoji, escaped twice, after a space: only once it is unescaped and dropped does
    // the summary end in a space, which the normalizer trims. On Kyoto's day, written by hand,
    // which needs no repair of its own, and asked as the intake signs a city with no written day.
    const request: DayRequest = { ...KYOTO_REQUEST, energy: "lively" };
    const day = {
      ...KYOTO_DAY.day,
      stops: KYOTO_DAY.day.stops.map((stop, index) =>
        index === 0
          ? { ...stop, place: { ...stop.place, summary: `${stop.place.summary} \\ud83c` } }
          : stop,
      ),
    };
    const { deps, afterResponse, generationLog } = bench({
      day: simulatedModel({ day, ending: { kind: "finished" }, pace: QUICK }),
    });

    await read(answerDayRequest(await signed(request), QUICK, liveDayOf(deps)), request);
    await afterResponse();

    const record = generationLog.records.find(({ role }) => role === "day");
    expect(record?.repairs).toBe(1);
    expect(record?.checks?.find(({ id }) => id === "repairs")?.findings).toEqual([
      expect.stringMatching(/^stops\[0\]\.place\.summary: trimmed-text/),
    ]);
  });
});

describe("the live day route's failures", () => {
  it.each(REJECTIONS.map((failure) => [failure.name, failure] as const))(
    "reads %s as unavailable",
    async (_name, failure) => {
      const { deps, afterResponse, generationLog } = bench({ day: sonnet(failing(failure)) });

      const { outcome } = await playLive(deps);
      await afterResponse();

      expect(outcome).toEqual({ kind: "unavailable" });
      expect(generationLog.records.find((record) => record.role === "day")).toMatchObject({
        outcome: "unavailable",
        error: { status: failure.status, type: failure.type, requestId: FIXTURE_REQUEST_ID },
      });
    },
  );

  it("leaves one log line naming the status, the type, the error code and the request id", async () => {
    const tierCap = rejectionNamed("the tier's monthly cap");
    const { deps, afterResponse, lines } = bench({ day: sonnet(failing(tierCap)) });

    await playLive(deps);
    await afterResponse();

    const failures = lines.filter(({ event }) => event === "model-call-failed");
    expect(failures).toEqual([
      {
        event: "model-call-failed",
        fields: expect.objectContaining({
          role: "day",
          model: "claude-sonnet-5-5",
          status: 429,
          type: "rate_limit_error",
          errorCode: "enforced_spend_limit_reached",
          requestId: FIXTURE_REQUEST_ID,
        }),
      },
    ]);
  });

  it("logs an error that comes after text by its type and the status it stands for", async () => {
    const cutText = TEXT.slice(0, (OFFSETS.options ?? 0) + 900);
    const { deps, afterResponse, lines, generationLog } = bench({
      day: sonnet({ kind: "message", text: cutText, isCutByError: true }),
    });

    await playLive(deps);
    await afterResponse();

    expect(lines.find(({ event }) => event === "model-call-failed")?.fields).toMatchObject({
      status: 529,
      type: "overloaded_error",
    });
    expect(generationLog.records[0]).toMatchObject({ outcome: "cut", outputText: cutText });
  });

  it("keeps the request id and the input of a day an error cut, though it ends with no usage", async () => {
    const cutText = TEXT.slice(0, (OFFSETS.options ?? 0) + 900);
    const usage = { input: 6_695, output: 6_439 };
    const { deps, afterResponse, generationLog } = bench({
      day: sonnet({ kind: "message", text: cutText, usage, isCutByError: true }),
    });

    await playLive(deps);
    await afterResponse();

    expect(generationLog.records[0]).toMatchObject({
      requestId: FIXTURE_REQUEST_ID,
      tokens: { input: 6_695, output: null, thinking: null },
      costUsd: null,
    });
  });

  it("sends the visitor only the SDK's default message, which the simulator sends too", async () => {
    const spendLimit = rejectionNamed("our workspace's monthly spend limit");
    const { deps, afterResponse } = bench({ day: sonnet(failing(spendLimit)) });

    const body = await (
      await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(deps))
    ).text();
    await afterResponse();

    expect(body).toContain('"errorText":"An error occurred."');
    expect(body).not.toContain("workspace");
  });

  it("refuses to call a model when the deploy left out the key or the salt", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" } });
    const { deps, lines } = bench({ day });
    const misconfigured: LiveDayDeps = {
      ...deps,
      config: { kind: "misconfigured", missing: ["VISITOR_HASH_SALT"] },
    };

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(misconfigured));

    expect(response.status).toBe(503);
    expect(day.doStreamCalls).toHaveLength(0);
    expect(lines).toEqual([
      { event: "live-generation-misconfigured", fields: { missing: ["VISITOR_HASH_SALT"] } },
    ]);
  });

  it("answers 400 for a city longer than any city's name, before any call or count", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK });
    const { deps, afterResponse } = bench({ day, dayLimit: 1 });

    const response = await answerDayRequest(
      post({ ...LIVELY_KANAZAWA, city: "Kanazawa. ".repeat(20) }),
      QUICK,
      liveDayOf(deps),
    );

    expect(response.status).toBe(400);
    expect(day.doStreamCalls).toHaveLength(0);
    // The visitor's one day today is still theirs.
    expect((await playLive(deps)).outcome.kind).toBe("complete");
    await afterResponse();
  });
});

describe("the live day route's signature", () => {
  // A city with no written day, as the intake resolves it.
  const PARIS: DayRequest = { ...LIVELY_KANAZAWA, city: "Paris", timezone: "Europe/Paris" };

  it("writes a city the intake signed, its words changed after signing", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK });
    const { deps, afterResponse } = bench({ day });
    // Signed for its city and zone; the sentence's words and the date are the client's.
    const asked = { ...PARIS, energy: "calm", end: "late", date: "2026-11-21" } as const;

    const { outcome } = await read(
      answerDayRequest(await signed(asked), QUICK, liveDayOf(deps)),
      asked,
    );
    await afterResponse();

    expect(outcome.kind).toBe("complete");
    expect(day.doStreamCalls).toHaveLength(1);
  });

  it("writes a written day's city with a word changed, which needs no signature", async () => {
    const { deps, afterResponse } = bench();

    const { outcome } = await playLive(deps, LIVELY_KANAZAWA);
    await afterResponse();

    expect(outcome.kind).toBe("complete");
  });

  it.each([
    ["no signature", () => Promise.resolve(post(PARIS))],
    ["another city's", async () => signed({ ...PARIS, city: "Braga" }).then(retarget)],
    ["another zone's", async () => signed({ ...PARIS, timezone: "Europe/Madrid" }).then(retarget)],
    ["a written city's", async () => signed(KANAZAWA_START_REQUEST).then(retarget)],
    ["another salt's", async () => signed(PARIS, "another-salt")],
    ["one that is not a signature", () => Promise.resolve(withSignature(post(PARIS), "forged"))],
  ])(
    "answers 403, read as unavailable, before any count or call, with %s",
    async (_name, forge) => {
      const day = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK });
      const { deps, appSpend, lines, afterResponse } = bench({ day, dayLimit: 1 });
      const reserve = vi.spyOn(appSpend, "reserve");

      const response = await answerDayRequest(await forge(), QUICK, liveDayOf(deps));
      // The visitor's one day today is still theirs.
      const next = await playLive(deps);
      await afterResponse();

      expect(response.status).toBe(403);
      expect((await read(Promise.resolve(response), PARIS)).outcome).toEqual({
        kind: "unavailable",
      });
      expect(next.outcome.kind).toBe("complete");
      expect(reserve).toHaveBeenCalledTimes(2);
      expect(day.doStreamCalls).toHaveLength(1);
      expect(lines.map(({ event }) => event)).toEqual(["day-request-not-signed"]);
    },
  );

  /** The signed request's signature, on a request for Paris in its own zone. */
  function retarget(signedPost: Request): Request {
    return withSignature(post(PARIS), signedPost.headers.get(CITY_SIGNATURE_HEADER) ?? "");
  }

  function withSignature(request: Request, signature: string): Request {
    request.headers.set(CITY_SIGNATURE_HEADER, signature);
    return request;
  }
});

describe("a day asked again in the city of a day kept at its address", () => {
  // A city with no written day. The visitor opened their Paris day by its link: the page holds
  // no intake's signature, only the day's id.
  const PARIS: DayRequest = { ...LIVELY_KANAZAWA, city: "Paris", timezone: "Europe/Paris" };
  const KEPT_ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
  const NO_DAY_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  /** The word the visitor changes, which writes the whole day again. */
  const RIDDEN: DayRequest = { ...PARIS, travel: "transit" };

  /**
   * A bench whose log keeps a Paris day under `KEPT_ID`, written through the route under the
   * intake's signature as a visitor's first day is, and that day's count taken.
   */
  async function withKeptParis(dayLimit = 3) {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK });
    const kept = bench({ day, dayLimit });
    await read(answerDayRequest(await signed(PARIS), QUICK, liveDayOf(kept.deps)), PARIS);
    await kept.afterResponse();
    const written = kept.generationLog.records.find(({ role }) => role === "day")!;
    // The bench names its records `id-1`, `id-2`; a day's address holds a UUID.
    await kept.generationLog.record({ ...written, id: KEPT_ID });
    kept.lines.length = 0;
    return { ...kept, day };
  }

  function naming(request: DayRequest, id: string): Request {
    const named = post(request);
    named.headers.set(KEPT_DAY_HEADER, id);
    return named;
  }

  it("answers 403 without the day's id, as it did, and writes the day with it", async () => {
    const { deps, day, afterResponse } = await withKeptParis();

    const before = await answerDayRequest(post(RIDDEN), QUICK, liveDayOf(deps));
    const after = await read(
      answerDayRequest(naming(RIDDEN, KEPT_ID), QUICK, liveDayOf(deps)),
      RIDDEN,
    );
    await afterResponse();

    expect(before.status).toBe(403);
    expect(after.outcome.kind).toBe("complete");
    // The kept Paris day, then the day asked again; the refused one never reached the model.
    expect(day.doStreamCalls).toHaveLength(2);
  });

  it("counts a day asked by a kept day's id as any day, against the visitor's limit", async () => {
    const { deps, afterResponse } = await withKeptParis(2);

    const second = await read(
      answerDayRequest(naming(RIDDEN, KEPT_ID), QUICK, liveDayOf(deps)),
      RIDDEN,
    );
    const third = await read(
      answerDayRequest(naming(PARIS, KEPT_ID), QUICK, liveDayOf(deps)),
      PARIS,
    );
    await afterResponse();

    expect(second.outcome.kind).toBe("complete");
    expect(third.outcome).toEqual({ kind: "limited" });
  });

  it.each([
    ["no id", () => post(RIDDEN)],
    ["the id of a day in another city", () => naming({ ...RIDDEN, city: "Lyon" }, KEPT_ID)],
    [
      "the id of a day in another zone",
      () => naming({ ...RIDDEN, timezone: "Europe/Madrid" }, KEPT_ID),
    ],
    ["an id no day is kept under", () => naming(RIDDEN, NO_DAY_ID)],
    ["an id that cannot be a day's", () => naming(RIDDEN, "id-1")],
  ])("answers 403, before any count or call, with %s", async (_name, ask) => {
    const { deps, day, appSpend, generationLog, lines, afterResponse } = await withKeptParis(2);
    const reserve = vi.spyOn(appSpend, "reserve");
    const reads = vi.spyOn(generationLog, "dayRecordOf");

    const response = await answerDayRequest(ask(), QUICK, liveDayOf(deps));
    // The visitor's second day today is still theirs.
    const next = await read(
      answerDayRequest(naming(RIDDEN, KEPT_ID), QUICK, liveDayOf(deps)),
      RIDDEN,
    );
    await afterResponse();

    expect(response.status).toBe(403);
    expect(next.outcome.kind).toBe("complete");
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(day.doStreamCalls).toHaveLength(2);
    expect(lines.map(({ event }) => event)).toEqual(["day-request-not-signed"]);
    // `id-1` holds the Paris day in this log, and is never read: a day's id is a UUID.
    expect(reads.mock.calls.map(([id]) => id)).not.toContain("id-1");
  });

  it.each([
    ["fails", () => Promise.reject(new Error("connection refused"))],
    ["is late", () => new Promise<never>(() => undefined)],
  ])("answers 503, before any count or call, when the log %s", async (_name, reading) => {
    const { deps, day, appSpend, generationLog, lines } = await withKeptParis();
    const reserve = vi.spyOn(appSpend, "reserve");
    vi.spyOn(generationLog, "dayRecordOf").mockImplementation(reading);

    const response = await answerDayRequest(
      naming(RIDDEN, KEPT_ID),
      QUICK,
      liveDayOf({ ...deps, preCallDeadlineMs: 20 }),
    );

    expect(response.status).toBe(503);
    expect(reserve).not.toHaveBeenCalled();
    expect(day.doStreamCalls).toHaveLength(1);
    expect(lines.map(({ event }) => event)).toEqual(["kept-day-unread"]);
  });
});

describe("the live day route's limits", () => {
  it("answers the visitor's eleventh day today with 429 and limited, before any call", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK });
    const { deps, afterResponse } = bench({ day, dayLimit: 1 });

    const first = await playLive(deps);
    const second = await playLive(deps);
    await afterResponse();

    expect(first.outcome.kind).toBe("complete");
    expect(second.outcome).toEqual({ kind: "limited" });
    expect(day.doStreamCalls).toHaveLength(1);
  });

  it("counts each visitor apart, by the hash of their address", async () => {
    const { deps, afterResponse } = bench({ dayLimit: 1 });

    await read(
      answerDayRequest(post(LIVELY_KANAZAWA, undefined, "203.0.113.7"), QUICK, liveDayOf(deps)),
    );
    const other = await read(
      answerDayRequest(post(LIVELY_KANAZAWA, undefined, "198.51.100.4"), QUICK, liveDayOf(deps)),
    );
    await afterResponse();

    expect(other.outcome.kind).toBe("complete");
  });

  it("answers 429 and limited before any call once the app's daily cap has no room", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" } });
    const { deps } = bench({ day, caps: { dailyUsd: 0.01, monthlyUsd: null } });

    const { outcome } = await playLive(deps);

    expect(outcome).toEqual({ kind: "limited" });
    expect(day.doStreamCalls).toHaveLength(0);
  });

  it("answers limited once the monthly ceiling is reached, when one is set", async () => {
    const { deps } = bench({ caps: { dailyUsd: 10, monthlyUsd: 0.05 } });

    const { outcome } = await playLive(deps);

    expect(outcome).toEqual({ kind: "limited" });
  });

  it("never counts a written day, even with no limit left", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" } });
    const { deps, generationLog } = bench({
      day,
      dayLimit: 0,
      caps: { dailyUsd: 0, monthlyUsd: 0 },
    });

    const { outcome } = await read(
      answerDayRequest(post(KANAZAWA_START_REQUEST), QUICK, liveDayOf(deps)),
      KANAZAWA_START_REQUEST,
    );

    expect(outcome.kind).toBe("complete");
    expect(day.doStreamCalls).toHaveLength(0);
    expect(generationLog.records).toEqual([]);
  });

  it("writes the day without a shadow when the cap has room for the day alone", async () => {
    const shadow = simulatedModel({ day: DAY, ending: { kind: "finished" } });
    // Room for the day's worst case, $0.14, and not for the shadow's beside it.
    const { deps, afterResponse, generationLog } = bench({
      shadow,
      caps: { dailyUsd: DAY_RESERVE_USD + SHADOW_RESERVE_USD / 2, monthlyUsd: null },
    });

    const { outcome } = await playLive(deps);
    await afterResponse();

    expect(outcome.kind).toBe("complete");
    expect(shadow.doStreamCalls).toHaveLength(0);
    expect(generationLog.records.map(({ role, pairId }) => ({ role, pairId }))).toEqual([
      { role: "day", pairId: null },
    ]);
  });

  it("holds 68 pairs at their worst case in the app's $10 day", async () => {
    const appSpend = new InMemoryAppSpend({ dailyUsd: 10, monthlyUsd: null });
    let pairs = 0;
    while (
      (await appSpend.reserve(DAY_RESERVE_USD, NOW)) !== null &&
      (await appSpend.reserve(SHADOW_RESERVE_USD, NOW)) !== null
    ) {
      pairs += 1;
    }

    expect(pairs).toBe(68);
  });

  it("settles the cap with what the calls cost once they end", async () => {
    const usage = { input: 3_000, output: 4_300 };
    const { deps, afterResponse, appSpend } = bench({
      day: sonnet({ kind: "message", text: TEXT, usage }),
      shadow: haiku({ kind: "message", text: TEXT, usage }),
    });

    await playLive(deps);
    await afterResponse();

    const day = costOf("claude-sonnet-5-5", inputOutput(usage));
    const shadow = costOf("claude-haiku-5-5", inputOutput(usage));
    expect(appSpend.spentOn(NOW)).toBeCloseTo((day ?? 0) + (shadow ?? 0), 10);
  });

  it("charges nothing for a call the provider turned down before writing", async () => {
    const overloaded = failing(rejectionNamed("overloaded"));
    const { deps, afterResponse, appSpend } = bench({
      day: sonnet(overloaded),
      shadow: haiku(overloaded),
    });

    await playLive(deps);
    await afterResponse();

    expect(appSpend.spentOn(NOW)).toBeCloseTo(0, 10);
  });

  it("charges a day that reported no usage, as an error cut it, its whole hold", async () => {
    const cutText = TEXT.slice(0, (OFFSETS.options ?? 0) + 900);
    const { deps, afterResponse, appSpend } = bench({
      day: sonnet({ kind: "message", text: cutText, isCutByError: true }),
    });

    await playLive(deps);
    await afterResponse();

    // The simulated shadow reports no tokens spent, so the day's hold is the whole of it.
    expect(appSpend.spentOn(NOW)).toBeCloseTo(DAY_RESERVE_USD, 10);
  });

  it("answers limited at the month's $95, though the day has room", async () => {
    const { deps } = bench();
    const appSpend = new InMemoryAppSpend();
    for (let day = 1; day <= 10; day++) {
      const at = new Date(`2026-11-${String(day).padStart(2, "0")}T12:00:00Z`);
      const held = await appSpend.reserve(9.5, at);
      if (held !== null) await appSpend.settle(held, 9.5);
    }

    const { outcome } = await playLive({ ...deps, appSpend });

    expect(outcome).toEqual({ kind: "limited" });
  });

  it("holds none of the app's cap for a visitor already past their limit", async () => {
    const { deps } = bench({ dayLimit: 0 });
    const reserve = vi.spyOn(deps.appSpend, "reserve");

    const { outcome } = await playLive(deps);

    expect(outcome).toEqual({ kind: "limited" });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("gives the visitor's day back when the cap has no room for it", async () => {
    const { deps, afterResponse } = bench({ dayLimit: 1 });
    const full = new InMemoryAppSpend({ dailyUsd: 0, monthlyUsd: null });

    const refused = await playLive({ ...deps, appSpend: full });
    const next = await playLive(deps);
    await afterResponse();

    expect(refused.outcome).toEqual({ kind: "limited" });
    expect(next.outcome.kind).toBe("complete");
  });
});

// `docs/decisions.md`, "A day has at least one stop": a day the model closed with no stops gives
// the visitor's day back, and the page asks for it once more.
describe("an empty day", () => {
  const EMPTY_TEXT = dayText({ ...DAY, stops: [], alternatives: [] });
  const EMPTY_USAGE = { input: 3_000, output: 300 };
  // Long past the moment the stream would close without waiting for the store.
  const SLOW_STORE_MS = 50;
  const inStops = OFFSETS.midPlan ?? 0;

  /** Sonnet writing an empty day first, then whole days. */
  function emptyThenWhole(): StreamingModel {
    let calls = 0;
    return fakeClaude(() => {
      calls += 1;
      return calls === 1
        ? { kind: "message", text: EMPTY_TEXT, usage: EMPTY_USAGE }
        : { kind: "message", text: TEXT };
    }).provider("claude-sonnet-5-5");
  }

  it("gives the visitor's day back before the page can ask for it again", async () => {
    const { deps, afterResponse, lines } = bench({ day: emptyThenWhole(), dayLimit: 1 });

    const empty = await playLive(deps);
    // Asked again the moment the empty day ends, before `after()` has run.
    const again = await playLive(deps);
    await afterResponse();

    expect(empty.outcome).toMatchObject({ kind: "invalid", isEmpty: true });
    expect(again.outcome.kind).toBe("complete");
    expect(lines).toContainEqual({
      event: "empty-day-given-back",
      fields: { model: "claude-sonnet-5-5", requestId: FIXTURE_REQUEST_ID },
    });
  });

  it("closes the visitor's stream only once the day is given back, however slow the store", async () => {
    const { deps, afterResponse } = bench({ day: sonnet({ kind: "message", text: EMPTY_TEXT }) });
    const limits = deps.visitorLimits;
    const order: string[] = [];
    const slow: LiveDayDeps = {
      ...deps,
      visitorLimits: {
        take: limits.take.bind(limits),
        giveBack: async (take) => {
          await new Promise((resolve) => setTimeout(resolve, SLOW_STORE_MS));
          await limits.giveBack(take);
          order.push("given back");
        },
      },
    };

    await playLive(slow);
    order.push("outcome read");
    await afterResponse();

    expect(order).toEqual(["given back", "outcome read"]);
  });

  it("gives it back once, and keeps what Claude charged for it in the app's spend", async () => {
    const { deps, afterResponse, appSpend, generationLog } = bench({
      day: sonnet({ kind: "message", text: EMPTY_TEXT, usage: EMPTY_USAGE }),
    });
    const giveBack = vi.spyOn(deps.visitorLimits, "giveBack");

    await playLive(deps);
    await afterResponse();

    expect(giveBack).toHaveBeenCalledTimes(1);
    // The simulated shadow reports no tokens spent, so the day's cost is the whole of it.
    const charged = costOf("claude-sonnet-5-5", inputOutput(EMPTY_USAGE));
    expect(appSpend.spentOn(NOW)).toBeCloseTo(charged ?? Number.NaN, 10);
    expect(generationLog.records[0]).toMatchObject({ role: "day", outcome: "invalid" });
  });

  it.each([
    ["a whole day", simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK })],
    [
      "a day invalid for another reason, its line blank",
      simulatedModel({ day: REFUSED_DAY.day, ending: { kind: "finished" }, pace: QUICK }),
    ],
    [
      "a day cut in its stops",
      simulatedModel({ day: DAY, ending: { kind: "cut", at: inStops, by: "length" }, pace: QUICK }),
    ],
    [
      "a refusal",
      simulatedModel({ day: DAY, ending: { kind: "refused", at: inStops }, pace: QUICK }),
    ],
  ])("keeps %s counted", async (_name, day) => {
    const { deps, afterResponse } = bench({ day, dayLimit: 1 });
    const giveBack = vi.spyOn(deps.visitorLimits, "giveBack");

    await playLive(deps);
    const next = await playLive(deps);
    await afterResponse();

    expect(next.outcome).toEqual({ kind: "limited" });
    expect(giveBack).not.toHaveBeenCalled();
  });

  it("closes the visitor's day and says so in the log when the store cannot give it back", async () => {
    const { deps, afterResponse, lines } = bench({
      day: sonnet({ kind: "message", text: EMPTY_TEXT }),
      dayLimit: 1,
    });
    const broken: LiveDayDeps = {
      ...deps,
      visitorLimits: {
        take: deps.visitorLimits.take.bind(deps.visitorLimits),
        giveBack: () => Promise.reject(new Error("The store is down")),
      },
    };

    const { outcome } = await playLive(broken);
    const next = await playLive(broken);
    await afterResponse();

    expect(outcome).toMatchObject({ kind: "invalid", isEmpty: true });
    expect(next.outcome).toEqual({ kind: "limited" });
    expect(lines).toContainEqual({
      event: "empty-day-not-given-back",
      fields: expect.objectContaining({ message: "The store is down" }),
    });
  });
});

describe("the live day route when its own parts fail", () => {
  const down = (): Promise<never> => Promise.reject(new Error("The store is down"));

  it("gives everything back and stops the calls when after() cannot take them", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK });
    const { deps, afterResponse, appSpend, generationLog, lines } = bench({ day, dayLimit: 1 });
    const noAfter: LiveDayDeps = {
      ...deps,
      schedule: () => {
        throw new Error("after() is not available here");
      },
    };

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(noAfter));

    expect(response.status).toBe(503);
    expect(appSpend.spentOn(NOW)).toBeCloseTo(0, 10);
    expect(lines.map(({ event }) => event)).toContain("live-day-failed");
    // The visitor's one day today is still theirs.
    expect((await playLive(deps)).outcome.kind).toBe("complete");
    await afterResponse();
    expect(generationLog.records.map(({ role }) => role)).toEqual(["day", "shadow"]);
  });

  it("gives the visitor's day back when the cap's store fails", async () => {
    const { deps, afterResponse } = bench({ dayLimit: 1 });
    const broken = { ...deps, appSpend: { reserve: down, settle: down } };

    const failed = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(broken));
    const next = await playLive(deps);
    await afterResponse();

    expect(failed.status).toBe(503);
    expect(next.outcome.kind).toBe("complete");
  });

  it("settles both holds even when the log refuses the day's record", async () => {
    const { deps, afterResponse, appSpend, lines } = bench({
      day: sonnet({ kind: "message", text: TEXT, usage: { input: 3_000, output: 4_300 } }),
      shadow: haiku({ kind: "message", text: TEXT, usage: { input: 3_000, output: 4_100 } }),
    });
    const recorded: string[] = [];
    const refusing: LiveDayDeps = {
      ...deps,
      generationLog: {
        record: (entry) => {
          if (entry.role === "day") return Promise.reject(new Error("invalid byte sequence"));
          recorded.push(entry.role);
          return Promise.resolve();
        },
      },
    };

    await playLive(refusing);
    await afterResponse();

    const spent = costOf("claude-sonnet-5-5", inputOutput({ input: 3_000, output: 4_300 })) ?? 0;
    const shadowSpent =
      costOf("claude-haiku-5-5", inputOutput({ input: 3_000, output: 4_100 })) ?? 0;
    expect(appSpend.spentOn(NOW)).toBeCloseTo(spent + shadowSpent, 10);
    expect(recorded).toEqual(["shadow"]);
    expect(lines.map(({ event }) => event)).toEqual(["generation-log-failed"]);
  });

  it("records both calls even when a hold will not settle", async () => {
    const { deps, afterResponse, generationLog, lines } = bench();
    const unsettled: LiveDayDeps = {
      ...deps,
      appSpend: { reserve: deps.appSpend.reserve.bind(deps.appSpend), settle: down },
    };

    await playLive(unsettled);
    await afterResponse();

    expect(generationLog.records.map(({ role }) => role)).toEqual(["day", "shadow"]);
    expect(lines.map(({ event }) => event)).toEqual(["spend-not-settled", "spend-not-settled"]);
  });

  it("answers 503 by the deadline, calling no model, when the stores do not answer", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" } });
    const { deps } = bench({ day });
    const never = (): Promise<never> => new Promise(() => undefined);
    const stalled: LiveDayDeps = {
      ...deps,
      appSpend: { reserve: never, settle: never },
      preCallDeadlineMs: 20,
    };

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(stalled));

    expect(response.status).toBe(503);
    expect(day.doStreamCalls).toHaveLength(0);
  });

  it("holds nothing when the visitors' store fails", async () => {
    const day = simulatedModel({ day: DAY, ending: { kind: "finished" } });
    const { deps, appSpend } = bench({ day });
    const broken = { ...deps, visitorLimits: { take: down, giveBack: down } };

    const failed = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(broken));

    expect(failed.status).toBe(503);
    expect(appSpend.spentOn(NOW)).toBe(0);
    expect(day.doStreamCalls).toHaveLength(0);
  });
});

function inputOutput({ input, output }: { input: number; output: number }) {
  return {
    inputTokens: input,
    inputTokenDetails: { noCacheTokens: input, cacheReadTokens: 0, cacheWriteTokens: 0 },
    outputTokens: output,
    outputTokenDetails: { textTokens: output, reasoningTokens: undefined },
    totalTokens: input + output,
  };
}

describe("the shadow and the pair log", () => {
  it("records the visitor's day and the shadow as one pair", async () => {
    const { deps, afterResponse, generationLog } = bench({
      day: sonnet({ kind: "message", text: TEXT, usage: { input: 3_000, output: 4_300 } }),
      shadow: haiku({ kind: "message", text: TEXT, usage: { input: 3_000, output: 4_100 } }),
    });

    await playLive(deps);
    await afterResponse();

    const [day, shadow] = generationLog.records;
    expect(generationLog.records).toHaveLength(2);
    expect(day?.pairId).not.toBeNull();
    expect(shadow?.pairId).toBe(day?.pairId);
    expect(day).toMatchObject({
      role: "day",
      model: "claude-sonnet-5-5",
      promptVersion: DAY_PROMPT_VERSION,
      startedAt: NOW.toISOString(),
      tokens: { input: 3_000, output: 4_300, thinking: null },
      finishReason: "stop",
      outcome: "complete",
      visitorText: null,
      request: LIVELY_KANAZAWA,
      outputText: TEXT,
      requestId: FIXTURE_REQUEST_ID,
      error: null,
    });
    expect(day?.costUsd).toBeCloseTo(0.049, 10);
    expect(day?.repairs).toEqual(expect.any(Number));
    expect(day?.checks?.map(({ id }) => id)).toContain("banned-phrases");
    expect(day?.msToFirstToken).toEqual(expect.any(Number));
    expect(shadow).toMatchObject({
      role: "shadow",
      model: "claude-haiku-5-5",
      tokens: { input: 3_000, output: 4_100, thinking: null },
      outcome: "complete",
    });
  });

  it("writes each field of the day's record and the shadow's, from the trace and the request", async () => {
    const { deps, afterResponse, generationLog } = bench({
      day: sonnet({ kind: "message", text: TEXT, usage: { input: 3_000, output: 4_300 } }),
      shadow: haiku({ kind: "message", text: TEXT, usage: { input: 3_000, output: 4_100 } }),
    });

    await playLive(deps);
    await afterResponse();

    const [day, shadow] = generationLog.records;
    const common = {
      pairId: day?.pairId,
      promptVersion: DAY_PROMPT_VERSION,
      startedAt: NOW.toISOString(),
      msToFirstToken: expect.any(Number),
      msToFinish: expect.any(Number),
      finishReason: "stop",
      outcome: "complete",
      salvaged: false,
      repairs: expect.any(Number),
      checks: expect.any(Array),
      visitorText: null,
      request: LIVELY_KANAZAWA,
      outputText: TEXT,
      warnings: [],
      requestId: FIXTURE_REQUEST_ID,
      error: null,
      placeChecks: null,
    };
    expect(day).toStrictEqual({
      ...common,
      id: expect.any(String),
      role: "day",
      model: "claude-sonnet-5-5",
      tokens: { input: 3_000, output: 4_300, thinking: null },
      costUsd: expect.any(Number),
    });
    expect(shadow).toStrictEqual({
      ...common,
      id: expect.any(String),
      role: "shadow",
      model: "claude-haiku-5-5",
      tokens: { input: 3_000, output: 4_100, thinking: null },
      costUsd: expect.any(Number),
    });
  });

  it("starts the shadow beside the day, not once the visitor's day has been sent", async () => {
    const shadow = simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: QUICK });
    const { deps, afterResponse, generationLog } = bench({ shadow });

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(deps));
    // Let the calls start on their own, with nobody reading the visitor's copy yet.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shadow.doStreamCalls).toHaveLength(1);
    await read(Promise.resolve(response));
    expect(generationLog.records).toEqual([]);
    await afterResponse();
    expect(generationLog.records).toHaveLength(2);
  });

  it("leaves the visitor's outcome untouched when the shadow fails", async () => {
    const { deps, afterResponse, generationLog } = bench({
      shadow: haiku(failing(rejectionNamed("overloaded"))),
    });

    const { outcome } = await playLive(deps);
    await afterResponse();

    expect(outcome.kind).toBe("complete");
    expect(generationLog.records.map(({ role, outcome }) => ({ role, outcome }))).toEqual([
      { role: "day", outcome: "complete" },
      { role: "shadow", outcome: "unavailable" },
    ]);
  });

  it("writes the day and its shadow to their end when the visitor leaves, for the log to open again", async () => {
    const slow: Partial<StreamPace> = { deltaChars: 64, deltaDelayMs: 5 };
    const { deps, afterResponse, generationLog } = bench({
      day: simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: slow }),
      shadow: simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: slow }),
    });
    const leave = new AbortController();
    // Held to the end: undici reaches a request's abort controller through a WeakRef.
    const request = post(LIVELY_KANAZAWA, leave.signal);

    await readDayStream({
      request: LIVELY_KANAZAWA,
      response: answerDayRequest(request, QUICK, liveDayOf(deps)),
      onPartial: () => leave.abort(),
    });
    await afterResponse();

    expect(request.signal.aborted).toBe(true);
    expect(generationLog.records.map(({ role, outcome }) => ({ role, outcome }))).toEqual([
      { role: "day", outcome: "complete" },
      { role: "shadow", outcome: "complete" },
    ]);
    expect(generationLog.records[0]?.outputText).toBe(TEXT);
  });

  it("writes on when only the visitor's body is cancelled", async () => {
    const slow: Partial<StreamPace> = { deltaChars: 64, deltaDelayMs: 5 };
    const { deps, afterResponse, generationLog } = bench({
      day: simulatedModel({ day: DAY, ending: { kind: "finished" }, pace: slow }),
    });

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(deps));
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    await afterResponse();

    expect(generationLog.records[0]?.outcome).toBe("complete");
  });

  it("names the day's row in the log in its answer, before the row is written", async () => {
    const { deps, afterResponse, generationLog } = bench();

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(deps));
    const dayId = response.headers.get(DAY_ID_HEADER);
    expect(dayId).not.toBeNull();
    expect(generationLog.records).toEqual([]);
    await response.text();
    await afterResponse();

    const day = generationLog.records.find(({ role }) => role === "day");
    const shadow = generationLog.records.find(({ role }) => role === "shadow");
    expect(day?.id).toBe(dayId);
    expect(shadow?.id).not.toBe(dayId);
  });
});

describe("a cut day in the log", () => {
  const inSwaps = (OFFSETS.options ?? 0) + 900;
  const inStops = OFFSETS.midPlan ?? 0;

  async function recordOfDay(ending: ModelEnding) {
    const { deps, afterResponse, generationLog } = bench({
      day: simulatedModel({ day: DAY, ending, pace: QUICK }),
    });
    const { outcome } = await playLive(deps);
    await afterResponse();
    return { outcome, record: generationLog.records.find(({ role }) => role === "day") };
  }

  it("marks a cut the salvage rule kept a day of, and scores that day", async () => {
    const { outcome, record } = await recordOfDay({ kind: "cut", at: inSwaps, by: "length" });

    const shown = outcome.kind === "cut" ? outcome.itinerary : null;
    expect(shown).not.toBeNull();
    expect(record).toMatchObject({ outcome: "cut", salvaged: true, repairs: expect.any(Number) });
    const checks = new Map(record?.checks?.map((check) => [check.id, check]));
    expect(checks.get("shape")?.passed).toBe(true);
    expect(checks.get("normalizes")?.passed).toBe(true);
    // The day lost its last swaps, and the record says so, stop by stop.
    expect(checks.get("alternatives-map")?.findings).toEqual(
      DAY.stops
        .map((_, stopIndex) => stopIndex)
        .filter((stopIndex) => !shown?.stops[stopIndex]?.alternatives.length)
        .map((stopIndex) => `stops[${stopIndex}]: no alternatives`),
    );
  });

  it("marks a cut that kept nothing as not salvaged, with nothing to score", async () => {
    const { outcome, record } = await recordOfDay({ kind: "cut", at: inStops, by: "length" });

    expect(outcome).toEqual({ kind: "cut", itinerary: null });
    expect(record).toMatchObject({ outcome: "cut", salvaged: false, repairs: null, checks: null });
  });

  it("marks a whole day as not salvaged", async () => {
    const { record } = await recordOfDay({ kind: "finished" });

    expect(record).toMatchObject({ outcome: "complete", salvaged: false });
    expect(record?.checks).not.toBeNull();
  });

  it("records a pair the visitor left whole, and charges it what it cost", async () => {
    const usage = { input: 6_695, output: 6_439 };
    const { deps, afterResponse, generationLog, appSpend } = bench({
      day: sonnet({ kind: "message", text: TEXT, usage, eventDelayMs: 5 }),
      shadow: haiku({ kind: "message", text: TEXT, usage, eventDelayMs: 5 }),
    });
    const leave = new AbortController();
    // Held to the end: undici reaches a request's abort controller through a WeakRef.
    const request = post(LIVELY_KANAZAWA, leave.signal);

    await readDayStream({
      request: LIVELY_KANAZAWA,
      response: answerDayRequest(request, QUICK, liveDayOf(deps)),
      onPartial: () => leave.abort(),
    });
    await afterResponse();

    const left = {
      outcome: "complete",
      requestId: FIXTURE_REQUEST_ID,
      // Written to its end, so Claude's last event counted what it wrote.
      tokens: { input: 6_695, output: 6_439, thinking: null },
    };
    expect(generationLog.records).toMatchObject([left, left]);
    expect(generationLog.records[0]?.outputText).toBe(TEXT);
    const cost = (model: "claude-sonnet-5-5" | "claude-haiku-5-5"): number =>
      costOf(model, { inputTokens: usage.input, outputTokens: usage.output } as Parameters<
        typeof costOf
      >[1]) ?? Number.NaN;
    expect(appSpend.spentOn(NOW)).toBeCloseTo(
      cost("claude-sonnet-5-5") + cost("claude-haiku-5-5"),
      10,
    );
  });
});

describe("POST /api/day's Server-Timing, live", () => {
  function namesOf(response: Response): string[] {
    return parseServerTiming(response.headers.get("Server-Timing") ?? "")
      .map(({ name }) => name)
      .filter((name) => name !== "cold");
  }

  // The stream's headers leave before Claude's first token, which the log keeps instead.
  it("times Neon and the handler up to the stream, and nothing of Claude's", async () => {
    const { deps } = bench();

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(deps));

    expect(namesOf(response)).toEqual(["limits", "total"]);
    const outcome = await readDayStream({
      request: LIVELY_KANAZAWA,
      response: Promise.resolve(response),
      onPartial: () => undefined,
    });
    expect(outcome.kind).toBe("complete");
  });

  it("times Neon for a visitor past their day, answered before any call", async () => {
    const { deps } = bench({ dayLimit: 0 });

    const response = await answerDayRequest(post(LIVELY_KANAZAWA), QUICK, liveDayOf(deps));

    expect(response.status).toBe(429);
    expect(namesOf(response)).toEqual(["limits", "total"]);
  });
});
