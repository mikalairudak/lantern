import { z } from "zod";
import { MAX_CITY_READINGS } from "@/lib/normalizer/normalize-intake";
import type { CityReading, GeneratedIntake } from "@/lib/schema/intake.schema";
import { OtherNamesSchema, foldToLatin, namesIn } from "@/lib/places/names";
import { isCountryCalled } from "./country-names";

/**
 * The resolver: whether Geoapify knows a name the intake wrote as a place a day can happen in,
 * and which zone the day's date and light are read in (`docs/harness.md`, "The resolver").
 * One geocoding search per name, `citySearchParams`, on the client the places share
 * (`src/lib/places/server.ts`). The responses it is tested on are hand-written in Geoapify's
 * documented shape (`src/lib/fixtures/intake/places.ts`); no city lookup has been recorded.
 */

/** One search for a name as the intake wrote it, "Portland, Oregon", for cities only. */
export function citySearchParams(name: string): Readonly<Record<string, string>> {
  return { text: name, type: "city", lang: "en", limit: "5", format: "json" };
}

/** Looks a name up and resolves with the response body as Geoapify sends it. */
export type TextSearch = (query: string, signal?: AbortSignal) => Promise<unknown>;

// Loose objects: a result carries more than the resolver reads, and that is not an error.
const CityResultSchema = z.object({
  place_id: z.string(),
  result_type: z.string(),
  name: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  state_code: z.string().optional(),
  county: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  name_international: OtherNamesSchema.optional(),
  other_names: OtherNamesSchema.optional(),
  timezone: z.object({ name: z.string() }).optional(),
});
// A search that finds nothing answers with an empty list.
const GeocodeResponseSchema = z.object({ results: z.array(CityResultSchema) });

type CityResult = z.infer<typeof CityResultSchema>;

/** The result types of an area; an address, a street or a business is never a city. */
const AREA_RESULT_TYPES: readonly string[] = [
  "city",
  "district",
  "suburb",
  "county",
  "state",
  "country",
];

/** Lower case, in plain Latin letters, without punctuation: "Île-de-France" reads "ile de france". */
function plain(text: string): string {
  return foldToLatin(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isOneOf(text: string, values: readonly (string | undefined)[]): boolean {
  return values.some((value) => value !== undefined && plain(value) === plain(text));
}

/** A city's name without a closing "City", so "New York City" reads as New York. */
function cityNameOf(text: string): string {
  return plain(text).replace(/ city$/, "");
}

/** Called by any of its names: its own, its city's, or one in another language ("Köln"). */
function isCalled(result: CityResult, name: string): boolean {
  const names = [
    result.name,
    result.city,
    ...namesIn(result.name_international),
    ...namesIn(result.other_names),
  ];
  return names.some((each) => each !== undefined && cityNameOf(each) === cityNameOf(name));
}

/**
 * A region or country by its name or code ("Oregon", "OR"), the county a town is known by
 * ("Whitby, North Yorkshire, England", as the intake suggested a coastal town), or the country
 * by a short form.
 */
function isRegionOf(result: CityResult, qualifier: string): boolean {
  return (
    isOneOf(qualifier, [result.state, result.state_code, result.county, result.country]) ||
    (result.country_code !== undefined && isCountryCalled(qualifier, result.country_code))
  );
}

/**
 * Whether a result is the city a name asked for: called by the name before the first comma,
 * and in the region or country after it, when the name gives one. The geocoder answers a name
 * it cannot find with the nearest thing it can, and a lookup by name alone has come back with
 * Toronto and Melbourne; a result that is not called what was asked is not that city.
 */
function isAskedFor(result: CityResult, query: string): boolean {
  const [name = "", ...qualifiers] = query.split(",").map((part) => part.trim());
  return (
    isCalled(result, name) &&
    qualifiers
      .filter((qualifier) => qualifier !== "")
      .every((qualifier) => isRegionOf(result, qualifier))
  );
}

/**
 * "Oregon, United States" for Portland; "Japan" for Kyoto, whose prefecture is named for it,
 * and "Portugal" for Lisbon, whose district is Lisbon too.
 */
function regionOf(name: string, { state, country }: CityResult): string {
  const isOwnName = (part: string) =>
    plain(part) === plain(name) || plain(part).startsWith(`${plain(name)} `);
  const parts = [state, country].filter((part): part is string => part !== undefined);
  return [...new Set(parts)].filter((part) => !isOwnName(part)).join(", ");
}

/**
 * The cities in a response to a search for `query` that a day can happen in: an area, never
 * a business, called what was asked and in the region asked, and only with a time zone, which
 * is the provider's, never the model's. Which kinds of area count as a city is the intake's to
 * judge, since it wrote the name; real responses on Tokyo, Singapore and a British town check
 * the rule once lookups are live. Throws on a body that is not a geocoding response.
 */
export function citiesIn(response: unknown, query: string): CityReading[] {
  const { results } = GeocodeResponseSchema.parse(response);
  return results.flatMap((result): CityReading[] => {
    const name = result.name ?? result.city;
    const timezone = result.timezone?.name;
    if (
      !AREA_RESULT_TYPES.includes(result.result_type) ||
      name === undefined ||
      timezone === undefined ||
      !isAskedFor(result, query)
    ) {
      return [];
    }
    return [{ placeId: result.place_id, name, region: regionOf(name, result), timezone }];
  });
}

/**
 * The cities the intake's names were found as. A city it named is the first place Geoapify
 * finds for it, or none: the intake already judged that one city fits the name. The others
 * its name could mean follow it, and are nothing without it. Each city a name was read as is
 * looked up on its own, so the question and the city word offer only places Geoapify knows,
 * each once.
 */
export async function resolveCities(
  intake: GeneratedIntake,
  search: TextSearch,
  signal?: AbortSignal,
): Promise<CityReading[]> {
  const names =
    intake.city === null
      ? intake.cityReadings.slice(0, MAX_CITY_READINGS)
      : [intake.city, ...intake.cityReadings.slice(0, MAX_CITY_READINGS - 1)];
  const firsts = await Promise.all(
    names.map(async (name) => citiesIn(await search(name, signal), name)[0]),
  );
  if (intake.city !== null && firsts[0] === undefined) return [];
  const found = firsts.filter((city): city is CityReading => city !== undefined);
  return found.filter(
    (city, index) => found.findIndex((other) => other.placeId === city.placeId) === index,
  );
}
