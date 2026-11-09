import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { MINUTES_PER_DAY, minutesOf } from "@/lib/time/clock";
import { daySummaryOf, placesFoundOf, type DaySummary } from "./day-end";
import { dayWalkRouteOf, type WalkRoute } from "./walk-route";

/**
 * What the line under a finished day says (`DayEnd`): when the day ends in words, how many
 * stops and how far, how many of its places the map found, and the route's label. A plain
 * module, so the lab's matrix and the tests read the same words as the page. Only numbers
 * and Lantern's own words: no name or line the model wrote.
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_STEP = 5;
const HALF_HOUR = 30;
const QUARTER_HOUR = 15;
const HOURS_ON_A_CLOCK = 12;
const NOON = 12;
/** A space a line never breaks at, so a count keeps its unit: "8 stops", "6.2 km". */
const TIED = " ";

const HOUR_NAMES = [
  "twelve",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
] as const;

/** Minutes either side of the hour, as a clock is read aloud: five to twenty-five. */
const MINUTE_NAMES: Readonly<Record<number, string>> = {
  5: "five",
  10: "ten",
  20: "twenty",
  25: "twenty-five",
};

/** An hour as it is said beside "past" or "to": "seven", and "midnight" for the day's end. */
function hourBeside(hour: number): string {
  return hour % HOURS_ON_A_CLOCK === 0 && hour !== NOON
    ? "midnight"
    : HOUR_NAMES[hour % HOURS_ON_A_CLOCK]!;
}

/**
 * "half past seven", "quarter to eight", "eleven", "midnight": a clock as a person says it,
 * on the five minutes at or after it, so "home by" is never earlier than the day ends. A
 * time after midnight on the day's clock, other than midnight itself, is "in the morning".
 */
export function clockWordsOf(clock: string, isPastMidnight = false): string {
  const minutes = Math.ceil(minutesOf(clock) / MINUTES_STEP) * MINUTES_STEP;
  const hour = Math.floor(minutes / MINUTES_PER_HOUR) % (MINUTES_PER_DAY / MINUTES_PER_HOUR);
  const past = minutes % MINUTES_PER_HOUR;
  const next = (hour + 1) % (MINUTES_PER_DAY / MINUTES_PER_HOUR);
  let words: string;
  if (past === 0) words = hour === NOON ? "noon" : hourBeside(hour);
  else if (past === QUARTER_HOUR) words = `quarter past ${hourBeside(hour)}`;
  else if (past === HALF_HOUR) words = `half past ${hourBeside(hour)}`;
  else if (past === MINUTES_PER_HOUR - QUARTER_HOUR) words = `quarter to ${hourBeside(next)}`;
  else if (past < HALF_HOUR) words = `${MINUTE_NAMES[past]} past ${hourBeside(hour)}`;
  else words = `${MINUTE_NAMES[MINUTES_PER_HOUR - past]} to ${hourBeside(next)}`;
  return isPastMidnight && !words.includes("midnight") ? `${words} in the morning` : words;
}

/**
 * "Home by half past seven · 8 stops · about 6.2 km on foot": the count and the distance each
 * whole on a line, and each dot on the line of the words after it, never left at a line's end.
 */
export function summaryLineOf(summary: DaySummary): string {
  const home = `Home by ${clockWordsOf(summary.endsAt, summary.isPastMidnight)}`;
  const stops = `${summary.stops}${TIED}${summary.stops === 1 ? "stop" : "stops"}`;
  const distance = summary.distanceLine?.replaceAll(" ", TIED);
  return [home, stops, distance].filter(Boolean).join(` ·${TIED}`);
}

/** What the route's link says: the whole day, or as far as the map takes it. */
export function routeLabelOf(route: WalkRoute): string {
  return route.included < route.total
    ? `Walk the first ${route.included}${TIED}stops in Google Maps`
    : "Walk it in Google Maps";
}

/** The day's end as the line says it. */
export interface DayEndWords {
  /** "19:30": when the last stop ends, on the clock. */
  endsAt: string;
  /** "Home by half past seven · 8 stops · about 6.2 km on foot". */
  summary: string;
  /** "7 of 8 places found on OpenStreetMap", or null for a day with no checks to count. */
  found: string | null;
  /** The walking route through the places shown, or null for a day of one stop. */
  route: WalkRoute | null;
}

/**
 * The day's end for the places it shows: the normalized day only, never a frame of its stream,
 * so every word comes from what the normalizer kept.
 */
export function dayEndWordsOf(
  day: Itinerary,
  shown: readonly number[],
  checks: PlaceChecks,
): DayEndWords {
  const summary = daySummaryOf(day.stops, shown, day.facts.travel.value, checks);
  return {
    endsAt: summary.endsAt,
    summary: summaryLineOf(summary),
    found: placesFoundOf(day.stops, shown, checks)?.line ?? null,
    route: dayWalkRouteOf(day.stops, shown, checks),
  };
}
