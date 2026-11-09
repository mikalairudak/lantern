import { DIRECTIONS_URL, pointWords } from "@/features/abacus/map-action";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import type { Stop } from "@/lib/schema/itinerary.schema";
import { placePointOf, shownPlacesOf, type Point } from "./day-end";

/**
 * "Walk it in Google Maps": the day's places in order as one walking route. Its address is
 * Google Maps' fixed one and carries only numbers, the places' points, never a name the model
 * wrote; `URLSearchParams` writes them, so nothing in them can add a parameter.
 *
 * Google Maps takes nine stops between the first and the last, three in a phone's browser
 * without the app (developers.google.com/maps/documentation/urls/get-started, read
 * 2026-11-05); a longer day is cut there, and the route says how many of its stops it holds.
 */

/** The stops a route may pass between its first and its last, where the Maps app opens it. */
export const MAX_ROUTE_WAYPOINTS = 9;

/** What a phone's browser follows without the Maps app. */
export const PHONE_BROWSER_WAYPOINTS = 3;

export interface WalkRoute {
  url: string;
  /** How many of the day's stops the route holds, from the first. */
  included: number;
  /** How many the day has. */
  total: number;
}

/** A walking route through the points in order, cut after `maxWaypoints` between its ends. */
export function walkRouteOf(
  points: readonly Point[],
  maxWaypoints: number = MAX_ROUTE_WAYPOINTS,
): WalkRoute | null {
  if (points.length < 2) return null;
  const route = points.slice(0, Math.max(0, maxWaypoints) + 2);
  const [origin, ...rest] = route;
  const destination = rest.at(-1);
  if (origin === undefined || destination === undefined) return null;
  const waypoints = rest.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: pointWords(origin),
    destination: pointWords(destination),
    travelmode: "walking",
  });
  if (waypoints.length > 0) params.set("waypoints", waypoints.map(pointWords).join("|"));
  return { url: `${DIRECTIONS_URL}?${params}`, included: route.length, total: points.length };
}

/** The walking route through the places a day shows, where the map found them. */
export function dayWalkRouteOf(
  stops: readonly Stop[],
  shown: readonly number[],
  checks: PlaceChecks = {},
  maxWaypoints?: number,
): WalkRoute | null {
  const points = shownPlacesOf(stops, shown).map((place) => placePointOf(place, checks));
  return walkRouteOf(points, maxWaypoints);
}
