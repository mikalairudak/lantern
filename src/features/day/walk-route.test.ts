import { describe, expect, it } from "vitest";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import { shownPlacesOf } from "./day-end";
import {
  MAX_ROUTE_WAYPOINTS,
  PHONE_BROWSER_WAYPOINTS,
  dayWalkRouteOf,
  walkRouteOf,
} from "./walk-route";

/** The curated Kyoto day, normalized: a fixture of its own, whatever the site serves. */
const KYOTO = KYOTO_ITINERARY;

/** Points along a line, a hundredth of a degree apart. */
function pointsOf(count: number): { lat: number; lng: number }[] {
  return Array.from({ length: count }, (_, at) => ({ lat: 35 + at / 100, lng: 135.7 }));
}

function paramsOf(url: string): URLSearchParams {
  const parsed = new URL(url);
  expect(`${parsed.protocol}//${parsed.host}${parsed.pathname}`).toBe(
    "https://www.google.com/maps/dir/",
  );
  return parsed.searchParams;
}

describe("walkRouteOf", () => {
  it("walks from the first point to the last through the ones between, in order", () => {
    const route = walkRouteOf(pointsOf(4))!;
    const params = paramsOf(route.url);
    expect(params.get("api")).toBe("1");
    expect(params.get("travelmode")).toBe("walking");
    expect(params.get("origin")).toBe("35,135.7");
    expect(params.get("destination")).toBe("35.03,135.7");
    expect(params.get("waypoints")).toBe("35.01,135.7|35.02,135.7");
    expect(route).toMatchObject({ included: 4, total: 4 });
  });

  it("has no waypoints between two points, and no route for one", () => {
    expect(paramsOf(walkRouteOf(pointsOf(2))!.url).has("waypoints")).toBe(false);
    expect(walkRouteOf(pointsOf(1))).toBeNull();
    expect(walkRouteOf([])).toBeNull();
  });

  it("cuts a long day where the map stops taking points, and says how many it holds", () => {
    const long = walkRouteOf(pointsOf(14))!;
    expect(long).toMatchObject({ included: MAX_ROUTE_WAYPOINTS + 2, total: 14 });
    expect(paramsOf(long.url).get("waypoints")?.split("|")).toHaveLength(MAX_ROUTE_WAYPOINTS);
    expect(paramsOf(long.url).get("destination")).toBe("35.1,135.7");

    const phone = walkRouteOf(pointsOf(14), PHONE_BROWSER_WAYPOINTS)!;
    expect(phone).toMatchObject({ included: PHONE_BROWSER_WAYPOINTS + 2, total: 14 });
  });

  it("stays within the map's 2,048 characters at its longest", () => {
    const far = Array.from({ length: 11 }, () => ({ lat: -33.123456789, lng: -151.123456789 }));
    expect(walkRouteOf(far)!.url.length).toBeLessThan(2048);
  });
});

describe("dayWalkRouteOf", () => {
  it("goes through the places shown, at the map's point where it found one by name", () => {
    const shown = KYOTO.stops.map(() => 0);
    const first = shownPlacesOf(KYOTO.stops, shown)[0]!;
    const checks: PlaceChecks = {
      [first.id]: {
        placeId: first.id,
        state: "confirmed",
        by: "name",
        coordinates: { lat: 1.5, lng: 2.5 },
      },
    };
    const route = dayWalkRouteOf(KYOTO.stops, shown, checks)!;
    expect(paramsOf(route.url).get("origin")).toBe("1.5,2.5");
    expect(route.total).toBe(KYOTO.stops.length);
    // Numbers alone: no name the model wrote reaches the address.
    for (const place of shownPlacesOf(KYOTO.stops, shown)) {
      expect(decodeURIComponent(route.url)).not.toContain(place.name);
    }
  });
});
