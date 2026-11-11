import { distanceInMeters } from "@/lib/geo/distance";
import { isVisitedInWindow, lightWindowSpan, type MinuteSpan } from "@/lib/geo/light-windows";
import { utcOffsetMinutes } from "@/lib/geo/sun";
import {
  normalizeDay,
  type NormalizeResult,
  type Repair,
  type RepairKind,
} from "@/lib/normalizer/normalize";
import {
  ALTERNATIVES_PER_STOP,
  EARLY_START_BY,
  SLOW_START_FROM,
  SLOW_START_BY,
  EVENING_MEAL_FROM,
  EARLY_DINNER_BY,
  LATE_DINNER_FROM,
  EARLY_END_BY,
  EVENING_END_BY,
  ENERGY_LEVELS,
  QUIET_LATE_END_FROM,
  FACT_KEYS,
  GeneratedDaySchema,
  isAreaKind,
  MAX_DAY_FLOW_METERS,
  MEAL_NAME_TWO_LINES_CHARS,
  noneAsNull,
  SWAP_RADIUS_METERS,
  type AssumableFactKey,
  type DayRequest,
  type EnergyLevel,
  type GeneratedAlternative,
  type GeneratedDay,
  type GeneratedPlace,
  type GeneratedStop,
  type Itinerary,
  type TravelMode,
  swapSidesOf,
} from "@/lib/schema/itinerary.schema";
import { escapedLettersIn, withLettersUnescaped } from "@/lib/stream/escaped-letters";
import {
  formatClock,
  MINUTES_PER_DAY,
  minutesOf,
  parseClock,
  runningSpans,
} from "@/lib/time/clock";
import { findBannedPhrases, phrasesIn } from "./banned-phrases";
import { charactersIn, isPastTwoLines, mealNameFaults } from "./meal-name";
import { formatPath, textsIn } from "./path";
import { isStopIndexOf } from "@/lib/schema/positions";

/**
 * This folder holds pure functions over one generation, which production or an eval round may
 * run on a day. Whatever calls a model, spends money or reads and writes round files lives in
 * `src/eval`, which no non-test module imports (`docs/harness.md`, "Where the code lives").
 *
 * Quality checks for one generated day, run over every fixture and on every live day the log
 * keeps. Hard checks say whether the day is broken; scored checks measure a value and hold it to
 * a threshold. `docs/harness.md` lists them with their reasons.
 */

export type CheckId =
  | "shape"
  | "normalizes"
  | "asked-words"
  | "banned-phrases"
  | "meal-name"
  | "meal-name-lines"
  | "script"
  | "escaped-letters"
  | "alternatives-map"
  | "swap-direction"
  | "repairs"
  | "walk-radius"
  | "energy-fit"
  | "day-flow"
  | "leg-time"
  | "light-sense"
  | "time-words"
  // The live route's place checks (`place-results.ts`), never `runQualityChecks`'.
  | "places-confirmed"
  | "provider-shift"
  | "places-wait"
  // A targeted re-plan's, on what the model wrote and the day it merged into (`replan-checks.ts`).
  | "replan-windows"
  | "replan-word"
  | "replan-time-words"
  | "replan-drops"
  | "replan-gap";

/** One check's result. The intake's checks (`intake-checks.ts`) share the shape with their own ids. */
export interface CheckResult<Id extends string = CheckId> {
  id: Id;
  kind: "hard" | "scored";
  passed: boolean;
  /**
   * What a scored check measured: a share from 0 to 1, meters for day flow, a count for repairs;
   * and the one hard check that counts, the stops a re-plan's merge dropped (`replan-drops`).
   */
  value: number | null;
  /** A minimum share, or the most allowed: meters for day flow, counted repairs for repairs. */
  threshold: number | null;
  /** What failed, each with the path a person can act on. */
  findings: string[];
}

/**
 * The curated days score 1 on walk radius and swap direction, so they set a ceiling, not a
 * threshold. A day of about fifteen alternatives passes with one miss and fails with two. The
 * normalizer drops a far alternative anyway.
 */
export const MIN_SHARE_WITHIN_SWAP_RADIUS = 0.9;
export const MIN_SHARE_SWAP_SIDES_COVERED = 0.9;

/**
 * Calibrated on the curated days. The calm Alicante day keeps six of its eight stops
 * within one step of calm; the market at noon and the bar at nine sit further out.
 */
export const MIN_SHARE_ENERGY_FIT = 0.75;
const ENERGY_FIT_MAX_STEPS = 1;

/**
 * How fast a visitor covers the straight line between two stops, and what a ride costs before
 * it moves, by the travel word. Rough on purpose (`docs/harness.md`, "Leg time, 20
 * minutes"): a walk at about 4.5 km/h over streets a quarter longer than the line; transit at
 * about 15 km/h door to door after ten minutes to reach a stop, wait and change; a taxi at
 * about 18 km/h after five to find one. A leg is walked wherever walking is quicker.
 */
export const LEG_PACE: Readonly<
  Record<TravelMode, { metersPerMinute: number; waitMinutes: number }>
> = {
  "on-foot": { metersPerMinute: 60, waitMinutes: 0 },
  transit: { metersPerMinute: 250, waitMinutes: 10 },
  taxi: { metersPerMinute: 300, waitMinutes: 5 },
};

/**
 * About a quarter of a stop's hour and a quarter: what a visitor can take from the next stop
 * without losing it. On the recorded rounds it fails Sonnet's legs across town and passes its
 * habit of 1.5 to 1.8 km in 10 to 15 minutes (`docs/harness.md`, "Leg time, 20 minutes").
 */
export const MAX_LEG_SHORT_MINUTES = 20;

/**
 * The headline asks about one word of the request at most (`docs/decisions.md`, "The request
 * sentence is the input"). The model may leave more open, and nothing repairs that.
 */
export const MAX_ASKED_WORDS = 1;

/**
 * A proposal: the curated days need no repairs at all. Only repairs that change what a
 * visitor sees count; tidying is listed but not counted.
 */
export const MAX_COUNTED_REPAIRS = 2;

/**
 * Whether each kind of repair is tidying a visitor never sees: space at the ends of a
 * field, a time written "7:30", a fractional minute, a pair in the wrong order, a word
 * named twice in a stop's `dependsOn`. A model that leaves space on ten fields still wrote
 * a day that holds. Every kind is listed, so a new one fails the typecheck until someone
 * decides whether it counts.
 */
const IS_TIDY_REPAIR: Readonly<Record<RepairKind, boolean>> = {
  "trimmed-text": true,
  "reformatted-time": true,
  "rounded-duration": true,
  "sorted-alternatives": true,
  "deduplicated-dependencies": true,
  "trimmed-tags": false,
  "clamped-duration": false,
  "shortened-overlap": false,
  "dropped-stop": false,
  "dropped-alternatives": false,
  "dropped-alternative": false,
  // The visitor loses a swap, as for a far option.
  "dropped-repeat": false,
  // The day was planned on a word the visitor did not choose.
  "kept-choice": false,
  // Lantern's own word said as the day keeps it; the day itself is as written.
  "fitted-end": true,
};

/**
 * The curated days score 1, so this is a proposal: with four to seven stops in a light
 * window, one miss passes and two fail.
 */
export const MIN_SHARE_IN_LIGHT_WINDOW = 0.75;

/**
 * The schema's limits for the start, dinner and end words, in minutes of the day, with margins
 * set on the recorded live days (`docs/harness.md`, "The start, dinner and end words"). A late
 * end is kept past midnight, or from `QUIET_LATE_END_FROM` on a quiet day.
 */
const EARLY_START_LATEST = minutesOf(EARLY_START_BY);
const SLOW_START_EARLIEST = minutesOf(SLOW_START_FROM);
const SLOW_START_LATEST = minutesOf(SLOW_START_BY);
const EVENING_MEAL_EARLIEST = minutesOf(EVENING_MEAL_FROM);
const EARLY_DINNER_LATEST = minutesOf(EARLY_DINNER_BY);
const LATE_DINNER_EARLIEST = minutesOf(LATE_DINNER_FROM);
const EVENING_END_LATEST = minutesOf(EVENING_END_BY);
const EARLY_END_LATEST = minutesOf(EARLY_END_BY);
const LATE_END_EARLIEST = MINUTES_PER_DAY;
const QUIET_LATE_END_EARLIEST = minutesOf(QUIET_LATE_END_FROM);
/** The energies whose late end is kept from `QUIET_LATE_END_FROM`. */
const QUIET_ENERGIES: readonly EnergyLevel[] = ["reflective", "calm"];

/**
 * Calibrated on the curated days, which each miss one word: Alicante's has no dinner under
 * its late dinner, and Lisbon's late dinner is at 20:15. A day of three words passes with
 * one missed and fails with two; of Sonnet's 45 recorded days, one fails.
 */
export const MIN_SHARE_TIME_WORDS_KEPT = 2 / 3;

/**
 * A run of characters outside the two scripts every face carries (`docs/decisions.md`, "One sans in
 * one weight: Fira Sans"). Unicode's Common and Inherited pass: punctuation, digits and symbols
 * that every script shares, and accents set on a letter. So a Japanese full stop or an emoji, which
 * are Common too, passes. The check reads scripts rather than the faces' character sets, which
 * would move with every change of face.
 */
const OUTSIDE_LATIN_AND_CYRILLIC =
  /[^\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]+/gu;

interface PlacedSet {
  setIndex: number;
  stop: GeneratedStop;
  options: GeneratedAlternative[];
}

/** Nothing to measure scores 0, so a day without stops or alternatives cannot pass. */
function share(hits: number, total: number): number {
  return total === 0 ? 0 : hits / total;
}

function energyRank(energy: EnergyLevel): number {
  return ENERGY_LEVELS.indexOf(energy);
}

function describeDirection(direction: number): string {
  if (direction < 0) return "quieter";
  return direction > 0 ? "livelier" : "the same";
}

function meters(value: number): string {
  return `${Math.round(value)} m`;
}

function hardResult(id: CheckId, findings: string[]): CheckResult {
  return {
    id,
    kind: "hard",
    passed: findings.length === 0,
    value: null,
    threshold: null,
    findings,
  };
}

function scoredResult(
  id: CheckId,
  value: number,
  threshold: number,
  passed: boolean,
  findings: string[],
): CheckResult {
  return { id, kind: "scored", passed, value, threshold, findings };
}

/** The alternative sets whose `stopIndex` names a real stop, with where they sit in the day. */
function placedSets(day: GeneratedDay): PlacedSet[] {
  return day.alternatives.flatMap((set, setIndex) => {
    const stop = day.stops[set.stopIndex];
    return stop ? [{ setIndex, stop, options: set.options }] : [];
  });
}

function checkAskedWords(normalized: NormalizeResult): CheckResult {
  // A refused day has no words to read, and it already fails on "normalizes".
  if (!normalized.ok) return hardResult("asked-words", []);
  const { facts } = normalized.itinerary;
  const asked = FACT_KEYS.filter((key) => facts[key].source === "asked");
  const findings =
    asked.length > MAX_ASKED_WORDS
      ? [
          `assumptions: ${asked.length} words asked (${asked.join(", ")}), at most ${MAX_ASKED_WORDS}`,
        ]
      : [];
  return hardResult("asked-words", findings);
}

/** Every place of the day with its path, the stops' and then the options'. */
function placesOf(day: GeneratedDay): { path: string; place: GeneratedPlace }[] {
  return [
    ...day.stops.map(({ place }, index) => ({ path: `stops[${index}].place`, place })),
    ...day.alternatives.flatMap(({ options }, setIndex) =>
      options.map((place, index) => ({
        path: `alternatives[${setIndex}].options[${index}]`,
        place,
      })),
    ),
  ];
}

/** The places to eat or drink around, whose names are copy since day-v4. */
function mealsOf(day: GeneratedDay): { path: string; place: GeneratedPlace }[] {
  return placesOf(day).filter(({ place }) => isAreaKind(place.kind));
}

/** Banned phrases in the day's copy, a meal's name included: other names are proper names. */
function checkBannedPhrases(day: GeneratedDay): CheckResult {
  const hits = [
    ...findBannedPhrases(day),
    ...mealsOf(day).flatMap(({ path, place }) =>
      phrasesIn(place.name).map((phrase) => ({ path: `${path}.name`, phrase })),
    ),
  ];
  return hardResult(
    "banned-phrases",
    hits.map((hit) => `${hit.path}: "${hit.phrase}"`),
  );
}

/**
 * A meal's name says what is eaten there and where, without a word its line says, a venue's
 * word or the city, in no more than three lines on a phone (`meal-name.ts`). A measure, never a
 * failure (`docs/decisions.md`, "Lantern names no restaurant, café or bar"): the share of meal
 * names with nothing wrong, its threshold 0, each fault a finding. As a hard check it failed 29
 * of 36 days on each model in round A, so a failed day said nothing the share does not say
 * better. A day without meals has none to get wrong.
 */
export function checkMealNames(request: DayRequest, day: GeneratedDay): CheckResult {
  const meals = mealsOf(day).map(({ path, place }) => ({
    path,
    name: place.name,
    faults: mealNameFaults(place.name, request.city),
  }));
  const findings = meals.flatMap(({ path, name, faults }) =>
    faults.map((fault) => `${path}.name: "${name}" ${fault}`),
  );
  const faulty = meals.filter(({ faults }) => faults.length > 0).length;
  const value = meals.length === 0 ? 1 : 1 - faulty / meals.length;
  return scoredResult("meal-name", value, 0, true, findings);
}

/**
 * A warning, never a failure: the share of meal names that keep to two lines where a bead
 * stands mid-scale, as they are asked to. Its threshold is 0, so it measures without failing a
 * day; each name past two lines is a finding. A day without meals has none to get wrong.
 */
export function checkMealNameLines(day: GeneratedDay): CheckResult {
  const meals = mealsOf(day);
  const findings = meals.flatMap(({ path, place }) =>
    isPastTwoLines(place.name)
      ? [
          `${path}.name: "${place.name}" runs ${charactersIn(place.name)} characters, past the ${MEAL_NAME_TWO_LINES_CHARS} two lines hold mid-scale`,
        ]
      : [],
  );
  const value = meals.length === 0 ? 1 : 1 - findings.length / meals.length;
  return scoredResult("meal-name-lines", value, 0, true, findings);
}

/** Every generated string, place names included, keeps to Latin and Cyrillic letters. */
function checkScript(day: GeneratedDay): CheckResult {
  const findings = textsIn(day).flatMap(({ path, text }) => {
    const runs = text.match(OUTSIDE_LATIN_AND_CYRILLIC);
    if (!runs) return [];
    return [`${path}: ${runs.map((run) => `"${run}"`).join(", ")} not in Latin or Cyrillic`];
  });
  return hardResult("script", findings);
}

/**
 * No string spells a letter as its escape. A model that escapes "ç" twice writes `\\u00e7`,
 * which parses to the text `\u00e7`. The reader unescapes it before the visitor sees it
 * (`escaped-letters.ts`), so this judges the day as the model wrote it, as `meal-name` does,
 * and fails, so the log counts the days it happens on.
 */
function checkEscapedLetters(written: GeneratedDay): CheckResult {
  const findings = textsIn(written).flatMap(({ path, text }) => {
    const escapes = escapedLettersIn(text);
    return escapes.length === 0 ? [] : [`${path}: "${text}" spells ${escapes.join(", ")} as text`];
  });
  return hardResult("escaped-letters", findings);
}

function checkAlternativesMap(day: GeneratedDay): CheckResult {
  const findings: string[] = [];
  const covered = new Set<number>();
  day.alternatives.forEach((set, setIndex) => {
    const path = formatPath(["alternatives", setIndex]);
    const isStop = isStopIndexOf(set.stopIndex, day.stops.length);
    if (!isStop) findings.push(`${path}.stopIndex: ${set.stopIndex} is not a stop`);
    else if (covered.has(set.stopIndex))
      findings.push(`${path}.stopIndex: stop ${set.stopIndex} already has alternatives`);
    else covered.add(set.stopIndex);
    if (set.options.length === 0 || set.options.length > ALTERNATIVES_PER_STOP) {
      findings.push(
        `${path}.options: ${set.options.length} options, expected 1 to ${ALTERNATIVES_PER_STOP}`,
      );
    }
  });
  day.stops.forEach((_, stopIndex) => {
    if (!covered.has(stopIndex)) findings.push(`stops[${stopIndex}]: no alternatives`);
  });
  return hardResult("alternatives-map", findings);
}

/**
 * Share of the sides the schema asks for, quieter and livelier, that an option covers.
 * The order of the pair is not checked: the curve picks by energy, and the normalizer can
 * sort a pair.
 */
function checkSwapDirection(day: GeneratedDay): CheckResult {
  const findings: string[] = [];
  let slots = 0;
  let covered = 0;
  for (const { setIndex, stop, options } of placedSets(day)) {
    const stopEnergy = stop.place.sensory.energy;
    const expected: number[] = swapSidesOf(stopEnergy);
    const setPath = formatPath(["alternatives", setIndex]);
    const open = [...expected];
    options.forEach((option, n) => {
      const direction = Math.sign(energyRank(option.sensory.energy) - energyRank(stopEnergy));
      const side = open.indexOf(direction);
      if (side >= 0) {
        open.splice(side, 1);
        covered++;
        return;
      }
      const why = expected.includes(direction) ? "already has" : "does not take";
      findings.push(
        `${setPath}.options[${n}]: ${option.sensory.energy} next to a ${stopEnergy} stop is ${describeDirection(direction)}, which the stop ${why}`,
      );
    });
    for (const direction of open) {
      findings.push(
        `${setPath}: no ${describeDirection(direction)} option next to a ${stopEnergy} stop`,
      );
    }
    slots += Math.max(expected.length, options.length);
  }
  const value = share(covered, slots);
  return scoredResult(
    "swap-direction",
    value,
    MIN_SHARE_SWAP_SIDES_COVERED,
    value >= MIN_SHARE_SWAP_SIDES_COVERED,
    findings,
  );
}

/**
 * Share of the options within a swap walk of their stop. A coffee, food or bar place is an
 * area since day-v3, its point the middle of a stretch rather than a door, so for one it
 * measures middle to middle: the visitor's walk from the door they chose can be up to an
 * area's radius (`AREA_RADIUS_METERS` in `src/lib/places/area.ts`) longer or shorter at each
 * end. It still means "the option is a short walk from the stop", and its threshold stays.
 */
function checkWalkRadius(day: GeneratedDay): CheckResult {
  const findings: string[] = [];
  let total = 0;
  let within = 0;
  for (const { setIndex, stop, options } of placedSets(day)) {
    options.forEach((option, n) => {
      total++;
      const distance = distanceInMeters(stop.place.coordinates, option.coordinates);
      if (distance <= SWAP_RADIUS_METERS) within++;
      else {
        const path = formatPath(["alternatives", setIndex, "options", n]);
        findings.push(
          `${path}: ${meters(distance)} from its stop, over ${meters(SWAP_RADIUS_METERS)}`,
        );
      }
    });
  }
  const value = share(within, total);
  return scoredResult(
    "walk-radius",
    value,
    MIN_SHARE_WITHIN_SWAP_RADIUS,
    value >= MIN_SHARE_WITHIN_SWAP_RADIUS,
    findings,
  );
}

function checkEnergyFit(day: GeneratedDay, requestedEnergy: EnergyLevel): CheckResult {
  const findings: string[] = [];
  let fitting = 0;
  day.stops.forEach((stop, stopIndex) => {
    const energy = stop.place.sensory.energy;
    const steps = Math.abs(energyRank(energy) - energyRank(requestedEnergy));
    if (steps <= ENERGY_FIT_MAX_STEPS) fitting++;
    else findings.push(`stops[${stopIndex}]: ${energy}, ${steps} steps from ${requestedEnergy}`);
  });
  const value = share(fitting, day.stops.length);
  return scoredResult(
    "energy-fit",
    value,
    MIN_SHARE_ENERGY_FIT,
    value >= MIN_SHARE_ENERGY_FIT,
    findings,
  );
}

/**
 * Straight-line meters from each stop to the next, summed over the day. A meal's leg runs to
 * and from the middle of its area since day-v3, not its door; summed over a day, the
 * difference is the visitor's choice of door, a few hundred metres at most.
 */
function checkDayFlow(day: GeneratedDay): CheckResult {
  const legs: { from: number; meters: number }[] = [];
  day.stops.forEach((stop, index) => {
    const next = day.stops[index + 1];
    if (next) {
      legs.push({
        from: index,
        meters: distanceInMeters(stop.place.coordinates, next.place.coordinates),
      });
    }
  });
  const total = legs.reduce((sum, leg) => sum + leg.meters, 0);
  const passed = total <= MAX_DAY_FLOW_METERS;
  const longest = legs.reduce((a, b) => (b.meters > a.meters ? b : a), { from: 0, meters: 0 });
  const findings = passed
    ? []
    : [
        `${meters(total)} between stops, over ${meters(MAX_DAY_FLOW_METERS)}; the longest leg is stops[${longest.from}] to stops[${longest.from + 1}], ${meters(longest.meters)}`,
      ];
  return scoredResult("day-flow", total, MAX_DAY_FLOW_METERS, passed, findings);
}

/** The minutes a leg of so many straight-line metres takes by the travel word. */
export function legMinutes(meters: number, travel: TravelMode): number {
  const walk = meters / LEG_PACE["on-foot"].metersPerMinute;
  const { metersPerMinute, waitMinutes } = LEG_PACE[travel];
  return Math.min(walk, waitMinutes + meters / metersPerMinute);
}

/**
 * The most minutes any leg's gap falls short of the travel it needs: the prompt's "with time
 * to get between them", which `day-flow` cannot see, as it adds the distances and reads no
 * clock. A day passes when the latest leg is short by no more than the threshold, the time a
 * visitor can take from the next stop. The travel word is the visitor's, or else the model's
 * assumption; one left to ask reads as walking, since nothing faster was promised. A gap the
 * stops overlap into counts as none: the normalizer shortens the overlap and counts that
 * repair itself.
 */
function checkLegTime(request: DayRequest, day: GeneratedDay): CheckResult {
  const travel = request.travel ?? day.assumptions.travel ?? "on-foot";
  const by = travel === "on-foot" ? "on foot" : `by ${travel}`;
  const visits = runningVisits(day.stops);
  const findings: string[] = [];
  let mostShort = 0;
  day.stops.forEach((stop, index) => {
    const next = day.stops[index + 1];
    const visit = visits[index];
    const nextVisit = visits[index + 1];
    if (!next || !visit || !nextVisit) return;
    const legMeters = distanceInMeters(stop.place.coordinates, next.place.coordinates);
    const gap = Math.max(0, nextVisit.from - visit.to);
    const needed = Math.round(legMinutes(legMeters, travel));
    const short = needed - gap;
    mostShort = Math.max(mostShort, short);
    if (short > MAX_LEG_SHORT_MINUTES) {
      findings.push(
        `stops[${index}] to stops[${index + 1}]: ${meters(legMeters)} in ${gap} min, about ${needed} min ${by}`,
      );
    }
  });
  return scoredResult(
    "leg-time",
    mostShort,
    MAX_LEG_SHORT_MINUTES,
    mostShort <= MAX_LEG_SHORT_MINUTES,
    findings,
  );
}

function checkRepairs(repairs: readonly Repair[]): CheckResult {
  const counted = repairs.filter((repair) => !IS_TIDY_REPAIR[repair.kind]).length;
  const findings = repairs.map((repair) => {
    const tidy = IS_TIDY_REPAIR[repair.kind] ? " (tidy, not counted)" : "";
    return `${formatPath(repair.path)}: ${repair.kind}${tidy}, ${repair.note}`;
  });
  return scoredResult(
    "repairs",
    counted,
    MAX_COUNTED_REPAIRS,
    counted <= MAX_COUNTED_REPAIRS,
    findings,
  );
}

/**
 * Each stop's visit in minutes from the day's midnight, running on past it as the
 * itinerary's do, or null for a stop whose start is not a time. A start is a time when
 * `parseClock` reads it, as the normalizer's is: those it does not ("dawn", "24:30") are left
 * out of the count, as the normalizer drops them, so a night stop after one still lands after
 * midnight. The rest are counted at the time the normalizer writes them.
 */
function runningVisits(stops: GeneratedDay["stops"]): (MinuteSpan | null)[] {
  const clocks = stops.map((stop) => parseClock(stop.startTime));
  const readable = stops.flatMap((stop, index) => {
    const clock = clocks[index];
    if (clock === null || clock === undefined) return [];
    return [{ startTime: formatClock(clock), durationMinutes: stop.durationMinutes }];
  });
  const spans = runningSpans(readable);
  let next = 0;
  return clocks.map((clock) => (clock === null ? null : (spans[next++] ?? null)));
}

/** Share of the stops with a best light window that are visited in it. */
export function checkLightSense(request: DayRequest, day: GeneratedDay): CheckResult {
  const offset = utcOffsetMinutes(request.timezone, request.date);
  const visits = runningVisits(day.stops);
  const findings: string[] = [];
  let windowed = 0;
  let inside = 0;
  day.stops.forEach((stop, stopIndex) => {
    const window = noneAsNull(stop.place.light.bestWindow);
    if (window === null) return;
    windowed++;
    const visit = visits[stopIndex];
    if (!visit) {
      findings.push(`stops[${stopIndex}].startTime: "${stop.startTime}" is not a time`);
      return;
    }
    const visited = `visited ${formatClock(visit.from)} to ${formatClock(visit.to)}`;
    const context = {
      position: stop.place.coordinates,
      date: request.date,
      utcOffsetMinutes: offset,
    };
    const span = lightWindowSpan(context, window);
    if (!span) {
      findings.push(`stops[${stopIndex}]: no ${window} light on ${request.date}, ${visited}`);
      return;
    }
    if (isVisitedInWindow(visit, span)) inside++;
    else {
      findings.push(
        `stops[${stopIndex}]: ${window} light is ${formatClock(span.from)} to ${formatClock(span.to)}, ${visited}`,
      );
    }
  });
  // A day where light matters nowhere, all museums and dinners, has nothing to get wrong.
  const value = windowed === 0 ? 1 : inside / windowed;
  return scoredResult(
    "light-sense",
    value,
    MIN_SHARE_IN_LIGHT_WINDOW,
    value >= MIN_SHARE_IN_LIGHT_WINDOW,
    findings,
  );
}

interface TimedVisit {
  kind: GeneratedPlace["kind"];
  from: number;
  to: number;
}

/**
 * How a word is held to the day's hours. "promised": as the prompt asks the model for it, the
 * visitor's words and the model's own as it wrote them, so a late end runs past midnight, or from
 * `QUIET_LATE_END_FROM` on a quiet day. "said": as the headline says it to the visitor, for an end
 * Lantern fitted to the day's hours (`endKeptBy`), so "out late" is kept by any end after eleven,
 * the fit's own line, and a check never fails a day on the end Lantern itself gave it.
 */
type WordReading = "promised" | "said";

/** What a day's hours miss of one word, read as `reading` says, or null when they keep it. */
type TimeWordMiss = (
  value: string,
  visits: readonly TimedVisit[],
  energy: EnergyLevel | null,
  reading: WordReading,
) => string | null;

function startMiss(start: string, visits: readonly TimedVisit[]): string | null {
  const first = visits[0];
  if (!first) return null;
  const at = formatClock(first.from);
  if (start === "early" && first.from > EARLY_START_LATEST) {
    return `start: "early", but the first stop starts at ${at}, after ${formatClock(EARLY_START_LATEST)}`;
  }
  const isMidMorning = first.from >= SLOW_START_EARLIEST && first.from <= SLOW_START_LATEST;
  if (start === "slow" && !isMidMorning) {
    return `start: "slow", but the first stop starts at ${at}, outside ${formatClock(SLOW_START_EARLIEST)} to ${formatClock(SLOW_START_LATEST)}`;
  }
  return null;
}

function dinnerMiss(dinner: string, visits: readonly TimedVisit[]): string | null {
  const meal = visits.find((visit) => visit.kind === "food" && visit.from >= EVENING_MEAL_EARLIEST);
  if (!meal)
    return `dinner: "${dinner}", but no meal starts from ${formatClock(EVENING_MEAL_EARLIEST)}`;
  const at = formatClock(meal.from);
  if (dinner === "early" && meal.from > EARLY_DINNER_LATEST) {
    return `dinner: "early", but the evening's meal starts at ${at}, after ${formatClock(EARLY_DINNER_LATEST)}`;
  }
  if (dinner === "late" && meal.from < LATE_DINNER_EARLIEST) {
    return `dinner: "late", but the evening's meal starts at ${at}, before ${formatClock(LATE_DINNER_EARLIEST)}`;
  }
  return null;
}

function endMiss(
  end: string,
  visits: readonly TimedVisit[],
  energy: EnergyLevel | null,
  reading: WordReading,
): string | null {
  const last = visits.at(-1);
  if (!last) return null;
  const at = formatClock(last.to);
  if (end === "evening" && last.to > EVENING_END_LATEST) {
    return `end: "evening", but the last stop ends at ${at}, after ${formatClock(EVENING_END_LATEST)}`;
  }
  if (end === "early" && last.to > EARLY_END_LATEST) {
    return `end: "early", but the last stop ends at ${at}, after ${formatClock(EARLY_END_LATEST)}`;
  }
  if (end === "late" && reading === "said") {
    return last.to > EARLY_END_LATEST
      ? null
      : `end: "late", but the last stop ends at ${at}, by ${formatClock(EARLY_END_LATEST)}`;
  }
  // Promised, a quiet day's late evening is kept from half past eleven (`docs/decisions.md`, "The
  // end of the day is said in real hours").
  const isQuiet = energy !== null && QUIET_ENERGIES.includes(energy);
  if (end === "late" && isQuiet && last.to < QUIET_LATE_END_EARLIEST) {
    return `end: "late", but the last stop ends at ${at}, before ${formatClock(QUIET_LATE_END_EARLIEST)}, a ${energy} day's late end`;
  }
  if (end === "late" && !isQuiet && last.to < LATE_END_EARLIEST) {
    return `end: "late", but the last stop ends at ${at}, before midnight`;
  }
  return null;
}

/** The words that set a day's hours, each with what its hours miss of it. */
const TIME_WORD_MISSES: readonly { key: "start" | "dinner" | "end"; miss: TimeWordMiss }[] = [
  { key: "start", miss: startMiss },
  { key: "dinner", miss: dinnerMiss },
  { key: "end", miss: endMiss },
];

/** Each stop's visit in running minutes, with its kind, as the visitor is shown the day. */
function visitsOf({ stops }: Itinerary): TimedVisit[] {
  return runningSpans(stops).flatMap((span, index): TimedVisit[] => {
    const stop = stops[index];
    return stop ? [{ ...span, kind: stop.primary.kind }] : [];
  });
}

/**
 * What a day's hours miss of one of its start, dinner and end words, or null when they keep it,
 * when the word is left to ask, or when it sets no hours. A targeted re-plan holds its changed
 * word to it (`replan-word`), and every other word that sets hours (`replan-time-words`). A word
 * the visitor chose is read as promised; one Lantern assumed, which the normalizer fitted to the
 * day's hours, as the headline says it (`WordReading`).
 */
export function timeWordMissOf(itinerary: Itinerary, key: AssumableFactKey): string | null {
  const word = TIME_WORD_MISSES.find((each) => each.key === key);
  const { value, source } = itinerary.facts[key];
  if (word === undefined || value === null) return null;
  const reading = source === "assumed" ? "said" : "promised";
  return word.miss(value, visitsOf(itinerary), itinerary.facts.energy.value, reading);
}

/**
 * Share of the day's start, dinner and end words, chosen or assumed, that its hours keep, read
 * on the day as the visitor is shown it. The words are the ones the model planned on, the
 * visitor's or its own assumptions as it wrote them: an end the normalizer fitted to the hours
 * (`fitted-end`) is what the headline says, and would always pass. A word left to ask has
 * nothing to keep; a targeted re-plan holds each word to its hours instead, not a share,
 * through `timeWordMissOf`.
 */
function checkTimeWords(
  normalized: NormalizeResult,
  request: DayRequest,
  assumptions: GeneratedDay["assumptions"],
): CheckResult {
  // A refused day has no hours to read, and it already fails on "normalizes".
  if (!normalized.ok) return scoredResult("time-words", 1, MIN_SHARE_TIME_WORDS_KEPT, true, []);
  const { facts } = normalized.itinerary;
  const visits = visitsOf(normalized.itinerary);
  const kept = TIME_WORD_MISSES.flatMap(({ key, miss }) => {
    const value = request[key] ?? assumptions[key];
    return value === null ? [] : [{ value, miss }];
  });
  const energy = facts.energy.value;
  const findings = kept.flatMap(({ value, miss }) => miss(value, visits, energy, "promised") ?? []);
  const value = kept.length === 0 ? 1 : share(kept.length - findings.length, kept.length);
  return scoredResult(
    "time-words",
    value,
    MIN_SHARE_TIME_WORDS_KEPT,
    value >= MIN_SHARE_TIME_WORDS_KEPT,
    findings,
  );
}

/**
 * Runs every check on one model output for the request it answers. `request` must already
 * have parsed, as the normalizer requires; `output` is unknown because a live generation
 * is not trusted until it parses. If the shape fails, only the shape result comes back:
 * the other checks have nothing to read.
 */
export function runQualityChecks(request: DayRequest, output: unknown): CheckResult[] {
  const parsed = GeneratedDaySchema.safeParse(output);
  if (!parsed.success) {
    const findings = parsed.error.issues.map(
      (issue) => `${formatPath(issue.path) || "day"}: ${issue.message}`,
    );
    return [hardResult("shape", findings)];
  }
  const written = parsed.data;
  // Scored as the visitor is shown it; only `escaped-letters` reads the day as written.
  const day = withLettersUnescaped(written);
  const normalized = normalizeDay(request, day);
  return [
    hardResult("shape", []),
    hardResult("normalizes", normalized.ok ? [] : [normalized.reason]),
    checkAskedWords(normalized),
    checkBannedPhrases(day),
    checkMealNames(request, day),
    checkMealNameLines(day),
    checkScript(day),
    checkEscapedLetters(written),
    checkAlternativesMap(day),
    checkSwapDirection(day),
    checkRepairs(normalized.repairs),
    checkWalkRadius(day),
    checkEnergyFit(day, request.energy),
    checkDayFlow(day),
    checkLegTime(request, day),
    checkLightSense(request, day),
    checkTimeWords(normalized, request, day.assumptions),
  ];
}
