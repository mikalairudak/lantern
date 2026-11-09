import { describe, expect, it } from "vitest";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import { distanceInMeters } from "@/lib/geo/distance";
import type { Stop } from "@/lib/schema/itinerary.schema";
import {
  STREET_DETOUR,
  daySummaryOf,
  distanceWords,
  placePointOf,
  placesFoundOf,
  shownPlacesOf,
} from "./day-end";

/** The curated Kyoto day, normalized: a fixture of its own, whatever the site serves. */
const KYOTO = KYOTO_ITINERARY;
const STOPS = KYOTO.stops;
/** What each stop shows as written: the model's pick. */
const WRITTEN = STOPS.map((stop) =>
  [stop.primary, ...stop.alternatives].findIndex((place) => place.id === stop.selectedPlaceId),
);
const SWAPPED_AT = STOPS.findIndex((stop) => stop.alternatives.length > 0);
const SWAPPED = WRITTEN.map((index, at) => (at === SWAPPED_AT ? (index === 0 ? 1 : 0) : index));

/** A day of two stops at these times, from Kyoto's first two. */
function twoStops(first: [string, number], second: [string, number]): Stop[] {
  return [
    { ...STOPS[0]!, startTime: first[0], durationMinutes: first[1] },
    { ...STOPS[1]!, startTime: second[0], durationMinutes: second[1] },
  ];
}

describe("shownPlacesOf", () => {
  it("gives each stop's version as shown, and the written one where none is given", () => {
    const places = shownPlacesOf(STOPS, SWAPPED);
    const swapped = STOPS[SWAPPED_AT]!;
    expect(places[SWAPPED_AT]!.id).toBe(
      [swapped.primary, ...swapped.alternatives][SWAPPED[SWAPPED_AT]!]!.id,
    );
    expect(shownPlacesOf(STOPS, []).map(({ id }) => id)).toEqual(
      STOPS.map((stop) => stop.selectedPlaceId),
    );
  });
});

describe("placePointOf", () => {
  const place = STOPS[0]!.primary;

  it("takes the map's point for a place it found by its name, else the model's", () => {
    const found: PlaceChecks = {
      [place.id]: {
        placeId: place.id,
        state: "confirmed",
        by: "name",
        coordinates: { lat: 1, lng: 2 },
      },
    };
    expect(placePointOf(place, found)).toEqual({ lat: 1, lng: 2 });
    expect(
      placePointOf(place, { [place.id]: { placeId: place.id, state: "confirmed", by: "area" } }),
    ).toEqual(place.coordinates);
    expect(placePointOf(place, {})).toEqual(place.coordinates);
  });
});

describe("distanceWords", () => {
  it("says a distance as a person would", () => {
    expect(distanceWords(0)).toBe("100 m");
    expect(distanceWords(840)).toBe("800 m");
    expect(distanceWords(960)).toBe("1.0 km");
    expect(distanceWords(4230)).toBe("4.2 km");
    expect(distanceWords(9960)).toBe("10 km");
    expect(distanceWords(12_600)).toBe("13 km");
  });
});

describe("daySummaryOf", () => {
  it("ends with the last stop, counts the stops, and walks the street between the places shown", () => {
    const summary = daySummaryOf(STOPS, WRITTEN, "on-foot");
    const last = STOPS.at(-1)!;
    const [hours, minutes] = last.startTime.split(":").map(Number);
    const end = hours! * 60 + minutes! + last.durationMinutes;
    expect(summary.endsAt).toBe(
      `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
    );
    expect(summary.isPastMidnight).toBe(false);
    expect(summary.stops).toBe(STOPS.length);

    const points = shownPlacesOf(STOPS, WRITTEN).map(({ coordinates }) => coordinates);
    const straight = points
      .slice(1)
      .reduce((sum, point, at) => sum + distanceInMeters(points[at]!, point), 0);
    expect(summary.meters).toBeCloseTo(straight * STREET_DETOUR, 6);
    expect(summary.distanceLine).toBe(`about ${distanceWords(straight * STREET_DETOUR)} on foot`);
  });

  it("says no 'on foot' for a day ridden, or one whose travel nobody said", () => {
    expect(daySummaryOf(STOPS, WRITTEN, "transit").distanceLine).toMatch(/^about [\d.]+ k?m$/);
    expect(daySummaryOf(STOPS, WRITTEN, null).distanceLine).not.toContain("on foot");
  });

  it("goes by the versions shown", () => {
    expect(daySummaryOf(STOPS, SWAPPED, "on-foot").meters).not.toBe(
      daySummaryOf(STOPS, WRITTEN, "on-foot").meters,
    );
  });

  it("ends on the next day's clock for a day past midnight", () => {
    const summary = daySummaryOf(twoStops(["22:00", 120], ["00:30", 60]), [0, 0], "taxi");
    expect(summary.endsAt).toBe("01:30");
    expect(summary.isPastMidnight).toBe(true);
  });

  it("says no distance for a day of one stop", () => {
    expect(daySummaryOf(STOPS.slice(0, 1), [0], "on-foot").distanceLine).toBeNull();
  });
});

describe("placesFoundOf", () => {
  const places = shownPlacesOf(STOPS, WRITTEN);
  const confirmed = (id: string): PlaceChecks[string] => ({
    placeId: id,
    state: "confirmed",
    by: "area",
  });

  it("counts the places shown the map confirmed, of all of them", () => {
    const checks: PlaceChecks = Object.fromEntries(
      places.map((place, at) => [
        place.id,
        at < 3 ? confirmed(place.id) : { placeId: place.id, state: "unconfirmed" },
      ]),
    );
    expect(placesFoundOf(STOPS, WRITTEN, checks)).toEqual({
      found: 3,
      total: STOPS.length,
      line: `3 of ${STOPS.length} places found on OpenStreetMap`,
    });
  });

  it("says nothing for a day with no checks, or while one is still running", () => {
    expect(placesFoundOf(STOPS, WRITTEN, {})).toBeNull();
    const first = places[0]!.id;
    expect(
      placesFoundOf(STOPS, WRITTEN, { [first]: { placeId: first, state: "checking" } }),
    ).toBeNull();
  });

  it("counts the version shown, not the one written", () => {
    const shownId = shownPlacesOf(STOPS, SWAPPED)[SWAPPED_AT]!.id;
    const writtenId = places[SWAPPED_AT]!.id;
    expect(
      placesFoundOf(STOPS, SWAPPED, {
        [writtenId]: confirmed(writtenId),
        [shownId]: { placeId: shownId, state: "unconfirmed" },
      })?.found,
    ).toBe(0);
    expect(placesFoundOf(STOPS, SWAPPED, { [shownId]: confirmed(shownId) })?.found).toBe(1);
  });

  it("says one place in the singular", () => {
    const only = STOPS[0]!;
    expect(
      placesFoundOf([only], [0], { [only.primary.id]: confirmed(only.primary.id) })?.line,
    ).toBe("1 of 1 place found on OpenStreetMap");
  });
});
