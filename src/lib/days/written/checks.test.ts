import { describe, expect, it } from "vitest";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { WrittenDay } from "./written-day";
import { WRITTEN_DAYS } from "./days";
import { START_PLACE_CHECKS, writtenChecksOf } from "./checks";
import { START_DAYS } from "./start-days";

/** Every place the normalized day shows, by its id. */
function placeIdsOf({ request, day }: WrittenDay): string[] {
  const result = normalizeDay(request, day);
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary.stops.flatMap((stop) => [
    stop.primary.id,
    ...stop.alternatives.map(({ id }) => id),
  ]);
}

describe.each(START_DAYS.map((start) => [start.request.city, start] as const))(
  "the start in %s",
  (city, { request, day }) => {
    const checks = START_PLACE_CHECKS[city] ?? {};
    const places = placeIdsOf({ request, day });

    it("has each check under an id the normalizer gives a place of its day, none left without one", () => {
      expect(Object.keys(checks).filter((id) => !places.includes(id))).toEqual([]);
    });

    it("has a check for every place the day shows", () => {
      expect(places.filter((id) => checks[id] === undefined)).toEqual([]);
    });
  },
);

describe("a written day's checks", () => {
  it("are there for every day the site serves from a file", () => {
    for (const { request } of WRITTEN_DAYS) {
      expect(writtenChecksOf(request.city)).toBe(START_PLACE_CHECKS[request.city]);
    }
  });

  it("are asked for no day but a written one: a day written by hand has none, and says so", () => {
    expect(() => writtenChecksOf("Kyoto")).toThrow("The written day in Kyoto has no place checks");
  });
});
