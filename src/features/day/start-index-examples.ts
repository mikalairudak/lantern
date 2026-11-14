import { ELCHE_REQUEST } from "@/lib/fixtures/replan/elche-dinner";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { startOffersOf, type StartOffer } from "./start-offers";
import { writtenPool } from "./written-pool";

/** A start as the index offers it, for a city and the words its day was asked with. */
function offerOf(words: Partial<DayRequest> & Pick<DayRequest, "city" | "timezone">): StartOffer {
  return {
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
  };
}

/**
 * The eight cities with an engraving, as the index offers them (`startOffersOf`): Madrid's start
 * and the seven city days, each with its own words, a gist of one line and of two.
 */
export const DRAWN_STARTS: readonly StartOffer[] = startOffersOf(writtenPool());

/**
 * A city with no picture, among drawn ones: Lisbon, which has none. Its cell keeps its caption
 * on the row's line with nothing over it.
 */
export const UNDRAWN_START: StartOffer = offerOf({
  city: "Lisbon",
  timezone: "Europe/Lisbon",
  company: "friends",
});

/**
 * A cell at the index's extremes: production's Elche day, its city named "Elx / Elche" and its
 * day in many words, so its caption wraps beside a drawn city's and the row keeps one line.
 */
export const LONG_START: StartOffer = { request: ELCHE_REQUEST };

/**
 * A city whose name sets on two lines in a phone's cell: the lab draws it over a plate, so the
 * light can be seen to stand clear of a name that wraps. No written day is for it.
 */
export const WRAPPING_START: StartOffer = offerOf({
  city: "Santiago de Compostela",
  timezone: "Europe/Madrid",
  company: "friends",
});
