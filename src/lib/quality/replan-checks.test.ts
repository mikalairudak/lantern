import { describe, expect, it } from "vitest";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_EATING_LATE,
  ELCHE_LATE_DINNER,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import {
  KYOTO_ITINERARY,
  KYOTO_MORNING_BASIS,
  KYOTO_SLOW_MORNING,
  KYOTO_SLOW_MORNING_WITH_VERSIONS,
} from "@/lib/fixtures/replan/kyoto-morning";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { mergeReplan, type ReplanBasis } from "@/lib/replan/merge";
import type { EnergyLevel, Itinerary } from "@/lib/schema/itinerary.schema";
import { minutesOf } from "@/lib/time/clock";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import {
  checkReplanDrops,
  checkReplanGap,
  checkReplanTimeWords,
  checkReplanWindows,
  checkReplanWord,
} from "./replan-checks";

/** Production's Elche evening: its late end missed, its coffee dropped, 17:30 to 21:00 empty. */
const ELCHE_END_MISS = 'end: "early", but the last stop ends at 23:45, after 23:00';
const ELCHE_HOLE =
  "17:30 to 21:00 stands empty, 210 minutes, between Huerto del Cura and Tapas along Carrer Major de la Vila";

/** The written Kyoto day at `energy`, its dinner from 18:00 running on to `endTime`, normalized. */
function kyotoEndingAt(endTime: string, energy: EnergyLevel = "calm"): Itinerary {
  const stops = [...KYOTO_DAY.day.stops];
  const last = stops.length - 1;
  const dinner = stops[last];
  if (dinner === undefined) throw new Error("Kyoto has a last stop");
  const durationMinutes = minutesOf(endTime) - minutesOf(dinner.startTime);
  stops[last] = { ...dinner, durationMinutes };
  const normalized = normalizeDay({ ...KYOTO_DAY.request, energy }, { ...KYOTO_DAY.day, stops });
  if (!normalized.ok) throw new Error(normalized.reason);
  return normalized.itinerary;
}

function withStops(
  stops: { name?: string; startTime: string; durationMinutes: number }[],
): GeneratedReplan {
  return {
    ...KYOTO_SLOW_MORNING,
    stops: stops.map(({ name, ...times }, index) => {
      const stop = KYOTO_SLOW_MORNING.stops[index % KYOTO_SLOW_MORNING.stops.length];
      if (stop === undefined) throw new Error("The slow morning has stops");
      return { ...stop, ...times, place: { ...stop.place, name: name ?? stop.place.name } };
    }),
  };
}

describe("checkReplanWindows", () => {
  it("passes a re-plan whose every new stop fits its window", () => {
    expect(checkReplanWindows(KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING)).toMatchObject({
      id: "replan-windows",
      kind: "hard",
      passed: true,
      findings: [],
    });
  });

  it("names a stop the merge drops for no time left before a kept stop", () => {
    const replan = withStops([
      { startTime: "09:00", durationMinutes: 30 },
      { startTime: "09:50", durationMinutes: 30 },
    ]);

    expect(checkReplanWindows(KYOTO_MORNING_BASIS, replan).findings).toEqual([
      "stops[1]: runs into a kept stop, no time left before a kept stop",
    ]);
  });

  it("names a stop that runs into a kept one, repeats a kept place, or starts outside every window", () => {
    const kept = KYOTO_ITINERARY.stops[3]?.primary.name ?? "";
    const replan = withStops([
      { startTime: "09:00", durationMinutes: 30 },
      { name: kept, startTime: "09:32", durationMinutes: 10 },
      { startTime: "09:45", durationMinutes: 30 },
      { startTime: "14:00", durationMinutes: 30 },
    ]);

    expect(checkReplanWindows(KYOTO_MORNING_BASIS, replan).findings).toEqual([
      `stops[1]: repeats a kept place, ${kept} is kept`,
      "stops[2]: runs into a kept stop, cut to 15 minutes",
      "stops[3]: outside the windows asked for, starts at 14:00",
    ]);
  });

  it("fails a window left empty, as the merge does", () => {
    const replan = withStops([{ startTime: "15:00", durationMinutes: 30 }]);

    expect(checkReplanWindows(KYOTO_MORNING_BASIS, replan)).toMatchObject({
      passed: false,
      findings: [
        "stops[0]: outside the windows asked for, starts at 15:00",
        "the re-plan left window 1 without a stop",
      ],
    });
  });

  it("fails what is not a re-plan at all", () => {
    expect(checkReplanWindows(KYOTO_MORNING_BASIS, { stops: [] }).passed).toBe(false);
    expect(checkReplanWindows(KYOTO_MORNING_BASIS, null).passed).toBe(false);
  });
});

describe("checkReplanWord", () => {
  it("passes a re-plan whose merged day keeps the word it was written for", () => {
    // The slow morning starts at nine, mid-morning.
    expect(checkReplanWord(KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING)).toMatchObject({
      id: "replan-word",
      kind: "hard",
      passed: true,
      findings: [],
    });
  });

  it("fails one that misses it, though time-words would pass a day that misses one word of three", () => {
    const early = withStops([
      { startTime: "08:00", durationMinutes: 45 },
      { startTime: "09:00", durationMinutes: 40 },
    ]);

    expect(checkReplanWord(KYOTO_MORNING_BASIS, early)).toMatchObject({
      passed: false,
      findings: ['start: "slow", but the first stop starts at 08:00, outside 09:00 to 11:30'],
    });
  });

  it("fails a re-plan with no merged day to keep it, and says why", () => {
    expect(checkReplanWord(KYOTO_MORNING_BASIS, null).findings).toEqual([
      "not a re-plan the merge can read",
    ]);
    const afternoon = withStops([{ startTime: "15:00", durationMinutes: 45 }]);
    expect(checkReplanWord(KYOTO_MORNING_BASIS, afternoon).findings).toEqual([
      "the re-plan left window 1 without a stop",
    ]);
  });
});

describe("checkReplanTimeWords", () => {
  it("passes a merged day that keeps its start, dinner and end, the changed word and the rest", () => {
    expect(checkReplanTimeWords(KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING)).toMatchObject({
      id: "replan-time-words",
      kind: "hard",
      passed: true,
      findings: [],
    });
  });

  // replan-word passed it: the dinner, the word changed, is kept at 21:00.
  it("fails Elche's evening, whose end Lantern assumed early and the re-plan ran to 23:45", () => {
    expect(checkReplanWord(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER).passed).toBe(true);
    expect(checkReplanTimeWords(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER)).toMatchObject({
      passed: false,
      findings: [ELCHE_END_MISS],
    });
  });

  // Out late, as the headline says it, is any end after eleven: a day Lantern fitted so is never
  // failed on it when the visitor changes another word.
  it("passes a re-plan of a day whose assumed end was fitted to out late from a 23:30 finish", () => {
    // A lively day's late end is promised past midnight; Lantern's word says only "out late".
    const day = kyotoEndingAt("23:30", "lively");
    const basis: ReplanBasis = { ...KYOTO_MORNING_BASIS, itinerary: day };

    expect(day.facts.end).toEqual({ value: "late", source: "assumed" });
    expect(checkReplanTimeWords(basis, KYOTO_SLOW_MORNING)).toMatchObject({
      passed: true,
      findings: [],
    });
  });

  it("holds a late end the visitor chose to the hour promised, from half past eleven on a calm day", () => {
    const day = kyotoEndingAt("23:15");
    const chosen = { ...day.facts, end: { value: "late" as const, source: "chosen" as const } };
    const basis: ReplanBasis = { ...KYOTO_MORNING_BASIS, itinerary: { ...day, facts: chosen } };

    expect(checkReplanTimeWords(basis, KYOTO_SLOW_MORNING).findings).toEqual([
      'end: "late", but the last stop ends at 23:15, before 23:30, a calm day\'s late end',
    ]);
  });

  it("fails a re-plan with no merged day, and says why", () => {
    expect(checkReplanTimeWords(KYOTO_MORNING_BASIS, null).findings).toEqual([
      "not a re-plan the merge can read",
    ]);
    const afternoon = withStops([{ startTime: "15:00", durationMinutes: 45 }]);
    expect(checkReplanTimeWords(KYOTO_MORNING_BASIS, afternoon).findings).toEqual([
      "the re-plan left window 1 without a stop",
    ]);
  });
});

describe("checkReplanDrops", () => {
  it("counts no drop for a re-plan whose every new stop stands in the day, a cut one too", () => {
    const cut = withStops([
      { startTime: "09:00", durationMinutes: 30 },
      { startTime: "09:45", durationMinutes: 30 },
    ]);

    expect(checkReplanDrops(KYOTO_MORNING_BASIS, cut)).toEqual({
      id: "replan-drops",
      kind: "hard",
      passed: true,
      value: 0,
      threshold: null,
      findings: [],
    });
  });

  it("counts no drop for a re-plan that lost only an option, one past the walk from its stop", () => {
    const { repairs } = mergeReplan({
      ...KYOTO_MORNING_BASIS,
      replan: KYOTO_SLOW_MORNING_WITH_VERSIONS,
    });
    expect(repairs).toContainEqual(expect.objectContaining({ kind: "dropped-alternative" }));

    expect(checkReplanDrops(KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING_WITH_VERSIONS)).toMatchObject({
      passed: true,
      value: 0,
      findings: [],
    });
  });

  it("counts each new stop the merge or the normalizer drops, and says why", () => {
    const kept = KYOTO_ITINERARY.stops[3]?.primary.name ?? "";
    const replan = withStops([
      { startTime: "09:00", durationMinutes: 30 },
      { name: kept, startTime: "09:32", durationMinutes: 10 },
      { startTime: "nine", durationMinutes: 30 },
      { startTime: "14:00", durationMinutes: 30 },
    ]);

    expect(checkReplanDrops(KYOTO_MORNING_BASIS, replan)).toMatchObject({
      passed: false,
      value: 3,
      findings: [
        `stops[1]: repeats a kept place, ${kept} is kept`,
        'stops[2]: the normalizer drops it, its start time "nine" is not a time',
        "stops[3]: outside the windows asked for, starts at 14:00",
      ],
    });
  });

  it("counts Elche's coffee on the kept morning's square", () => {
    expect(checkReplanDrops(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER)).toMatchObject({
      passed: false,
      value: 1,
      findings: ["stops[2]: repeats a kept place, Coffee on Plaça de Baix is kept"],
    });
  });

  it("counts nothing of what is not a re-plan", () => {
    expect(checkReplanDrops(KYOTO_MORNING_BASIS, null)).toMatchObject({
      passed: false,
      value: null,
      findings: ["not a re-plan the merge can read"],
    });
  });
});

describe("checkReplanGap", () => {
  it("passes a merged day with no new hole", () => {
    expect(checkReplanGap(KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING)).toMatchObject({
      id: "replan-gap",
      kind: "hard",
      passed: true,
      findings: [],
    });
  });

  it("names Elche's evening hole, which the kept day did not have, with the coffee dropped or never written", () => {
    for (const replan of [ELCHE_LATE_DINNER, ELCHE_LATE_DINNER_UNREPEATED]) {
      expect(checkReplanGap(ELCHE_DINNER_BASIS, replan)).toMatchObject({
        passed: false,
        findings: [ELCHE_HOLE],
      });
    }
  });

  it("passes a hole the kept day already had", () => {
    const merged = mergeReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
    if (!merged.ok) throw new Error(merged.reason);
    // The merged day re-planned again for a late end: its last two stops, after the hole.
    const lateEnd: ReplanBasis = {
      itinerary: merged.itinerary,
      request: { ...ELCHE_EATING_LATE, end: "late" },
      changed: "end",
      windows: [{ from: 7, to: 8 }],
      idPrefix: "r2",
    };
    const evening: GeneratedReplan = {
      ...ELCHE_LATE_DINNER_UNREPEATED,
      stops: ELCHE_LATE_DINNER_UNREPEATED.stops.slice(2),
      alternatives: ELCHE_LATE_DINNER_UNREPEATED.alternatives
        .filter(({ stopIndex }) => stopIndex >= 2)
        .map((set) => ({ ...set, stopIndex: set.stopIndex - 2 })),
    };

    expect(checkReplanGap(lateEnd, evening)).toMatchObject({ passed: true, findings: [] });
  });

  it("fails a re-plan with no merged day, and says why", () => {
    expect(checkReplanGap(KYOTO_MORNING_BASIS, null).findings).toEqual([
      "not a re-plan the merge can read",
    ]);
  });
});
