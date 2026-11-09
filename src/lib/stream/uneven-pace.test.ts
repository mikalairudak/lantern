// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { EDGE_DAYS, REFUSED_DAY } from "@/lib/fixtures/edge/edge-days";
import { inSchemaOrder } from "@/lib/schema/in-schema-order";
import {
  GeneratedStopSchema,
  type DayRequest,
  type GeneratedDay,
} from "@/lib/schema/itinerary.schema";
import type { DayOutcome, PartialDay } from "./outcome";
import { readDayStream } from "./read-day-stream";
import { dayText, dayTextOffsets, simulateDayStream } from "./simulate-day-stream";
import { UNEVEN_PACE, unevenBursts, type Burst, type UnevenPace } from "./uneven-pace";

// The waiting line shows after this much quiet and takes about 0.8 s more to read
// (`docs/decisions.md`, "Designing for Dynamic UI"), so a quiet that shows it has to last at
// least the second.
const WAITING_SILENCE_MS = 400;
const READABLE_PAUSE_MS = 1200;

const LIVE: UnevenPace = { kind: "uneven" };
const LANDING: UnevenPace = { kind: "uneven", speed: 8 };
const ALL_DAYS = [...CURATED_DAYS, ...EDGE_DAYS, REFUSED_DAY];

function startsOf(bursts: readonly Burst[]): number[] {
  let start = 0;
  return bursts.map(({ delta }) => {
    const at = start;
    start += delta.length;
    return at;
  });
}

function burstsOf(day: GeneratedDay, pace: UnevenPace = LIVE): Burst[] {
  return unevenBursts(dayText(day), dayTextOffsets(day), pace);
}

describe("dayTextOffsets", () => {
  it.each(ALL_DAYS.map(({ day }) => [day.dek.slice(0, 40), day]))(
    "finds where the middle stop and the options start: %s",
    (_, day) => {
      const text = dayText(day);
      const { midPlan, options } = dayTextOffsets(day);
      const middle = day.stops[Math.floor(day.stops.length / 2)];

      if (middle === undefined) expect(midPlan).toBeNull();
      else {
        const middleText = JSON.stringify(inSchemaOrder(GeneratedStopSchema, middle));
        expect(text.startsWith(middleText, midPlan ?? -1)).toBe(true);
      }
      if (day.alternatives.length === 0) expect(options).toBeNull();
      else expect(text.startsWith('"alternatives":[{', options ?? -1)).toBe(true);
    },
  );
});

describe("unevenBursts", () => {
  it.each([LIVE, LANDING])("sends every character once, in order, at %o", (pace) => {
    for (const { day } of ALL_DAYS) {
      const bursts = burstsOf(day, pace);
      expect(bursts.map(({ delta }) => delta).join("")).toBe(dayText(day));
      bursts.forEach(({ delta }) => expect(delta).not.toBe(""));
    }
  });

  it("gives the same bursts for the same seed and others for another", () => {
    const { day } = KYOTO_DAY;
    expect(burstsOf(day)).toEqual(burstsOf(day));
    expect(burstsOf(day, { kind: "uneven", seed: UNEVEN_PACE.seed + 1 })).not.toEqual(
      burstsOf(day),
    );
  });

  it.each([LIVE, LANDING])(
    "goes quiet only for the first words, the middle stop and the options, at %o",
    (pace) => {
      for (const { day } of CURATED_DAYS) {
        const bursts = burstsOf(day, pace);
        const starts = startsOf(bursts);
        const { midPlan, options } = dayTextOffsets(day);
        const silences = bursts.flatMap(({ delayMs }, index) =>
          delayMs >= WAITING_SILENCE_MS ? [{ delayMs, start: starts[index] }] : [],
        );

        expect(silences.map(({ start }) => start)).toEqual([0, midPlan, options]);
        expect(silences[0]?.delayMs).toBe(UNEVEN_PACE.firstTokenMs);
        silences.forEach(({ delayMs }) =>
          expect(delayMs).toBeGreaterThanOrEqual(READABLE_PAUSE_MS),
        );
      }
    },
  );

  it("paces a cut text only up to where it stops", () => {
    const { day } = KYOTO_DAY;
    const { midPlan, options } = dayTextOffsets(day);
    const sent = dayText(day).slice(0, options ?? 0);
    const bursts = unevenBursts(sent, dayTextOffsets(day), LIVE);

    expect(bursts.map(({ delta }) => delta).join("")).toBe(sent);
    expect(
      startsOf(bursts).filter((_, index) => (bursts[index]?.delayMs ?? 0) >= WAITING_SILENCE_MS),
    ).toEqual([0, midPlan]);
  });

  it("does not stack the two pauses on a day without stops", () => {
    const day: GeneratedDay = { ...KYOTO_DAY.day, stops: [] };
    const silences = burstsOf(day)
      .map(({ delayMs }) => delayMs)
      .filter((delayMs) => delayMs >= WAITING_SILENCE_MS);

    expect(dayTextOffsets(day).midPlan).toBeNull();
    expect(silences).toHaveLength(2);
    expect(silences[1]).toBeLessThan(UNEVEN_PACE.pauseBeforeOptionsMs + UNEVEN_PACE.gapMaxMs);
  });

  it("refuses a speed that is not above zero before anything streams", () => {
    const zero: UnevenPace = { kind: "uneven", speed: 0 };
    expect(() =>
      simulateDayStream({ day: KYOTO_DAY.day, ending: { kind: "finished" }, pace: zero }),
    ).toThrow(RangeError);
  });
});

describe("the simulator at an uneven pace", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function play(
    { request, day }: { request: DayRequest; day: GeneratedDay },
    partials: PartialDay[] = [],
    signal?: AbortSignal,
  ): Promise<DayOutcome> {
    return readDayStream({
      request,
      response: simulateDayStream({ day, ending: { kind: "finished" }, pace: LIVE, signal }),
      onPartial: (partial) => partials.push(partial),
      signal,
    });
  }

  it("holds the first words for the wait before them", async () => {
    const partials: PartialDay[] = [];
    const outcome = play(KYOTO_DAY, partials);

    await vi.advanceTimersByTimeAsync(UNEVEN_PACE.firstTokenMs - 1);
    expect(partials).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(partials).not.toEqual([]);

    await vi.runAllTimersAsync();
    await outcome;
  });

  it.each(CURATED_DAYS.map((curated) => [curated.request.city, curated]))(
    "brings %s to complete",
    async (_, curated) => {
      const outcome = play(curated);
      await vi.runAllTimersAsync();
      expect((await outcome).kind).toBe("complete");
    },
  );

  it("gives no outcome and leaves no wait running when the caller aborts in a pause", async () => {
    const controller = new AbortController();
    const outcome = play(KYOTO_DAY, [], controller.signal);
    const rejected = expect(outcome).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(UNEVEN_PACE.firstTokenMs / 2);
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
