import { normalizeDay } from "@/lib/normalizer/normalize";
import {
  ENERGY_LEVELS,
  GeneratedDaySchema,
  type DayRequest,
  type Itinerary,
  swapSidesOf,
} from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";

/**
 * What a day's versions give the energy slider and the quick swap, on the day the visitor
 * sees: the normalizer has dropped a version past the walk or spelled as a stop by then, which
 * the checks, reading the generation, do not see. A move is a stop's way quieter or livelier,
 * one a side, or one toward the middle at an end of the scale; it is reachable when a version
 * on that side stands. Round A found Haiku's days answer fewer than half (`docs/harness.md`).
 */
export interface VersionReach {
  days: number;
  stops: number;
  versions: number;
  /** Stops with no version left: the slider and the swap do nothing there. */
  bareStops: number;
  moves: number;
  reachable: number;
}

export const NO_REACH: VersionReach = {
  days: 0,
  stops: 0,
  versions: 0,
  bareStops: 0,
  moves: 0,
  reachable: 0,
};

export function versionReachOf(itinerary: Itinerary): VersionReach {
  return itinerary.stops.reduce(
    (reach, stop) => {
      const level = ENERGY_LEVELS.indexOf(stop.primary.sensory.energy);
      const sides = swapSidesOf(stop.primary.sensory.energy);
      const reached = sides.filter((side) =>
        stop.alternatives.some(
          (version) => Math.sign(ENERGY_LEVELS.indexOf(version.sensory.energy) - level) === side,
        ),
      );
      return {
        ...reach,
        stops: reach.stops + 1,
        versions: reach.versions + stop.alternatives.length,
        bareStops: reach.bareStops + (stop.alternatives.length === 0 ? 1 : 0),
        moves: reach.moves + sides.length,
        reachable: reach.reachable + reached.length,
      };
    },
    { ...NO_REACH, days: 1 },
  );
}

export function addReach(a: VersionReach, b: VersionReach): VersionReach {
  return {
    days: a.days + b.days,
    stops: a.stops + b.stops,
    versions: a.versions + b.versions,
    bareStops: a.bareStops + b.bareStops,
    moves: a.moves + b.moves,
    reachable: a.reachable + b.reachable,
  };
}

/** A recorded day's reach, from its text as the model wrote it, or null when it shows none. */
export function reachOfOutput(request: DayRequest, outputText: string): VersionReach | null {
  let json: unknown;
  try {
    json = JSON.parse(outputText);
  } catch {
    return null;
  }
  const day = GeneratedDaySchema.safeParse(json);
  if (!day.success) return null;
  const normalized = normalizeDay(request, withLettersUnescaped(day.data));
  return normalized.ok ? versionReachOf(normalized.itinerary) : null;
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "–" : `${part} of ${whole} (${Math.round((part / whole) * 100)}%)`;
}

/** The reach's row of a report: versions a day, stops with none, moves with a version. */
export function reachRow(label: string, reach: VersionReach): string[] {
  const perDay = reach.days === 0 ? "–" : (reach.versions / reach.days).toFixed(1);
  return [
    label,
    String(reach.days),
    perDay,
    percent(reach.bareStops, reach.stops),
    percent(reach.reachable, reach.moves),
  ];
}

export const REACH_HEADER = [
  "",
  "days",
  "versions a day",
  "stops with none",
  "moves with a version",
];
