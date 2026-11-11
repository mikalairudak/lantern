import { ELCHE_REQUEST } from "@/lib/fixtures/replan/elche-dinner";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { indexOffersOf, type StartOffer } from "./start-offers";
import { writtenPool } from "./written-pool";

/** A start as the index offers it, for a city and the words its day was asked with. */
function offerOf(
  country: string,
  words: Partial<DayRequest> & Pick<DayRequest, "city" | "timezone">,
): StartOffer {
  return {
    country,
    request: {
      date: "2026-11-14",
      citySource: "chosen",
      energy: "balanced",
      energySource: "chosen",
      travel: "on-foot",
      start: null,
      dinner: null,
      end: null,
      company: null,
      ...words,
    },
    energies: ["calm", "balanced", "lively"],
  };
}

/**
 * The eight cities with an engraving, as the index offers them (`indexOffersOf`): Madrid's start
 * and the seven city days, each with its own words and day's shape, a gist of one line and of two.
 */
export const DRAWN_STARTS: readonly StartOffer[] = indexOffersOf(writtenPool());

/**
 * A city with no picture, among drawn ones: Lisbon, which has none. Its cell keeps its caption
 * on the row's line with nothing over it.
 */
export const UNDRAWN_START: StartOffer = offerOf("Portugal", {
  city: "Lisbon",
  timezone: "Europe/Lisbon",
  company: "friends",
});

/**
 * A cell at the index's extremes: production's Elche day, its city named "Elx / Elche" and its
 * day in many words, so its caption wraps beside a drawn city's and the row keeps one line.
 */
export const LONG_START: StartOffer = {
  country: "Spain, the Valencian Community",
  request: ELCHE_REQUEST,
  energies: ["calm", "balanced", "balanced", "lively", "calm"],
};
