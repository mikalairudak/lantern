import type { PlaceKind } from "@/lib/schema/itinerary.schema";
import { runningSpans } from "@/lib/time/clock";
import { candidatesOf, plannedPlace, versionOf } from "./curve";
import { hasEnergy, type StopDraft } from "./day-draft";
import { DINNER_FROM, LUNCH_FROM, mealAt } from "./meal";

/**
 * The clause the curve adds to the headline: how the day on screen differs from the one
 * the model planned, in the day's own words ("livelier at lunch"). The visitor's energy
 * word is never rewritten; the clause sits beside it. Code derives it from each stop's
 * time, its planned kind and the direction of the version it shows.
 */

export type Direction = "quieter" | "livelier";

/** One stop as the headline reads it. */
export interface StopChange {
  /** When the stop starts, in minutes on the day's running clock, past midnight running on. */
  start: number;
  /** The kind of the place the model planned, which names its part of the day. */
  kind: PlaceKind | undefined;
  /** How the version shown differs from the plan; null while it shows the plan. */
  direction: Direction | null;
}

interface Group {
  direction: Direction;
  part: string;
}

const MINUTES_PER_HOUR = 60;
const AFTERNOON_FROM = 12 * MINUTES_PER_HOUR;
const MIDNIGHT = 24 * MINUTES_PER_HOUR;

/** Kinds of place that can be breakfast. */
const BREAKFAST_KINDS: ReadonlySet<PlaceKind | undefined> = new Set(["food", "coffee"]);

/**
 * "at lunch", "in the evening": where a stop sits in the day, a meal as its row names it
 * (`mealAt`). Past midnight the day's clock runs on, so a stop there is late at night,
 * never the morning.
 */
function partOfDay(start: number, kind: PlaceKind | undefined): string {
  if (start >= MIDNIGHT) return "late at night";
  if (BREAKFAST_KINDS.has(kind) && start < LUNCH_FROM) return "at breakfast";
  if (kind === "food") {
    const meal = mealAt(start);
    return meal === "snack" ? "in the afternoon" : `at ${meal}`;
  }
  if (start < AFTERNOON_FROM) return "in the morning";
  if (start < DINNER_FROM) return "in the afternoon";
  return "in the evening";
}

/**
 * The changed stops in order, neighbours with the same direction and part of the day
 * merged. A stop that shows the plan does not separate two changes.
 */
function groupsOf(changes: readonly StopChange[]): Group[] {
  return changes.reduce<Group[]>((groups, { start, kind, direction }) => {
    if (direction === null) return groups;
    const part = partOfDay(start, kind);
    const last = groups.at(-1);
    if (last?.direction === direction && last.part === part) return groups;
    return [...groups, { direction, part }];
  }, []);
}

function phraseOf({ direction, part }: Group): string {
  return `${direction} ${part}`;
}

/** Two groups joined with "and", a shared direction or part of the day said once. */
function pairOf(first: Group, second: Group): string {
  if (first.direction === second.direction) return `${phraseOf(first)} and ${second.part}`;
  if (first.part === second.part) return `${first.direction} and ${second.direction} ${first.part}`;
  return `${phraseOf(first)} and ${phraseOf(second)}`;
}

/** "quieter", "livelier" or "quieter and livelier": the directions among the groups. */
function directionsIn(groups: readonly Group[]): string {
  const isQuieter = groups.some((group) => group.direction === "quieter");
  const isLivelier = groups.some((group) => group.direction === "livelier");
  if (isQuieter && isLivelier) return "quieter and livelier";
  return isQuieter ? "quieter" : "livelier";
}

/** The clause for a day's changes, or null when it shows the plan. */
export function clauseOf(changes: readonly StopChange[]): string | null {
  const groups = groupsOf(changes);
  const [first, second] = groups;
  if (!first) return null;
  if (!second) return phraseOf(first);
  if (groups.length === 2) return pairOf(first, second);
  return `${directionsIn(groups)} in places`;
}

/** Each stop's change, given the candidate each one shows. */
export function changesOf(stops: readonly StopDraft[], shown: readonly number[]): StopChange[] {
  const visits = runningSpans(stops);
  return stops.map((stop, index) => {
    const planned = plannedPlace(stop);
    const change = { start: visits[index]?.from ?? 0, kind: planned.kind, direction: null };
    const place = candidatesOf(stop)[shown[index] ?? -1];
    if (!hasEnergy(stop) || !place?.sensory?.energy) return change;
    const version = versionOf(stop, { id: place.id, sensory: { energy: place.sensory.energy } });
    return version === "quieter" || version === "livelier"
      ? { ...change, direction: version }
      : change;
  });
}

/** The directions a stop can take from its plan, plus null for the plan itself. */
function directionsOf(stop: StopDraft): (Direction | null)[] {
  if (!hasEnergy(stop)) return [null];
  const versions = stop.alternatives.map((place) => versionOf(stop, place));
  const directions = (["quieter", "livelier"] as const).filter((direction) =>
    versions.includes(direction),
  );
  return [null, ...directions];
}

/**
 * Every clause the day's versions can produce, once each. The header reserves room for the
 * tallest, so the chart below never moves when one appears. It tries each combination of
 * directions, at most three per stop, which is a few thousand for a day of eight stops.
 */
export function possibleClauses(stops: readonly StopDraft[]): string[] {
  const combinations = stops.reduce<(Direction | null)[][]>(
    (sofar, stop) =>
      sofar.flatMap((prefix) => directionsOf(stop).map((direction) => [...prefix, direction])),
    [[]],
  );
  const visits = runningSpans(stops);
  const clauses = combinations.map((directions) =>
    clauseOf(
      stops.map((stop, index) => ({
        start: visits[index]?.from ?? 0,
        kind: plannedPlace(stop).kind,
        direction: directions[index] ?? null,
      })),
    ),
  );
  return [...new Set(clauses.filter((clause) => clause !== null))];
}
