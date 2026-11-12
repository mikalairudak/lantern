// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { searchWrittenPlaces } from "@/lib/fixtures/intake/places";
import { fakeClaude } from "@/lib/fixtures/live/mock-claude";
import { answerIntakeRequest, type LiveIntakeDeps } from "@/lib/intake/answer-intake-request";
import {
  CITY_SIGNATURE_HEADER,
  KEPT_DAY_HEADER,
  signedKeyOf,
  type IntakeRouteAnswer,
} from "@/lib/intake/signed-city";
import { InMemoryGenerationLog } from "@/lib/live/generation-log";
import { InMemoryAppSpend, InMemoryVisitorLimits } from "@/lib/live/limits";
import { liveDayOf, type LiveDayDeps } from "@/lib/live/live-day";
import type { GeneratedIntake } from "@/lib/schema/intake.schema";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { readDayStream } from "@/lib/stream/read-day-stream";
import { simulatedModel } from "@/lib/stream/simulate-day-stream";
import { DAY_ROUTE, routeSourceFor, type RouteOptions } from "./day-route";

const ORIGIN = "http://lantern.test";
const QUICK = { deltaChars: 64 };
const LIVE_UNSIGNED: RouteOptions = { isLive: true, signature: null };

afterEach(() => {
  vi.unstubAllGlobals();
});

function read(request: DayRequest, options?: RouteOptions) {
  const source = routeSourceFor(request, options);
  const signal = new AbortController().signal;
  return readDayStream({
    request: source.request,
    response: source.open(signal),
    onPartial: () => undefined,
    signal,
  });
}

describe("routeSourceFor", () => {
  it("posts the request as JSON, with the signal that stops it", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;

    await routeSourceFor(KANAZAWA_START_REQUEST).open(signal);

    expect(fetch).toHaveBeenCalledWith(
      DAY_ROUTE,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(KANAZAWA_START_REQUEST),
        signal,
      }),
    );
  });

  it("answers a request no day was written for as the route would, without calling it", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const outcome = await read({ ...KANAZAWA_START_REQUEST, city: "Osaka" });
    // A day written by hand is a fixture: with live generation off its city is any city's.
    const kyoto = await read(KYOTO_REQUEST);

    expect(fetch).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: "unavailable" });
    expect(kyoto).toEqual({ kind: "unavailable" });
  });

  it("sends a request the route reads, and its written day arrives complete", async () => {
    vi.stubGlobal("fetch", (path: string, init: RequestInit) =>
      answerDayRequest(new Request(new URL(path, ORIGIN), init), QUICK),
    );

    expect((await read(KANAZAWA_START_REQUEST)).kind).toBe("complete");
  });

  it("with live generation on, posts every request, and a city's signature in its header", async () => {
    const fetch = vi.fn((_path: string, _init: RequestInit) => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetch);
    const marseille = { ...KANAZAWA_START_REQUEST, city: "Marseille", timezone: "Europe/Paris" };
    const signal = new AbortController().signal;

    await routeSourceFor(marseille, LIVE_UNSIGNED).open(signal);
    await routeSourceFor(marseille, { isLive: true, signature: "signed" }).open(signal);

    const [unsigned, signed] = fetch.mock.calls.map(([, init]) => new Headers(init.headers));
    expect(unsigned?.has(CITY_SIGNATURE_HEADER)).toBe(false);
    expect(signed?.get(CITY_SIGNATURE_HEADER)).toBe("signed");
  });

  it("names the kept day a request was asked from, by its id, and no day otherwise", async () => {
    const fetch = vi.fn((_path: string, _init: RequestInit) => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetch);
    const marseille = { ...KANAZAWA_START_REQUEST, city: "Marseille", timezone: "Europe/Paris" };
    const id = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
    const signal = new AbortController().signal;

    await routeSourceFor(marseille, { ...LIVE_UNSIGNED, keptId: id }).open(signal);
    await routeSourceFor(marseille, LIVE_UNSIGNED).open(signal);

    const [kept, other] = fetch.mock.calls.map(([, init]) => new Headers(init.headers));
    expect(kept?.get(KEPT_DAY_HEADER)).toBe(id);
    expect(other?.has(KEPT_DAY_HEADER)).toBe(false);
  });
});

describe("a day for a city Lantern has not written, from the intake to the day route", () => {
  const SEVILLE_INTAKE: GeneratedIntake = {
    city: "Seville",
    cityReadings: [],
    energy: "calm",
    energyGuess: null,
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: null,
    date: null,
    unplaced: [],
  };

  /** What both live routes run on, sharing nothing but the salt. */
  function common() {
    const generationLog = new InMemoryGenerationLog();
    return {
      config: { kind: "ready", config: { visitorHashSalt: "test-salt" } } as const,
      visitorLimits: new InMemoryVisitorLimits({ day: 10, intake: 20 }),
      appSpend: new InMemoryAppSpend({ dailyUsd: 10, monthlyUsd: null }),
      generationLog,
      dayArchive: generationLog,
      schedule: () => undefined,
      log: () => undefined,
      now: () => new Date("2026-11-19T10:00:00Z"),
      newId: () => crypto.randomUUID(),
      maxRetries: 0,
    };
  }

  async function readSeville(): Promise<IntakeRouteAnswer & { kind: "request" }> {
    const model = fakeClaude({
      kind: "message",
      text: JSON.stringify(SEVILLE_INTAKE),
      usage: { input: 1_800, output: 150 },
    }).provider("claude-haiku-5-5");
    const deps: LiveIntakeDeps = { ...common(), model, search: searchWrittenPlaces };
    const response = await answerIntakeRequest(
      new Request(new URL("/api/intake", ORIGIN), {
        method: "POST",
        body: JSON.stringify({ text: "Seville, a calm day" }),
      }),
      deps,
    );
    const answer = (await response.json()) as IntakeRouteAnswer;
    if (answer.kind !== "request") throw new Error(`Expected a request, got ${answer.kind}`);
    return answer;
  }

  function serveLiveDays(): void {
    const model = () =>
      simulatedModel({ day: KYOTO_DAY.day, ending: { kind: "finished" }, pace: QUICK });
    const deps: LiveDayDeps = { ...common(), models: { day: model(), shadow: model() } };
    vi.stubGlobal("fetch", (path: string, init: RequestInit) =>
      answerDayRequest(new Request(new URL(path, ORIGIN), init), QUICK, liveDayOf(deps)),
    );
  }

  it("writes the day the intake read under its signature, with a word changed since", async () => {
    const answer = await readSeville();
    serveLiveDays();
    const signature =
      answer.signed?.find((city) => signedKeyOf(city) === signedKeyOf(answer.request))?.signature ??
      null;

    const outcome = await read(
      { ...answer.request, energy: "lively" },
      { isLive: true, signature },
    );

    expect(signature).not.toBeNull();
    expect(outcome.kind).toBe("complete");
  });

  it("answers the same city, unsigned, as unavailable", async () => {
    const answer = await readSeville();
    serveLiveDays();

    expect(await read(answer.request, LIVE_UNSIGNED)).toEqual({ kind: "unavailable" });
  });
});
