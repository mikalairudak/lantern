import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { MADRID_START_REQUEST, startRequestOf, type QuickStart } from "./quick-starts";

/**
 * Seven cities' written days beside the quick starts' (`docs/decisions.md`, "Seven more cities
 * have a written day at their own address"): with Madrid's start, a day in eight cities from
 * Euromonitor's Top 100 City Destinations Index 2025. Each is a day the product wrote, at its own
 * address and played from its file as a start's is; no quick start opens it, and the start
 * screen's index does (`INDEX_REQUESTS`). Requests only,
 * apart from the days, so a page can say each day's date without loading its text, and with no
 * runtime import but relative ones, so the router's config can read the addresses. Their words
 * differ across the set, so the days between them show what the request changes.
 */

/**
 * A city's written day as its address and the start screen's index need it: a start's words and
 * country, without the start's other cities.
 */
export type CityDay = Pick<QuickStart, "country" | "request" | "firstStart">;

export const PARIS_REQUEST: DayRequest = startRequestOf({
  city: "Paris",
  timezone: "Europe/Paris",
  date: "2026-11-15",
  energy: "calm",
  start: "slow",
  company: "partner",
});

export const TOKYO_REQUEST: DayRequest = startRequestOf({
  city: "Tokyo",
  timezone: "Asia/Tokyo",
  date: "2026-11-14",
  energy: "lively",
  start: "early",
  company: "alone",
});

export const ROME_REQUEST: DayRequest = startRequestOf({
  city: "Rome",
  timezone: "Europe/Rome",
  date: "2026-11-14",
  energy: "balanced",
  dinner: "late",
  company: "family",
});

export const NEW_YORK_REQUEST: DayRequest = startRequestOf({
  city: "New York",
  timezone: "America/New_York",
  date: "2026-11-14",
  energy: "lively",
  end: "late",
  company: "partner",
});

export const AMSTERDAM_REQUEST: DayRequest = startRequestOf({
  city: "Amsterdam",
  timezone: "Europe/Amsterdam",
  date: "2026-11-15",
  energy: "calm",
  start: "slow",
  company: "family",
});

export const BARCELONA_REQUEST: DayRequest = startRequestOf({
  city: "Barcelona",
  timezone: "Europe/Madrid",
  date: "2026-11-14",
  energy: "lively",
  dinner: "late",
  company: "friends",
});

export const SEOUL_REQUEST: DayRequest = startRequestOf({
  city: "Seoul",
  timezone: "Asia/Seoul",
  date: "2026-11-13",
  energy: "balanced",
  end: "late",
  company: "alone",
});

/** Each city's day, its first hour as its file writes it; a test holds the hour to the file. */
export const CITY_DAYS: readonly CityDay[] = [
  { country: "France", request: PARIS_REQUEST, firstStart: "10:00" },
  { country: "Japan", request: TOKYO_REQUEST, firstStart: "07:30" },
  { country: "Italy", request: ROME_REQUEST, firstStart: "09:45" },
  { country: "United States", request: NEW_YORK_REQUEST, firstStart: "10:00" },
  { country: "Netherlands", request: AMSTERDAM_REQUEST, firstStart: "10:00" },
  { country: "Spain", request: BARCELONA_REQUEST, firstStart: "10:00" },
  { country: "South Korea", request: SEOUL_REQUEST, firstStart: "10:00" },
];

/** The city days' requests, in the same order. */
export const CITY_REQUESTS: readonly DayRequest[] = CITY_DAYS.map(({ request }) => request);

/**
 * The days the start screen's index offers, in the order of the
 * Index's ranking: the seven city days and Madrid's start. The quick starts' other five keep
 * their pages, their addresses and the sitemap. Each line's picture is named by its day's slug.
 */
export const INDEX_REQUESTS: readonly DayRequest[] = [
  PARIS_REQUEST,
  MADRID_START_REQUEST,
  TOKYO_REQUEST,
  ROME_REQUEST,
  NEW_YORK_REQUEST,
  AMSTERDAM_REQUEST,
  BARCELONA_REQUEST,
  SEOUL_REQUEST,
];

/** The day the start screen's excerpt shows the first stops of, under the index. */
export const EXCERPT_REQUEST: DayRequest = BARCELONA_REQUEST;
