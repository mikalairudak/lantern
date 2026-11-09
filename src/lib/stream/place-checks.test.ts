import { describe, expect, it } from "vitest";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { EDGE_DAYS } from "@/lib/fixtures/edge/edge-days";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { GeneratedDay, Itinerary } from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "./outcome";
import {
  PlaceCheckSchema,
  placeCheckOf,
  readyPlacesIn,
  withProviderPoints,
  type PlaceCheck,
} from "./place-checks";

const NOTHING_SEEN: ReadonlySet<string> = new Set();

function placesOf(itinerary: Itinerary): { id: string; name: string }[] {
  return itinerary.stops.flatMap((stop) => [stop.primary, ...stop.alternatives]);
}

const DAYS = [...CURATED_DAYS, ...EDGE_DAYS].map(({ request, day }) => ({
  city: request.city,
  request,
  day,
}));

describe("readyPlacesIn", () => {
  // The mark holds by the place's id, which a repair never moves (`docs/grounding.md`).
  it.each(DAYS)(
    "gives every place of the $city day the normalizer keeps a check under its own id",
    ({ request, day }) => {
      const normalized = normalizeDay(request, day);
      if (!normalized.ok) return;
      const ready = new Map(readyPlacesIn(day, NOTHING_SEEN).map(({ id, place }) => [id, place]));

      for (const place of placesOf(normalized.itinerary)) {
        expect(ready.get(place.id)?.name, place.id).toBe(place.name);
      }
    },
  );

  it("checks a name with a format character at its edge by the name the normalizer shows", () => {
    const day = structuredClone(KYOTO_DAY.day);
    const stop = day.stops[0];
    if (stop === undefined) throw new Error("Kyoto has stops");
    stop.place.name = `${stop.place.name}\u200B`;
    stop.place.neighborhood = `\u2060${stop.place.neighborhood} `;
    const normalized = normalizeDay(KYOTO_DAY.request, day);
    if (!normalized.ok) throw new Error(normalized.reason);
    const shown = placesOf(normalized.itinerary).find(({ id }) => id === "stop-0:p");
    const ready = readyPlacesIn(day, NOTHING_SEEN).find(({ id }) => id === "stop-0:p");

    expect(ready?.place.name).toBe(shown?.name);
    expect(ready?.place.neighborhood).toBe(KYOTO_DAY.day.stops[0]?.place.neighborhood);
  });

  it("waits for the field after a place's coordinates, so a number still streaming is not read", () => {
    const stop = KYOTO_DAY.day.stops[0] as GeneratedDay["stops"][number];
    const { sensory: _sensory, light: _light, aesthetic: _aesthetic, ...placeSoFar } = stop.place;
    const partial: PartialDay = { stops: [{ ...stop, place: placeSoFar }] };
    const begun: PartialDay = { stops: [{ ...stop, place: { ...placeSoFar, sensory: {} } }] };

    expect(readyPlacesIn(partial, NOTHING_SEEN)).toEqual([]);
    expect(readyPlacesIn(begun, NOTHING_SEEN).map(({ id }) => id)).toEqual(["stop-0:p"]);
  });

  it("leaves out what was seen, an option of a stop that does not exist, and a second set for a stop", () => {
    const day = structuredClone(KYOTO_DAY.day);
    const [first] = day.alternatives;
    if (first === undefined) throw new Error("Kyoto has alternatives");
    day.alternatives = [first, { ...first }, { ...first, stopIndex: day.stops.length }];

    const ids = readyPlacesIn(day, new Set(["stop-0:p"])).map(({ id }) => id);

    expect(ids).not.toContain("stop-0:p");
    expect(ids.filter((id) => id.startsWith(`stop-${first.stopIndex}:a`))).toHaveLength(
      first.options.length,
    );
    expect(ids.some((id) => id.startsWith(`stop-${day.stops.length}:`))).toBe(false);
  });
});

describe("placeCheckOf", () => {
  it("carries the provider's point for a place confirmed by name, and none for an area", () => {
    const byName = placeCheckOf("stop-1:p", {
      kind: "verified",
      by: "name",
      lat: 35.0268,
      lng: 135.7954,
      providerId: "51a1",
      source: "geoapify",
    });
    const byArea = placeCheckOf("stop-2:p", {
      kind: "verified",
      by: "area",
      lat: 35.0,
      lng: 135.7,
      placesAround: 12,
      source: "geoapify",
    });

    expect(byName).toEqual({
      placeId: "stop-1:p",
      state: "confirmed",
      by: "name",
      coordinates: { lat: 35.0268, lng: 135.7954 },
    });
    expect(byArea).toEqual({ placeId: "stop-2:p", state: "confirmed", by: "area" });
    expect(PlaceCheckSchema.safeParse(byName).success).toBe(true);
  });

  it("tells an answer the rule could not confirm from a lookup that gave none", () => {
    expect(placeCheckOf("a", { kind: "unverified", reason: "no-match" }).state).toBe("unconfirmed");
    expect(placeCheckOf("a", { kind: "unverified", reason: "too-few-places" }).state).toBe(
      "unconfirmed",
    );
    for (const reason of [
      "timeout",
      "quota",
      "failed",
      "no-key",
      "aborted",
      "invalid-input",
    ] as const) {
      expect(placeCheckOf("a", { kind: "unverified", reason }).state).toBe("unchecked");
    }
  });
});

describe("withProviderPoints", () => {
  const { request, day } = KYOTO_DAY;
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error("Kyoto normalizes");
  const itinerary = normalized.itinerary;

  // The page holds the finished day by reference; a day nothing moves must not remount it.
  it("gives back the same day, object for object, when no place was confirmed by name", () => {
    const checks = new Map<string, PlaceCheck>([
      ["stop-0:p", { placeId: "stop-0:p", state: "confirmed", by: "area" }],
      ["stop-1:p", { placeId: "stop-1:p", state: "unconfirmed" }],
    ]);

    expect(withProviderPoints(itinerary, checks)).toBe(itinerary);
  });

  it("moves only the place confirmed by name, and keeps every other stop as it was", () => {
    const point = { lat: 35.0268, lng: 135.7954 };
    const checks = new Map<string, PlaceCheck>([
      ["stop-1:p", { placeId: "stop-1:p", state: "confirmed", by: "name", coordinates: point }],
    ]);

    const moved = withProviderPoints(itinerary, checks);

    expect(moved.stops[1]?.primary.coordinates).toEqual(point);
    expect(moved.stops[0]).toBe(itinerary.stops[0]);
    expect(moved.stops[2]).toBe(itinerary.stops[2]);
  });
});
