import { describe, expect, it } from "vitest";
import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LATE_NIGHT_DAY, MIDNIGHT_SUN_DAY, POLAR_NIGHT_DAY } from "@/lib/fixtures/edge/edge-days";
import { utcOffsetMinutes, type DayContext, type LightRun } from "@/lib/geo/sun";
import { type DayRequest, type GeneratedDay, lightOf } from "@/lib/schema/itinerary.schema";
import { minutesOf, runningSpans } from "@/lib/time/clock";
import {
  MIN_RUN_MINUTES,
  axisLightTo,
  axisLightWithin,
  dayLightOf,
  isGoldenAt,
  type AxisRun,
  bestLightOf,
  dayContextOf,
} from "./light";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";

/** The frame an early start and home by eleven ask for. */
const FRAME = { from: 7 * 60, to: 23 * 60 };
const NEXT_DAY = 24 * 60;

/** Where and when a fixture's day happens, at its first place. */
function contextOf({ request, day }: { request: DayRequest; day: GeneratedDay }): DayContext {
  return {
    position: day.stops[0]!.place.coordinates,
    date: request.date,
    utcOffsetMinutes: utcOffsetMinutes(request.timezone, request.date),
  };
}

/** The runs a fixture's axis shows between two running minutes. */
function axisOf(fixture: { request: DayRequest; day: GeneratedDay }, from: number, to: number) {
  return axisLightWithin(dayLightOf(contextOf(fixture)), from, to);
}

/** The runs as the axis draws them, light and minutes, without their keys. */
function drawn(runs: readonly AxisRun[]): [string, number, number][] {
  return runs.map(({ light, from, to }) => [light, from, to]);
}

describe("the time axis in the light", () => {
  it("runs Kyoto's evening in gold to the sunset, then dotted to the frame's end", () => {
    expect(drawn(axisOf(KYOTO_DAY, FRAME.from, FRAME.to))).toEqual([
      ["golden", minutesOf("16:16"), minutesOf("16:53")],
      // Blue hour and night are one dotted run.
      ["dark", minutesOf("16:53"), minutesOf("23:00")],
    ]);
  });

  it("leaves plain the seven minutes of Kyoto's morning gold the frame keeps", () => {
    // The morning's golden hour runs on to 07:07, seven minutes into a frame from 07:00.
    const wider = axisOf(KYOTO_DAY, minutesOf("06:50"), FRAME.to);

    expect(drawn(axisOf(KYOTO_DAY, FRAME.from, FRAME.to))[0]?.[1]).toBe(minutesOf("16:16"));
    expect(drawn(wider)[0]).toEqual(["golden", minutesOf("06:50"), minutesOf("07:07")]);
  });

  it("holds Alicante's dawn and dusk, and leaves the day between them plain", () => {
    const runs = axisOf(ALICANTE_DAY, FRAME.from, FRAME.to);

    expect(drawn(runs)).toEqual([
      ["dark", minutesOf("07:00"), minutesOf("07:43")],
      ["golden", minutesOf("07:43"), minutesOf("08:21")],
      ["golden", minutesOf("17:12"), minutesOf("17:51")],
      ["dark", minutesOf("17:51"), minutesOf("23:00")],
    ]);
    expect(isGoldenAt(runs, minutesOf("12:00"))).toBe(false);
    expect(isGoldenAt(runs, minutesOf("17:20"))).toBe(true);
    // A run ends where the next light begins.
    expect(isGoldenAt(runs, minutesOf("17:51"))).toBe(false);
  });

  it("keys a run by where its light began, so a frame that springs keeps its runs", () => {
    const runs = dayLightOf(contextOf(ALICANTE_DAY));
    const wider = axisLightWithin(runs, 6 * 60, FRAME.to);
    const framed = axisLightWithin(runs, FRAME.from, FRAME.to);

    expect(wider.map((run) => run.key)).toEqual(framed.map((run) => run.key));
    expect(wider[0]!.from).toBe(6 * 60);
    expect(framed[0]!.from).toBe(FRAME.from);
  });

  it("carries one dotted night through midnight into the small hours", () => {
    const runs = axisOf(LATE_NIGHT_DAY, 20 * 60, NEXT_DAY + 3 * 60);

    expect(drawn(runs)).toEqual([["dark", 20 * 60, NEXT_DAY + 3 * 60]]);
  });

  it("dots a polar day from end to end, its blue noon too", () => {
    expect(drawn(axisOf(POLAR_NIGHT_DAY, 9 * 60, 23 * 60))).toEqual([["dark", 9 * 60, 23 * 60]]);
  });

  it("gives a sun that never sets no dotted run, only its low gold around midnight", () => {
    const runs = axisOf(MIDNIGHT_SUN_DAY, 9 * 60, NEXT_DAY + 60);

    expect(drawn(runs)).toEqual([["golden", minutesOf("22:35"), NEXT_DAY + 60]]);
  });

  it("draws a run the frame keeps ten minutes of, and leaves one it keeps less of plain", () => {
    const runs: LightRun[] = [
      { quality: "golden", fromMinutes: 0 },
      { quality: "soft", fromMinutes: 100 },
      { quality: "golden", fromMinutes: 200 },
      { quality: "blue", fromMinutes: 300 },
    ];

    expect(drawn(axisLightWithin(runs, 100 - MIN_RUN_MINUTES, 300))).toEqual([
      ["golden", 100 - MIN_RUN_MINUTES, 100],
      ["golden", 200, 300],
    ]);
    expect(drawn(axisLightWithin(runs, 100 - MIN_RUN_MINUTES + 1, 300 + 9))).toEqual([
      ["golden", 200, 300],
    ]);
  });

  it("comes in with the day: down to a minute, the run it falls in cut there", () => {
    const runs = axisOf(KYOTO_DAY, FRAME.from, FRAME.to);

    expect(drawn(axisLightTo(runs, minutesOf("17:00")))).toEqual([
      ["golden", minutesOf("16:16"), minutesOf("16:53")],
      ["dark", minutesOf("16:53"), minutesOf("17:00")],
    ]);
    expect(axisLightTo(runs, minutesOf("16:16"))).toEqual([]);
  });
});

const CONTEXT = dayContextOf(ABACUS_DAY);

type Light = ReturnType<typeof bestLightOf>;

function lightAt(index: number, alternative?: number): Light {
  const stop = ABACUS_DAY.stops[index]!;
  const place = alternative === undefined ? stop.primary : stop.alternatives[alternative]!;
  const from = minutesOf(stop.startTime);
  return bestLightOf(place, { from, to: from + stop.durationMinutes }, CONTEXT);
}

/** A visit between two clock times on the same day. */
function visit(from: string, to: string): { from: number; to: number } {
  return { from: minutesOf(from), to: minutesOf(to) };
}

describe("bestLightOf", () => {
  it("marks the sunrise beach and the sunset promenade, not the stops between", () => {
    const lights = ABACUS_DAY.stops.map((_, index) => lightAt(index));

    expect(lights).toEqual(["sunrise", null, null, null, null, null, "sunset", null]);
  });

  it("drops the mark when the stop changes to a place with no best light", () => {
    expect(lightAt(0, 0)).toBeNull();
  });

  it("does not mark a place visited in a window that lasts for hours", () => {
    // Horchata by Santa María is at its best in the afternoon, and visited then.
    expect(lightAt(5, 0)).toBeNull();
  });

  it("marks a roofed place whose own best light is sunset", () => {
    const sunsetStop = ABACUS_DAY.stops[6]!;
    const roofed = sunsetStop.alternatives.find((place) => place.light.exposure === "covered");

    expect(roofed).toBeDefined();
    expect(lightAt(6, sunsetStop.alternatives.indexOf(roofed!))).toBe("sunset");
  });

  it("says nothing about a place best at sunset that is visited in the morning", () => {
    const promenade = ABACUS_DAY.stops[6]!.primary;

    expect(bestLightOf(promenade, visit("08:30", "09:30"), CONTEXT)).toBeNull();
  });

  it("does not count a visit that only grazes the window", () => {
    const promenade = ABACUS_DAY.stops[6]!.primary;
    const grazing = bestLightOf(promenade, visit("16:20", "17:25"), CONTEXT);

    expect(grazing).toBeNull();
  });

  it("waits for the best window to be written", () => {
    expect(bestLightOf({}, visit("07:45", "08:30"), CONTEXT)).toBeNull();
    expect(
      bestLightOf({ light: { bestWindow: null } }, visit("07:45", "08:30"), CONTEXT),
    ).toBeNull();
  });

  it("meets an evening window that runs past midnight with a visit after midnight", () => {
    // Under the midnight sun the evening light runs on past 24:00, and a stop at 00:10
    // after a late dinner is counted on from it, not at the start of the day.
    const fjellheisen = MIDNIGHT_SUN_DAY.day.stops.at(-1)!.place;
    const context = {
      position: fjellheisen.coordinates,
      date: MIDNIGHT_SUN_DAY.request.date,
      utcOffsetMinutes: 120,
    };
    const [, afterMidnight] = runningSpans([
      { startTime: "22:00", durationMinutes: 90 },
      { startTime: "00:10", durationMinutes: 60 },
    ]);

    expect(afterMidnight).toEqual({ from: 24 * 60 + 10, to: 25 * 60 + 10 });
    expect(
      bestLightOf({ ...fjellheisen, light: lightOf(fjellheisen.light) }, afterMidnight!, context),
    ).toBe("sunset");
  });
});
