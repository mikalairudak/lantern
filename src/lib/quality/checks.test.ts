import { describe, expect, it } from "vitest";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { LATE_NIGHT_DAY, MIDNIGHT_SUN_DAY } from "@/lib/fixtures/edge/edge-days";
import { ALICANTE_ESCAPED_DAY } from "@/lib/fixtures/live/escaped-days";
import {
  isAreaKind,
  MAX_DAY_FLOW_METERS,
  SWAP_RADIUS_METERS,
  type DayRequest,
  type GeneratedDay,
} from "@/lib/schema/itinerary.schema";
import {
  checkMealNameLines,
  checkMealNames,
  LEG_PACE,
  legMinutes,
  MAX_ASKED_WORDS,
  MAX_COUNTED_REPAIRS,
  MAX_LEG_SHORT_MINUTES,
  MIN_SHARE_TIME_WORDS_KEPT,
  runQualityChecks,
  type CheckId,
  type CheckResult,
} from "./checks";

// Roughly 2.2 km and 5.5 km of latitude: far outside a swap walk, and far enough to
// break a day's flow.
const FAR_LATITUDE_STEP = 0.02;
const ACROSS_TOWN_LATITUDE_STEP = 0.05;

/** A fresh copy of the hero day to break one thing in. Kyoto's request is calm. */
function kyotoDay(): GeneratedDay {
  return structuredClone(KYOTO_DAY.day);
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Nothing at index ${index}`);
  return item;
}

function resultOf(
  id: CheckId,
  output: unknown,
  request: DayRequest = KYOTO_DAY.request,
): CheckResult {
  const result = runQualityChecks(request, output).find((check) => check.id === id);
  if (!result) throw new Error(`No ${id} result`);
  return result;
}

describe.each(CURATED_DAYS)("the curated day in $request.city", ({ request, day }) => {
  it("passes every check", () => {
    const results = runQualityChecks(request, day);
    expect(results.map((result) => result.id)).toEqual([
      "shape",
      "normalizes",
      "asked-words",
      "banned-phrases",
      "meal-name",
      "meal-name-lines",
      "script",
      "escaped-letters",
      "alternatives-map",
      "swap-direction",
      "repairs",
      "walk-radius",
      "energy-fit",
      "day-flow",
      "leg-time",
      "light-sense",
      "time-words",
    ]);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  });
});

describe("shape", () => {
  it("stops the run when the output does not parse, and says where", () => {
    const { dek: _dek, ...withoutDek } = kyotoDay();
    const results = runQualityChecks(KYOTO_DAY.request, withoutDek);
    expect(results).toHaveLength(1);
    expect(at(results, 0)).toMatchObject({ id: "shape", passed: false });
    expect(at(at(results, 0).findings, 0)).toMatch(/^dek: /);
  });

  it("names the whole day when the output is not an object", () => {
    expect(at(resultOf("shape", null).findings, 0)).toMatch(/^day: /);
  });
});

describe("normalizes", () => {
  it("fails a day the normalizer refuses, with its reason", () => {
    const day = kyotoDay();
    day.dek = "   ";
    expect(resultOf("normalizes", day)).toMatchObject({
      passed: false,
      findings: ["the line about the day is blank"],
    });
  });
});

describe("asked words", () => {
  it(`fails a day that leaves more than ${MAX_ASKED_WORDS} word for the headline to ask`, () => {
    // Kyoto's request gives no words and the model leaves only company open.
    const day = kyotoDay();
    day.assumptions.travel = null;
    expect(resultOf("asked-words", day)).toEqual({
      id: "asked-words",
      kind: "hard",
      passed: false,
      value: null,
      threshold: null,
      findings: ["assumptions: 2 words asked (travel, company), at most 1"],
    });
  });

  it("leaves a refused day to the normalizes check", () => {
    const day = kyotoDay();
    day.dek = " ";
    day.assumptions.travel = null;
    expect(resultOf("normalizes", day)).toMatchObject({ passed: false });
    expect(resultOf("asked-words", day)).toMatchObject({ passed: true, findings: [] });
  });
});

describe("repairs", () => {
  it("lists tidying but does not count it", () => {
    const day = kyotoDay();
    day.dek += " ";
    at(day.stops, 0).startTime = "7:30";
    at(day.stops, 0).dependsOn.push("start");
    const result = resultOf("repairs", day);
    expect(result).toMatchObject({ passed: true, value: 0 });
    expect(result.findings).toEqual([
      expect.stringMatching(/^dek: trimmed-text \(tidy, not counted\), /),
      'stops[0].startTime: reformatted-time (tidy, not counted), "7:30" became "07:30"',
      'stops[0].dependsOn: deduplicated-dependencies (tidy, not counted), kept ["start"]',
    ]);
  });

  it("counts a day planned on a word the visitor did not choose", () => {
    const request: DayRequest = { ...KYOTO_DAY.request, travel: "transit" };
    const result = resultOf("repairs", kyotoDay(), request);
    expect(result).toMatchObject({ passed: true, value: 1 });
    expect(result.findings).toEqual([
      'assumptions.travel: kept-choice, kept the visitor\'s "transit" over the assumed "on-foot"',
    ]);
  });

  it(`fails a day with more than ${MAX_COUNTED_REPAIRS} repairs a visitor would see`, () => {
    const day = kyotoDay();
    for (const stop of day.stops.slice(0, MAX_COUNTED_REPAIRS + 1)) {
      stop.place.aesthetic = [...stop.place.aesthetic, "one tag too many", "and another"];
    }
    const result = resultOf("repairs", day);
    expect(result).toMatchObject({ passed: false, value: MAX_COUNTED_REPAIRS + 1 });
    expect(at(result.findings, 0)).toMatch(/^stops\[0\]\.place\.aesthetic: trimmed-tags, /);
  });
});

describe("light sense", () => {
  it("passes one stop outside its light and fails two", () => {
    const day = kyotoDay();
    at(day.stops, 0).place.light.bestWindow = "sunset";
    const oneOutside = resultOf("light-sense", day);
    expect(oneOutside).toMatchObject({ passed: true, value: 0.75 });
    expect(oneOutside.findings).toEqual([
      "stops[0]: sunset light is 16:16 to 17:19, visited 07:30 to 08:15",
    ]);

    at(day.stops, 1).place.light.bestWindow = "after-dark";
    expect(resultOf("light-sense", day)).toMatchObject({ passed: false, value: 0.5 });
  });

  it("keeps the midnight sun's evening light for a stop that runs past midnight", () => {
    const { request, day } = MIDNIGHT_SUN_DAY;
    expect(resultOf("light-sense", day, request)).toMatchObject({ passed: true, value: 1 });
  });

  it("measures a stop after midnight on the night it belongs to", () => {
    const { request, day } = LATE_NIGHT_DAY;
    expect(resultOf("light-sense", day, request)).toEqual(
      expect.objectContaining({ passed: true, value: 1, findings: [] }),
    );
  });

  it("still puts a night stop after midnight when the stop before it has no time", () => {
    const { request } = LATE_NIGHT_DAY;
    const day = structuredClone(LATE_NIGHT_DAY.day);
    at(day.stops, 1).startTime = "late";
    expect(resultOf("light-sense", day, request)).toEqual(
      expect.objectContaining({
        value: 0.5,
        findings: ['stops[1].startTime: "late" is not a time'],
      }),
    );
  });

  it("passes a day where light matters nowhere", () => {
    const day = kyotoDay();
    for (const stop of day.stops) stop.place.light.bestWindow = "none";
    expect(resultOf("light-sense", day)).toMatchObject({ passed: true, value: 1, findings: [] });
  });

  it("misses a stop whose start time cannot be read", () => {
    const day = kyotoDay();
    at(day.stops, 0).startTime = "dawn";
    expect(resultOf("light-sense", day).findings).toEqual([
      'stops[0].startTime: "dawn" is not a time',
    ]);
  });

  // The normalizer drops such a stop, so the checks leave it out of the day's running clock.
  it.each(["24:30", "25:99"])("misses a stop whose start %s is past the clock", (startTime) => {
    const day = kyotoDay();
    at(day.stops, 0).startTime = startTime;
    expect(resultOf("light-sense", day).findings).toEqual([
      `stops[0].startTime: "${startTime}" is not a time`,
    ]);
  });

  it("misses a stop whose light the sun never makes that day", () => {
    const day = kyotoDay();
    at(day.stops, 0).place.coordinates = { lat: 69.6492, lng: 18.9553 };
    const polarNight = { ...KYOTO_DAY.request, date: "2026-12-15", timezone: "Europe/Oslo" };
    expect(resultOf("light-sense", day, polarNight).findings).toContain(
      "stops[0]: no morning light on 2026-12-15, visited 07:30 to 08:15",
    );
  });
});

describe("script", () => {
  it("fails a name that keeps its own script, and names the letters", () => {
    const day = kyotoDay();
    at(day.stops, 0).place.name = "Kiyomizu-dera (清水寺)";
    at(day.stops, 1).place.neighborhood = "Πλάκα";
    at(day.stops, 2).place.summary = "Tea by วัดโพธิ์ and then by سوق";
    expect(resultOf("script", day)).toEqual(
      expect.objectContaining({
        passed: false,
        findings: [
          'stops[0].place.name: "清水寺" not in Latin or Cyrillic',
          'stops[1].place.neighborhood: "Πλάκα" not in Latin or Cyrillic',
          'stops[2].place.summary: "วัดโพธิ์", "سوق" not in Latin or Cyrillic',
        ],
      }),
    );
  });

  it("passes Latin with any accent, Cyrillic, and the marks every script shares", () => {
    const day = kyotoDay();
    at(day.stops, 0).place.name = "Hōnen-in";
    at(day.stops, 1).place.name = "Кафе «Пушкинъ»";
    // The accent here is a separate combining mark, as some text arrives.
    at(day.stops, 2).place.summary = "Cafe\u0301 by Łódź — 18°, €4, the owner’s 2nd room.";
    expect(resultOf("script", day)).toEqual(
      expect.objectContaining({ passed: true, findings: [] }),
    );
  });
});

describe("escaped letters", () => {
  // Sonnet's recorded Alicante day, as the log parses it: `\\u00e1` became the text `\u00e1`.
  const { request, outputText } = ALICANTE_ESCAPED_DAY;
  const written: unknown = JSON.parse(outputText);

  it("passes a day whose letters are letters", () => {
    expect(resultOf("escaped-letters", kyotoDay())).toMatchObject({ passed: true, findings: [] });
  });

  it("fails a recorded day on each string that spells a letter as its escape, by path", () => {
    const result = resultOf("escaped-letters", written, request);

    expect(result.passed).toBe(false);
    expect(result.findings.map((finding) => finding.slice(0, finding.indexOf(":")))).toEqual([
      "dek",
      "stops[1].place.name",
      "stops[5].place.name",
      "alternatives[2].options[0].name",
      "alternatives[4].options[1].name",
      "alternatives[6].options[0].name",
    ]);
    expect(result.findings).toContain(
      'alternatives[4].options[1].name: "Rambla de M\\u00e9ndez N\\u00fa\\u00f1ez" spells \\u00e9, \\u00fa, \\u00f1 as text',
    );
  });

  it("leaves every other check to read the day as the visitor is shown it", () => {
    expect(resultOf("meal-name", written, request).findings).toContain(
      'stops[5].place.name: "Vermut and tapas around Plaza de Gabriel Miró" runs 45 characters, past the 35 three lines hold',
    );
  });
});

describe("banned phrases", () => {
  it("fails the day on one hit", () => {
    const day = kyotoDay();
    at(day.stops, 0).place.summary += " A hidden gem.";
    expect(resultOf("banned-phrases", day)).toMatchObject({
      passed: false,
      findings: ['stops[0].place.summary: "hidden gem"'],
    });
  });

  // Since day-v4 a meal's name is a line about its food and its street, not a proper name.
  it("reads a meal's name, and leaves any other place's name its own", () => {
    const day = kyotoDay();
    const meal = mealIndexOf(day);
    at(day.stops, meal).place.name = "Charming tofu by Nanzen-ji";
    at(day.stops, sightIndexOf(day)).place.name = "Oasis";

    expect(resultOf("banned-phrases", day).findings).toEqual([
      `stops[${meal}].place.name: "charming"`,
    ]);
  });
});

function mealIndexOf(day: GeneratedDay): number {
  return day.stops.findIndex(({ place }) => isAreaKind(place.kind));
}

function sightIndexOf(day: GeneratedDay): number {
  return day.stops.findIndex(({ place }) => !isAreaKind(place.kind));
}

/** Kyoto with every meal, stop or option, named as day-v4 asks. */
function kyotoWithMealLines(): GeneratedDay {
  const day = kyotoDay();
  const places = [
    ...day.stops.map(({ place }) => place),
    ...day.alternatives.flatMap(({ options }) => options),
  ];
  for (const place of places) if (isAreaKind(place.kind)) place.name = "Tofu by Nanzen-ji";
  return day;
}

describe("meal names", () => {
  it("passes meals named as lines about their food and street", () => {
    expect(checkMealNames(KYOTO_DAY.request, kyotoWithMealLines())).toMatchObject({
      id: "meal-name",
      kind: "scored",
      passed: true,
      value: 1,
      threshold: 0,
    });
  });

  // A measure, never a failure (`docs/decisions.md`, "Lantern names no restaurant, café or bar").
  it("measures the share of meal names with nothing wrong, and never fails the day", () => {
    const day = kyotoWithMealLines();
    const meals = [
      ...day.stops.map(({ place }) => place),
      ...day.alternatives.flatMap(({ options }) => options),
    ].filter(({ kind }) => isAreaKind(kind));
    const [first] = meals;
    if (first === undefined) throw new Error("The Kyoto day has a meal");
    first.name = "Lunch bars in Kyoto";

    const result = checkMealNames(KYOTO_DAY.request, day);

    expect(result).toMatchObject({ kind: "scored", passed: true });
    expect(result.value).toBeCloseTo(1 - 1 / meals.length);
    expect(result.findings).toHaveLength(3);
  });

  it("fails a meal named by a word its line says, a venue's word or the city, stop or option", () => {
    const day = kyotoWithMealLines();
    const meal = mealIndexOf(day);
    at(day.stops, meal).place.name = "Kaiseki dinner in Kyoto";
    const setIndex = day.alternatives.findIndex(({ options }) =>
      options.some(({ kind }) => isAreaKind(kind)),
    );
    const options = at(day.alternatives, setIndex).options;
    const optionIndex = options.findIndex(({ kind }) => isAreaKind(kind));
    at(options, optionIndex).name = "ZEN CAFE";

    expect(checkMealNames(KYOTO_DAY.request, day).findings).toEqual([
      `stops[${meal}].place.name: "Kaiseki dinner in Kyoto" says "dinner", which its line says`,
      `stops[${meal}].place.name: "Kaiseki dinner in Kyoto" names the city, Kyoto`,
      `alternatives[${setIndex}].options[${optionIndex}].name: "ZEN CAFE" says "café", a venue's word`,
    ]);
  });

  it("leaves a sight's proper name alone", () => {
    const day = kyotoWithMealLines();
    at(day.stops, sightIndexOf(day)).place.name = "Kyoto Dinner Café of the Philosopher's Path";

    expect(checkMealNames(KYOTO_DAY.request, day).passed).toBe(true);
  });

  it("warns on a name past two lines and never fails the day for it", () => {
    const day = kyotoWithMealLines();
    const meal = mealIndexOf(day);
    const long = "Yudofu and tofu along the Nanzen-ji lane";
    at(day.stops, meal).place.name = long;
    const meals = [
      ...day.stops.map(({ place }) => place),
      ...day.alternatives.flatMap(({ options }) => options),
    ].filter(({ kind }) => isAreaKind(kind)).length;

    const lines = checkMealNameLines(day);

    expect(lines).toMatchObject({
      id: "meal-name-lines",
      kind: "scored",
      passed: true,
      threshold: 0,
    });
    expect(lines.value).toBeCloseTo(1 - 1 / meals);
    expect(lines.findings).toEqual([
      `stops[${meal}].place.name: "${long}" runs ${long.length} characters, past the 26 two lines hold mid-scale`,
    ]);
    expect(checkMealNames(KYOTO_DAY.request, day).findings).toEqual([
      `stops[${meal}].place.name: "${long}" runs ${long.length} characters, past the 35 three lines hold`,
    ]);
  });

  it("finds nothing to get wrong on a day without meals", () => {
    const day = kyotoWithMealLines();
    for (const { place } of day.stops) if (isAreaKind(place.kind)) place.kind = "garden";
    for (const { options } of day.alternatives) {
      for (const option of options) if (isAreaKind(option.kind)) option.kind = "garden";
    }

    expect(checkMealNameLines(day)).toMatchObject({ value: 1, findings: [] });
  });
});

describe("alternatives map", () => {
  it("fails a set that points past the last stop, and the stop it left uncovered", () => {
    const day = kyotoDay();
    at(day.alternatives, 0).stopIndex = 99;
    expect(resultOf("alternatives-map", day).findings).toEqual([
      "alternatives[0].stopIndex: 99 is not a stop",
      "stops[0]: no alternatives",
    ]);
  });

  it("fails a stop index that is not a whole number", () => {
    const day = kyotoDay();
    at(day.alternatives, 0).stopIndex = 0.5;
    expect(resultOf("alternatives-map", day).findings).toContain(
      "alternatives[0].stopIndex: 0.5 is not a stop",
    );
  });

  it("fails two sets for one stop", () => {
    const day = kyotoDay();
    at(day.alternatives, 1).stopIndex = 0;
    expect(resultOf("alternatives-map", day).findings).toEqual([
      "alternatives[1].stopIndex: stop 0 already has alternatives",
      "stops[1]: no alternatives",
    ]);
  });

  it("fails a set with no options or too many", () => {
    const day = kyotoDay();
    const first = at(day.alternatives, 0);
    const second = at(day.alternatives, 1);
    second.options = [...second.options, at(first.options, 0)];
    first.options = [];
    expect(resultOf("alternatives-map", day).findings).toEqual([
      "alternatives[0].options: 0 options, expected 1 to 2",
      "alternatives[1].options: 3 options, expected 1 to 2",
    ]);
  });
});

describe("swap direction", () => {
  it("leaves the order of a pair alone", () => {
    const day = kyotoDay();
    at(day.alternatives, 1).options.reverse();
    expect(resultOf("swap-direction", day)).toMatchObject({ passed: true, value: 1, findings: [] });
  });

  it("fails an option at the stop's own energy, and the side it left open", () => {
    const day = kyotoDay();
    at(at(day.alternatives, 1).options, 0).sensory.energy = "calm";
    expect(resultOf("swap-direction", day).findings).toEqual([
      "alternatives[1].options[0]: calm next to a calm stop is the same, which the stop does not take",
      "alternatives[1]: no quieter option next to a calm stop",
    ]);
  });

  it("fails a second option on a side already covered, and a missing side", () => {
    const day = kyotoDay();
    const first = at(day.alternatives, 0);
    const second = at(day.alternatives, 1);
    first.options = [...first.options, at(second.options, 1)];
    second.options = second.options.slice(0, 1);
    expect(resultOf("swap-direction", day).findings).toEqual([
      "alternatives[0].options[1]: balanced next to a reflective stop is livelier, which the stop already has",
      "alternatives[1]: no livelier option next to a calm stop",
    ]);
  });

  it("fails a day whose alternatives sit at their stops' energies", () => {
    const day = kyotoDay();
    for (const set of day.alternatives) {
      const stopEnergy = at(day.stops, set.stopIndex).place.sensory.energy;
      for (const option of set.options) option.sensory.energy = stopEnergy;
    }
    expect(resultOf("swap-direction", day)).toMatchObject({ passed: false, value: 0 });
  });
});

describe("walk radius", () => {
  it(`passes one alternative beyond ${SWAP_RADIUS_METERS} m and fails two`, () => {
    const day = kyotoDay();
    at(at(day.alternatives, 1).options, 0).coordinates.lat += FAR_LATITUDE_STEP;
    const oneFar = resultOf("walk-radius", day);
    expect(oneFar.passed).toBe(true);
    expect(at(oneFar.findings, 0)).toMatch(
      /^alternatives\[1\]\.options\[0\]: \d+ m from its stop, over 800 m$/,
    );

    at(at(day.alternatives, 2).options, 0).coordinates.lat += FAR_LATITUDE_STEP;
    expect(resultOf("walk-radius", day).passed).toBe(false);
  });

  it("scores a day without alternatives as zero", () => {
    const day = kyotoDay();
    day.alternatives = [];
    expect(resultOf("walk-radius", day)).toMatchObject({ passed: false, value: 0 });
    expect(resultOf("swap-direction", day)).toMatchObject({ passed: false, value: 0 });
  });
});

describe("energy fit", () => {
  it("fails a calm day asked for as social", () => {
    const result = resultOf("energy-fit", kyotoDay(), { ...KYOTO_DAY.request, energy: "social" });
    expect(result).toMatchObject({ passed: false, value: 0 });
    expect(at(result.findings, 0)).toBe("stops[0]: reflective, 4 steps from social");
  });
});

describe("day flow", () => {
  it(`fails a day over ${MAX_DAY_FLOW_METERS} m and names its longest leg`, () => {
    const day = kyotoDay();
    const lastStop = at(day.stops, day.stops.length - 1);
    lastStop.place.coordinates.lat += ACROSS_TOWN_LATITUDE_STEP;
    const result = resultOf("day-flow", day);
    expect(result.passed).toBe(false);
    expect(at(result.findings, 0)).toMatch(/the longest leg is stops\[6\] to stops\[7\]/);
  });
});

describe("leg time", () => {
  /** Kyoto's last stop moved about 5.6 km north, across town from the stop before, 45 minutes away. */
  function kyotoWithFarLastStop(): GeneratedDay {
    const day = kyotoDay();
    at(day.stops, day.stops.length - 1).place.coordinates.lat += ACROSS_TOWN_LATITUDE_STEP;
    return day;
  }

  it("passes the curated Kyoto day, whose latest leg is short by a few minutes at most", () => {
    const result = resultOf("leg-time", kyotoDay());

    expect(result.passed).toBe(true);
    expect(result.value).toBeLessThanOrEqual(MAX_LEG_SHORT_MINUTES);
    expect(result.findings).toEqual([]);
  });

  it(`fails a leg on foot short of its gap by more than ${MAX_LEG_SHORT_MINUTES} minutes, and names it`, () => {
    const result = resultOf("leg-time", kyotoWithFarLastStop());

    expect(result.passed).toBe(false);
    expect(result.value).toBeGreaterThan(MAX_LEG_SHORT_MINUTES);
    expect(result.findings).toHaveLength(1);
    expect(at(result.findings, 0)).toMatch(
      /^stops\[6\] to stops\[7\]: \d+ m in 45 min, about \d+ min on foot$/,
    );
  });

  it("reads the visitor's travel word: the same leg by taxi fits its 45 minutes", () => {
    const request: DayRequest = { ...KYOTO_DAY.request, travel: "taxi" };

    expect(resultOf("leg-time", kyotoWithFarLastStop(), request)).toMatchObject({
      passed: true,
      findings: [],
    });
  });

  it("reads a travel word left to ask as walking", () => {
    const day = kyotoWithFarLastStop();
    day.assumptions.travel = null;

    expect(at(resultOf("leg-time", day).findings, 0)).toMatch(/on foot$/);
  });

  it("walks a short leg on a transit day, and rides a long one", () => {
    const { metersPerMinute, waitMinutes } = LEG_PACE.transit;
    const walkPace = LEG_PACE["on-foot"].metersPerMinute;

    expect(legMinutes(300, "transit")).toBe(300 / walkPace);
    expect(legMinutes(6000, "transit")).toBe(waitMinutes + 6000 / metersPerMinute);
  });
});

describe("time words", () => {
  // Kyoto assumes an early start, an early dinner and an early end, and keeps all three.
  it("keeps the curated Kyoto day's early start, early dinner and early end", () => {
    const result = resultOf("time-words", kyotoDay());

    expect(result).toMatchObject({ value: 1, passed: true, findings: [] });
  });

  it("finds a slow start that begins before mid-morning, and passes on two words of three", () => {
    const result = resultOf("time-words", kyotoDay(), { ...KYOTO_DAY.request, start: "slow" });

    expect(result.findings).toEqual([
      'start: "slow", but the first stop starts at 07:30, outside 09:00 to 11:30',
    ]);
    expect(result.value).toBeCloseTo(2 / 3, 10);
    expect(result.passed).toBe(true);
  });

  it("fails a day that misses two of its three words", () => {
    const request: DayRequest = { ...KYOTO_DAY.request, start: "slow", dinner: "late" };

    const result = resultOf("time-words", kyotoDay(), request);

    expect(result.findings).toEqual([
      'start: "slow", but the first stop starts at 07:30, outside 09:00 to 11:30',
      'dinner: "late", but the evening\'s meal starts at 18:00, before 20:30',
    ]);
    expect(result.value).toBeLessThan(MIN_SHARE_TIME_WORDS_KEPT);
    expect(result.passed).toBe(false);
  });

  it("finds an early start that begins late, and an early end that runs late", () => {
    const day = kyotoDay();
    day.assumptions.end = "early";
    at(day.stops, 0).startTime = "09:15";
    at(day.stops, day.stops.length - 1).durationMinutes = 330;

    expect(resultOf("time-words", day).findings).toEqual([
      'start: "early", but the first stop starts at 09:15, after 08:30',
      'end: "early", but the last stop ends at 23:30, after 23:00',
    ]);
  });

  it("finds a dinner word with no meal from five in the evening, a lunch not counting", () => {
    const day = kyotoDay();
    at(day.stops, day.stops.length - 1).place.kind = "walk";

    expect(resultOf("time-words", day).findings).toEqual([
      'dinner: "early", but no meal starts from 17:00',
    ]);
  });

  it("finds an evening end that runs past eight, read as the model assumed it", () => {
    const day = kyotoDay();
    at(day.stops, day.stops.length - 1).durationMinutes = 135;

    expect(resultOf("time-words", day).findings).toEqual([
      'end: "evening", but the last stop ends at 20:15, after 20:00',
    ]);
  });

  it("finds an early dinner that starts after half past seven", () => {
    const day = kyotoDay();
    day.assumptions.end = "early";
    at(day.stops, day.stops.length - 1).startTime = "19:45";

    expect(resultOf("time-words", day).findings).toEqual([
      'dinner: "early", but the evening\'s meal starts at 19:45, after 19:30',
    ]);
  });

  // Four rounds of a calm Kyoto evening ended at 22:40 to 23:50 (`docs/decisions.md`, "The end of
  // the day is said in real hours").
  it("keeps a quiet day's late end from half past eleven, and any other day's past midnight", () => {
    const lateAt = (startTime: string, energy: DayRequest["energy"]) => {
      const day = kyotoDay();
      const last = at(day.stops, day.stops.length - 1);
      last.startTime = startTime;
      last.durationMinutes = 90;
      return resultOf("time-words", day, { ...KYOTO_DAY.request, energy, end: "late" }).findings;
    };

    expect(lateAt("22:15", "calm")).not.toContainEqual(expect.stringContaining("end:"));
    expect(lateAt("22:15", "reflective")).not.toContainEqual(expect.stringContaining("end:"));
    expect(lateAt("21:45", "calm")).toContainEqual(
      'end: "late", but the last stop ends at 23:15, before 23:30, a calm day\'s late end',
    );
    expect(lateAt("22:15", "balanced")).toContainEqual(
      'end: "late", but the last stop ends at 23:45, before midnight',
    );
  });

  it("reads a night past midnight on the running clock", () => {
    const { request, day } = LATE_NIGHT_DAY;

    const result = resultOf("time-words", day, request);

    // Dinner at nine and a bar until four keep "late"; Lantern's own slow start at nine at night does not.
    expect(result.findings).toEqual([
      'start: "slow", but the first stop starts at 21:00, outside 09:00 to 11:30',
    ]);
  });

  it("has nothing to keep when every word is left to ask", () => {
    const day = kyotoDay();
    day.assumptions = { ...day.assumptions, start: null, dinner: null, end: null };

    expect(resultOf("time-words", day)).toMatchObject({ value: 1, passed: true, findings: [] });
  });
});
