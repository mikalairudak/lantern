import { describe, expect, it } from "vitest";
import { ALICANTE_DAY } from "@/lib/fixtures/curated/alicante";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { CROWDED_DAY } from "@/lib/fixtures/edge/crowded";
import { LATE_NIGHT_DAY } from "@/lib/fixtures/edge/late-night";
import { LONG_STAY_DAY } from "@/lib/fixtures/edge/long-stay";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/minimal";
import { MIDNIGHT_SUN_DAY, POLAR_NIGHT_DAY } from "@/lib/fixtures/edge/polar";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { ENERGY_LEVELS, type DayRequest, type GeneratedDay } from "@/lib/schema/itinerary.schema";
import { runningSpans } from "@/lib/time/clock";
import {
  CHART,
  askedHoursOf,
  basisAtPaceOf,
  dayBounds,
  paceOf,
  wholeDayEndOf,
  type DaySpan,
  beadTargetPath,
  chartScale,
  drawnEnergyOf,
  hourMarks,
  polylinePath,
} from "./geometry";
import { replanForEnergy } from "./replan";
import { rowScale, type RowExtent } from "./rows";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { MAX_ENERGY } from "./curve";

/** A day's height on a phone and on a laptop, `h-day`. */
const DAY_HEIGHT = 540;
const WIDTH = 358;
const hours = (count: number) => count * 60;

function itineraryOf({ request, day }: { request: DayRequest; day: GeneratedDay }) {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(normalized.reason);
  return normalized.itinerary;
}

/** The frame a day's stream drew it on: the hours its words ask for, stretched around its stops. */
function askedFrameOf(fixture: { request: DayRequest; day: GeneratedDay }): DaySpan {
  const { stops, facts } = itineraryOf(fixture);
  return dayBounds(stops, askedHoursOf(facts.start.value, facts.end.value));
}

/** Where the frame of a whole day ends, on the page's pace. */
function wholeEndOf(fixture: { request: DayRequest; day: GeneratedDay }): number {
  const asked = askedFrameOf(fixture);
  return wholeDayEndOf(itineraryOf(fixture).stops, asked, paceOf(asked, DAY_HEIGHT));
}

/** A day as the visitor asked it to end by eleven, which no fitting of Lantern's word moves. */
function homeByEleven(fixture: { request: DayRequest; day: GeneratedDay }) {
  return { ...fixture, request: { ...fixture.request, end: "early" as const } };
}

describe("wholeDayEndOf", () => {
  it("ends Kyoto's frame on the whole hour after its last visit, not on the hour asked", () => {
    // Obanzai along Pontocho, 18:00 to 19:30; the day asked to end by 23:00.
    expect(askedFrameOf(homeByEleven(KYOTO_DAY)).end).toBe(hours(23));
    expect(wholeEndOf(homeByEleven(KYOTO_DAY))).toBe(hours(20));
  });

  it("frames a day home by eight to eight, before its stops land", () => {
    expect(askedFrameOf(KYOTO_DAY).end).toBe(hours(20));
  });

  it("leaves a day whose last visit ends on the hour asked as it was", () => {
    for (const fixture of [
      LISBON_DAY,
      ALICANTE_DAY,
      CROWDED_DAY,
      LATE_NIGHT_DAY,
      MIDNIGHT_SUN_DAY,
    ]) {
      expect(wholeEndOf(fixture)).toBe(askedFrameOf(fixture).end);
    }
  });

  it("runs a frame past midnight to the whole hour after its last visit", () => {
    // The last stop, from 01:00 for three hours, ends at 04:00 the next morning.
    expect(wholeEndOf(LATE_NIGHT_DAY)).toBe(hours(28));
  });

  it("ends a long stay's frame after its last visit too", () => {
    expect(wholeEndOf(LONG_STAY_DAY)).toBe(hours(21));
  });

  it("never ends a frame so soon that it stands shorter than the chart's least", () => {
    for (const fixture of [MINIMAL_DAY, homeByEleven(POLAR_NIGHT_DAY)]) {
      const asked = askedFrameOf(fixture);
      const pace = paceOf(asked, DAY_HEIGHT);
      const end = wholeDayEndOf(itineraryOf(fixture).stops, asked, pace);
      const height = basisAtPaceOf({ start: asked.start, end }, pace);

      expect(height).toBeGreaterThanOrEqual(CHART.minHeight);
      // On the first whole hour that does it.
      expect(height - pace * hours(1)).toBeLessThan(CHART.minHeight);
      expect(end % hours(1)).toBe(0);
    }
    // One stop from 10:00 to 12:00, on a frame from 09:00 asked to end by 23:00.
    expect(wholeEndOf(MINIMAL_DAY)).toBe(hours(19));
  });

  it("keeps the frame asked for while a day's height is not measured", () => {
    const asked = askedFrameOf(MINIMAL_DAY);
    const stops = itineraryOf(MINIMAL_DAY).stops;

    expect(wholeDayEndOf(stops, asked, paceOf(asked, 0))).toBe(asked.end);
  });

  it("keeps the frame asked for with no stops, or no pace", () => {
    const asked = { start: hours(7), end: hours(23) };

    expect(wholeDayEndOf([], asked, 0.5)).toBe(asked.end);
    expect(wholeDayEndOf(itineraryOf(KYOTO_DAY).stops, asked, 0)).toBe(asked.end);
  });

  it("ends at the same minute, the same distance under the last visit, in every plan a re-pick can show", () => {
    for (const fixture of [KYOTO_DAY, LISBON_DAY, ALICANTE_DAY]) {
      const { stops } = itineraryOf(fixture);
      const asked = askedFrameOf(fixture);
      const pace = paceOf(asked, DAY_HEIGHT);
      const from = ENERGY_LEVELS.indexOf(fixture.request.energy);
      const plans = ENERGY_LEVELS.map((_, to) => replanForEnergy(stops, from, to));
      // Each plan shows other versions of the stops, on the stops' own times.
      expect(
        new Set(plans.map((plan) => plan.map((stop) => stop.selectedPlaceId).join())).size,
      ).toBeGreaterThan(1);
      const ends = plans.map((plan) => wholeDayEndOf(plan, asked, pace));
      const tails = plans.map((plan, index) => {
        const lastVisit = runningSpans(plan).at(-1)?.to ?? 0;
        return pace * ((ends[index] ?? 0) - lastVisit);
      });

      expect(new Set(ends).size).toBe(1);
      expect(new Set(tails).size).toBe(1);
    }
  });
});

describe("a whole day's frame at the asked hours' pace", () => {
  const asked = { start: hours(7), end: hours(23) };
  const whole = { start: hours(7), end: hours(20) };
  const pace = paceOf(asked, DAY_HEIGHT);
  /** Two rows, the second's words taller than its hours, so the scale stretches under them. */
  const rows: RowExtent[] = [
    { mid: hours(8), above: 40 },
    { mid: hours(18.75), above: 300 },
  ];

  it("moves no row, and cuts only the empty hours under the last", () => {
    const before = rowScale(WIDTH, basisAtPaceOf(asked, pace), asked.start, asked.end, rows);
    const after = rowScale(WIDTH, basisAtPaceOf(whole, pace), whole.start, whole.end, rows);

    expect(after.anchors).toEqual(before.anchors);
    expect(before.scale.height - after.scale.height).toBeCloseTo(pace * hours(3));
    expect(after.scale.yOf(hours(19.5))).toBeCloseTo(before.scale.yOf(hours(19.5)));
  });

  it("stands as tall as the day's own height when it ends on the hour asked", () => {
    expect(basisAtPaceOf(asked, pace)).toBeCloseTo(DAY_HEIGHT);
    expect(basisAtPaceOf(asked, paceOf(asked, 0))).toBeCloseTo(CHART.minHeight);
  });
});

const TWIN_STEP = CHART.twinStep;

describe("chart geometry", () => {
  it("spans whole hours around the day", () => {
    expect(dayBounds(ABACUS_DAY.stops)).toEqual({ start: 7 * 60, end: 23 * 60 });
    expect(dayBounds([])).toEqual({ start: 0, end: 24 * 60 });
  });

  it("spans the requested hours before any stop arrives, and stretches only for one outside", () => {
    const requested = { start: 7 * 60, end: 23 * 60 };
    const lateSupper = { startTime: "22:30", durationMinutes: 75 };

    expect(dayBounds([], requested)).toEqual(requested);
    expect(dayBounds(ABACUS_DAY.stops.slice(0, 3), requested)).toEqual(requested);
    expect(dayBounds([...ABACUS_DAY.stops.slice(0, 3), lateSupper], requested)).toEqual({
      start: 7 * 60,
      end: 24 * 60,
    });
  });

  it("runs on past midnight for a night that goes through it", () => {
    const night = [
      { startTime: "21:00", durationMinutes: 105 },
      { startTime: "23:15", durationMinutes: 90 },
      { startTime: "01:00", durationMinutes: 180 },
    ];

    expect(dayBounds(night)).toEqual({ start: 21 * 60, end: 28 * 60 });
  });

  it("maps the day to the plot and back", () => {
    const scale = chartScale(480, 700, 7 * 60, 23 * 60);

    expect(scale.yOf(7 * 60)).toBe(CHART.top);
    expect(scale.yOf(23 * 60)).toBe(700 - CHART.bottom);
    expect(scale.minutesAt(scale.yOf(14 * 60 + 30))).toBeCloseTo(14 * 60 + 30);
  });

  it("puts reflective after the axis and social before the edge", () => {
    const scale = chartScale(480, 700, 7 * 60, 23 * 60);

    expect(scale.xOf(0)).toBe(CHART.axisWidth + CHART.laneInsetStart);
    expect(scale.xOf(4)).toBe(480 - CHART.laneInsetEnd);
    expect(scale.laneStep * 4).toBe(scale.xOf(4) - scale.xOf(0));
  });

  it("ends the social lane at the beads' reach, with no room kept for anything else", () => {
    const width = 390 - 2 * 16;
    const scale = chartScale(width, 576, 7 * 60, 23 * 60);
    const beadReach = scale.xOf(MAX_ENERGY) + CHART.beadHitRadius;
    const knobReach = scale.xOf(MAX_ENERGY) + CHART.knobRadius + CHART.knobStroke / 2;

    expect(beadReach).toBeLessThanOrEqual(width);
    expect(knobReach).toBeLessThanOrEqual(width);
    expect(width - beadReach).toBeLessThan(CHART.beadHitRadius);
  });

  it("ticks every whole hour of the day", () => {
    const hours = hourMarks(7 * 60, 23 * 60).map((minutes) => minutes / 60);

    expect(hours).toHaveLength(17);
    expect(hours[0]).toBe(7);
    expect(hours.at(-1)).toBe(23);
  });

  it("writes a path to a tenth of a pixel", () => {
    expect(
      polylinePath([
        { x: 1, y: 2.25 },
        { x: 3.04, y: 4 },
      ]),
    ).toBe("M1.0 2.3 L3.0 4.0");
    expect(polylinePath([])).toBe("");
  });
});

describe("twins on the wire", () => {
  const scale = chartScale(390, 700, 7 * 60, 23 * 60);

  it("draws the first version at its energy and each twin a bead's width inward", () => {
    expect(drawnEnergyOf(scale, MAX_ENERGY, 0)).toBe(MAX_ENERGY);
    expect(scale.xOf(drawnEnergyOf(scale, MAX_ENERGY, 1))).toBeCloseTo(
      scale.xOf(MAX_ENERGY) - TWIN_STEP,
    );
    expect(scale.xOf(drawnEnergyOf(scale, 0, 1))).toBeCloseTo(scale.xOf(0) + TWIN_STEP);
  });

  it("keeps a lone bead's target a whole circle", () => {
    expect(beadTargetPath(100, 50, [200])).toBe(
      "M112.0 50.0 A12 12 0 0 0 88.0 50.0 L88.0 50.0 A12 12 0 0 0 112.0 50.0 Z",
    );
  });

  it("keeps a twin's target whole, a whole target's width from its neighbour", () => {
    // WCAG 2.5.8: each version a 24 px circle of its own, never half the ground between two.
    expect(TWIN_STEP).toBeGreaterThanOrEqual(2 * CHART.beadHitRadius);
    const whole = beadTargetPath(100, 50, []);
    expect(beadTargetPath(100, 50, [100 + TWIN_STEP])).toBe(whole);
    expect(beadTargetPath(100, 50, [100 - TWIN_STEP, 100 + TWIN_STEP])).toBe(whole);
  });

  it("cuts a target where a bead closer than a target's width begins its own", () => {
    const near = CHART.beadHitRadius;
    const right = (100 + near / 2).toFixed(1).replace(".", "\\.");
    const left = (100 - near / 2).toFixed(1).replace(".", "\\.");
    expect(beadTargetPath(100, 50, [100 + near])).toMatch(new RegExp(`^M${right} `));
    expect(beadTargetPath(100, 50, [100 - near])).toMatch(new RegExp(`A12 12 0 0 0 ${left} `));
  });

  it("gives a stop's every version a whole target, three at one energy or a twin by a neighbour", () => {
    // A 320 px phone's chart, the narrowest, where a twin stands half a step in; a 390 px
    // phone's; and a laptop's.
    for (const width of [288, 358, 1408]) {
      const wide = chartScale(width, 700, 7 * 60, 23 * 60);
      for (const end of [0, MAX_ENERGY]) {
        const inward = end === 0 ? 1 : -1;
        // Three versions at one energy, the stop's most: two twins in from the first.
        const triple = [0, 1, 2].map((rank) => wide.xOf(drawnEnergyOf(wide, end, rank)));
        // Two at one energy, the third at the energy next to it.
        const pair = [
          wide.xOf(drawnEnergyOf(wide, end, 0)),
          wide.xOf(drawnEnergyOf(wide, end, 1)),
          wide.xOf(end + inward),
        ];
        for (const beads of [triple, pair]) {
          beads.forEach((x, index) => {
            const others = beads.filter((_, at) => at !== index);
            expect(beadTargetPath(x, 50, others)).toBe(beadTargetPath(x, 50, []));
          });
        }
      }
    }
  });
});
