import { z } from "zod";
import { distanceInMeters } from "@/lib/geo/distance";
import { isAreaKind, type DayRequest, type GeneratedPlace } from "@/lib/schema/itinerary.schema";
import { areaSearchParams, MIN_PLACES_AROUND, placesAroundIn, type AreaToCheck } from "./area";
import type { GeoapifyClient, Lookup, LookupFailure, LookupParams } from "./geoapify";
import { bestMatch, type Candidate } from "./match";
import { OtherNamesSchema, namesIn } from "./names";

/** What a place is checked by: the fields the model wrote that the rule reads. */
export type PlaceToCheck = Pick<GeneratedPlace, "name" | "kind" | "neighborhood" | "coordinates">;

/** The city the day is in, by the name the request gives it. */
export type CityToCheck = Pick<DayRequest, "city">;

/**
 * "invalid-input" is a place with no point on the map, which is never looked up.
 * "no-match" is a named place nothing confirmed; "too-few-places" an area with fewer places
 * of its kind around it than the check asks.
 */
export type UnverifiedReason = "no-match" | "too-few-places" | "invalid-input" | LookupFailure;

/**
 * "verified" by name promises that a place of this name and this kind is at this spot, and no
 * more. On the written days the rule confirmed one wrong place of 39, a restaurant whose name
 * shares the day's one distinctive word, so it does not promise the place the model meant. The
 * coordinates are the provider's, which replace the model's.
 *
 * "verified" by area, for a coffee, food or bar stop, promises that at least
 * `MIN_PLACES_AROUND` places of its kind stand within a short walk of its point, and says how
 * many the lookup found, up to its page of 20. The coordinates stay the model's: an area has
 * no door for the provider to place.
 *
 * "unverified" is every other ending, a lookup that failed included; the day is never lost
 * to one. A caller that caches checks, by `placeCheckKey`, may keep "verified", "no-match"
 * and "too-few-places", which are the provider's answer about the place. It must not keep
 * "failed", "timeout", "quota", "aborted" or "no-key", which say only that this lookup did
 * not finish, nor "invalid-input", which is the model's to fix; `isCacheable` says which.
 */
export type PlaceCheck =
  | {
      kind: "verified";
      by: "name";
      lat: number;
      lng: number;
      providerId: string;
      source: "geoapify";
    }
  | {
      kind: "verified";
      by: "area";
      lat: number;
      lng: number;
      placesAround: number;
      source: "geoapify";
    }
  | { kind: "unverified"; reason: UnverifiedReason };

export function isCacheable(check: PlaceCheck): boolean {
  return (
    check.kind === "verified" || check.reason === "no-match" || check.reason === "too-few-places"
  );
}

/** One key for every check of the same place in the same city: what the check reads, in order. */
export function placeCheckKey(place: PlaceToCheck, city: CityToCheck): string {
  const { name, kind, neighborhood, coordinates } = place;
  return JSON.stringify([city.city, name, kind, neighborhood, coordinates.lat, coordinates.lng]);
}

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

function isOnTheMap({ lat, lng }: PlaceToCheck["coordinates"]): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= MAX_LATITUDE &&
    Math.abs(lng) <= MAX_LONGITUDE
  );
}

function unverified(reason: UnverifiedReason): PlaceCheck {
  return { kind: "unverified", reason };
}

/**
 * Runs one check of a place that has a point on the map, asking nothing for one that has not.
 * A check is not meant to reject; one that does still leaves the place unverified.
 */
async function checkOnTheMap(
  place: Pick<PlaceToCheck, "coordinates">,
  check: () => Promise<PlaceCheck>,
): Promise<PlaceCheck> {
  if (!isOnTheMap(place.coordinates)) return unverified("invalid-input");
  try {
    return await check();
  } catch {
    return unverified("failed");
  }
}

export interface PlaceVerifier {
  /** Never rejects: a failure is an unverified place with its reason. */
  verify(place: PlaceToCheck, city: CityToCheck, signal?: AbortSignal): Promise<PlaceCheck>;
}

/** The circle a place is looked for in, around the model's coordinates. */
export const SEARCH_RADIUS_METERS = 1000;
export const CANDIDATES_PER_LOOKUP = 5;

/**
 * One search per place, as measured: its name and city as text, inside a hard circle around
 * the model's point (a soft bias alone returned Toronto) and ranked by nearness within it.
 */
export function placeSearchParams(place: PlaceToCheck, city: CityToCheck): LookupParams {
  const { lat, lng } = place.coordinates;
  return {
    text: `${place.name}, ${city.city}`,
    filter: `circle:${lng},${lat},${SEARCH_RADIUS_METERS}`,
    bias: `proximity:${lng},${lat}`,
    lang: "en",
    limit: String(CANDIDATES_PER_LOOKUP),
    format: "json",
  };
}

// Loose: a result carries much more than the rule reads.
const ResultSchema = z.object({
  place_id: z.string(),
  lat: z.number(),
  lon: z.number(),
  result_type: z.string(),
  name: z.string().optional(),
  name_international: OtherNamesSchema.optional(),
  other_names: OtherNamesSchema.optional(),
  category: z.string().optional(),
});
const ResponseSchema = z.object({ results: z.array(z.unknown()) });

type Result = z.infer<typeof ResultSchema>;

interface LocatedCandidate extends Candidate {
  result: Result;
}

function candidateOf(place: PlaceToCheck, result: Result): LocatedCandidate {
  const names = [
    ...(result.name === undefined ? [] : [result.name]),
    ...namesIn(result.name_international),
    ...namesIn(result.other_names),
  ];
  return {
    names: [...new Set(names)],
    meters: distanceInMeters(place.coordinates, { lat: result.lat, lng: result.lon }),
    resultType: result.result_type,
    category: result.category ?? null,
    result,
  };
}

/**
 * The candidates in a geocoding body, or null when it is not one. A result the rule cannot
 * read, with no id or no point, is left out rather than spoil the others.
 */
export function candidatesIn(place: PlaceToCheck, body: unknown): LocatedCandidate[] | null {
  const response = ResponseSchema.safeParse(body);
  if (!response.success) return null;
  return response.data.results.flatMap((entry) => {
    const result = ResultSchema.safeParse(entry);
    return result.success ? [candidateOf(place, result.data)] : [];
  });
}

/**
 * Checks a place by its name through any geocoding search: Geoapify's on the server, a
 * recording in tests. Every kind but coffee, food and bar is checked so. Run on a coffee, food
 * or bar place, it says whether the model named one venue: a café, restaurant or bar of that
 * name confirmed at its point is the establishment day-v3 asks never to name.
 */
export function createNameVerifier(geocode: Lookup): PlaceVerifier {
  return {
    verify(place, city, signal) {
      return checkOnTheMap(place, async () => {
        const answer = await geocode(placeSearchParams(place, city), signal);
        if (!answer.ok) return unverified(answer.failure);
        const candidates = candidatesIn(place, answer.body);
        if (candidates === null) return unverified("failed");
        const match = bestMatch(place, city, candidates);
        if (match === null) return unverified("no-match");
        const { lat, lon, place_id } = match.result;
        return {
          kind: "verified",
          by: "name",
          lat,
          lng: lon,
          providerId: place_id,
          source: "geoapify",
        };
      });
    },
  };
}

export interface AreaVerifier {
  /** Never rejects: a failure is an unverified area with its reason. */
  verify(area: AreaToCheck, signal?: AbortSignal): Promise<PlaceCheck>;
}

/** Checks a coffee, food or bar area by the places of its kind around it, on any Places search. */
export function createAreaVerifier(places: Lookup): AreaVerifier {
  return {
    verify(area, signal) {
      return checkOnTheMap(area, async () => {
        const answer = await places(areaSearchParams(area), signal);
        if (!answer.ok) return unverified(answer.failure);
        const placesAround = placesAroundIn(area, answer.body);
        if (placesAround === null) return unverified("failed");
        if (placesAround < MIN_PLACES_AROUND) return unverified("too-few-places");
        const { lat, lng } = area.coordinates;
        return { kind: "verified", by: "area", lat, lng, placesAround, source: "geoapify" };
      });
    },
  };
}

/**
 * The check every live place gets, on Geoapify's client or on recordings in tests: a coffee,
 * food or bar area by the places around it, every other kind by its name. Each place costs one
 * lookup, one credit, either way.
 */
export function createPlaceVerifier({ geocode, places }: GeoapifyClient): PlaceVerifier {
  const byName = createNameVerifier(geocode);
  const byArea = createAreaVerifier(places);
  return {
    verify(place, city, signal) {
      const { kind, coordinates } = place;
      return isAreaKind(kind)
        ? byArea.verify({ kind, coordinates }, signal)
        : byName.verify(place, city, signal);
    },
  };
}
