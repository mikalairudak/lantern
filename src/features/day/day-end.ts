import { candidatesOf } from "@/features/abacus/curve";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { distanceInMeters } from "@/lib/geo/distance";
import type { Place, Stop, TravelMode } from "@/lib/schema/itinerary.schema";
import { MINUTES_PER_DAY, formatClock, runningSpans } from "@/lib/time/clock";

/**
 * What the block under a day's last row says of the day as the visitor shaped it: when it
 * ends, how many stops, how far, and how many of its places the map
 * found. Pure functions of the finished day, the version each stop shows, and the place
 * checks; the block, the calendar file and the route read the same places from here.
 *
 * Only numbers and Lantern's own words come out of this module; no text the model wrote.
 */

/** A point on the map, in decimal degrees. */
export interface Point {
  lat: number;
  lng: number;
}

/** The place each stop shows: the version picked, as the curve's `committed` indices say. */
export function shownPlacesOf(stops: readonly Stop[], shown: readonly number[]): Place[] {
  return stops.map((stop, index) => {
    const candidates = candidatesOf(stop);
    return (
      candidates[shown[index] ?? -1] ??
      candidates.find((place) => place.id === stop.selectedPlaceId) ??
      stop.primary
    );
  });
}

/**
 * Where a place is: the map's own point when the check found it by its name, which is where
 * the map app will look for it, else the model's.
 */
export function placePointOf(place: Place, checks: PlaceChecks): Point {
  const check = checks[place.id];
  return check?.state === "confirmed" && check.by === "name"
    ? check.coordinates
    : place.coordinates;
}

/**
 * How much longer the way between two places runs in a city's streets than the straight line
 * between them: a rough, common figure, as the design review set it, which "about" owns up to.
 */
export const STREET_DETOUR = 1.3;

const METERS_PER_KM = 1000;
/** Under a kilometre the way is said to the hundred metres; from ten, to the kilometre. */
const METERS_STEP = 100;
const TENTHS_UNDER_KM = 10;

/** "800 m", "4.2 km", "12 km": a distance as a person says it, never more exact than "about". */
export function distanceWords(meters: number): string {
  const rounded = Math.max(METERS_STEP, Math.round(meters / METERS_STEP) * METERS_STEP);
  if (rounded < METERS_PER_KM) return `${rounded} m`;
  const tenths = Math.round(meters / (METERS_PER_KM / TENTHS_UNDER_KM)) / TENTHS_UNDER_KM;
  return tenths < TENTHS_UNDER_KM
    ? `${tenths.toFixed(1)} km`
    : `${Math.round(meters / METERS_PER_KM)} km`;
}

/** The day at its end. */
export interface DaySummary {
  /** When the last stop ends, "HH:mm" on the clock. */
  endsAt: string;
  /** The last stop ends after midnight, on the next day's clock. */
  isPastMidnight: boolean;
  /** How many stops the day has. */
  stops: number;
  /** The way between the shown places in the street, the straight lines times `STREET_DETOUR`. */
  meters: number;
  /**
   * "about 4.2 km on foot" when the day is walked, "about 4.2 km" when it is not or nobody said,
   * null for a day of one stop.
   */
  distanceLine: string | null;
}

/** When the day ends, how many stops it has, and how far it goes between the places shown. */
export function daySummaryOf(
  stops: readonly Stop[],
  shown: readonly number[],
  travel: TravelMode | null,
  checks: PlaceChecks = {},
): DaySummary {
  const spans = runningSpans(stops);
  const end = spans.at(-1)?.to ?? 0;
  const points = shownPlacesOf(stops, shown).map((place) => placePointOf(place, checks));
  const straight = points
    .slice(1)
    .reduce((sum, point, index) => sum + distanceInMeters(points[index]!, point), 0);
  const meters = straight * STREET_DETOUR;
  const onFoot = travel === "on-foot" ? " on foot" : "";
  return {
    endsAt: formatClock(end),
    isPastMidnight: end >= MINUTES_PER_DAY,
    stops: stops.length,
    meters,
    distanceLine: points.length < 2 ? null : `about ${distanceWords(meters)}${onFoot}`,
  };
}

/** How many of the places shown the map found, of how many. */
export interface PlacesFound {
  found: number;
  total: number;
  /** "6 of 8 places found on OpenStreetMap". */
  line: string;
}

/**
 * How many of the places the day shows the map confirmed, by name or by places of their kind
 * around them, once every one of them has been looked up. Null for a day with no checks, as one
 * written by hand, and while any shown place is still being looked up.
 */
export function placesFoundOf(
  stops: readonly Stop[],
  shown: readonly number[],
  checks: PlaceChecks,
): PlacesFound | null {
  const places = shownPlacesOf(stops, shown);
  const results = places.map((place) => checks[place.id]);
  if (results.every((check) => check === undefined)) return null;
  if (results.some((check) => check?.state === "checking")) return null;
  const found = results.filter((check) => check?.state === "confirmed").length;
  const total = places.length;
  const noun = total === 1 ? "place" : "places";
  return { found, total, line: `${found} of ${total} ${noun} found on OpenStreetMap` };
}
