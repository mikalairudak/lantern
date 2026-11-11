import type { DayRequest } from "@/lib/schema/itinerary.schema";

/**
 * The start screen's starts, the days its index offers (`docs/decisions.md`, "The start screen is
 * an index, with a day's first stops under it"): behind each a day the product wrote ahead of time
 * in its city, its country, which a city typed beside it may name, and a short list of the
 * country's other cities for a new one. Requests only, apart from the days, so a page can offer
 * them without loading each day's text.
 */

/** A city a start can write a new day in, with the zone its day is read in. */
export interface StartCity {
  city: string;
  /** An IANA city zone, as a request's. */
  timezone: string;
}

export interface QuickStart {
  /** The country the city is in, as a visitor may type it beside the city: "Italy". */
  country: string;
  /**
   * The day written ahead of time, which the start opens, on the date it was written for; it
   * is shown on its weekday's next date (`shownDateOf`).
   */
  request: DayRequest;
  /**
   * When the day's first stop begins in its city, as its file writes it: until then the day
   * can still be shown on today's date. Kept here so a page can say the date without loading
   * the day's text; a test holds it to the file.
   */
  firstStart: string;
  /** The country's other cities, likeliest first, for a day written anew. */
  others: readonly StartCity[];
}

/**
 * The two days the starts were written for, the first weekend after they were. A page shows
 * each day on its weekday's next date (`shownDateOf`).
 */
const SATURDAY = "2026-11-07";
const SUNDAY = "2026-11-08";
/**
 * The weekend after, for the two days written again: a request the route answered from its file
 * would not have reached the model.
 */
const NEXT_SATURDAY = "2026-11-14";
const NEXT_SUNDAY = "2026-11-15";

/** A request as a start asks it: every word chosen, none assumed. */
export function startRequestOf(
  words: Partial<DayRequest> & Pick<DayRequest, "city" | "timezone">,
): DayRequest {
  return {
    date: SATURDAY,
    citySource: "chosen",
    energy: "balanced",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: null,
    ...words,
  } satisfies DayRequest;
}

export const BOLOGNA_START_REQUEST: DayRequest = startRequestOf({
  city: "Bologna",
  timezone: "Europe/Rome",
  energy: "lively",
  company: "friends",
});

export const PORTO_START_REQUEST: DayRequest = startRequestOf({
  city: "Porto",
  timezone: "Europe/Lisbon",
  date: NEXT_SUNDAY,
  energy: "calm",
  start: "slow",
});

export const KANAZAWA_START_REQUEST: DayRequest = startRequestOf({
  city: "Kanazawa",
  timezone: "Asia/Tokyo",
  energy: "calm",
  start: "early",
});

export const MADRID_START_REQUEST: DayRequest = startRequestOf({
  city: "Madrid",
  timezone: "Europe/Madrid",
  date: NEXT_SATURDAY,
  energy: "lively",
  end: "late",
  company: "friends",
});

export const UTRECHT_START_REQUEST: DayRequest = startRequestOf({
  city: "Utrecht",
  timezone: "Europe/Amsterdam",
  date: SUNDAY,
  energy: "balanced",
  company: "family",
});

export const NAFPLIO_START_REQUEST: DayRequest = startRequestOf({
  city: "Nafplio",
  timezone: "Europe/Athens",
  energy: "reflective",
  start: "slow",
});

/** In the order the index offers them, lively and quiet days mixed so neighbours differ. */
export const QUICK_STARTS: readonly QuickStart[] = [
  {
    country: "Italy",
    request: BOLOGNA_START_REQUEST,
    firstStart: "09:30",
    others: [
      { city: "Naples", timezone: "Europe/Rome" },
      { city: "Turin", timezone: "Europe/Rome" },
    ],
  },
  {
    country: "Portugal",
    request: PORTO_START_REQUEST,
    firstStart: "10:00",
    others: [
      { city: "Cascais", timezone: "Europe/Lisbon" },
      { city: "Lagos", timezone: "Europe/Lisbon" },
    ],
  },
  {
    country: "Japan",
    request: KANAZAWA_START_REQUEST,
    firstStart: "07:30",
    others: [
      { city: "Kyoto", timezone: "Asia/Tokyo" },
      { city: "Nara", timezone: "Asia/Tokyo" },
    ],
  },
  {
    country: "Spain",
    request: MADRID_START_REQUEST,
    firstStart: "10:00",
    others: [
      { city: "Seville", timezone: "Europe/Madrid" },
      { city: "Valencia", timezone: "Europe/Madrid" },
    ],
  },
  {
    country: "Netherlands",
    request: UTRECHT_START_REQUEST,
    firstStart: "10:00",
    others: [
      { city: "Haarlem", timezone: "Europe/Amsterdam" },
      { city: "Leiden", timezone: "Europe/Amsterdam" },
    ],
  },
  {
    country: "Greece",
    request: NAFPLIO_START_REQUEST,
    firstStart: "10:00",
    others: [
      { city: "Athens", timezone: "Europe/Athens" },
      { city: "Thessaloniki", timezone: "Europe/Athens" },
    ],
  },
];

/** The starts' days, in the order the index offers them. */
export const START_REQUESTS: readonly DayRequest[] = QUICK_STARTS.map(({ request }) => request);
