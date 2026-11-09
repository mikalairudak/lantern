import { describe, expect, it } from "vitest";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { normalizeDay, type Repair } from "@/lib/normalizer/normalize";
import { findBannedPhrases } from "@/lib/quality/banned-phrases";
import {
  ACOUSTIC_LEVELS,
  ALTERNATIVES_PER_STOP,
  ASSUMABLE_FACT_KEYS,
  COMPANIES,
  COMPASS_POINTS,
  NONE,
  CROWD_LEVELS,
  DAY_ENDS,
  DAY_STARTS,
  DayRequestSchema,
  DINNER_TIMES,
  ENERGY_LEVELS,
  EXPOSURES,
  FACT_KEYS,
  FACT_SOURCES,
  GeneratedDaySchema,
  LIGHT_WINDOWS,
  MAX_AESTHETIC_TAGS,
  PLACE_KINDS,
  TRAVEL_MODES,
  type AssumableFactKey,
} from "@/lib/schema/itinerary.schema";
import type { EdgeDay } from "./edge-day";
import { EDGE_DAYS, REFUSED_DAY, REPAIRED_DAY } from "./edge-days";

/** What each day was written to need from the normalizer; every other day needs nothing. */
const EXPECTED_REPAIRS = new Map<EdgeDay, Pick<Repair, "kind" | "path">[]>([
  [
    REPAIRED_DAY,
    [
      { kind: "kept-choice", path: ["assumptions", "company"] },
      { kind: "reformatted-time", path: ["stops", 0, "startTime"] },
      { kind: "trimmed-text", path: ["stops", 1, "place", "name"] },
      { kind: "trimmed-tags", path: ["stops", 4, "place", "aesthetic"] },
      { kind: "rounded-duration", path: ["stops", 6, "durationMinutes"] },
      { kind: "deduplicated-dependencies", path: ["stops", 6, "dependsOn"] },
      { kind: "clamped-duration", path: ["stops", 7, "durationMinutes"] },
      { kind: "shortened-overlap", path: ["stops", 2, "durationMinutes"] },
      { kind: "dropped-stop", path: ["stops", 5] },
      { kind: "dropped-alternatives", path: ["alternatives", 8] },
      { kind: "sorted-alternatives", path: ["alternatives", 1, "options"] },
      { kind: "dropped-alternative", path: ["alternatives", 3, "options", 1] },
    ],
  ],
]);

describe.each(EDGE_DAYS)("the edge day with $edge", (edgeDay) => {
  const { request, day } = edgeDay;

  it("answers a valid request", () => {
    expect(DayRequestSchema.parse(request)).toEqual(request);
  });

  it("is exactly what the generation schema allows", () => {
    expect(GeneratedDaySchema.parse(day)).toEqual(day);
  });

  it("normalizes with only the repairs it was written to need", () => {
    const result = normalizeDay(request, day);
    expect(result.ok).toBe(true);
    expect(result.repairs.map(({ kind, path }) => ({ kind, path }))).toEqual(
      EXPECTED_REPAIRS.get(edgeDay) ?? [],
    );
  });

  it("keeps clear of the banned phrases", () => {
    expect(findBannedPhrases(day)).toEqual([]);
  });
});

describe("the refused day", () => {
  it("is what the generation schema allows", () => {
    expect(GeneratedDaySchema.parse(REFUSED_DAY.day)).toEqual(REFUSED_DAY.day);
  });

  it("is refused by the normalizer", () => {
    expect(normalizeDay(REFUSED_DAY.request, REFUSED_DAY.day)).toMatchObject({
      ok: false,
      reason: "the line about the day is blank",
    });
  });
});

// Every value the schema allows has to look intentional in /lab, so some fixture has to
// carry it. A value no day uses is a state nobody designed.
describe("the curated and edge days together", () => {
  const days = [...CURATED_DAYS, ...EDGE_DAYS];
  const sets = days.flatMap(({ day }) => day.alternatives);
  const places = days.flatMap(({ day }) => [
    ...day.stops.map((stop) => stop.place),
    ...sets.flatMap((set) => set.options),
  ]);

  function missing<T>(all: readonly T[], seen: readonly T[]): T[] {
    return all.filter((value) => !seen.includes(value));
  }

  function upTo(count: number, from = 0): number[] {
    return Array.from({ length: count - from + 1 }, (_, i) => from + i);
  }

  /** A word's values, whether the visitor chose them or the model assumed them. */
  function wordsFor(key: AssumableFactKey): unknown[] {
    return days
      .flatMap(({ request, day }) => [request[key], day.assumptions[key]])
      .filter((word) => word !== null);
  }

  const sources = days.flatMap(({ request, day }) => {
    const result = normalizeDay(request, day);
    return result.ok ? FACT_KEYS.map((key) => result.itinerary.facts[key].source) : [];
  });

  it.each<[string, readonly unknown[], readonly unknown[]]>([
    ["requested energy", ENERGY_LEVELS, days.map(({ request }) => request.energy)],
    ["kind", PLACE_KINDS, places.map((place) => place.kind)],
    ["energy", ENERGY_LEVELS, places.map((place) => place.sensory.energy)],
    ["acoustic", ACOUSTIC_LEVELS, places.map((place) => place.sensory.acoustic)],
    ["crowd", CROWD_LEVELS, places.map((place) => place.sensory.crowd)],
    ["exposure", EXPOSURES, places.map((place) => place.light.exposure)],
    ["orientation", [...COMPASS_POINTS, NONE], places.map((place) => place.light.orientation)],
    ["best window", [...LIGHT_WINDOWS, NONE], places.map((place) => place.light.bestWindow)],
    ["tag count", upTo(MAX_AESTHETIC_TAGS, 1), places.map((place) => place.aesthetic.length)],
    ["option count", upTo(ALTERNATIVES_PER_STOP), sets.map((set) => set.options.length)],
    ["way of getting about", TRAVEL_MODES, wordsFor("travel")],
    ["start", DAY_STARTS, wordsFor("start")],
    ["dinner time", DINNER_TIMES, wordsFor("dinner")],
    ["end", DAY_ENDS, wordsFor("end")],
    ["company", COMPANIES, wordsFor("company")],
    ["source of a word", FACT_SOURCES, sources],
  ])("use every %s", (_name, all, seen) => {
    expect(missing(all, seen)).toEqual([]);
  });

  it("include a day that asks the visitor nothing", () => {
    const asksNothing = days.some(({ request, day }) =>
      ASSUMABLE_FACT_KEYS.every((key) => request[key] !== null || day.assumptions[key] !== null),
    );
    expect(asksNothing).toBe(true);
  });

  it("include a stop with no set of alternatives at all", () => {
    const isWithoutSet = ({ day }: EdgeDay): boolean =>
      day.stops.some((_, index) => !day.alternatives.some((set) => set.stopIndex === index));
    expect(EDGE_DAYS.some(isWithoutSet)).toBe(true);
  });
});
