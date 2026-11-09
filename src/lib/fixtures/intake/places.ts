/**
 * Geoapify geocoding responses (`format=json`, `type=city`) for the names the golden intakes
 * write, hand-written in the shape Geoapify documents, with made-up place ids and only the
 * fields the resolver reads. They are not recordings: no city lookup has been recorded yet.
 * The prefectures are named as OpenStreetMap names them in English ("Kyoto Prefecture"),
 * which a recording should confirm.
 */

interface CityResultOptions {
  id: string;
  name: string;
  /** The state, prefecture or district, when there is one. */
  state?: string;
  stateCode?: string;
  /** The county, as Geoapify gives a British town's. */
  county?: string;
  country: string;
  countryCode: string;
  timezone: string;
}

/** A city as Geoapify's geocoder returns it. */
function cityResult({
  id,
  name,
  state,
  stateCode,
  county,
  country,
  countryCode,
  timezone,
}: CityResultOptions) {
  return {
    place_id: `fixture-${id}`,
    name,
    city: name,
    ...(state === undefined ? {} : { state }),
    ...(stateCode === undefined ? {} : { state_code: stateCode }),
    ...(county === undefined ? {} : { county }),
    country,
    country_code: countryCode,
    result_type: "city",
    timezone: { name: timezone },
  };
}

function found(...results: ReturnType<typeof cityResult>[]) {
  return { results };
}

const LISBON = cityResult({
  id: "lisbon",
  name: "Lisbon",
  state: "Lisbon",
  country: "Portugal",
  countryCode: "pt",
  timezone: "Europe/Lisbon",
});
const KYOTO = cityResult({
  id: "kyoto",
  name: "Kyoto",
  state: "Kyoto Prefecture",
  country: "Japan",
  countryCode: "jp",
  timezone: "Asia/Tokyo",
});
const TOKYO = cityResult({
  id: "tokyo",
  name: "Tokyo",
  state: "Tokyo",
  country: "Japan",
  countryCode: "jp",
  timezone: "Asia/Tokyo",
});
const OSAKA = cityResult({
  id: "osaka",
  name: "Osaka",
  state: "Osaka Prefecture",
  country: "Japan",
  countryCode: "jp",
  timezone: "Asia/Tokyo",
});

function usCity(id: string, name: string, state: string, stateCode: string, timezone: string) {
  return cityResult({
    id,
    name,
    state,
    stateCode,
    country: "United States",
    countryCode: "us",
    timezone,
  });
}

/** What the geocoder answers for each name, as the golden intakes write them. */
export const CITY_RESPONSES: Readonly<Record<string, unknown>> = {
  Lisbon: found(LISBON),
  Kyoto: found(KYOTO),
  "Kyoto, Japan": found(KYOTO),
  "Osaka, Japan": found(OSAKA),
  Tokyo: found(TOKYO),
  "Tokyo, Japan": found(TOKYO),
  Madrid: found(
    cityResult({
      id: "madrid",
      name: "Madrid",
      state: "Community of Madrid",
      country: "Spain",
      countryCode: "es",
      timezone: "Europe/Madrid",
    }),
  ),
  Paris: found(
    cityResult({
      id: "paris",
      name: "Paris",
      state: "Ile-de-France",
      country: "France",
      countryCode: "fr",
      timezone: "Europe/Paris",
    }),
  ),
  Rome: found(
    cityResult({
      id: "rome",
      name: "Rome",
      state: "Lazio",
      country: "Italy",
      countryCode: "it",
      timezone: "Europe/Rome",
    }),
  ),
  Porto: found(
    cityResult({
      id: "porto",
      name: "Porto",
      state: "Porto",
      country: "Portugal",
      countryCode: "pt",
      timezone: "Europe/Lisbon",
    }),
  ),
  Seville: found(
    cityResult({
      id: "seville",
      name: "Seville",
      state: "Andalusia",
      country: "Spain",
      countryCode: "es",
      timezone: "Europe/Madrid",
    }),
  ),
  "Portland, Oregon": found(
    usCity("portland-or", "Portland", "Oregon", "OR", "America/Los_Angeles"),
  ),
  "Portland, Maine": found(usCity("portland-me", "Portland", "Maine", "ME", "America/New_York")),
  "Springfield, Illinois": found(
    usCity("springfield-il", "Springfield", "Illinois", "IL", "America/Chicago"),
  ),
  "Springfield, Missouri": found(
    usCity("springfield-mo", "Springfield", "Missouri", "MO", "America/Chicago"),
  ),
  "Springfield, Massachusetts": found(
    usCity("springfield-ma", "Springfield", "Massachusetts", "MA", "America/New_York"),
  ),
  // The cities the suggestion cases offer, as an intake writes a reading: with its country.
  "Lisbon, Portugal": found(LISBON),
  "Rome, Italy": found(
    cityResult({
      id: "rome",
      name: "Rome",
      state: "Lazio",
      country: "Italy",
      countryCode: "it",
      timezone: "Europe/Rome",
    }),
  ),
  "Madrid, Spain": found(
    cityResult({
      id: "madrid",
      name: "Madrid",
      state: "Community of Madrid",
      country: "Spain",
      countryCode: "es",
      timezone: "Europe/Madrid",
    }),
  ),
  "Porto, Portugal": found(
    cityResult({
      id: "porto",
      name: "Porto",
      state: "Porto",
      country: "Portugal",
      countryCode: "pt",
      timezone: "Europe/Lisbon",
    }),
  ),
  "Malaga, Spain": found(
    cityResult({
      id: "malaga",
      name: "Málaga",
      state: "Andalusia",
      country: "Spain",
      countryCode: "es",
      timezone: "Europe/Madrid",
    }),
  ),
  "Valencia, Spain": found(
    cityResult({
      id: "valencia",
      name: "Valencia",
      state: "Valencian Community",
      country: "Spain",
      countryCode: "es",
      timezone: "Europe/Madrid",
    }),
  ),
  "Whitby, North Yorkshire, England": found(
    cityResult({
      id: "whitby",
      name: "Whitby",
      state: "England",
      county: "North Yorkshire",
      country: "United Kingdom",
      countryCode: "gb",
      timezone: "Europe/London",
    }),
  ),
  "St Ives, Cornwall, England": found(
    cityResult({
      id: "st-ives",
      name: "St Ives",
      state: "England",
      county: "Cornwall",
      country: "United Kingdom",
      countryCode: "gb",
      timezone: "Europe/London",
    }),
  ),
  "Cascais, Portugal": found(
    cityResult({
      id: "cascais",
      name: "Cascais",
      state: "Lisbon",
      country: "Portugal",
      countryCode: "pt",
      timezone: "Europe/Lisbon",
    }),
  ),
  "Sitges, Spain": found(
    cityResult({
      id: "sitges",
      name: "Sitges",
      state: "Catalonia",
      country: "Spain",
      countryCode: "es",
      timezone: "Europe/Madrid",
    }),
  ),
  "Innsbruck, Austria": found(
    cityResult({
      id: "innsbruck",
      name: "Innsbruck",
      state: "Tyrol",
      country: "Austria",
      countryCode: "at",
      timezone: "Europe/Vienna",
    }),
  ),
  "Interlaken, Switzerland": found(
    cityResult({
      id: "interlaken",
      name: "Interlaken",
      state: "Bern",
      country: "Switzerland",
      countryCode: "ch",
      timezone: "Europe/Zurich",
    }),
  ),
  // Nothing found: the geocoder answers with an empty list.
  Atlantis: found(),
};

/** A search over the responses above that fails on a name nobody wrote a response for. */
export function searchWrittenPlaces(query: string): Promise<unknown> {
  const response = CITY_RESPONSES[query];
  if (response === undefined) {
    return Promise.reject(new Error(`No geocoding response is written for "${query}"`));
  }
  return Promise.resolve(response);
}
