// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import {
  CHECKING,
  DIRECTIONS_TO_THE_AREA,
  FOUND_BY_NAME,
  NOT_CONFIRMED,
  OPEN_IN_GOOGLE_MAPS,
  SEARCH_IN_GOOGLE_MAPS,
  mapActionOf,
  mapDirectionsUrlOf,
  mapSearchUrlOf,
  type MapPlace,
} from "./map-action";

const TEMPLE: MapPlace = {
  name: "Nanzen-ji",
  kind: "sacred",
  city: "Kyoto",
  point: { lat: 35.0113, lng: 135.7944 },
};
const LUNCH: MapPlace = {
  name: "Obanzai along Pontocho",
  kind: "food",
  city: "Kyoto",
  point: { lat: 35.0052, lng: 135.7712 },
};
/** Where the search found the temple by its name, a little off the model's point. */
const FOUND_AT = { lat: 35.01104, lng: 135.79437 };

const BY_NAME: PlaceCheck = {
  placeId: "p",
  state: "confirmed",
  by: "name",
  coordinates: FOUND_AT,
};
const BY_AREA: PlaceCheck = { placeId: "p", state: "confirmed", by: "area" };
const CHECKING_NOW: PlaceCheck = { placeId: "p", state: "checking" };
const UNCONFIRMED: PlaceCheck = { placeId: "p", state: "unconfirmed" };
const UNCHECKED: PlaceCheck = { placeId: "p", state: "unchecked" };

/** What a map link asks for, as the map reads it. */
function asked(href: string): { path: string; params: Record<string, string> } {
  const url = new URL(href);
  return { path: `${url.origin}${url.pathname}`, params: Object.fromEntries(url.searchParams) };
}

describe("the map's URLs", () => {
  it("asks Google Maps, with no key, for a search or for the way to a point", () => {
    expect(asked(mapSearchUrlOf("Nanzen-ji, Kyoto"))).toEqual({
      path: "https://www.google.com/maps/search/",
      params: { api: "1", query: "Nanzen-ji, Kyoto" },
    });
    expect(asked(mapDirectionsUrlOf(LUNCH.point!))).toEqual({
      path: "https://www.google.com/maps/dir/",
      params: { api: "1", destination: "35.0052,135.7712" },
    });
  });

  it("encodes the words a model wrote, so none of them can end the query or start another", () => {
    const href = mapSearchUrlOf("Café & Bar #2 / São Bento?api=0, Porto");

    expect(href).not.toMatch(/[ &#?]api=0|#|São/);
    expect(asked(href).params).toEqual({
      api: "1",
      query: "Café & Bar #2 / São Bento?api=0, Porto",
    });
  });

  it("gives a point to six decimals, with no float noise and no trailing zeros", () => {
    const href = mapDirectionsUrlOf({ lat: 35.0113 + 0.0003, lng: -9.1 });

    expect(asked(href).params.destination).toBe("35.0116,-9.1");
    expect(asked(mapDirectionsUrlOf({ lat: 44.4927368, lng: 11.3430324 })).params).toEqual({
      api: "1",
      destination: "44.492737,11.343032",
    });
  });
});

describe("a named place's map row", () => {
  it("asks for its name and the day's city in every check, so the map opens the place's card", () => {
    for (const check of [BY_NAME, BY_AREA, CHECKING_NOW, UNCONFIRMED, UNCHECKED, null]) {
      expect(asked(mapActionOf(TEMPLE, check).href)).toEqual({
        path: "https://www.google.com/maps/search/",
        params: { api: "1", query: "Nanzen-ji, Kyoto" },
      });
    }
  });

  it("opens a place confirmed by its name, and says the hours were not checked", () => {
    const action = mapActionOf(TEMPLE, BY_NAME);

    expect(action.label).toBe(OPEN_IN_GOOGLE_MAPS);
    expect(action.trust).toBe(FOUND_BY_NAME);
  });

  it("opens one confirmed by places around it, which no day gives it, and says so", () => {
    const action = mapActionOf(TEMPLE, BY_AREA);

    expect(action.label).toBe(OPEN_IN_GOOGLE_MAPS);
    expect(action.trust).toBe("Places of its kind found around it on OpenStreetMap.");
  });

  it("searches for one the check has not confirmed, and says how it stands", () => {
    for (const [check, trust] of [
      [CHECKING_NOW, CHECKING],
      [UNCONFIRMED, NOT_CONFIRMED],
      [UNCHECKED, NOT_CONFIRMED],
    ] as const) {
      const action = mapActionOf(TEMPLE, check);
      expect(action.label).toBe(SEARCH_IN_GOOGLE_MAPS);
      expect(action.trust).toBe(trust);
    }
  });

  it("searches for one on a day never checked, with no line on the map", () => {
    expect(mapActionOf(TEMPLE, null)).toMatchObject({ label: SEARCH_IN_GOOGLE_MAPS, trust: null });
  });

  it("searches for one with no kind yet as for a named place", () => {
    expect(mapActionOf({ ...TEMPLE, kind: null }, null).label).toBe(SEARCH_IN_GOOGLE_MAPS);
  });
});

const AREA_LINE = "An area to eat in; choose a place when you arrive.";

describe("a place to eat or drink around's map row", () => {
  it("leads to its own point once places of its kind are found around it", () => {
    const action = mapActionOf(LUNCH, BY_AREA);

    expect(action.label).toBe(DIRECTIONS_TO_THE_AREA);
    expect(asked(action.href)).toEqual({
      path: "https://www.google.com/maps/dir/",
      params: { api: "1", destination: "35.0052,135.7712" },
    });
    expect(action.trust).toBe(`${AREA_LINE} Places to eat found around it on OpenStreetMap.`);
  });

  it("leads to the search's point when found by its name, which no day gives it", () => {
    const action = mapActionOf(LUNCH, BY_NAME);

    expect(asked(action.href).params.destination).toBe("35.01104,135.79437");
  });

  it("searches by its name and city for a point no check vouches for, and says what it is", () => {
    for (const [check, trust] of [
      [CHECKING_NOW, `${AREA_LINE} ${CHECKING}`],
      [UNCONFIRMED, `${AREA_LINE} ${NOT_CONFIRMED}`],
      [UNCHECKED, `${AREA_LINE} ${NOT_CONFIRMED}`],
      [null, AREA_LINE],
    ] as const) {
      const action = mapActionOf(LUNCH, check);
      expect(action.label).toBe(SEARCH_IN_GOOGLE_MAPS);
      expect(asked(action.href).params.query).toBe("Obanzai along Pontocho, Kyoto");
      expect(action.trust).toBe(trust);
    }
  });

  it("searches by its name and city while its point is still to come", () => {
    const action = mapActionOf({ ...LUNCH, point: null }, BY_AREA);

    expect(action.label).toBe(SEARCH_IN_GOOGLE_MAPS);
    expect(asked(action.href).params.query).toBe("Obanzai along Pontocho, Kyoto");
  });

  it("says a café's and a bar's area by what is drunk there", () => {
    expect(mapActionOf({ ...LUNCH, kind: "coffee" }, BY_AREA).trust).toBe(
      "An area for coffee; choose a café when you arrive. Cafés found around it on OpenStreetMap.",
    );
    expect(mapActionOf({ ...LUNCH, kind: "bar" }, BY_AREA).trust).toBe(
      "An area for a drink; choose a bar when you arrive. Bars found around it on OpenStreetMap.",
    );
  });
});
