import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { startRequestOf, type QuickStart } from "./quick-starts";

/**
 * Seven cities' written days beside the quick starts' (`docs/decisions.md`, "Seven more cities
 * have a written day at their own address"): with Madrid's start, a day in eight cities from
 * Euromonitor's Top 100 City Destinations Index 2025. Each is a day the product wrote, at its own
 * address and played from its file as a start's is, but no quick start opens it. Requests only,
 * apart from the days, so a page can say each day's date without loading its text, and with no
 * runtime import but relative ones, so the router's config can read the addresses. Their words
 * differ across the set, so the days between them show what the request changes.
 */

/** A city's written day as its address needs it: the start's words, without a start. */
export type CityDay = Pick<QuickStart, "request" | "firstStart">;

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
  { request: PARIS_REQUEST, firstStart: "10:00" },
  { request: TOKYO_REQUEST, firstStart: "07:30" },
  { request: ROME_REQUEST, firstStart: "09:45" },
  { request: NEW_YORK_REQUEST, firstStart: "10:00" },
  { request: AMSTERDAM_REQUEST, firstStart: "10:00" },
  { request: BARCELONA_REQUEST, firstStart: "10:00" },
  { request: SEOUL_REQUEST, firstStart: "10:00" },
];

/** The city days' requests, in the same order. */
export const CITY_REQUESTS: readonly DayRequest[] = CITY_DAYS.map(({ request }) => request);
