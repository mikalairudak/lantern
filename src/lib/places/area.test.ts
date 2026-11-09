import { describe, expect, it } from "vitest";
import {
  CAMPO_DE_OURIQUE_CORNER,
  MOURARIA,
  MOURARIA_PLACES,
  placesBodyAround,
} from "@/lib/fixtures/places/meal-areas";
import { AREA_KINDS } from "@/lib/schema/itinerary.schema";
import {
  AREA_CATEGORIES,
  AREA_RADIUS_METERS,
  MIN_PLACES_AROUND,
  PLACES_PER_LOOKUP,
  areaSearchParams,
  placesAroundIn,
  type AreaToCheck,
} from "./area";

const TASCAS: AreaToCheck = { kind: "food", coordinates: MOURARIA };

function oneAt(name: string, categories: string[], metersNorth = 0) {
  return { name, categories, metersNorth, metersEast: 0 };
}

describe("the area check's numbers", () => {
  it("counts within a three-minute walk, asks for three places, and reads one credit's page", () => {
    expect(AREA_RADIUS_METERS).toBe(240);
    expect(MIN_PLACES_AROUND).toBe(3);
    expect(PLACES_PER_LOOKUP).toBe(20);
  });

  it("names Geoapify's categories under catering for every kind of area", () => {
    for (const kind of AREA_KINDS) {
      expect(AREA_CATEGORIES[kind].length).toBeGreaterThan(0);
      for (const category of AREA_CATEGORIES[kind]) expect(category).toMatch(/^catering\./);
    }
  });
});

describe("areaSearchParams", () => {
  it("asks for the kind's places inside the walk around the point, nearest first, on one credit", () => {
    expect(areaSearchParams(TASCAS)).toEqual({
      categories: "catering.restaurant,catering.fast_food,catering.food_court",
      filter: "circle:-9.1349,38.7149,240",
      bias: "proximity:-9.1349,38.7149",
      limit: "20",
      lang: "en",
    });
  });

  it("never searches by name: an area has no single one", () => {
    expect(areaSearchParams(TASCAS)).not.toHaveProperty("text");
    expect(areaSearchParams(TASCAS)).not.toHaveProperty("name");
  });
});

describe("placesAroundIn", () => {
  it("counts the places of the kind within the walk, and no café or place past it", () => {
    expect(placesAroundIn(TASCAS, placesBodyAround(MOURARIA, MOURARIA_PLACES))).toBe(6);
  });

  it("counts by the area's own kind", () => {
    const cafes: AreaToCheck = { kind: "coffee", coordinates: MOURARIA };
    expect(placesAroundIn(cafes, placesBodyAround(MOURARIA, MOURARIA_PLACES))).toBe(1);
  });

  it("takes a subcategory under the kind's own, and no other kind's", () => {
    const body = placesBodyAround(CAMPO_DE_OURIQUE_CORNER, [
      oneAt("Ramen", ["catering.fast_food.ramen"]),
      oneAt("Gelados", ["catering.ice_cream"]),
      oneAt("Wine bar", ["catering.bar"], 20),
    ]);
    const food: AreaToCheck = { kind: "food", coordinates: CAMPO_DE_OURIQUE_CORNER };
    const bars: AreaToCheck = { kind: "bar", coordinates: CAMPO_DE_OURIQUE_CORNER };

    expect(placesAroundIn(food, body)).toBe(1);
    expect(placesAroundIn(bars, body)).toBe(1);
  });

  it("counts a place listed twice once", () => {
    const tasca = oneAt("Tasca", ["catering.restaurant"]);
    expect(placesAroundIn(TASCAS, placesBodyAround(MOURARIA, [tasca, tasca]))).toBe(1);
  });

  it("leaves out a feature it cannot read and keeps the others", () => {
    const body = placesBodyAround(MOURARIA, [oneAt("Tasca", ["catering.restaurant"])]) as {
      features: unknown[];
    };
    body.features.push({ properties: { name: "No point", categories: ["catering.restaurant"] } });

    expect(placesAroundIn(TASCAS, body)).toBe(1);
  });

  it("reads nothing from a body that is not a Places answer", () => {
    expect(placesAroundIn(TASCAS, { results: [] })).toBeNull();
    expect(placesAroundIn(TASCAS, "Internal Server Error")).toBeNull();
  });
});
