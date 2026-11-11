import { isSameRequest } from "@/lib/days/request";
import { CITY_DAYS, INDEX_REQUESTS } from "@/lib/days/written/city-days";
import { QUICK_STARTS } from "@/lib/days/written/quick-starts";
import type { DayRequest, EnergyLevel } from "@/lib/schema/itinerary.schema";
import type { WrittenGist } from "./day";

/** A quick start as the start screen offers it: its words, and the shape of the day it opens. */
export interface StartOffer {
  /** Said under the day's words, the country its city is in: "Italy". */
  country: string;
  /** The written day the start opens. */
  request: DayRequest;
  /** Each stop's energy as the day shows it, in order: the beads of its shape. */
  energies: readonly EnergyLevel[];
}

/**
 * The quick starts, in the order the start screen offers them, each with the shape of its
 * written day read from the days the page handed over. A start without its day is a fixture
 * out of step with the registry, and says so rather than offer a day that cannot open.
 */
export function startOffersOf(pool: readonly WrittenGist[]): StartOffer[] {
  return QUICK_STARTS.map(({ country, request }) => offerOf(country, request, pool));
}

/** Each written day's country, a start's or a city day's. */
const COUNTRIES: ReadonlyMap<DayRequest, string> = new Map(
  [...QUICK_STARTS, ...CITY_DAYS].map(({ country, request }) => [request, country]),
);

/**
 * The days the start screen's index offers under the first impression (`INDEX_REQUESTS`), in
 * its order, each with its country and the shape of its day, read from the same pool.
 */
export function indexOffersOf(pool: readonly WrittenGist[]): StartOffer[] {
  return INDEX_REQUESTS.map((request) => {
    const country = COUNTRIES.get(request);
    if (country === undefined) throw new Error(`The index's day in ${request.city} has no country`);
    return offerOf(country, request, pool);
  });
}

/** A written day as a line offers it; one missing from the pool is a fixture out of step. */
function offerOf(country: string, request: DayRequest, pool: readonly WrittenGist[]): StartOffer {
  const written = pool.find((each) => isSameRequest(each.request, request));
  if (!written) throw new Error(`The start for ${country} has no written day`);
  return { country, request, energies: written.energies };
}
