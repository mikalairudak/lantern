// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { BOLOGNA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { WRITTEN_DAY_PACE } from "@/lib/stream/answer-day-request";
import type { DayOutcome } from "@/lib/stream/outcome";
import { readDayStream } from "@/lib/stream/read-day-stream";
import { simulateDayStream, type StreamPace } from "@/lib/stream/simulate-day-stream";
import { PACES } from "../../stream/frames";
import { BENCH_ENDINGS, BENCH_PACE, benchSourceFor, type BenchEnding } from "./endings";

// Large deltas keep the suite fast: thirty streams, each read whole.
const QUICK: Partial<StreamPace> = { deltaChars: 64 };

afterEach(() => {
  vi.unstubAllGlobals();
});

function endingKeyed(key: string): BenchEnding {
  const ending = BENCH_ENDINGS.find((each) => each.key === key);
  if (!ending) throw new Error(`No ending "${key}"`);
  return ending;
}

describe.each(CURATED_DAYS)("the bench's day in $request.city", (curated) => {
  it.each(BENCH_ENDINGS)("$label ends $outcome", async (ending) => {
    const { day, ending: streamEnding } = ending.streamOf(curated.day);
    const outcome: DayOutcome = await readDayStream({
      request: curated.request,
      response: simulateDayStream({ day, ending: streamEnding, pace: QUICK }),
      onPartial: () => undefined,
    });

    expect(outcome.kind).toBe(ending.outcome);
    const kept = "itinerary" in outcome ? outcome.itinerary : null;
    if (ending.isSalvaged) {
      // Every stop arrived whole; only swaps after the cut are lost.
      expect(kept?.stops).toHaveLength(curated.day.stops.length);
      const swaps = kept?.stops.reduce((sum, stop) => sum + stop.alternatives.length, 0) ?? 0;
      const planned = curated.day.alternatives.reduce((sum, set) => sum + set.options.length, 0);
      expect(swaps).toBeGreaterThan(0);
      expect(swaps).toBeLessThan(planned);
    } else if (ending.outcome !== "complete") {
      expect(kept).toBeNull();
    }
  });
});

describe("the bench's source", () => {
  it("ends the first request's play as chosen, without the route", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const sourceFor = benchSourceFor(KYOTO_DAY, endingKeyed("limited"), QUICK);
    const source = sourceFor(KYOTO_DAY.request);

    const outcome = await readDayStream({
      request: source.request,
      response: source.open(new AbortController().signal),
      onPartial: () => undefined,
    });

    expect(outcome).toEqual({ kind: "limited" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("plays a copy of the request, as a replay or a retry plays it, whole from its file", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const sourceFor = benchSourceFor(KYOTO_DAY, endingKeyed("limited"), QUICK);
    const source = sourceFor({ ...KYOTO_DAY.request });

    const outcome = await readDayStream({
      request: source.request,
      response: source.open(new AbortController().signal),
      onPartial: () => undefined,
    });

    // The route holds no day written by hand.
    expect(outcome.kind).toBe("complete");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a written day's replay to the route, as on its own address", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetch);
    const sourceFor = benchSourceFor(KANAZAWA_START_DAY, endingKeyed("limited"), QUICK);

    await sourceFor({ ...KANAZAWA_START_DAY.request }).open(new AbortController().signal);

    expect(fetch).toHaveBeenCalledWith(DAY_ROUTE, expect.objectContaining({ method: "POST" }));
  });

  it("sends any other day to the route, as one picked from the city word", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetch);
    const sourceFor = benchSourceFor(KYOTO_DAY, endingKeyed("limited"), QUICK);

    await sourceFor({ ...BOLOGNA_START_REQUEST }).open(new AbortController().signal);

    expect(fetch).toHaveBeenCalledWith(DAY_ROUTE, expect.objectContaining({ method: "POST" }));
  });

  it("plays at the landing's pace unless another is chosen", () => {
    expect(PACES[BENCH_PACE]).toBe(WRITTEN_DAY_PACE);
  });
});

describe("the bench's endings", () => {
  it("have keys of their own, for the select and the day's remount", () => {
    const keys = BENCH_ENDINGS.map((ending) => ending.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
