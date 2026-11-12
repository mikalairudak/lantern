import { isSameRequest } from "@/lib/days/request";
import { INDEX_REQUESTS } from "@/lib/days/written/city-days";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { WrittenGist } from "./day";

/** A written day as the start screen's index offers it: the request its cell opens. */
export interface StartOffer {
  /** The written day the cell opens. */
  request: DayRequest;
}

/**
 * The days the start screen's index offers (`INDEX_REQUESTS`), in its order, each checked against
 * the days the page handed over. A start without its day is a fixture out of step with the
 * registry, and says so rather than offer a day that cannot open.
 */
export function startOffersOf(pool: readonly WrittenGist[]): StartOffer[] {
  return INDEX_REQUESTS.map((request) => {
    if (!pool.some((each) => isSameRequest(each.request, request))) {
      throw new Error(`The start for ${request.city} has no written day`);
    }
    return { request };
  });
}
