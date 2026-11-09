// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  KYOTO_ITINERARY,
  KYOTO_MORNING_BASIS,
  KYOTO_SLOW_MORNING,
  KYOTO_SLOW_MORNING_WITH_VERSIONS,
} from "@/lib/fixtures/replan/kyoto-morning";
import { mergeReplan } from "@/lib/replan/merge";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import type { DayOutcome } from "./outcome";
import type { PlaceCheck } from "./place-checks";
import { PLACE_CHECK_PART } from "./place-checks";
import { readReplanStream, type PartialReplan } from "./read-replan-stream";

const TEXT = JSON.stringify(KYOTO_SLOW_MORNING);
const DELTA_CHARS = 200;

function deltasOf(text: string): object[] {
  const deltas: object[] = [];
  for (let start = 0; start < text.length; start += DELTA_CHARS) {
    deltas.push({ type: "text-delta", id: "t", delta: text.slice(start, start + DELTA_CHARS) });
  }
  return deltas;
}

function eventResponse(events: readonly object[], status = 200): Promise<Response> {
  const lines = [...events.map((event) => JSON.stringify(event)), "[DONE]"];
  const body = lines.map((line) => `data: ${line}\n\n`).join("");
  return Promise.resolve(new Response(body, { status }));
}

interface Read {
  outcome: DayOutcome;
  partials: PartialReplan[];
  checks: PlaceCheck[];
}

async function read(response: Promise<Response>): Promise<Read> {
  const partials: PartialReplan[] = [];
  const checks: PlaceCheck[] = [];
  const outcome = await readReplanStream({
    basis: KYOTO_MORNING_BASIS,
    response,
    onPartial: (partial) => partials.push(partial),
    onPlaceCheck: (check) => checks.push(check),
  });
  return { outcome, partials, checks };
}

const FINISHED = { type: "finish", finishReason: "stop" };

function merged(replan: GeneratedReplan = KYOTO_SLOW_MORNING) {
  const result = mergeReplan({ ...KYOTO_MORNING_BASIS, replan });
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary;
}

describe("readReplanStream", () => {
  it("merges the finished re-plan into the day on screen, the partials streamed on the way", async () => {
    const { outcome, partials } = await read(eventResponse([...deltasOf(TEXT), FINISHED]));

    expect(outcome).toEqual({ kind: "complete", itinerary: merged() });
    expect(partials.length).toBeGreaterThan(1);
    expect(partials.at(-1)).toEqual(KYOTO_SLOW_MORNING);
  });

  it("hands each new place's check on under the round's prefix, and moves a place it confirmed by name", async () => {
    const point = { lat: 35.0062, lng: 135.7835 };
    const check = { placeId: "stop-0:p", state: "confirmed", by: "name", coordinates: point };
    const { outcome, checks } = await read(
      eventResponse([
        ...deltasOf(TEXT),
        { type: PLACE_CHECK_PART, id: "stop-0:p", data: check },
        FINISHED,
      ]),
    );
    if (outcome.kind !== "complete") throw new Error(outcome.kind);

    expect(checks).toEqual([{ ...check, placeId: "r1-stop-0:p" }]);
    expect(outcome.itinerary.stops[0]?.primary.coordinates).toEqual(point);
    for (const [index, stop] of outcome.itinerary.stops.slice(2).entries()) {
      expect(stop).toBe(KYOTO_ITINERARY.stops[index + 2]);
    }
  });

  it("keeps nothing of a stream cut or lost before its end: a re-plan is all or nothing", async () => {
    const half = deltasOf(TEXT.slice(0, Math.floor(TEXT.length * 0.9)));

    expect(
      (await read(eventResponse([...half, { type: "finish", finishReason: "length" }]))).outcome,
    ).toEqual({ kind: "cut", itinerary: null });
    expect((await read(eventResponse(deltasOf(TEXT)))).outcome).toEqual({
      kind: "cut",
      itinerary: null,
    });
    expect((await read(Promise.reject(new TypeError("Failed to fetch")))).outcome).toEqual({
      kind: "disconnected",
      itinerary: null,
    });
  });

  it("is invalid when the re-plan breaks its schema or the merge refuses it, and the day stays", async () => {
    const shapeless = await read(eventResponse([...deltasOf('{"stops":[]}'), FINISHED]));
    expect(shapeless.outcome).toMatchObject({ kind: "invalid", isEmpty: false });

    const afternoonOnly: GeneratedReplan = {
      ...KYOTO_SLOW_MORNING,
      stops: KYOTO_SLOW_MORNING.stops.map((stop) => ({ ...stop, startTime: "15:00" })),
    };
    const outside = await read(
      eventResponse([...deltasOf(JSON.stringify(afternoonOnly)), FINISHED]),
    );
    expect(outside.outcome).toEqual({
      kind: "invalid",
      reason: "the re-plan left window 1 without a stop",
      isEmpty: false,
    });
  });

  // Its line about the day may name the stop, and its hour stands empty: Elche, 17:30 to 21:00.
  it("is invalid when the merge would drop a new stop, though every window has one, and the day stays", async () => {
    const lateShrine: GeneratedReplan = {
      ...KYOTO_SLOW_MORNING,
      stops: KYOTO_SLOW_MORNING.stops.map((stop, index) =>
        index === 1 ? { ...stop, startTime: "15:00" } : stop,
      ),
    };

    const { outcome } = await read(
      eventResponse([...deltasOf(JSON.stringify(lateShrine)), FINISHED]),
    );

    expect(outcome).toEqual({
      kind: "invalid",
      reason: "the re-plan dropped stops[1]: starts at 15:00",
      isEmpty: false,
    });
  });

  it("merges a re-plan whose new stop lost an option past the walk: only a new stop's drop is invalid", async () => {
    const text = JSON.stringify(KYOTO_SLOW_MORNING_WITH_VERSIONS);

    const { outcome } = await read(eventResponse([...deltasOf(text), FINISHED]));

    expect(outcome).toEqual({
      kind: "complete",
      itinerary: merged(KYOTO_SLOW_MORNING_WITH_VERSIONS),
    });
    if (outcome.kind !== "complete") throw new Error(outcome.kind);
    expect(outcome.itinerary.stops[0]?.alternatives.map(({ name }) => name)).toEqual(["Chion-in"]);
  });

  it("reads a refusal, the limits and a server that answered nothing as a day's stream does", async () => {
    const refused = [...deltasOf(TEXT), { type: "finish", finishReason: "content-filter" }];
    expect((await read(eventResponse(refused))).outcome).toEqual({ kind: "refused" });
    expect((await read(eventResponse([], 429))).outcome).toEqual({ kind: "limited" });
    expect((await read(eventResponse([], 500))).outcome).toEqual({ kind: "unavailable" });
  });
});
