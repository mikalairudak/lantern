import type { Coordinates } from "@/lib/schema/itinerary.schema";

/** Mean Earth radius (IUGG). A sphere is exact enough for distances inside a city. */
export const EARTH_RADIUS_METERS = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Straight-line (great-circle) distance between two points, by the haversine formula. */
export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}
