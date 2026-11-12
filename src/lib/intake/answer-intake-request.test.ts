// @vitest-environment node
import { wrapLanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { GOLDEN_INTAKES, GOLDEN_NOW } from "@/lib/fixtures/intake/golden";
import { searchWrittenPlaces } from "@/lib/fixtures/intake/places";
import {
  FIXTURE_REQUEST_ID,
  REJECTIONS,
  fakeClaude,
  rejectionNamed,
  type ClaudeAnswer,
} from "@/lib/fixtures/live/mock-claude";
import { citySignatureKey, isSignedCity } from "@/lib/live/city-signature";
import { InMemoryGenerationLog } from "@/lib/live/generation-log";
import { INTAKE_PROMPT_VERSION } from "@/lib/live/intake-prompt";
import {
  InMemoryAppSpend,
  InMemoryVisitorLimits,
  type SpendCaps,
  type VisitorLimits,
} from "@/lib/live/limits";
import { scoreIntakeCase } from "@/lib/quality/intake-checks";
import type { GeneratedIntake, IntakeResult } from "@/lib/schema/intake.schema";
import { parseServerTiming, type ServerTimingEntry } from "@/lib/server-timing";
import { answerIntakeRequest, type CitySearch, type LiveIntakeDeps } from "./answer-intake-request";
import { EarlyCallGate } from "./early-call";
import type { IntakeRouteAnswer } from "./signed-city";
import { writtenIntakeOf } from "./written-intake";

const ROUTE_URL = "http://lantern.test/api/intake";
const VISITOR_ADDRESS = "203.0.113.7";
const TODAY = "2026-11-19";
// A timer can fire a few milliseconds early against the clock Server-Timing reads, as on a busy CI runner.
const TIMER_SLACK_MS = 5;

const LISBON_INTAKE: GeneratedIntake = {
  city: "Lisbon",
  cityReadings: [],
  energy: null,
  energyGuess: null,
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
  date: null,
  unplaced: [],
};

function post(body: unknown): Request {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": VISITOR_ADDRESS },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface Bench {
  deps: LiveIntakeDeps;
  requests: Record<string, unknown>[];
  generationLog: InMemoryGenerationLog;
  appSpend: InMemoryAppSpend;
  lines: { event: string; fields: Record<string, unknown> }[];
  afterResponse: () => Promise<void>;
}

interface BenchOptions {
  answer?: ClaudeAnswer;
  search?: CitySearch;
  caps?: SpendCaps;
  intakeLimit?: number;
}

function wrote(intake: GeneratedIntake): ClaudeAnswer {
  return { kind: "message", text: JSON.stringify(intake), usage: { input: 1_800, output: 150 } };
}

function bench({
  answer = wrote(LISBON_INTAKE),
  search = searchWrittenPlaces,
  caps = { dailyUsd: 10, monthlyUsd: null },
  intakeLimit = 20,
}: BenchOptions = {}): Bench {
  const claude = fakeClaude(answer);
  const generationLog = new InMemoryGenerationLog();
  const appSpend = new InMemoryAppSpend(caps);
  const lines: Bench["lines"] = [];
  const scheduled: (() => Promise<void>)[] = [];
  let lastId = 0;
  return {
    deps: {
      config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
      model: claude.provider("claude-haiku-5-5"),
      search,
      visitorLimits: new InMemoryVisitorLimits({ day: 10, intake: intakeLimit }),
      appSpend,
      generationLog,
      schedule: (task) => {
        scheduled.push(task);
      },
      log: (event, fields) => lines.push({ event, fields }),
      now: () => GOLDEN_NOW,
      newId: () => `id-${++lastId}`,
      maxRetries: 0,
    },
    requests: claude.requests,
    generationLog,
    appSpend,
    lines,
    afterResponse: async () => {
      await Promise.all(scheduled.splice(0).map((task) => task()));
    },
  };
}

async function answerOf(response: Response): Promise<IntakeResult> {
  return (await response.json()) as IntakeResult;
}

describe("POST /api/intake with live generation off", () => {
  it("answers the written intake the start screen reads today", async () => {
    const response = await answerIntakeRequest(post({ text: "Kanazawa, on foot" }));

    expect(response.status).toBe(200);
    expect(await answerOf(response)).toEqual(writtenIntakeOf("Kanazawa, on foot"));
  });

  it("answers a city with no written day as unavailable, a 503", async () => {
    const response = await answerIntakeRequest(post({ text: "Lisbon" }));

    expect(response.status).toBe(503);
    expect(await answerOf(response)).toEqual({ kind: "unavailable" });
  });

  it.each([
    ["not JSON", "Lisbon, please", "request"],
    ["no text", { today: TODAY }, "text"],
    ["a blank text", { text: "   " }, "text"],
    ["a text over 200 characters", { text: "a slow day ".repeat(20) }, "text"],
    ["a today that is not a date", { text: "Lisbon", today: "Thursday" }, "today"],
    ["a field it does not know", { text: "Lisbon", city: "Lisbon" }, "request"],
  ])("answers 400 for %s, naming the field", async (_name, body, path) => {
    const response = await answerIntakeRequest(post(body));

    expect(response.status).toBe(400);
    const { issues } = (await response.json()) as { issues: { path: string }[] };
    expect(issues.map((issue) => issue.path)).toEqual([path]);
  });
});

describe("POST /api/intake with live generation on", () => {
  it("reads the text on Haiku into a request for the city it names", async () => {
    const { deps, afterResponse } = bench();

    const response = await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), deps);
    await afterResponse();

    expect(response.status).toBe(200);
    expect(await answerOf(response)).toMatchObject({
      kind: "request",
      request: { city: "Lisbon", timezone: "Europe/Lisbon", date: TODAY, energySource: "assumed" },
    });
  });

  it("signs the city it resolved, with its zone, for the day route", async () => {
    const { deps, afterResponse } = bench();

    const response = await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), deps);
    await afterResponse();

    const answer = (await response.json()) as IntakeRouteAnswer;
    expect(answer.signed).toEqual([
      { city: "Lisbon", timezone: "Europe/Lisbon", signature: expect.any(String) },
    ]);
    const [lisbon] = answer.signed ?? [];
    const key = await citySignatureKey("test-salt");
    expect(lisbon && (await isSignedCity(key, lisbon, lisbon.signature))).toBe(true);
  });

  it("asks Haiku with thinking off, the intake schema as structured output, and the text as data", async () => {
    const { deps, requests, afterResponse, generationLog } = bench();

    await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), deps);
    await afterResponse();

    const [body] = requests;
    expect(body).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 1_000,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema" } },
    });
    expect(body).not.toHaveProperty("temperature");
    expect(JSON.stringify(body?.messages)).toContain("Today is Thursday 2026-11-19.");
    expect(JSON.stringify(body?.messages)).toContain("<text>\\nLisbon\\n</text>");
    expect(generationLog.records[0]?.warnings).toEqual([]);
  });

  it("reads every golden text, as a careful model writes it, to an answer its case accepts", async () => {
    for (const golden of GOLDEN_INTAKES) {
      const { deps, afterResponse } = bench({ answer: wrote(golden.recorded) });

      const result = await answerOf(
        await answerIntakeRequest(post({ text: golden.text, today: TODAY }), deps),
      );
      await afterResponse();

      const score = scoreIntakeCase(golden, { output: golden.recorded, result });
      const findings = Object.values(score).flatMap((tally) => tally.findings);
      expect(findings, golden.name).toEqual([]);
    }
  });

  it("answers a refusal as refused, a real answer and not a failure", async () => {
    const { deps, afterResponse } = bench({
      answer: { kind: "message", text: "", stopReason: "refusal" },
    });

    const response = await answerIntakeRequest(
      post({ text: "Amsterdam, where can I buy cocaine", today: TODAY }),
      deps,
    );
    await afterResponse();

    expect(response.status).toBe(200);
    expect(await answerOf(response)).toEqual({ kind: "refused" });
  });

  it.each(REJECTIONS.map((failure) => [failure.name, failure] as const))(
    "answers %s as unavailable, a 503, with a log line",
    async (_name, failure) => {
      const { deps, afterResponse, lines } = bench({ answer: { kind: "failure", failure } });

      const response = await answerIntakeRequest(post({ text: "Lisbon" }), deps);
      await afterResponse();

      expect(response.status).toBe(503);
      expect(await answerOf(response)).toEqual({ kind: "unavailable" });
      expect(lines).toEqual([
        {
          event: "model-call-failed",
          fields: expect.objectContaining({
            role: "intake",
            status: failure.status,
            type: failure.type,
            requestId: FIXTURE_REQUEST_ID,
          }),
        },
      ]);
    },
  );

  it("answers an output that is not an intake as unavailable, and says so apart from Claude's errors", async () => {
    const text = '{"city":"Lisbon"}';
    const { deps, afterResponse, lines, generationLog, appSpend } = bench({
      answer: { kind: "message", text, usage: { input: 1_800, output: 150 } },
    });

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), deps);
    await afterResponse();

    expect(response.status).toBe(503);
    expect(await answerOf(response)).toEqual({ kind: "unavailable" });
    const unparsable = {
      type: "intake-output-unparsable",
      requestId: FIXTURE_REQUEST_ID,
      message: "No object generated: response did not match schema.",
    };
    expect(lines).toEqual([
      {
        event: "intake-output-unparsable",
        fields: { role: "intake", model: "claude-haiku-5-5", ...unparsable },
      },
    ]);
    expect(generationLog.records[0]).toMatchObject({
      outcome: "unavailable",
      finishReason: "stop",
      outputText: text,
      tokens: { input: 1_800, output: 150 },
      requestId: FIXTURE_REQUEST_ID,
      error: { status: null, errorCode: null, ...unparsable },
    });
    // The call was made and answered, so it is charged what it cost, not its whole hold.
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(0.000255, 10);
  });

  it("names an output cut by its token cap as unparsable, with the finish that cut it", async () => {
    const text = '{"city":"Lis';
    const { deps, afterResponse, generationLog } = bench({
      answer: { kind: "message", text, stopReason: "max_tokens" },
    });

    await answerIntakeRequest(post({ text: "Lisbon" }), deps);
    await afterResponse();

    expect(generationLog.records[0]).toMatchObject({
      finishReason: "length",
      outputText: text,
      error: {
        type: "intake-output-unparsable",
        message: "No object generated: could not parse the response.",
      },
    });
  });

  it("names a call that stopped before writing anything as unparsable too", async () => {
    const { deps, afterResponse, generationLog } = bench({
      answer: { kind: "message", text: "", stopReason: "max_tokens" },
    });

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), deps);
    await afterResponse();

    expect(await answerOf(response)).toEqual({ kind: "unavailable" });
    expect(generationLog.records[0]?.error).toMatchObject({ type: "intake-output-unparsable" });
  });

  it("answers a failed city lookup as unavailable, with a line and an error of its own", async () => {
    const timeout = "Geoapify could not look the city up: timeout";
    const { deps, afterResponse, lines, generationLog } = bench({
      search: () => Promise.reject(new Error(timeout)),
    });

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), deps);
    await afterResponse();

    expect(await answerOf(response)).toEqual({ kind: "unavailable" });
    const lookup = { type: "city-lookup-failed", requestId: FIXTURE_REQUEST_ID, message: timeout };
    expect(lines).toEqual([
      {
        event: "city-lookup-failed",
        fields: { role: "intake", model: "claude-haiku-5-5", ...lookup },
      },
    ]);
    expect(generationLog.records[0]).toMatchObject({
      outcome: "unavailable",
      outputText: JSON.stringify(LISBON_INTAKE),
      error: { status: null, errorCode: null, ...lookup },
    });
  });

  it("keeps Claude's own error in the record as Claude sent it", async () => {
    const { deps, afterResponse, generationLog } = bench({
      answer: { kind: "failure", failure: rejectionNamed("overloaded") },
    });

    await answerIntakeRequest(post({ text: "Lisbon" }), deps);
    await afterResponse();

    expect(generationLog.records[0]?.error).toMatchObject({
      status: 529,
      type: "overloaded_error",
    });
  });

  it("answers the visitor's twenty-first text today with 429 and limited, before any call", async () => {
    const { deps, requests, afterResponse } = bench({ intakeLimit: 2 });

    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await answerIntakeRequest(post({ text: "Lisbon" }), deps)).status);
    }
    await afterResponse();

    expect(statuses).toEqual([200, 200, 429]);
    expect(requests).toHaveLength(2);
  });

  it("holds none of the app's cap for a visitor already past their limit", async () => {
    const { deps } = bench({ intakeLimit: 0 });
    const reserve = vi.spyOn(deps.appSpend, "reserve");

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), deps);

    expect(response.status).toBe(429);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("gives the visitor's read back when the cap has no room for it", async () => {
    const { deps } = bench({ intakeLimit: 1 });
    const full = new InMemoryAppSpend({ dailyUsd: 0, monthlyUsd: null });

    const refused = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      appSpend: full,
    });
    const next = await answerIntakeRequest(post({ text: "Lisbon" }), deps);

    expect([refused.status, next.status]).toEqual([429, 200]);
  });

  it("gives the read back, and charges the call it made, when after() cannot take it", async () => {
    const { deps, appSpend, lines } = bench({ intakeLimit: 1 });
    const noAfter: LiveIntakeDeps = {
      ...deps,
      schedule: () => {
        throw new Error("after() is not available here");
      },
    };

    const failed = await answerIntakeRequest(post({ text: "Lisbon" }), noAfter);
    const next = await answerIntakeRequest(post({ text: "Lisbon" }), deps);

    expect([failed.status, next.status]).toEqual([503, 200]);
    expect(lines.map(({ event }) => event)).toContain("live-intake-failed");
    // The call was made, so its cost stays counted: 1,800 tokens in and 150 out on Haiku.
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(0.000255 + 0.0009, 10);
  });

  it("answers unavailable, holding nothing, when the visitors' store fails", async () => {
    const { deps, requests, appSpend } = bench();
    const down = (): Promise<never> => Promise.reject(new Error("The store is down"));

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      visitorLimits: { take: down, giveBack: down },
    });

    expect(response.status).toBe(503);
    expect(requests).toHaveLength(0);
    expect(appSpend.spentOn(GOLDEN_NOW)).toBe(0);
  });

  it("records the call even when its hold will not settle", async () => {
    const { deps, generationLog, lines, afterResponse } = bench();
    const down = (): Promise<never> => Promise.reject(new Error("The store is down"));

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      appSpend: { reserve: deps.appSpend.reserve.bind(deps.appSpend), settle: down },
    });
    await afterResponse();

    expect(response.status).toBe(200);
    expect(generationLog.records.map(({ role }) => role)).toEqual(["intake"]);
    expect(lines.map(({ event }) => event)).toEqual(["spend-not-settled"]);
  });

  it("answers unavailable by the deadline, calling no model, when the stores do not answer", async () => {
    const { deps, requests } = bench();
    const never = (): Promise<never> => new Promise(() => undefined);

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      visitorLimits: { take: never, giveBack: never },
      preCallDeadlineMs: 20,
    });

    expect(response.status).toBe(503);
    expect(requests).toHaveLength(0);
  });

  it("answers limited before any call once the app's cap has no room", async () => {
    const { deps, requests } = bench({ caps: { dailyUsd: 0, monthlyUsd: null } });

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), deps);

    expect(response.status).toBe(429);
    expect(await answerOf(response)).toEqual({ kind: "limited" });
    expect(requests).toHaveLength(0);
  });

  it("refuses to call a model when the deploy left out the key or the salt", async () => {
    const { deps, requests, lines } = bench();

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      config: { kind: "misconfigured", missing: ["ANTHROPIC_API_KEY"] },
    });

    expect(response.status).toBe(503);
    expect(requests).toHaveLength(0);
    expect(lines.map(({ event }) => event)).toEqual(["live-generation-misconfigured"]);
  });

  it("logs the call with the visitor's text and the request it read, and never their address", async () => {
    const { deps, afterResponse, generationLog, appSpend } = bench();

    await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), deps);
    await afterResponse();

    const [record] = generationLog.records;
    expect(record).toMatchObject({
      role: "intake",
      model: "claude-haiku-5-5",
      promptVersion: INTAKE_PROMPT_VERSION,
      tokens: { input: 1_800, output: 150, thinking: null },
      outcome: "request",
      visitorText: "Lisbon",
      request: { city: "Lisbon" },
      outputText: JSON.stringify(LISBON_INTAKE),
      requestId: FIXTURE_REQUEST_ID,
      error: null,
    });
    // $0.10 and $0.50 per million tokens in and out.
    expect(record?.costUsd).toBeCloseTo(0.000255, 10);
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(0.000255, 10);
    expect(JSON.stringify(generationLog.records)).not.toContain(VISITOR_ADDRESS);
  });
});

describe("POST /api/intake's Server-Timing", () => {
  const SEARCH_DELAY_MS = 30;
  // Every description the header may carry: its own words and numbers, never the visitor's.
  const OWN_DESCRIPTIONS =
    /^(Neon: the visitor's count and the app's spend|Claude, the whole call|Geoapify: the cities the text names|The handler, until its answer's headers|The first request this route served here, [\d.]+ ms after its process began)$/;

  function timingsOf(response: Response): ServerTimingEntry[] {
    return parseServerTiming(response.headers.get("Server-Timing") ?? "");
  }

  function namesOf(response: Response): string[] {
    return timingsOf(response)
      .map(({ name }) => name)
      .filter((name) => name !== "cold");
  }

  it("times Neon, Claude and Geoapify in the order the handler waits on them, then the whole", async () => {
    const slowSearch: CitySearch = async (query) => {
      await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS));
      return searchWrittenPlaces(query);
    };
    const { deps } = bench({ search: slowSearch });

    const response = await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), deps);

    expect(namesOf(response)).toEqual(["limits", "model", "cities", "total"]);
    const ms = Object.fromEntries(timingsOf(response).map(({ name, dur }) => [name, dur ?? 0]));
    expect(ms.cities).toBeGreaterThanOrEqual(SEARCH_DELAY_MS - TIMER_SLACK_MS);
    expect(ms.total).toBeGreaterThanOrEqual((ms.limits ?? 0) + (ms.model ?? 0) + (ms.cities ?? 0));
  });

  it("times only Neon for a visitor past their limit, since no call was made", async () => {
    const { deps } = bench({ intakeLimit: 0 });

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), deps);

    expect(response.status).toBe(429);
    expect(namesOf(response)).toEqual(["limits", "total"]);
  });

  it("times only the handler for the written intake and for a body it cannot read", async () => {
    expect(namesOf(await answerIntakeRequest(post({ text: "Lisbon" })))).toEqual(["total"]);
    expect(namesOf(await answerIntakeRequest(post("not json"), bench().deps))).toEqual(["total"]);
  });

  it("carries durations and its own descriptions only, nothing of the visitor's", async () => {
    const { deps } = bench();

    const response = await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), deps);
    const header = response.headers.get("Server-Timing") ?? "";

    for (const { desc } of timingsOf(response)) expect(desc).toMatch(OWN_DESCRIPTIONS);
    expect(header).not.toContain(VISITOR_ADDRESS);
    expect(header).not.toContain("Lisbon");
  });

  it("in production, names no service behind it and says nothing of its process", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    try {
      const { deps } = bench();

      const response = await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), deps);
      const header = response.headers.get("Server-Timing") ?? "";

      expect(timingsOf(response).map(({ name }) => name)).toEqual([
        "limits",
        "model",
        "cities",
        "total",
      ]);
      for (const { dur, desc } of timingsOf(response)) {
        expect(dur).not.toBeNull();
        expect(desc).toBeNull();
      }
      expect(header).not.toMatch(/desc=|cold|Neon|Claude|Anthropic|Geoapify|Vercel|Postgres/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("POST /api/intake from a page on another site", () => {
  function postFrom(headers: Record<string, string>): Request {
    return new Request(ROUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "x-real-ip": VISITOR_ADDRESS, ...headers },
      body: JSON.stringify({ text: "Lisbon" }),
    });
  }

  it("refuses it with an empty 403, before any count, hold, call or record", async () => {
    const { deps, requests, generationLog, appSpend, afterResponse } = bench({ intakeLimit: 1 });

    const response = await answerIntakeRequest(postFrom({ "sec-fetch-site": "cross-site" }), deps);
    await afterResponse();

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("");
    expect(requests).toEqual([]);
    expect(generationLog.records).toEqual([]);
    expect(appSpend.spentOn(GOLDEN_NOW)).toBe(0);
    // The visitor's one read of the day is still theirs.
    const own = await answerIntakeRequest(postFrom({ "sec-fetch-site": "same-origin" }), deps);
    expect(own.status).toBe(200);
  });

  it("reads a phone's page over plain HTTP on the local network, which sends Origin alone", async () => {
    const { deps } = bench();

    const response = await answerIntakeRequest(
      postFrom({ host: "192.168.1.20:3000", origin: "http://192.168.1.20:3000" }),
      deps,
    );

    expect(response.status).toBe(200);
  });
});

describe("POST /api/intake while the database may be waking", () => {
  const SLOW_MS = 60;
  // 1,800 tokens in and 150 out on Haiku, the bench's answer; and the intake's whole hold.
  const CALL_USD = 0.000255;
  const HOLD_USD = 0.0009;

  function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  /** Claude, answering `ms` later unless the call is stopped first. */
  function slowClaude(ms: number) {
    const claude = fakeClaude(wrote(LISBON_INTAKE));
    const model = wrapLanguageModel({
      model: claude.provider("claude-haiku-5-5"),
      middleware: {
        wrapGenerate: async ({ doGenerate, params }) => {
          await sleep(ms, params.abortSignal);
          return doGenerate();
        },
      },
    });
    return { model, requests: claude.requests };
  }

  /** The visitors' store, answering `ms` later, as a database that wakes. */
  function slowLimits(limits: VisitorLimits, ms: number): VisitorLimits {
    return {
      take: async (...args) => {
        await sleep(ms);
        return limits.take(...args);
      },
      giveBack: (take) => limits.giveBack(take),
    };
  }

  function msOf(response: Response): Record<string, number> {
    const header = response.headers.get("Server-Timing") ?? "";
    return Object.fromEntries(parseServerTiming(header).map(({ name, dur }) => [name, dur ?? 0]));
  }

  it("reads the text beside the limits, so the answer waits for the longer of the two, not both", async () => {
    const { deps, generationLog, appSpend, afterResponse } = bench();
    const claude = slowClaude(SLOW_MS);

    const response = await answerIntakeRequest(post({ text: "Lisbon", today: TODAY }), {
      ...deps,
      model: claude.model,
      visitorLimits: slowLimits(deps.visitorLimits, SLOW_MS),
      earlyCalls: new EarlyCallGate(),
    });
    await afterResponse();

    expect(response.status).toBe(200);
    expect(((await response.json()) as IntakeRouteAnswer).kind).toBe("request");
    // Each step says its own time; the two overlap, so the whole is less than their sum.
    const ms = msOf(response);
    expect(ms.limits).toBeGreaterThanOrEqual(SLOW_MS - TIMER_SLACK_MS);
    expect(ms.model).toBeGreaterThanOrEqual(SLOW_MS - TIMER_SLACK_MS);
    expect(ms.total).toBeLessThan((ms.limits ?? 0) + (ms.model ?? 0));
    // Recorded and charged as any intake, under its hold.
    expect(generationLog.records.map(({ outcome }) => outcome)).toEqual(["request"]);
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(CALL_USD, 10);
  });

  it("lets only the first request of a quiet spell call early; the next waits for the limits", async () => {
    const { deps, requests } = bench();
    const sentBeforeLimits: number[] = [];
    const visitorLimits: VisitorLimits = {
      take: async (...args) => {
        await sleep(20);
        sentBeforeLimits.push(requests.length);
        return deps.visitorLimits.take(...args);
      },
      giveBack: (take) => deps.visitorLimits.giveBack(take),
    };
    const early = { ...deps, visitorLimits, earlyCalls: new EarlyCallGate() };

    await answerIntakeRequest(post({ text: "Lisbon" }), early);
    await answerIntakeRequest(post({ text: "Lisbon" }), early);

    // The first call reached Claude while its limits were answering; the second had not.
    expect(sentBeforeLimits).toEqual([1, 1]);
    expect(requests).toHaveLength(2);
  });

  it("stops the early read for a visitor past their limit, keeps no record, and charges its hold", async () => {
    const { deps, generationLog, appSpend, lines, afterResponse } = bench({ intakeLimit: 0 });
    const claude = slowClaude(SLOW_MS);

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      model: claude.model,
      earlyCalls: new EarlyCallGate(),
    });
    await afterResponse();
    await sleep(SLOW_MS * 2);

    expect(response.status).toBe(429);
    expect(await answerOf(response)).toEqual({ kind: "limited" });
    // Stopped before Claude answered, so it never reached the fake.
    expect(claude.requests).toHaveLength(0);
    expect(generationLog.records).toEqual([]);
    // No usage came back, so it is charged its whole hold, as an aborted call is.
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(HOLD_USD, 10);
    expect(lines.map(({ event }) => event)).toEqual([]);
  });

  it("charges an early read that finished before the limits refused it what it cost", async () => {
    const { deps, requests, generationLog, appSpend, afterResponse } = bench({ intakeLimit: 0 });

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      visitorLimits: slowLimits(deps.visitorLimits, SLOW_MS),
      earlyCalls: new EarlyCallGate(),
    });
    await afterResponse();

    expect(response.status).toBe(429);
    expect(requests).toHaveLength(1);
    expect(generationLog.records).toEqual([]);
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(CALL_USD, 10);
  });

  it("gives the visitor's read back and charges the early call, past the cap, when the cap has no room", async () => {
    const { deps, appSpend, afterResponse } = bench({
      intakeLimit: 1,
      caps: { dailyUsd: 0, monthlyUsd: null },
    });

    const refused = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      visitorLimits: slowLimits(deps.visitorLimits, SLOW_MS),
      earlyCalls: new EarlyCallGate(),
    });
    await afterResponse();
    const next = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      appSpend: new InMemoryAppSpend(),
    });

    expect([refused.status, next.status]).toEqual([429, 200]);
    // The cap held no hold for it, and still counts what it cost.
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(CALL_USD, 10);
  });

  it("stops and charges the early read when the visitors' store fails", async () => {
    const { deps, generationLog, appSpend, lines, afterResponse } = bench();
    const claude = slowClaude(SLOW_MS);
    const down = (): Promise<never> => Promise.reject(new Error("The store is down"));

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      model: claude.model,
      visitorLimits: { take: down, giveBack: down },
      earlyCalls: new EarlyCallGate(),
    });
    await afterResponse();

    expect(response.status).toBe(503);
    expect(claude.requests).toHaveLength(0);
    expect(generationLog.records).toEqual([]);
    expect(appSpend.spentOn(GOLDEN_NOW)).toBeCloseTo(HOLD_USD, 10);
    expect(lines.map(({ event }) => event)).toEqual(["live-intake-failed"]);
  });

  it("logs the charge it could not leave to after(), and still answers", async () => {
    const { deps, lines } = bench({ intakeLimit: 0 });

    const response = await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      schedule: () => {
        throw new Error("after() is not available here");
      },
      earlyCalls: new EarlyCallGate(),
    });

    expect(response.status).toBe(429);
    expect(lines.map(({ event }) => event)).toEqual(["spend-not-settled"]);
  });

  it("logs a charge the store refuses", async () => {
    const { deps, lines, afterResponse } = bench({ intakeLimit: 0 });
    const down = (): Promise<never> => Promise.reject(new Error("The store is down"));

    await answerIntakeRequest(post({ text: "Lisbon" }), {
      ...deps,
      appSpend: { reserve: deps.appSpend.reserve.bind(deps.appSpend), settle: down },
      earlyCalls: new EarlyCallGate(),
    });
    await afterResponse();

    expect(lines.map(({ event }) => event)).toEqual(["spend-not-settled"]);
  });
});
