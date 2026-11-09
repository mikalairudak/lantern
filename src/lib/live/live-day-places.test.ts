// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { ALICANTE_ESCAPED_DAY } from "@/lib/fixtures/live/escaped-days";
import { fakeClaude } from "@/lib/fixtures/live/mock-claude";
import type { PlaceCheck as VerifierResult, PlaceVerifier } from "@/lib/places/verify-place";
import { isAreaKind, type DayRequest, type Itinerary } from "@/lib/schema/itinerary.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { PLACE_CHECK_PART, PlaceCheckSchema, type PlaceCheck } from "@/lib/stream/place-checks";
import { readDayStream } from "@/lib/stream/read-day-stream";
import { simulatedModel, type StreamPace } from "@/lib/stream/simulate-day-stream";
import { CITY_SIGNATURE_HEADER } from "@/lib/intake/signed-city";
import { citySignatureKey, signCity } from "./city-signature";
import { InMemoryGenerationLog } from "./generation-log";
import { InMemoryAppSpend, InMemoryVisitorLimits } from "./limits";
import { liveDayOf, type LiveDayDeps } from "./live-day";
import type { StreamingModel } from "./streamed-call";

// A written day's city with a word changed: no written day matches it, so with the flag on
// Claude writes it, and its city needs no signature.
const LIVELY_KANAZAWA: DayRequest = { ...KANAZAWA_START_REQUEST, energy: "lively" };
const QUICK: Partial<StreamPace> = { deltaChars: 64 };
const NOW = new Date("2026-11-19T10:00:00Z");
const SHORT_DEADLINE_MS = 40;

function post(signal?: AbortSignal, request: DayRequest = LIVELY_KANAZAWA): Request {
  return new Request("http://lantern.test/api/day", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "203.0.113.7" },
    body: JSON.stringify(request),
    signal,
  });
}

/** A post for a city with no written day, as the intake signs it, with the bench's salt. */
async function signed(request: DayRequest): Promise<Request> {
  const { signature } = await signCity(await citySignatureKey("test-salt"), request);
  const signedPost = post(undefined, request);
  signedPost.headers.set(CITY_SIGNATURE_HEADER, signature);
  return signedPost;
}

/** A verifier that answers each place by `answer`, keeping every place it was asked and how. */
function fakeVerifier(answer: (name: string, signal?: AbortSignal) => Promise<VerifierResult>) {
  const asked: { name: string; signal?: AbortSignal }[] = [];
  const verifier: PlaceVerifier = {
    verify(place, _city, signal) {
      asked.push({ name: place.name, signal });
      return answer(place.name, signal);
    },
  };
  return { verifier, asked };
}

const CONFIRMED: VerifierResult = {
  kind: "verified",
  by: "name",
  lat: 35.0268,
  lng: 135.7954,
  providerId: "p1",
  source: "geoapify",
};

function bench(
  placeVerifier: PlaceVerifier,
  placeCheckDeadlineMs?: number,
  dayModel?: StreamingModel,
) {
  const generationLog = new InMemoryGenerationLog();
  const scheduled: (() => Promise<void>)[] = [];
  const day =
    dayModel ??
    simulatedModel({ day: KANAZAWA_START_DAY.day, ending: { kind: "finished" }, pace: QUICK });
  const shadow = simulatedModel({
    day: KANAZAWA_START_DAY.day,
    ending: { kind: "finished" },
    pace: QUICK,
  });
  const deps: LiveDayDeps = {
    config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
    models: { day, shadow },
    visitorLimits: new InMemoryVisitorLimits({ day: 10, intake: 20 }),
    appSpend: new InMemoryAppSpend({ dailyUsd: 10, monthlyUsd: null }),
    generationLog,
    dayArchive: generationLog,
    schedule: (task) => {
      scheduled.push(task);
    },
    log: () => undefined,
    now: () => NOW,
    newId: () => crypto.randomUUID(),
    maxRetries: 0,
    placeVerifier,
    placeCheckDeadlineMs,
  };
  return {
    deps,
    generationLog,
    afterResponse: async () => {
      await Promise.all(scheduled.splice(0).map((task) => task()));
    },
  };
}

/** The place checks in a stream's text, in the order they were sent. */
function checksIn(text: string): PlaceCheck[] {
  return text.split("\n").flatMap((line) => {
    // The stream's last line, "data: [DONE]", is no JSON.
    if (!line.startsWith("data: {")) return [];
    const chunk = JSON.parse(line.slice("data: ".length)) as { type?: string; data?: unknown };
    return chunk.type === PLACE_CHECK_PART ? [PlaceCheckSchema.parse(chunk.data)] : [];
  });
}

async function itineraryOf(text: string): Promise<Itinerary> {
  const outcome = await readDayStream({
    request: LIVELY_KANAZAWA,
    response: Promise.resolve(new Response(text)),
    onPartial: () => undefined,
  });
  if (outcome.kind !== "complete") throw new Error(`The day ended ${outcome.kind}`);
  return outcome.itinerary;
}

function placeIdsOf(itinerary: Itinerary): string[] {
  return itinerary.stops.flatMap((stop) =>
    [stop.primary, ...stop.alternatives].map(({ id }) => id),
  );
}

describe("the live day's place checks", () => {
  it("checks every place the visitor can see as it streams, keyed by the id the itinerary gives it", async () => {
    const { verifier } = fakeVerifier(() => Promise.resolve(CONFIRMED));
    const { deps } = bench(verifier);

    const text = await (await answerDayRequest(post(), QUICK, liveDayOf(deps))).text();
    const checks = checksIn(text);

    for (const id of placeIdsOf(await itineraryOf(text))) {
      const states = checks.filter((check) => check.placeId === id).map(({ state }) => state);
      expect(states, id).toEqual(["checking", "confirmed"]);
    }
  });

  it("never checks the shadow, which no one sees", async () => {
    const { verifier, asked } = fakeVerifier(() => Promise.resolve(CONFIRMED));
    const { deps } = bench(verifier);

    const text = await (await answerDayRequest(post(), QUICK, liveDayOf(deps))).text();

    expect(asked).toHaveLength(new Set(checksIn(text).map(({ placeId }) => placeId)).size);
  });

  it("closes at the deadline when a lookup never answers, that place unchecked and its lookup stopped", async () => {
    const stuck = KANAZAWA_START_DAY.day.stops[0]?.place.name;
    const { verifier, asked } = fakeVerifier((name) =>
      name === stuck ? new Promise(() => undefined) : Promise.resolve(CONFIRMED),
    );
    const { deps } = bench(verifier, SHORT_DEADLINE_MS);

    const text = await (await answerDayRequest(post(), QUICK, liveDayOf(deps))).text();

    expect(
      checksIn(text)
        .filter(({ placeId }) => placeId === "stop-0:p")
        .at(-1)?.state,
    ).toBe("unchecked");
    expect((await itineraryOf(text)).stops.length).toBe(KANAZAWA_START_DAY.day.stops.length);
    expect(asked.find(({ name }) => name === stuck)?.signal?.aborted).toBe(true);
  });

  it("ends a failed lookup unchecked and an answer the rule could not confirm unconfirmed", async () => {
    const { verifier } = fakeVerifier((name) =>
      Promise.resolve<VerifierResult>(
        name === KANAZAWA_START_DAY.day.stops[0]?.place.name
          ? { kind: "unverified", reason: "quota" }
          : { kind: "unverified", reason: "no-match" },
      ),
    );
    const { deps } = bench(verifier);

    const checks = checksIn(await (await answerDayRequest(post(), QUICK, liveDayOf(deps))).text());
    const last = (id: string): string | undefined =>
      checks.filter(({ placeId }) => placeId === id).at(-1)?.state;

    expect(last("stop-0:p")).toBe("unchecked");
    expect(last("stop-1:p")).toBe("unconfirmed");
  });

  it("checks on when the visitor leaves, so the day kept in the log has its places' marks", async () => {
    const leaving = new AbortController();
    const { verifier, asked } = fakeVerifier(
      () => new Promise((resolve) => setTimeout(() => resolve(CONFIRMED), 20)),
    );
    const { deps, generationLog, afterResponse } = bench(verifier);

    const response = await answerDayRequest(post(leaving.signal), QUICK, liveDayOf(deps));
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    while (asked.length === 0) await reader.read();
    leaving.abort();
    void reader.cancel().catch(() => undefined);
    await afterResponse();

    const day = generationLog.records.find((record) => record.role === "day");
    const confirmed = day?.checks?.find(({ id }) => id === "places-confirmed");
    // Every lookup ran to its answer, none stopped by the visitor leaving.
    expect(confirmed?.value).toBe(1);
  });

  it("keeps each place's last check in the day's record, the provider's point with it", async () => {
    const { verifier } = fakeVerifier(() => Promise.resolve(CONFIRMED));
    const { deps, generationLog, afterResponse } = bench(verifier);

    await (await answerDayRequest(post(), QUICK, liveDayOf(deps))).text();
    await afterResponse();

    const day = generationLog.records.find((record) => record.role === "day");
    const shadow = generationLog.records.find((record) => record.role === "shadow");
    expect(day?.placeChecks?.["stop-0:p"]).toEqual({
      placeId: "stop-0:p",
      state: "confirmed",
      by: "name",
      coordinates: { lat: CONFIRMED.lat, lng: CONFIRMED.lng },
    });
    expect(shadow?.placeChecks).toBeNull();
  });

  it("keeps the checks in the day's record: the share confirmed, the provider's shift and the close's wait", async () => {
    const { verifier } = fakeVerifier((name) =>
      Promise.resolve<VerifierResult>(
        name === KANAZAWA_START_DAY.day.stops[0]?.place.name
          ? { kind: "unverified", reason: "no-match" }
          : CONFIRMED,
      ),
    );
    const { deps, generationLog, afterResponse } = bench(verifier);

    await (await answerDayRequest(post(), QUICK, liveDayOf(deps))).text();
    await afterResponse();

    const day = generationLog.records.find((record) => record.role === "day");
    const shadow = generationLog.records.find((record) => record.role === "shadow");
    const ids = (day?.checks ?? []).map(({ id }) => id);
    expect(ids).toEqual(
      expect.arrayContaining(["places-confirmed", "provider-shift", "places-wait"]),
    );
    const confirmed = day?.checks?.find(({ id }) => id === "places-confirmed");
    expect(confirmed?.findings).toContainEqual(
      expect.stringMatching(/^stop-0:p ".+" unconfirmed, no-match$/),
    );
    expect((shadow?.checks ?? []).map(({ id }) => id)).not.toContain("places-confirmed");
  });
});

describe("reading the place checks", () => {
  /** Confirms a named place by name and a meal by its area, as the route's verifier does. */
  function byKind() {
    const verifier: PlaceVerifier = {
      verify: (place) =>
        Promise.resolve<VerifierResult>(
          isAreaKind(place.kind)
            ? {
                kind: "verified",
                by: "area",
                ...place.coordinates,
                placesAround: 9,
                source: "geoapify",
              }
            : CONFIRMED,
        ),
    };
    return verifier;
  }

  it("hands each check to the page by id, and puts a place confirmed by name at the provider's point", async () => {
    const { deps } = bench(byKind());
    const seen: PlaceCheck[] = [];

    const outcome = await readDayStream({
      request: LIVELY_KANAZAWA,
      response: answerDayRequest(post(), QUICK, liveDayOf(deps)),
      onPartial: () => undefined,
      onPlaceCheck: (check) => seen.push(check),
    });
    if (outcome.kind !== "complete") throw new Error(`The day ended ${outcome.kind}`);

    const written = new Map(
      KANAZAWA_START_DAY.day.stops.map((stop, index) => [
        `stop-${index}:p`,
        stop.place.coordinates,
      ]),
    );
    for (const stop of outcome.itinerary.stops) {
      const { id, kind, coordinates } = stop.primary;
      expect(seen.filter((check) => check.placeId === id).map(({ state }) => state)).toEqual([
        "checking",
        "confirmed",
      ]);
      // A meal is the middle of its street, so it keeps the model's point.
      expect(coordinates).toEqual(
        isAreaKind(kind) ? written.get(id) : { lat: CONFIRMED.lat, lng: CONFIRMED.lng },
      );
    }
  });

  it("skips a check it cannot read and still reads the day", async () => {
    const { deps } = bench(byKind());
    const text = await (await answerDayRequest(post(), QUICK, liveDayOf(deps))).text();
    const malformed = `data: ${JSON.stringify({ type: PLACE_CHECK_PART, data: { placeId: 1 } })}\n\n`;
    const seen: PlaceCheck[] = [];

    const outcome = await readDayStream({
      request: LIVELY_KANAZAWA,
      response: Promise.resolve(new Response(malformed + text)),
      onPartial: () => undefined,
      onPlaceCheck: (check) => seen.push(check),
    });

    expect(outcome.kind).toBe("complete");
    expect(seen.every(({ placeId }) => typeof placeId === "string")).toBe(true);
  });
});

// Through the real provider, as production writes a day: Sonnet's own recorded text.
describe("the place checks on a day Sonnet wrote", () => {
  const { request, outputText } = ALICANTE_ESCAPED_DAY;
  const sonnet = (cut = false): StreamingModel =>
    fakeClaude({ kind: "message", text: outputText, isCutByError: cut }).provider(
      "claude-sonnet-5-5",
    );

  it("asks for each name as the visitor reads it, a letter Sonnet escaped twice unescaped", async () => {
    const { verifier, asked } = fakeVerifier(() => Promise.resolve(CONFIRMED));
    const { deps } = bench(verifier, undefined, sonnet());

    await (await answerDayRequest(await signed(request), QUICK, liveDayOf(deps))).text();

    const names = asked.map(({ name }) => name);
    expect(names).toContain("Castillo de Santa Bárbara");
    expect(names.some((name) => name.includes(String.fromCharCode(92)))).toBe(false);
  });

  it("still settles every check and closes when the model's stream is cut by an error", async () => {
    const { verifier, asked } = fakeVerifier(() => Promise.resolve(CONFIRMED));
    const { deps } = bench(verifier, SHORT_DEADLINE_MS, sonnet(true));

    const text = await (
      await answerDayRequest(await signed(request), QUICK, liveDayOf(deps))
    ).text();
    const outcome = await readDayStream({
      request,
      response: Promise.resolve(new Response(text)),
      onPartial: () => undefined,
    });

    expect(outcome.kind).toBe("cut");
    const ended = checksIn(text).filter(({ state }) => state !== "checking");
    expect(new Set(ended.map(({ placeId }) => placeId)).size).toBe(asked.length);
  });
});
