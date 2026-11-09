import { describe, expect, it } from "vitest";
import {
  AREA_LUNCH_DAY,
  AREA_LUNCH_STOP_INDEX,
  MOURARIA_LUNCH,
  RAMIRO_DOOR,
  geocodeHandWrittenMeals,
  searchHandWrittenPlaces,
} from "@/lib/fixtures/places/meal-areas";
import { runQualityChecks } from "@/lib/quality/checks";
import type { GeneratedDay } from "@/lib/schema/itinerary.schema";
import { createNameVerifier, createPlaceVerifier } from "./verify-place";

const LISBON = { city: AREA_LUNCH_DAY.request.city };
const verifier = createPlaceVerifier({
  geocode: geocodeHandWrittenMeals,
  places: searchHandWrittenPlaces,
});
const nameRule = createNameVerifier(geocodeHandWrittenMeals);

/** The example day, its lunch at one swapped for the door of one restaurant. */
function withRestaurantLunch(): GeneratedDay {
  const day = structuredClone(AREA_LUNCH_DAY.day);
  const lunch = day.stops[AREA_LUNCH_STOP_INDEX];
  if (lunch === undefined) throw new Error("The example day has no lunch");
  lunch.place = {
    ...MOURARIA_LUNCH,
    name: "Cervejaria Ramiro",
    neighborhood: "Intendente",
    coordinates: RAMIRO_DOOR,
  };
  return day;
}

function lunchOf(day: GeneratedDay) {
  const lunch = day.stops[AREA_LUNCH_STOP_INDEX];
  if (lunch === undefined) throw new Error("The day has no lunch");
  return lunch.place;
}

describe("a day whose lunch is a place to eat around", () => {
  it("passes every quality check", () => {
    const failed = runQualityChecks(AREA_LUNCH_DAY.request, AREA_LUNCH_DAY.day).filter(
      (check) => !check.passed,
    );

    expect(failed).toEqual([]);
  });

  it("has its lunch and both options confirmed as areas, each at the point the model gave", async () => {
    const lunchSet = AREA_LUNCH_DAY.day.alternatives.find(
      ({ stopIndex }) => stopIndex === AREA_LUNCH_STOP_INDEX,
    );
    const places = [lunchOf(AREA_LUNCH_DAY.day), ...(lunchSet?.options ?? [])];

    const checks = await Promise.all(places.map((place) => verifier.verify(place, LISBON)));

    expect(checks.map(({ kind }) => kind)).toEqual(["verified", "verified", "verified"]);
    expect(checks).toEqual(
      places.map(({ coordinates }) =>
        expect.objectContaining({ by: "area", lat: coordinates.lat, lng: coordinates.lng }),
      ),
    );
  });

  it("is not a venue by the name rule: its name finds the quarter, not a restaurant", async () => {
    await expect(nameRule.verify(lunchOf(AREA_LUNCH_DAY.day), LISBON)).resolves.toEqual({
      kind: "unverified",
      reason: "no-match",
    });
  });
});

// The mutation day-v3 forbids: the lunch names one restaurant.
describe("the same day with a restaurant for lunch", () => {
  it("passes every quality check: none reads a name for a venue", () => {
    const failed = runQualityChecks(AREA_LUNCH_DAY.request, withRestaurantLunch()).filter(
      (check) => !check.passed,
    );

    expect(failed).toEqual([]);
  });

  it("passes the area check too, on the restaurants around its door", async () => {
    await expect(verifier.verify(lunchOf(withRestaurantLunch()), LISBON)).resolves.toMatchObject({
      kind: "verified",
      by: "area",
      placesAround: 4,
    });
  });

  it("is caught by the name rule, which confirms a restaurant of that name at its point", async () => {
    await expect(nameRule.verify(lunchOf(withRestaurantLunch()), LISBON)).resolves.toMatchObject({
      kind: "verified",
      by: "name",
      providerId: "hand-cervejaria-ramiro",
    });
  });
});
