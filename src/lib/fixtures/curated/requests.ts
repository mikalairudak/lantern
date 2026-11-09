import type { DayRequest } from "@/lib/schema/itinerary.schema";

/**
 * What a visitor asks for to land on each curated day, apart from the days themselves, so
 * a page can offer them without loading 15,000 characters of fixture per day.
 */

export const KYOTO_REQUEST: DayRequest = {
  city: "Kyoto",
  date: "2026-11-14",
  timezone: "Asia/Tokyo",
  citySource: "chosen",
  energy: "calm",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

export const ALICANTE_REQUEST: DayRequest = {
  city: "Alicante",
  date: "2026-11-14",
  timezone: "Europe/Madrid",
  citySource: "chosen",
  energy: "calm",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

export const LISBON_REQUEST: DayRequest = {
  city: "Lisbon",
  date: "2026-11-14",
  timezone: "Europe/Lisbon",
  citySource: "chosen",
  energy: "lively",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: "friends",
};

/** In the order of `CURATED_DAYS`: Kyoto, the hero day, first. */
export const CURATED_REQUESTS: readonly DayRequest[] = [
  KYOTO_REQUEST,
  ALICANTE_REQUEST,
  LISBON_REQUEST,
];
