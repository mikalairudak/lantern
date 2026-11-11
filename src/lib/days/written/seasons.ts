import type { PlaceCheck } from "@/lib/places/verify-place";
import type { WrittenDay } from "./written-day";

/**
 * A written day's season (`docs/decisions.md`, "A city's written day is one of its seasons, picked
 * by the date it is shown on"): the dates its file answers in its city. A city holds one or more,
 * oldest first, and the date a page shows picks one, so the page's hourly redraw moves to the next
 * season with no build.
 */
export interface WrittenSeason {
  /** The first date it answers, as ISO 8601: "2026-11-07". */
  from: string;
  /** The last date it answers, or null while no later season is written. */
  through: string | null;
  /**
   * The day, its request the city's start's words on the start's weekday, on the date it was
   * written for, which lies in the season. The first season's request is the start's own.
   */
  written: WrittenDay;
  /** The place checks the run that wrote it recorded, by the id the normalizer gives each place. */
  checks: Readonly<Record<string, PlaceCheck>>;
}

/**
 * The season a date falls in. A date no season covers gets the season that began last before
 * it, so a city whose seasons run out keeps serving its latest day, and a date before them all
 * gets the first. Read from the date alone, never the clock: a page and a re-plan of what it
 * showed pick the same season.
 */
export function seasonOn(seasons: readonly WrittenSeason[], date: string): WrittenSeason {
  // ISO 8601 dates sort as their text does.
  return seasons.findLast((season) => season.from <= date) ?? firstSeasonOf(seasons);
}

/** A city's first season, whose request is its start's own. */
export function firstSeasonOf(seasons: readonly WrittenSeason[]): WrittenSeason {
  const [first] = seasons;
  if (first === undefined) throw new Error("A written city has no season");
  return first;
}

/** Whether a season answers a date by its range, rather than for want of a later one. */
export function isInSeason(season: WrittenSeason, date: string): boolean {
  return season.from <= date && (season.through === null || date <= season.through);
}
