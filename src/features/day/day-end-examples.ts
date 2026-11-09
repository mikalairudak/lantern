import { candidatesOf } from "@/features/abacus/curve";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { CROWDED_DAY, LATE_NIGHT_DAY, MINIMAL_DAY } from "@/lib/fixtures/edge/edge-days";
import { START_PLACE_CHECKS } from "@/lib/days/written/checks";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { DayRequest, GeneratedDay, Itinerary } from "@/lib/schema/itinerary.schema";
import { placeCheckOf } from "@/lib/stream/place-checks";

/**
 * The days the line under a finished day is set over in the lab and its tests: real fixture
 * days, normalized as the page draws them, each named for the edge it sits on. A plain module,
 * not a client one, since the lab's server page reads the matrix's axes.
 */

/** A day as the page ends it: the normalized day, its checks, its picks and its address. */
export interface DayEndExample {
  label: string;
  day: Itinerary;
  /** Which version each stop shows; the model's pick where left out. */
  shown: readonly number[];
  checks: PlaceChecks;
  address: string | null;
  isCut: boolean;
}

function normalized(request: DayRequest, day: GeneratedDay): Itinerary {
  const result = normalizeDay(request, day);
  if (!result.ok) throw new Error(`A lab day did not normalize: ${result.reason}`);
  return result.itinerary;
}

/** Each stop showing the version the model picked, by its place among its versions. */
export function writtenPicksOf(day: Itinerary): number[] {
  return day.stops.map((stop) =>
    candidatesOf(stop).findIndex((place) => place.id === stop.selectedPlaceId),
  );
}

const KANAZAWA = normalized(KANAZAWA_START_DAY.request, KANAZAWA_START_DAY.day);

/** Kanazawa's places checked as its run checked them, as the page has them. */
export const KANAZAWA_CHECKS: PlaceChecks = Object.fromEntries(
  Object.entries(START_PLACE_CHECKS[KANAZAWA.city] ?? {}).map(([id, result]) => [
    id,
    placeCheckOf(id, result),
  ]),
);

const KYOTO = normalized(KYOTO_DAY.request, KYOTO_DAY.day);
const CROWDED = normalized(CROWDED_DAY.request, CROWDED_DAY.day);
const LATE_NIGHT = normalized(LATE_NIGHT_DAY.request, LATE_NIGHT_DAY.day);
const MINIMAL = normalized(MINIMAL_DAY.request, MINIMAL_DAY.day);

/** Kanazawa with its first stop that has another version showing that one instead. */
function swappedKanazawa(): readonly number[] {
  const picks = writtenPicksOf(KANAZAWA);
  const at = KANAZAWA.stops.findIndex((stop) => stop.alternatives.length > 0);
  return picks.map((pick, index) => (index === at ? (pick === 0 ? 1 : 0) : pick));
}

/** Every place Kyoto shows, looked up and not confirmed: a day the map knew none of. */
const KYOTO_NONE_FOUND: PlaceChecks = Object.fromEntries(
  KYOTO.stops.map((stop) => [
    stop.selectedPlaceId,
    { placeId: stop.selectedPlaceId, state: "unconfirmed" } as const,
  ]),
);

/** Kanazawa with one place still being looked up as the day ends. */
const KANAZAWA_STILL_CHECKING: PlaceChecks = {
  ...KANAZAWA_CHECKS,
  [KANAZAWA.stops.at(-1)!.selectedPlaceId]: {
    placeId: KANAZAWA.stops.at(-1)!.selectedPlaceId,
    state: "checking",
  },
};

function example(
  label: string,
  day: Itinerary,
  change: Partial<Omit<DayEndExample, "label" | "day">> = {},
): DayEndExample {
  return {
    label,
    day,
    shown: writtenPicksOf(day),
    checks: {},
    address: `/day/${day.city.toLowerCase()}`,
    isCut: false,
    ...change,
  };
}

export const DAY_END_EXAMPLES: readonly DayEndExample[] = [
  example("a quick start, its places checked", KANAZAWA, { checks: KANAZAWA_CHECKS }),
  example("a version swapped in: the way and the count follow it", KANAZAWA, {
    checks: KANAZAWA_CHECKS,
    shown: swappedKanazawa(),
  }),
  example("one stop: no way between places", MINIMAL),
  example("twelve stops, past the route's nine waypoints", CROWDED),
  example("past midnight, on the next day's clock", LATE_NIGHT),
  example("written by hand: no checks, the model's own points", KYOTO),
  example("every place looked up, none found", KYOTO, { checks: KYOTO_NONE_FOUND }),
  example("a place still being looked up", KANAZAWA, { checks: KANAZAWA_STILL_CHECKING }),
  example("cut in its swaps: its link alone", KANAZAWA, { checks: KANAZAWA_CHECKS, isCut: true }),
  example("no address of its own: no link to send", KANAZAWA, {
    checks: KANAZAWA_CHECKS,
    address: null,
  }),
  example("cut, with no address: nothing to take along", KANAZAWA, {
    checks: KANAZAWA_CHECKS,
    isCut: true,
    address: null,
  }),
];
