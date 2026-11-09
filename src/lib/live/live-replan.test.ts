// @vitest-environment node
import { describe, expect, it } from "vitest";
import { writtenDayAt } from "@/lib/days/written/days";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { fakeClaude, type ClaudeAnswer } from "@/lib/fixtures/live/mock-claude";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_EATING_LATE,
  ELCHE_ITINERARY,
  ELCHE_LATE_DINNER,
  ELCHE_SHOWN_STOPS,
} from "@/lib/fixtures/replan/elche-dinner";
import {
  KYOTO_ITINERARY,
  KYOTO_MORNING_BASIS,
  KYOTO_SLOW_MORNING,
  KYOTO_SLOW_START,
} from "@/lib/fixtures/replan/kyoto-morning";
import { mergeReplan } from "@/lib/replan/merge";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { MAX_REPLAN_BODY_BYTES, type ReplanRequest } from "@/lib/replan/request";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import { readReplanStream } from "@/lib/stream/read-replan-stream";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { InMemoryGenerationLog, type DayArchive, type GenerationRecord } from "./generation-log";
import { InMemoryAppSpend, InMemoryVisitorLimits, type SpendCaps } from "./limits";
import { answerReplanRequest, REPLAN_RESERVE_USD, type LiveReplanDeps } from "./live-replan";
import { costOf, REPLAN_MAX_OUTPUT_TOKENS } from "./models";
import { REPLAN_PROMPT_VERSION } from "./replan-prompt";
import { keptBasisOf, readStoredDay } from "./stored-days";

const NOW = new Date("2026-11-19T10:00:00Z");
const ROUTE_URL = "http://lantern.test/api/replan";
const USAGE = { input: 4_200, output: 1_100 };

/** Ids as the route makes them, numbered for the test. */
function dayIdOf(n: number): string {
  return `6f1c1e9a-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/** The Kyoto day written by hand as the log keeps a live one: Sonnet's text, no place checked. */
const LIVE_KYOTO_ID = dayIdOf(900);
const LIVE_KYOTO: GenerationRecord = {
  id: LIVE_KYOTO_ID,
  pairId: null,
  role: "day",
  model: "claude-sonnet-5-5",
  promptVersion: "day-v8",
  startedAt: new Date(NOW.getTime() - 60_000).toISOString(),
  tokens: { input: 8_500, output: 6_400, thinking: null },
  costUsd: 0.08,
  msToFirstToken: 3_500,
  msToFinish: 50_000,
  finishReason: "stop",
  outcome: "complete",
  salvaged: false,
  placeChecks: {},
  repairs: 0,
  checks: null,
  visitorText: null,
  request: KYOTO_DAY.request,
  outputText: dayText(KYOTO_DAY.day),
  warnings: [],
  requestId: "req_1",
  error: null,
};

/** The owner's case: a kept Kyoto day, its start changed to slow, its first re-plan. */
const BODY: ReplanRequest = {
  basis: { kind: "kept", id: LIVE_KYOTO_ID },
  request: KYOTO_SLOW_START,
  changed: "start",
  round: 1,
  picks: {},
};

/** A page's own day, with one kept stop's line rewritten, as any client could send it. */
const CLIENT_TEXT = "A line the client wrote, never the model";

function writing(replan: GeneratedReplan): ClaudeAnswer {
  return { kind: "message", text: JSON.stringify(replan), usage: USAGE };
}

/** The prompt a call sent, as the model reads it: its one message's text. */
function promptSent(body: Record<string, unknown> | undefined): string {
  const [message] = (body?.messages ?? []) as { content: { text?: string }[] }[];
  return message?.content.map(({ text }) => text ?? "").join("") ?? "";
}

function post(body: unknown): Request {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "203.0.113.7" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface LoggedLine {
  event: string;
  fields: Record<string, unknown>;
}

interface BenchOptions {
  answer?: ClaudeAnswer;
  caps?: SpendCaps;
  dayLimit?: number;
}

function bench({
  answer = writing(KYOTO_SLOW_MORNING),
  caps = { dailyUsd: 10, monthlyUsd: null },
  dayLimit = 10,
}: BenchOptions = {}) {
  const claude = fakeClaude(answer);
  const generationLog = new InMemoryGenerationLog();
  // The kept day each re-plan here rewrites.
  generationLog.records.push(LIVE_KYOTO);
  const appSpend = new InMemoryAppSpend(caps);
  const lines: LoggedLine[] = [];
  const scheduled: (() => Promise<void>)[] = [];
  let lastId = 0;
  const deps: LiveReplanDeps = {
    config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
    model: claude.provider("claude-sonnet-5-5"),
    visitorLimits: new InMemoryVisitorLimits({ day: dayLimit, intake: 20 }),
    appSpend,
    generationLog,
    dayArchive: generationLog,
    basisRetryMs: 0,
    schedule: (task) => {
      scheduled.push(task);
    },
    log: (event, fields) => lines.push({ event, fields }),
    now: () => NOW,
    newId: () => dayIdOf(++lastId),
    maxRetries: 0,
  };
  return {
    deps,
    claude,
    generationLog,
    appSpend,
    lines,
    /** Waits for what the route leaves to `after()`: the spend and the record. */
    afterResponse: async () => {
      await Promise.all(scheduled.splice(0).map((task) => task()));
    },
  };
}

function read(response: Promise<Response>): Promise<DayOutcome> {
  return readReplanStream({ basis: KYOTO_MORNING_BASIS, response, onPartial: () => undefined });
}

function merged(replan: GeneratedReplan) {
  const result = mergeReplan({ ...KYOTO_MORNING_BASIS, replan });
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary;
}

/** The garden's place, kept after the morning, and one of its options, which a swap shows. */
const KEPT_GARDEN = KYOTO_ITINERARY.stops[2]?.primary.name ?? "";
const KEPT_OPTION = KYOTO_ITINERARY.stops[2]?.alternatives[0]?.name ?? "";

/** The slow morning with its shrine written at the garden kept after it, which the merge drops. */
const REPEATING_MORNING: GeneratedReplan = {
  ...KYOTO_SLOW_MORNING,
  stops: KYOTO_SLOW_MORNING.stops.map((stop, index) =>
    index === 1 ? { ...stop, place: { ...stop.place, name: KEPT_GARDEN } } : stop,
  ),
};

/** Every stop of the slow morning moved to the afternoon, outside the window it was asked for. */
const AFTERNOON_ONLY: GeneratedReplan = {
  ...KYOTO_SLOW_MORNING,
  stops: KYOTO_SLOW_MORNING.stops.map((stop) => ({ ...stop, startTime: "15:00" })),
};

describe("the live re-plan route", () => {
  it("streams the morning the page merges into its day, asked of the day's model under replan-v1", async () => {
    const { deps, claude } = bench();

    const outcome = await read(answerReplanRequest(post(BODY), deps));

    expect(outcome).toEqual({ kind: "complete", itinerary: merged(KYOTO_SLOW_MORNING) });
    const [sent] = claude.requests;
    expect(sent?.model).toBe("claude-sonnet-5-5");
    expect(sent?.max_tokens).toBe(REPLAN_MAX_OUTPUT_TOKENS);
    const text = JSON.stringify(sent);
    expect(text).toContain("You re-plan part of one day");
    // The kept garden at ten is read as a kept stop; no stop's line is sent back.
    expect(text).toContain(KYOTO_ITINERARY.stops[2]?.primary.name);
    expect(text).not.toContain(KYOTO_ITINERARY.stops[2]?.primary.summary);
  });

  // replan-v6 sent the words Lantern assumed as open; the day's headline says them as its own.
  // replan-v7 also listed the kept stops' options, and new stops went to them.
  it("asks for the kept day's words as the day has them, and names a kept stop's place but not its options", async () => {
    const { deps, claude } = bench();

    await read(answerReplanRequest(post(BODY), deps));

    const prompt = promptSent(claude.requests[0]);
    expect(KYOTO_SLOW_START.end).toBeNull();
    expect(prompt).toContain('"assumed":{"travel":"on-foot","dinner":"early","end":"evening"}');
    expect(prompt).toContain('"open":["company"]');
    expect(prompt).toContain(KEPT_GARDEN);
    expect(KEPT_OPTION).not.toBe("");
    expect(prompt).not.toContain(KEPT_OPTION);
  });

  it("names its row in the log in its answer, and writes on when the visitor leaves", async () => {
    const { deps, generationLog, afterResponse } = bench();

    const response = await answerReplanRequest(post(BODY), deps);
    const id = response.headers.get(DAY_ID_HEADER);
    await response.body?.cancel();
    await afterResponse();

    expect(id).not.toBeNull();
    expect(generationLog.records.at(-1)).toMatchObject({ id, outcome: "complete" });
  });

  it("reads the windows from the day itself: a slow start takes Kyoto's 07:30 temple and 08:25 walk", async () => {
    const { deps, generationLog, afterResponse } = bench();

    await read(answerReplanRequest(post(BODY), deps));
    await afterResponse();

    expect(generationLog.records.at(-1)?.context?.windows).toEqual([{ from: 0, to: 1 }]);
  });

  it("counts one of the visitor's ten days, and settles the re-plan's hold at what it cost", async () => {
    const { deps, appSpend, afterResponse } = bench({ dayLimit: 1 });

    await read(answerReplanRequest(post(BODY), deps));
    await afterResponse();

    expect(appSpend.spentOn(NOW)).toBeCloseTo(
      costOf("claude-sonnet-5-5", {
        inputTokens: USAGE.input,
        outputTokens: USAGE.output,
      } as Parameters<typeof costOf>[1]) ?? Number.NaN,
      10,
    );
    expect(await read(answerReplanRequest(post(BODY), deps))).toEqual({ kind: "limited" });
  });

  it("records the re-plan alone, under its prompt version, with the context that lets it run again", async () => {
    const { deps, generationLog, afterResponse } = bench();

    await read(answerReplanRequest(post(BODY), deps));
    await afterResponse();

    // The kept day, and the re-plan alone beside it.
    expect(generationLog.records).toHaveLength(2);
    expect(generationLog.records.at(-1)).toMatchObject({
      pairId: null,
      role: "day",
      model: "claude-sonnet-5-5",
      promptVersion: REPLAN_PROMPT_VERSION,
      outcome: "complete",
      salvaged: false,
      checks: [
        expect.objectContaining({ id: "replan-windows", passed: true, findings: [] }),
        expect.objectContaining({ id: "replan-word", passed: true, findings: [] }),
        expect.objectContaining({ id: "replan-time-words", passed: true, findings: [] }),
        expect.objectContaining({ id: "replan-drops", passed: true, value: 0 }),
        expect.objectContaining({ id: "replan-gap", passed: true, findings: [] }),
      ],
      request: KYOTO_SLOW_START,
      outputText: JSON.stringify(KYOTO_SLOW_MORNING),
      context: {
        changed: "start",
        round: 1,
        windows: [{ from: 0, to: 1 }],
        itinerary: KYOTO_ITINERARY,
        basis: { kind: "kept", id: LIVE_KYOTO_ID },
      },
    });
    expect(generationLog.records.at(-1)?.repairs).toEqual(expect.any(Number));
  });

  it("writes each field of the re-plan's record, from the trace, the merge and the context", async () => {
    const { deps, generationLog, afterResponse } = bench();

    await read(answerReplanRequest(post(BODY), deps));
    await afterResponse();

    expect(generationLog.records.at(-1)).toStrictEqual({
      id: expect.any(String),
      pairId: null,
      role: "day",
      model: "claude-sonnet-5-5",
      promptVersion: REPLAN_PROMPT_VERSION,
      startedAt: NOW.toISOString(),
      tokens: { input: USAGE.input, output: USAGE.output, thinking: null },
      costUsd: expect.any(Number),
      msToFirstToken: expect.any(Number),
      msToFinish: expect.any(Number),
      finishReason: "stop",
      outcome: "complete",
      salvaged: false,
      repairs: expect.any(Number),
      checks: expect.any(Array),
      visitorText: null,
      request: KYOTO_SLOW_START,
      outputText: JSON.stringify(KYOTO_SLOW_MORNING),
      warnings: [],
      requestId: expect.any(String),
      error: null,
      placeChecks: null,
      context: expect.objectContaining({ round: 1, basis: { kind: "kept", id: LIVE_KYOTO_ID } }),
    });
  });

  it("gives the visitor's day back when the re-plan fails, before the page reads its outcome", async () => {
    const { deps, lines } = bench({ answer: writing(AFTERNOON_ONLY), dayLimit: 1 });

    expect(await read(answerReplanRequest(post(BODY), deps))).toEqual({
      kind: "invalid",
      reason: "the re-plan left window 1 without a stop",
      isEmpty: false,
    });
    expect(lines.map(({ event }) => event)).toContain("failed-replan-given-back");
    // The day came back, so the page's next try is not limited.
    const retry = bench({ dayLimit: 1 });
    retry.deps.visitorLimits = deps.visitorLimits;
    expect((await read(answerReplanRequest(post(BODY), retry.deps))).kind).toBe("complete");
  });

  // Production's Elche evening named a coffee the merge had dropped, and stood empty 17:30-21:00.
  it("ends a re-plan that repeats a kept place as invalid, once, and never shows its day", async () => {
    const { deps, claude, generationLog, lines, afterResponse } = bench({
      answer: writing(REPEATING_MORNING),
      dayLimit: 1,
    });

    const response = answerReplanRequest(post(BODY), deps);
    const outcome = await read(response);
    await afterResponse();

    expect(outcome).toEqual({
      kind: "invalid",
      reason: `the re-plan dropped stops[1]: ${KEPT_GARDEN} is kept`,
      isEmpty: false,
    });
    // One call: the route asks nothing again, and the visitor's day comes back.
    expect(claude.requests).toHaveLength(1);
    expect(lines.map(({ event }) => event)).toContain("failed-replan-given-back");
    const record = generationLog.records.at(-1);
    expect(record).toMatchObject({ outcome: "invalid" });
    expect(record?.checks).toContainEqual(
      expect.objectContaining({
        id: "replan-drops",
        passed: false,
        value: 1,
        findings: [`stops[1]: repeats a kept place, ${KEPT_GARDEN} is kept`],
      }),
    );
    // Its address never opens the day with the stop dropped.
    const id = (await response).headers.get(DAY_ID_HEADER) ?? "";
    expect((await readStoredDay(id, generationLog, NOW)).status).toBe("failed");
  });

  // A record the route kept before a drop failed a re-plan holds the day its visitor saw.
  it("still opens a re-plan kept with a dropped stop, Elche's, as it was shown, and re-plans it", async () => {
    const kept: GenerationRecord = {
      ...LIVE_KYOTO,
      id: dayIdOf(901),
      promptVersion: "replan-v6",
      request: ELCHE_EATING_LATE,
      outputText: JSON.stringify(ELCHE_LATE_DINNER),
      context: {
        changed: "dinner",
        round: 1,
        windows: [...ELCHE_DINNER_BASIS.windows],
        itinerary: ELCHE_ITINERARY,
        basis: { kind: "kept", id: dayIdOf(902) },
      },
    };
    const log = new InMemoryGenerationLog();
    await log.record(kept);

    const stored = await readStoredDay(kept.id, log, NOW);

    if (stored.status !== "written") throw new Error(stored.status);
    expect(stored.itinerary.stops.map(({ id, startTime }) => `${id} ${startTime}`)).toEqual(
      ELCHE_SHOWN_STOPS,
    );
    expect(stored.itinerary.dek).toContain("coffee on the square again");
    expect(await keptBasisOf(kept.id, log, NOW)).toMatchObject({
      kind: "kept",
      basis: { round: 1 },
    });
  });

  it("answers a word no part of the day re-plans with a 409 and its reason, before anything is counted", async () => {
    const { deps, claude, generationLog } = bench({ dayLimit: 0 });
    // A kept day none of whose stops names travel: the word re-plans the whole of it.
    const untaggedId = dayIdOf(901);
    const stops = KYOTO_DAY.day.stops.map((stop) => ({
      ...stop,
      dependsOn: stop.dependsOn.filter((word) => word !== "travel"),
    }));
    generationLog.records.push({
      ...LIVE_KYOTO,
      id: untaggedId,
      outputText: dayText({ ...KYOTO_DAY.day, stops }),
    });
    const travel = {
      ...BODY,
      basis: { kind: "kept", id: untaggedId },
      changed: "travel",
      request: { ...KYOTO_SLOW_START, travel: "transit" },
    };

    const response = await answerReplanRequest(post(travel), deps);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ plan: "full", reason: "travel changes no stop" });
    expect(claude.requests).toEqual([]);
  });

  it("refuses a body that is not a re-plan request, or too large, and answers 503 with the flag off", async () => {
    const { deps } = bench();

    expect((await answerReplanRequest(post("{"), deps)).status).toBe(400);
    const missing = await answerReplanRequest(post({ ...BODY, round: undefined }), deps);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ issues: [{ path: "round" }] });
    const padded = { ...BODY, padding: "x".repeat(MAX_REPLAN_BODY_BYTES) };
    expect((await answerReplanRequest(post(padded), deps)).status).toBe(413);
    expect((await answerReplanRequest(post(BODY), null)).status).toBe(503);
  });

  it("refuses a request for another city, date or zone than the day's, before any count", async () => {
    const { deps, claude } = bench({ dayLimit: 0 });
    const paris = { ...KYOTO_SLOW_START, city: "Paris", timezone: "Europe/Paris" };

    const response = await answerReplanRequest(post({ ...BODY, request: paris }), deps);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      issues: [{ path: "request", message: expect.stringMatching(/\(city, timezone\)$/) }],
    });
    expect(claude.requests).toEqual([]);
  });

  it("checks the new places as a day's are, keyed by their ids in the merged day", async () => {
    const { deps, generationLog, afterResponse } = bench();
    const point = { lat: 35.0062, lng: 135.7835 };
    const asked: string[] = [];
    deps.placeVerifier = {
      verify: (place) => {
        asked.push(place.name);
        return Promise.resolve({
          kind: "verified",
          by: "name",
          lat: point.lat,
          lng: point.lng,
          providerId: "p1",
          source: "geoapify",
        });
      },
    };
    const checks: PlaceCheck[] = [];

    const outcome = await readReplanStream({
      basis: KYOTO_MORNING_BASIS,
      response: answerReplanRequest(post(BODY), deps),
      onPartial: () => undefined,
      onPlaceCheck: (check) => checks.push(check),
    });
    await afterResponse();

    // Only the re-plan's places: the kept ones were checked when their day was written.
    expect(asked).toContain("Shoren-in");
    expect(asked).not.toContain(KYOTO_ITINERARY.stops[2]?.primary.name);
    expect(checks.map(({ placeId }) => placeId)).toContain("r1-stop-0:p");
    if (outcome.kind !== "complete") throw new Error(outcome.kind);
    expect(outcome.itinerary.stops[0]?.primary.coordinates).toEqual(point);
    expect(generationLog.records.at(-1)?.checks?.map(({ id }) => id)).toContain("places-confirmed");
  });

  it("is limited when the app's cap has no room for the re-plan's worst case, and gives the day back", async () => {
    const { deps, claude } = bench({
      caps: { dailyUsd: REPLAN_RESERVE_USD / 2, monthlyUsd: null },
      dayLimit: 1,
    });

    expect(await read(answerReplanRequest(post(BODY), deps))).toEqual({ kind: "limited" });
    expect(claude.requests).toEqual([]);
    const roomy = bench({ dayLimit: 1 });
    roomy.deps.visitorLimits = deps.visitorLimits;
    expect((await read(answerReplanRequest(post(BODY), roomy.deps))).kind).toBe("complete");
  });
});

describe("the live re-plan route, for a page on another site", () => {
  it("refuses it with 403 before reading the body, and the reader takes it as unavailable", async () => {
    const { deps, claude, generationLog, appSpend, lines, afterResponse } = bench();
    const request = new Request(ROUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "sec-fetch-site": "cross-site" },
      body: JSON.stringify(BODY),
    });

    const response = answerReplanRequest(request, deps);
    const outcome = await read(response);
    await afterResponse();

    expect((await response).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(outcome).toEqual({ kind: "unavailable" });
    expect(claude.requests).toEqual([]);
    expect(generationLog.records).toEqual([LIVE_KYOTO]);
    expect(appSpend.spentOn(NOW)).toBe(0);
    expect(lines).toEqual([]);
  });
});

describe("the day a re-plan rewrites, read by the server (docs/security.md, S1)", () => {
  it("takes no day from the page, so no client's line reaches the model or the re-plan's link", async () => {
    const { deps, claude, generationLog, afterResponse } = bench();
    const clients = {
      ...KYOTO_ITINERARY,
      stops: KYOTO_ITINERARY.stops.map((stop) => ({
        ...stop,
        primary: { ...stop.primary, summary: CLIENT_TEXT },
      })),
    };

    // A day is far past the body's size, and any field but the five is no re-plan request.
    const whole = await answerReplanRequest(post({ ...BODY, itinerary: clients }), deps);
    const extra = await answerReplanRequest(post({ ...BODY, summary: CLIENT_TEXT }), deps);
    const response = answerReplanRequest(post(BODY), deps);
    await read(response);
    await afterResponse();

    expect(whole.status).toBe(413);
    expect(extra.status).toBe(400);
    expect(JSON.stringify(claude.requests)).not.toContain(CLIENT_TEXT);
    const id = (await response).headers.get(DAY_ID_HEADER) ?? "";
    const stored = await readStoredDay(id, generationLog, NOW);
    if (stored.status !== "written") throw new Error(stored.status);
    expect(JSON.stringify(stored)).not.toContain(CLIENT_TEXT);
    expect(stored.itinerary.stops.slice(2)).toEqual(KYOTO_ITINERARY.stops.slice(2));
  });

  it("reads the kept stops as the visitor sees them, by the picks' ids, and keeps the day so planned", async () => {
    const { deps, claude, generationLog, afterResponse } = bench();
    const garden = KYOTO_ITINERARY.stops[2];
    const option = garden?.alternatives[0];
    if (garden === undefined || option === undefined) throw new Error("Kyoto's garden has options");

    const response = answerReplanRequest(
      post({ ...BODY, picks: { [garden.id]: option.id } }),
      deps,
    );
    await read(response);
    await afterResponse();

    // The kept garden is read as the version on screen; the plan's garden is named nowhere.
    const kept = /<kept>\n(.*)\n<\/kept>/.exec(promptSent(claude.requests[0]))?.[1] ?? "";
    expect(kept).toContain(JSON.stringify(option.name));
    expect(kept).not.toContain(JSON.stringify(garden.primary.name));
    const id = (await response).headers.get(DAY_ID_HEADER) ?? "";
    const stored = await readStoredDay(id, generationLog, NOW);
    if (stored.status !== "written") throw new Error(stored.status);
    const keptGarden = stored.itinerary.stops.find(({ id: stopId }) => stopId === garden.id);
    expect(keptGarden?.selectedPlaceId).toBe(option.id);
    // The places are the day's own: only which one the stop plans moved.
    expect(keptGarden?.alternatives).toEqual(garden.alternatives);
  });

  it.each([
    ["a stop the day does not hold", { "stop-99": "stop-99:p" }, "picks"],
    ["a place of another stop", { "stop-2": "stop-3:p" }, "picks"],
    ["a place's name rather than its id", { "stop-2": "Murin-an's garden" }, "picks"],
    [
      "more picks than a day re-planned holds stops",
      Object.fromEntries(Array.from({ length: 17 }, (_, at) => [`stop-${at}`, `stop-${at}:p`])),
      "picks",
    ],
  ])("refuses a pick of %s, before any count or call", async (_name, picks, path) => {
    // One day a visitor: the refused re-plan must leave it for the next.
    const { deps, claude, appSpend } = bench({ dayLimit: 1 });

    const response = await answerReplanRequest(post({ ...BODY, picks }), deps);

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(path);
    expect(claude.requests).toHaveLength(0);
    expect(appSpend.spentOn(NOW)).toBe(0);
    const next = await answerReplanRequest(post(BODY), deps);
    expect(next.status).toBe(200);
    await next.body?.cancel();
  });

  it("reads a written day from its file by its address", async () => {
    const { deps, claude, generationLog, afterResponse } = bench();
    const kanazawa = writtenDayAt("kanazawa");
    if (kanazawa === null) throw new Error("Kanazawa has no written day");
    const body = {
      basis: { kind: "written", slug: "kanazawa" },
      request: { ...kanazawa.request, start: "slow" },
      changed: "start",
      round: 1,
    };

    const response = await answerReplanRequest(post(body), deps);
    await response.body?.cancel();
    await afterResponse();

    // The day as its file holds it, its evening kept and sent as a kept stop.
    expect(JSON.stringify(claude.requests)).toContain(
      kanazawa.itinerary.stops.at(-1)?.primary.name,
    );
    expect(generationLog.records.at(-1)?.context).toMatchObject({
      round: 1,
      itinerary: kanazawa.itinerary,
      basis: { kind: "written", slug: "kanazawa" },
    });
  });

  it("reads a written day on the date its page shows it on, and re-plans it there", async () => {
    const { deps, claude, generationLog, afterResponse } = bench();
    const kanazawa = writtenDayAt("kanazawa");
    if (kanazawa === null) throw new Error("Kanazawa has no written day");
    // Thursday the 19th in Tokyo: the page shows Kanazawa's Saturday on the 21st.
    const shownOn = "2026-11-21";
    const body = {
      basis: { kind: "written", slug: "kanazawa" },
      request: { ...kanazawa.request, date: shownOn, start: "slow" },
      changed: "start",
      round: 1,
    };

    const response = await answerReplanRequest(post(body), deps);
    await response.body?.cancel();
    await afterResponse();

    expect(response.status).toBe(200);
    expect(JSON.stringify(claude.requests)).toContain(shownOn);
    expect(generationLog.records.at(-1)?.context).toMatchObject({
      itinerary: { ...kanazawa.itinerary, date: shownOn },
    });
  });

  it("re-plans a re-plan from its kept record, as the next round, and refuses a round out of turn", async () => {
    const { deps, claude, generationLog, afterResponse } = bench();
    const first = await answerReplanRequest(post(BODY), deps);
    await read(Promise.resolve(first));
    await afterResponse();
    const firstId = first.headers.get(DAY_ID_HEADER) ?? "";
    const again = {
      basis: { kind: "kept", id: firstId },
      request: { ...KYOTO_SLOW_START, start: "early" },
      changed: "start",
    };

    const outOfTurn = await answerReplanRequest(post({ ...again, round: 1 }), deps);
    const second = await answerReplanRequest(post({ ...again, round: 2 }), deps);
    await second.body?.cancel();
    await afterResponse();

    expect(outOfTurn.status).toBe(409);
    expect(await outOfTurn.json()).toEqual({
      plan: "full",
      reason: "The day has taken 1 re-plans, so this one is round 2",
    });
    expect(second.status).toBe(200);
    expect(claude.requests).toHaveLength(2);
    expect(generationLog.records.at(-1)?.context).toMatchObject({
      round: 2,
      basis: { kind: "kept", id: firstId },
    });
    expect(generationLog.records.at(-1)?.context?.itinerary.stops[0]?.id).toBe("r1-stop-0");
  });

  it("reads again a day whose record has not landed, and takes it once it has", async () => {
    const { deps, generationLog } = bench();
    let reads = 0;
    const landing: DayArchive = {
      dayRecordOf: (id) => {
        reads += 1;
        return reads < 3 ? Promise.resolve(null) : generationLog.dayRecordOf(id);
      },
    };
    const outcome = await read(answerReplanRequest(post(BODY), { ...deps, dayArchive: landing }));

    expect(reads).toBe(3);
    expect(outcome.kind).toBe("complete");
  });

  it("sends a word for a day it does not hold on to the whole day, before anything is counted", async () => {
    const { deps, claude, lines } = bench({ dayLimit: 0 });
    let reads = 0;
    const empty: DayArchive = {
      dayRecordOf: () => {
        reads += 1;
        return Promise.resolve(null);
      },
    };
    const kept = { ...BODY, basis: { kind: "kept", id: dayIdOf(404) } };
    const written = { ...BODY, basis: { kind: "written", slug: "atlantis" } };
    // A day written by hand is a fixture: no address of the site's holds it.
    const handWritten = { ...BODY, basis: { kind: "written", slug: "kyoto" } };

    const notLanded = await answerReplanRequest(post(kept), { ...deps, dayArchive: empty });
    const noSuchDay = await answerReplanRequest(post(written), deps);
    const noKyoto = await answerReplanRequest(post(handWritten), deps);

    expect(reads).toBe(4);
    expect(notLanded.status).toBe(409);
    expect(await notLanded.json()).toEqual({
      plan: "full",
      reason: "The day to re-plan is unknown",
    });
    expect(noSuchDay.status).toBe(409);
    expect(await noKyoto.json()).toEqual({
      plan: "full",
      reason: "No written day has that address",
    });
    expect(claude.requests).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("answers 503 by the stores' deadline, holding nothing, when the log does not answer", async () => {
    const { deps, claude, appSpend, lines } = bench();
    const hanging: DayArchive = { dayRecordOf: () => new Promise(() => undefined) };

    const response = await answerReplanRequest(post(BODY), {
      ...deps,
      dayArchive: hanging,
      preCallDeadlineMs: 50,
    });

    expect(response.status).toBe(503);
    expect(lines).toEqual([
      {
        event: "replan-basis-unread",
        fields: { message: "The generation log did not answer in time" },
      },
    ]);
    expect(claude.requests).toEqual([]);
    expect(appSpend.spentOn(NOW)).toBe(0);
  });

  // Four reads, `BASIS_RETRY_MS` apart, would wait past this deadline: the waits count against it.
  it("counts its waits for a day's record against the same deadline as the count and the hold", async () => {
    const { deps, claude, lines } = bench();
    const notLanded: DayArchive = { dayRecordOf: () => Promise.resolve(null) };

    const response = await answerReplanRequest(post(BODY), {
      ...deps,
      dayArchive: notLanded,
      basisRetryMs: 50,
      preCallDeadlineMs: 120,
    });

    expect(response.status).toBe(503);
    expect(lines.map(({ event }) => event)).toEqual(["replan-basis-unread"]);
    expect(claude.requests).toEqual([]);
  });

  it("answers unavailable when the log cannot be read, holding nothing", async () => {
    const { deps, claude, appSpend, lines } = bench();
    const failing: DayArchive = {
      dayRecordOf: () => Promise.reject(new Error("The database did not answer")),
    };
    const kept = { ...BODY, basis: { kind: "kept", id: LIVE_KYOTO_ID } };

    const response = await answerReplanRequest(post(kept), { ...deps, dayArchive: failing });

    expect(response.status).toBe(503);
    expect(lines.map(({ event }) => event)).toEqual(["replan-basis-unread"]);
    expect(claude.requests).toEqual([]);
    expect(appSpend.spentOn(NOW)).toBe(0);
  });
});
