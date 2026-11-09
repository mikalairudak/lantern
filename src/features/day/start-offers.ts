import { isSameRequest } from "@/lib/days/request";
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
  return QUICK_STARTS.map(({ country, request }) => {
    const written = pool.find((each) => isSameRequest(each.request, request));
    if (!written) throw new Error(`The start for ${country} has no written day`);
    return { country, request, energies: written.energies };
  });
}
