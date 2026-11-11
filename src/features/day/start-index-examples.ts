import { ELCHE_REQUEST } from "@/lib/fixtures/replan/elche-dinner";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { StartOffer } from "./start-offers";

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
 * The eight cities with an engraving, Madrid as the start screen offers it and the seven as their
 * days are asked, so the index shows every picture it ships, a short gist of one line and of two.
 */
export const DRAWN_STARTS: readonly StartOffer[] = [
  offerOf("France", {
    city: "Paris",
    timezone: "Europe/Paris",
    date: "2026-11-15",
    energy: "calm",
    start: "slow",
  }),
  offerOf("Japan", { city: "Tokyo", timezone: "Asia/Tokyo", energy: "lively", start: "early" }),
  offerOf("Italy", { city: "Rome", timezone: "Europe/Rome", dinner: "late", company: "family" }),
  offerOf("United States", {
    city: "New York",
    timezone: "America/New_York",
    energy: "lively",
    end: "late",
  }),
  offerOf("Netherlands", {
    city: "Amsterdam",
    timezone: "Europe/Amsterdam",
    date: "2026-11-15",
    energy: "calm",
  }),
  offerOf("Spain", {
    city: "Barcelona",
    timezone: "Europe/Madrid",
    energy: "lively",
    dinner: "late",
  }),
  offerOf("South Korea", {
    city: "Seoul",
    timezone: "Asia/Seoul",
    date: "2026-11-13",
    end: "late",
  }),
  { country: "Spain", request: MADRID_START_REQUEST, energies: ["calm", "balanced", "lively"] },
];

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
