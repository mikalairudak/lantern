import { ELCHE_REQUEST } from "@/lib/fixtures/replan/elche-dinner";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { StartOffer } from "./start-offers";

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
 * The eight cities with an engraving, Madrid as the start screen offers it and the seven as their
 * days are asked, so the index shows every picture it ships, a short gist of one line and of two.
 */
export const DRAWN_STARTS: readonly StartOffer[] = [
  offerOf({
    city: "Paris",
    timezone: "Europe/Paris",
    date: "2026-11-15",
    energy: "calm",
    start: "slow",
  }),
  offerOf({ city: "Tokyo", timezone: "Asia/Tokyo", energy: "lively", start: "early" }),
  offerOf({ city: "Rome", timezone: "Europe/Rome", dinner: "late", company: "family" }),
  offerOf({
    city: "New York",
    timezone: "America/New_York",
    energy: "lively",
    end: "late",
  }),
  offerOf({
    city: "Amsterdam",
    timezone: "Europe/Amsterdam",
    date: "2026-11-15",
    energy: "calm",
  }),
  offerOf({
    city: "Barcelona",
    timezone: "Europe/Madrid",
    energy: "lively",
    dinner: "late",
  }),
  offerOf({
    city: "Seoul",
    timezone: "Asia/Seoul",
    date: "2026-11-13",
    end: "late",
  }),
  { request: MADRID_START_REQUEST },
];

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
