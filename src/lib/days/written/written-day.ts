import type { DayRequest, GeneratedDay } from "@/lib/schema/itinerary.schema";

/**
 * A day written ahead of time: a request and what a model constrained by `GeneratedDaySchema`
 * would write for it. It types the curated days (Kyoto, Alicante, Lisbon: fixtures for the
 * tests and the lab) and the written days (`WRITTEN_DAYS`: the ones the public site serves).
 * A visitor lands on the written days, so every line is held to the rubric in `docs/voice.md`.
 */
export interface WrittenDay {
  request: DayRequest;
  day: GeneratedDay;
}
