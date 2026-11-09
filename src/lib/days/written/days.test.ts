import { describe, expect, it } from "vitest";
import { LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { daySlugOf } from "../address";
import { WRITTEN_DAYS, writtenDayAt } from "./days";

describe("writtenDayAt", () => {
  it("knows each day's first place as its stream will say it, so its sun is the stream's", () => {
    // The page passes it to the day before the stream: a place moved by the normalizer
    // would say one sunrise in the page's HTML and another once the first stop came.
    for (const { request, day } of WRITTEN_DAYS) {
      const written = writtenDayAt(daySlugOf(request));
      expect(written?.itinerary.stops[0]?.primary.coordinates).toEqual(
        day.stops[0]?.place.coordinates,
      );
    }
  });

  it("has no day at a city Lantern has not written, nor at a city spelled as asked", () => {
    expect(writtenDayAt("paris")).toBeNull();
    expect(writtenDayAt(LISBON_REQUEST.city)).toBeNull();
  });
});
