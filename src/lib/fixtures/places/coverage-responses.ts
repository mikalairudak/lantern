import { EARTH_RADIUS_METERS } from "@/lib/geo/distance";
import type { Lookup } from "@/lib/places/geoapify";
import { createNameVerifier, type PlaceVerifier } from "@/lib/places/verify-place";
import { COVERAGE_RUN, type RecordedLookup } from "./coverage-run";

/** Metres per degree of latitude on the sphere `distanceInMeters` measures on. */
const METERS_PER_DEGREE = (Math.PI * EARTH_RADIUS_METERS) / 180;

function slugOf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/**
 * The geocoding body a recorded lookup stands for, in Geoapify's shape. The recording kept the
 * candidate's distance but not its point or id, so the point is set that far due north of the
 * day's and the id is made up; a candidate's further names go in `other_names` as OpenStreetMap
 * joins them, with semicolons.
 */
export function responseOf({ city, place, found }: RecordedLookup): unknown {
  if (found === null) return { results: [] };
  const [name, ...otherNames] = found.names;
  const { lat, lng } = place.coordinates;
  return {
    results: [
      {
        place_id: `recorded-${slugOf(city)}-${slugOf(place.name)}`,
        name,
        ...(otherNames.length === 0 ? {} : { other_names: { alt_name: otherNames.join(";") } }),
        lat: lat + found.meters / METERS_PER_DEGREE,
        lon: lng,
        result_type: found.resultType,
        ...(found.category === null ? {} : { category: found.category }),
      },
    ],
  };
}

/** Answers a place search from the recording; a place it does not hold fails, as a lookup can. */
export const searchRecordedPlaces: Lookup = (params) => {
  const lookup = COVERAGE_RUN.find(({ city, place }) => params.text === `${place.name}, ${city}`);
  return Promise.resolve(
    lookup === undefined
      ? { ok: false, failure: "failed" }
      : { ok: true, body: responseOf(lookup) },
  );
};

/**
 * The name check for tests on the written days' places, through the same parsing and rule as
 * the live one: 39 of their 66 places come back verified. The recording predates the area
 * check, so it still measures the name rule on every kind, the written days' 25 cafés,
 * restaurants and bars included, which the live verifier now checks by the places around them.
 */
export const recordedNameVerifier: PlaceVerifier = createNameVerifier(searchRecordedPlaces);
