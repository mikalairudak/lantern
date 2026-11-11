import { describe, expect, it } from "vitest";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { WrittenDay } from "./written-day";
import { WRITTEN_DAYS, WRITTEN_SEASONS } from "./days";
import { CITY_PLACE_CHECKS } from "./city-checks";
import { START_PLACE_CHECKS, writtenChecksOf } from "./checks";

/** Every place the normalized day shows, by its id. */
function placeIdsOf({ request, day }: WrittenDay): string[] {
  const result = normalizeDay(request, day);
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary.stops.flatMap((stop) => [
    stop.primary.id,
    ...stop.alternatives.map(({ id }) => id),
  ]);
}

const SEASONS = WRITTEN_SEASONS.flat().map(
  (season) => [`${season.written.request.city} from ${season.from}`, season] as const,
);

describe.each(SEASONS)("the season of %s", (_name, { written, checks }) => {
  const places = placeIdsOf(written);

  it("has each check under an id the normalizer gives a place of its day, none left without one", () => {
    expect(Object.keys(checks).filter((id) => !places.includes(id))).toEqual([]);
  });

  it("has a check for every place the day shows", () => {
    expect(places.filter((id) => checks[id] === undefined)).toEqual([]);
  });
});

describe("a written day's checks", () => {
  it("are there for every day the site serves from a file", () => {
    for (const { request } of WRITTEN_DAYS) {
      expect(writtenChecksOf(request.city)).toBe(
        START_PLACE_CHECKS[request.city] ?? CITY_PLACE_CHECKS[request.city],
      );
    }
  });

  it("are asked for no day but a written one: a day written by hand has none, and says so", () => {
    expect(() => writtenChecksOf("Kyoto")).toThrow("The written day in Kyoto has no place checks");
  });
});
