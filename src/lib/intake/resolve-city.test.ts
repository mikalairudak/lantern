import { describe, expect, it, vi } from "vitest";
import { CITY_RESPONSES, searchWrittenPlaces } from "@/lib/fixtures/intake/places";
import { GeneratedIntakeSchema, type GeneratedIntake } from "@/lib/schema/intake.schema";
import { citiesIn, citySearchParams, resolveCities } from "./resolve-city";

function intakeOf(fields: Partial<GeneratedIntake>): GeneratedIntake {
  return GeneratedIntakeSchema.parse({
    city: null,
    cityReadings: [],
    energy: null,
    energyGuess: null,
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: null,
    date: null,
    unplaced: [],
    ...fields,
  });
}

function resultsOf(name: string): object[] {
  return (CITY_RESPONSES[name] as { results: object[] }).results;
}

const [LISBON] = resultsOf("Lisbon");
const [PORTLAND_OREGON] = resultsOf("Portland, Oregon");

const CAFE = {
  place_id: "cafe",
  name: "Lisbon Café",
  city: "London",
  country: "United Kingdom",
  result_type: "amenity",
  category: "catering.cafe",
  timezone: { name: "Europe/London" },
};

/** Portland in Victoria, Australia, which a search by name alone can rank first. */
const PORTLAND_VICTORIA = {
  ...PORTLAND_OREGON,
  place_id: "portland-vic",
  state: "Victoria",
  state_code: "VIC",
  country: "Australia",
  country_code: "au",
  timezone: { name: "Australia/Melbourne" },
};

const TORONTO = {
  place_id: "toronto",
  name: "Toronto",
  city: "Toronto",
  state: "Ontario",
  country: "Canada",
  country_code: "ca",
  result_type: "city",
  timezone: { name: "America/Toronto" },
};

const LONDON_ENGLAND = {
  place_id: "london-gb",
  name: "London",
  city: "London",
  state: "England",
  country: "United Kingdom",
  country_code: "gb",
  result_type: "city",
  timezone: { name: "Europe/London" },
};

const LONDON_ONTARIO = {
  ...LONDON_ENGLAND,
  place_id: "london-ca",
  state: "Ontario",
  state_code: "ON",
  country: "Canada",
  country_code: "ca",
  timezone: { name: "America/Toronto" },
};

describe("citySearchParams", () => {
  it("asks the geocoder for cities only, in English", () => {
    expect(citySearchParams("Portland, Oregon")).toEqual({
      text: "Portland, Oregon",
      type: "city",
      lang: "en",
      limit: "5",
      format: "json",
    });
  });
});

describe("citiesIn", () => {
  it("reads a city's name, region and zone from its result", () => {
    expect(citiesIn(CITY_RESPONSES["Portland, Oregon"], "Portland, Oregon")).toEqual([
      {
        placeId: "fixture-portland-or",
        name: "Portland",
        region: "Oregon, United States",
        timezone: "America/Los_Angeles",
      },
    ]);
  });

  it("leaves out of the region a part that only repeats the city's name", () => {
    expect(citiesIn(CITY_RESPONSES.Lisbon, "Lisbon")[0]?.region).toBe("Portugal");
    expect(citiesIn(CITY_RESPONSES.Kyoto, "Kyoto")[0]?.region).toBe("Japan");
  });

  it("keeps only areas with a time zone, never a business", () => {
    const zoneless = { ...LISBON, place_id: "zoneless", timezone: undefined };
    const cities = citiesIn({ results: [CAFE, zoneless, LISBON] }, "Lisbon");

    expect(cities.map(({ placeId }) => placeId)).toEqual(["fixture-lisbon"]);
  });

  it("drops a city that is not called what was asked", () => {
    expect(citiesIn({ results: [TORONTO] }, "Atlantis")).toEqual([]);
    expect(citiesIn({ results: [LISBON] }, "Lisbon, Ohio")).toEqual([]);
  });

  it("drops a city of the name in another region or country than the one asked", () => {
    const response = { results: [PORTLAND_VICTORIA, PORTLAND_OREGON] };

    expect(citiesIn(response, "Portland, Oregon").map(({ placeId }) => placeId)).toEqual([
      "fixture-portland-or",
    ]);
    expect(citiesIn(response, "Portland, OR")[0]?.placeId).toBe("fixture-portland-or");
    expect(citiesIn(response, "Portland, Australia")[0]?.placeId).toBe("portland-vic");
  });

  it("reads a country by the short forms visitors type", () => {
    const london = { results: [LONDON_ONTARIO, LONDON_ENGLAND] };
    const portlands = { results: [PORTLAND_VICTORIA, PORTLAND_OREGON] };

    expect(citiesIn(london, "London, UK").map(({ placeId }) => placeId)).toEqual(["london-gb"]);
    expect(citiesIn(portlands, "Portland, USA")[0]?.placeId).toBe("fixture-portland-or");
    expect(citiesIn(CITY_RESPONSES.Paris, "Paris, FR")[0]?.placeId).toBe("fixture-paris");
    expect(citiesIn(CITY_RESPONSES.Paris, "Paris, FRA")[0]?.placeId).toBe("fixture-paris");
  });

  it("still refuses a country the city is not in", () => {
    expect(
      citiesIn({ results: [LONDON_ENGLAND, LONDON_ONTARIO] }, "London, Canada").map(
        ({ placeId }) => placeId,
      ),
    ).toEqual(["london-ca"]);
    expect(citiesIn({ results: [LONDON_ENGLAND] }, "London, Canada")).toEqual([]);
    expect(citiesIn({ results: [LONDON_ENGLAND] }, "London, USA")).toEqual([]);
  });

  it("reads a nation of the United Kingdom as the city's own state, and only that", () => {
    const glasgow = {
      results: [
        {
          ...LONDON_ENGLAND,
          place_id: "glasgow",
          name: "Glasgow",
          city: "Glasgow",
          state: "Scotland",
        },
      ],
    };
    const edinburgh = {
      results: [
        {
          ...LONDON_ENGLAND,
          place_id: "edinburgh",
          name: "Edinburgh",
          city: "Edinburgh",
          state: "Scotland",
        },
      ],
    };

    expect(citiesIn(glasgow, "Glasgow, Scotland")).toHaveLength(1);
    expect(citiesIn(glasgow, "Glasgow, UK")).toHaveLength(1);
    expect(citiesIn(glasgow, "Glasgow, England")).toEqual([]);
    expect(citiesIn(edinburgh, "Edinburgh, England")).toEqual([]);
    expect(citiesIn({ results: [LONDON_ENGLAND] }, "London, Wales")).toEqual([]);
  });

  // intake-v4 suggested "Whitby, North Yorkshire, England" for a quiet coastal town, and the
  // resolver, which read a state but no county, found nothing.
  it("reads a county as a town's region, as a suggestion names a British town", () => {
    const whitby = {
      results: [
        {
          ...LONDON_ENGLAND,
          place_id: "whitby",
          name: "Whitby",
          city: "Whitby",
          county: "North Yorkshire",
        },
      ],
    };

    expect(citiesIn(whitby, "Whitby, North Yorkshire, England")).toHaveLength(1);
    expect(citiesIn(whitby, "Whitby, Cornwall, England")).toEqual([]);
  });

  it("finds a city by a name it carries in another language", () => {
    const byOtherName = {
      ...LONDON_ENGLAND,
      place_id: "cologne",
      name: "Cologne",
      city: "Cologne",
      state: "North Rhine-Westphalia",
      country: "Germany",
      country_code: "de",
      other_names: { "name:de": "Köln" },
      timezone: { name: "Europe/Berlin" },
    };
    const byInternational = {
      ...byOtherName,
      other_names: undefined,
      name_international: { de: "Köln", en: "Cologne" },
    };

    expect(citiesIn({ results: [byOtherName] }, "Köln")[0]?.name).toBe("Cologne");
    expect(citiesIn({ results: [byInternational] }, "Koln, Germany")[0]?.name).toBe("Cologne");
  });

  it("reads New York City as New York, and a letter no decomposition breaks as typed", () => {
    const newYork = {
      ...LONDON_ENGLAND,
      place_id: "nyc",
      name: "New York",
      city: "New York",
      state: "New York",
      country: "United States",
      country_code: "us",
      timezone: { name: "America/New_York" },
    };
    const lodz = {
      ...LONDON_ENGLAND,
      place_id: "lodz",
      name: "Łódź",
      city: "Łódź",
      state: "Łódź Voivodeship",
      country: "Poland",
      country_code: "pl",
      timezone: { name: "Europe/Warsaw" },
    };

    expect(citiesIn({ results: [newYork] }, "New York City")[0]?.placeId).toBe("nyc");
    expect(citiesIn({ results: [newYork] }, "New York City, USA")[0]?.region).toBe("United States");
    expect(citiesIn({ results: [lodz] }, "Lodz, Poland")[0]?.placeId).toBe("lodz");
  });

  it("reads a name without its case or diacritics, and past a trailing comma", () => {
    expect(citiesIn({ results: [LISBON] }, "lisbon, PORTUGAL")).toHaveLength(1);
    expect(citiesIn({ results: [LISBON] }, "Lisbon,")).toHaveLength(1);
  });

  it("finds nothing in the empty list the geocoder answers a fruitless search with", () => {
    expect(citiesIn({ results: [] }, "Atlantis")).toEqual([]);
  });

  it("throws on a body that is not a geocoding response", () => {
    expect(() => citiesIn({ results: [{ name: "Lisbon" }] }, "Lisbon")).toThrow();
    expect(() => citiesIn({}, "Lisbon")).toThrow();
  });
});

describe("resolveCities", () => {
  it("looks a named city up once and takes Geoapify's first city for it", async () => {
    const search = vi.fn(() =>
      Promise.resolve({
        results: [...resultsOf("Springfield, Illinois"), ...resultsOf("Springfield, Missouri")],
      }),
    );
    const cities = await resolveCities(intakeOf({ city: "Springfield" }), search);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("Springfield", undefined);
    expect(cities.map(({ region }) => region)).toEqual(["Illinois, United States"]);
  });

  it("finds no city for a name Geoapify does not know", async () => {
    await expect(
      resolveCities(intakeOf({ city: "Atlantis" }), searchWrittenPlaces),
    ).resolves.toEqual([]);
  });

  it("finds no city when all that comes back is another city", async () => {
    const search = vi.fn(() => Promise.resolve({ results: [TORONTO] }));
    await expect(resolveCities(intakeOf({ city: "Atlantis" }), search)).resolves.toEqual([]);
  });

  it("looks up each city a shared name was read as, at most three, each once", async () => {
    const readings = [
      "Springfield, Illinois",
      "Kyoto",
      "Kyoto, Japan",
      "Springfield, Missouri",
      "Springfield, Massachusetts",
    ];
    const search = vi.fn(searchWrittenPlaces);
    const cities = await resolveCities(intakeOf({ cityReadings: readings }), search);

    expect(search.mock.calls.map(([query]) => query)).toEqual(readings.slice(0, 3));
    expect(cities.map(({ placeId }) => placeId)).toEqual([
      "fixture-springfield-il",
      "fixture-kyoto",
    ]);
  });

  it("looks a named city up first, then the others its name could mean, three in all", async () => {
    const others = ["Springfield, Missouri", "Springfield, Massachusetts", "Kyoto"];
    const search = vi.fn(searchWrittenPlaces);
    const cities = await resolveCities(
      intakeOf({ city: "Springfield, Illinois", cityReadings: others }),
      search,
    );

    expect(search.mock.calls.map(([query]) => query)).toEqual([
      "Springfield, Illinois",
      ...others.slice(0, 2),
    ]);
    expect(cities.map(({ placeId }) => placeId)).toEqual([
      "fixture-springfield-il",
      "fixture-springfield-mo",
      "fixture-springfield-ma",
    ]);
  });

  it("offers none of the others when the named city itself is not found", async () => {
    await expect(
      resolveCities(intakeOf({ city: "Atlantis", cityReadings: ["Kyoto"] }), searchWrittenPlaces),
    ).resolves.toEqual([]);
  });

  it("passes the caller's signal to every search", async () => {
    const search = vi.fn(searchWrittenPlaces);
    const { signal } = new AbortController();
    await resolveCities(intakeOf({ city: "Lisbon" }), search, signal);

    expect(search).toHaveBeenCalledWith("Lisbon", signal);
  });

  it("fails on a name no written response answers, rather than find nothing", async () => {
    await expect(searchWrittenPlaces("Lisbon, Ohio")).rejects.toThrow('"Lisbon, Ohio"');
  });

  it("asks nothing when the intake named no city and read none", async () => {
    const search = vi.fn(searchWrittenPlaces);

    await expect(resolveCities(intakeOf({}), search)).resolves.toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
