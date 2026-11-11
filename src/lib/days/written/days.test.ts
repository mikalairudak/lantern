import { describe, expect, it } from "vitest";
import { LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { daySlugOf } from "../address";
import { writtenChecksOf } from "./checks";
import {
  normalizedDayOn,
  shownWrittenDayAt,
  WRITTEN_DAYS,
  writtenDayAt,
  writtenDayFor,
  writtenDayOn,
} from "./days";
import { firstStartOf, WRITTEN_REQUESTS } from "./requests";
import { shownDateOf } from "./shown-date";
import { writtenVersionOf } from "./version";

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
    expect(writtenDayAt("vienna")).toBeNull();
    expect(writtenDayAt(LISBON_REQUEST.city)).toBeNull();
  });
});

// A Wednesday, a Saturday morning before and after each first stop, and a Sunday night.
const INSTANTS = [
  "2026-11-11T12:00:00Z",
  "2026-11-14T00:00:00Z",
  "2026-11-14T08:00:00Z",
  "2026-11-15T22:00:00Z",
].map((instant) => new Date(instant));

describe.each(WRITTEN_REQUESTS.map((request, index) => [request, WRITTEN_DAYS[index]!] as const))(
  "the written day in $city, in its one open season",
  (request, start) => {
    const slug = daySlugOf(request);

    it.each(INSTANTS)("is drawn at %s as it was before cities had seasons", (now) => {
      const date = shownDateOf(request, firstStartOf(request), now);
      expect(shownWrittenDayAt(slug, now)).toEqual({
        ...normalizedDayOn(start, date),
        // The version the page worked out from the day on its own date.
        version: writtenVersionOf(writtenDayAt(slug)!.itinerary),
        checks: writtenChecksOf(request.city),
      });
    });

    it.each(INSTANTS)("plays from the route and is re-planned at %s from its one file", (now) => {
      const date = shownDateOf(request, firstStartOf(request), now);
      expect(writtenDayFor({ ...request, date }, now)).toBe(start);
      expect(writtenDayOn(slug, date, now)).toEqual(normalizedDayOn(start, date));
    });
  },
);
