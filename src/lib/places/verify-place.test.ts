import { describe, expect, it, vi } from "vitest";
import {
  CAMPO_DE_OURIQUE_CORNER,
  MOURARIA,
  searchHandWrittenPlaces,
} from "@/lib/fixtures/places/meal-areas";
import { AREA_KINDS, PLACE_KINDS, type PlaceKind } from "@/lib/schema/itinerary.schema";
import { areaSearchParams, type AreaToCheck } from "./area";
import type { Lookup, LookupAnswer } from "./geoapify";
import {
  candidatesIn,
  createAreaVerifier,
  createNameVerifier,
  createPlaceVerifier,
  isCacheable,
  placeCheckKey,
  placeSearchParams,
  type PlaceCheck,
  type PlaceToCheck,
} from "./verify-place";

const LISBON = { city: "Lisbon" };
const RAMIRO: PlaceToCheck = {
  name: "Cervejaria Ramiro",
  kind: "food",
  neighborhood: "Intendente",
  coordinates: { lat: 38.7224, lng: -9.1356 },
};

/** A restaurant result in Geoapify's shape, a few metres from Ramiro's point. */
function resultOf(fields: Record<string, unknown> = {}) {
  return {
    place_id: "51ramiro",
    name: "Cervejaria Ramiro",
    lat: 38.72245,
    lon: -9.13555,
    result_type: "amenity",
    category: "catering.restaurant",
    rank: { confidence: 1 },
    ...fields,
  };
}

function answering(answer: LookupAnswer): Lookup {
  return vi.fn(() => Promise.resolve(answer));
}

function body(...results: unknown[]): LookupAnswer {
  return { ok: true, body: { results } };
}

describe("placeSearchParams", () => {
  it("searches the name in its city inside a kilometre of the model's point, nearest first", () => {
    expect(placeSearchParams(RAMIRO, LISBON)).toEqual({
      text: "Cervejaria Ramiro, Lisbon",
      filter: "circle:-9.1356,38.7224,1000",
      bias: "proximity:-9.1356,38.7224",
      lang: "en",
      limit: "5",
      format: "json",
    });
  });
});

describe("candidatesIn", () => {
  it("reads the international and other names beside the name, each once", () => {
    const candidates = candidatesIn(RAMIRO, {
      results: [
        resultOf({
          name_international: { en: "Ramiro", pt: "Cervejaria Ramiro" },
          other_names: ["O Ramiro", 7],
        }),
      ],
    });

    expect(candidates?.[0]?.names).toEqual(["Cervejaria Ramiro", "Ramiro", "O Ramiro"]);
  });

  it("splits a tag that holds several names, as OpenStreetMap joins them", () => {
    const candidates = candidatesIn(RAMIRO, {
      results: [resultOf({ other_names: { alt_name: "Ramiro's; O Ramiro", level: 2 } })],
    });

    expect(candidates?.[0]?.names).toEqual(["Cervejaria Ramiro", "Ramiro's", "O Ramiro"]);
  });

  it("leaves out a result it cannot place and keeps the others", () => {
    const candidates = candidatesIn(RAMIRO, {
      results: [{ name: "Cervejaria Ramiro" }, resultOf({ place_id: "kept" })],
    });

    expect(candidates?.map(({ result }) => result.place_id)).toEqual(["kept"]);
  });

  it("measures each candidate from the model's point", () => {
    const [candidate] = candidatesIn(RAMIRO, { results: [resultOf({ lat: 38.7233 })] })!;
    expect(candidate?.meters).toBeCloseTo(100, 0);
  });

  it("reads nothing from a body that is not a geocoding response", () => {
    expect(candidatesIn(RAMIRO, { features: [] })).toBeNull();
    expect(candidatesIn(RAMIRO, "Internal Server Error")).toBeNull();
  });
});

describe("createNameVerifier", () => {
  it("verifies a place at the provider's point, with its id", async () => {
    const verifier = createNameVerifier(answering(body(resultOf())));

    await expect(verifier.verify(RAMIRO, LISBON)).resolves.toEqual({
      kind: "verified",
      by: "name",
      lat: 38.72245,
      lng: -9.13555,
      providerId: "51ramiro",
      source: "geoapify",
    });
  });

  it("verifies on the candidate that passes, not on the first", async () => {
    const shop = resultOf({ place_id: "shop", category: "commercial.gift_and_souvenir" });
    const verifier = createNameVerifier(answering(body(shop, resultOf({ place_id: "right" }))));

    await expect(verifier.verify(RAMIRO, LISBON)).resolves.toMatchObject({ providerId: "right" });
  });

  it("leaves a place unverified when nothing confirms it", async () => {
    const verifier = createNameVerifier(answering(body(resultOf({ name: "Zambeze" }))));
    await expect(verifier.verify(RAMIRO, LISBON)).resolves.toEqual({
      kind: "unverified",
      reason: "no-match",
    });
    await expect(createNameVerifier(answering(body())).verify(RAMIRO, LISBON)).resolves.toEqual({
      kind: "unverified",
      reason: "no-match",
    });
  });

  it.each(["failed", "quota", "timeout", "no-key", "aborted"] as const)(
    "passes on a lookup that ended %s",
    async (failure) => {
      const verifier = createNameVerifier(answering({ ok: false, failure }));
      await expect(verifier.verify(RAMIRO, LISBON)).resolves.toEqual({
        kind: "unverified",
        reason: failure,
      });
    },
  );

  it("answers a malformed body as a failed lookup", async () => {
    const verifier = createNameVerifier(answering({ ok: true, body: null }));
    await expect(verifier.verify(RAMIRO, LISBON)).resolves.toEqual({
      kind: "unverified",
      reason: "failed",
    });
  });

  it("never rejects, even on a search that does", async () => {
    const verifier = createNameVerifier(() => Promise.reject(new Error("socket hang up")));
    await expect(verifier.verify(RAMIRO, LISBON)).resolves.toEqual({
      kind: "unverified",
      reason: "failed",
    });
  });

  it("passes the place's search and the caller's signal on", async () => {
    const search = vi.fn(() => Promise.resolve(body()));
    const { signal } = new AbortController();
    await createNameVerifier(search).verify(RAMIRO, LISBON, signal);

    expect(search).toHaveBeenCalledWith(placeSearchParams(RAMIRO, LISBON), signal);
  });

  it.each([
    { lat: 91, lng: -9.1356 },
    { lat: 38.7224, lng: -181 },
    { lat: Number.NaN, lng: -9.1356 },
    { lat: 38.7224, lng: Number.POSITIVE_INFINITY },
  ])("asks nothing for a point no map holds: %o", async (coordinates) => {
    const search = vi.fn(() => Promise.resolve(body(resultOf())));
    const check = await createNameVerifier(search).verify({ ...RAMIRO, coordinates }, LISBON);

    expect(check).toEqual({ kind: "unverified", reason: "invalid-input" });
    expect(search).not.toHaveBeenCalled();
  });
});

describe("createAreaVerifier", () => {
  const TASCAS: AreaToCheck = { kind: "food", coordinates: MOURARIA };
  const CAFES: AreaToCheck = { kind: "coffee", coordinates: CAMPO_DE_OURIQUE_CORNER };

  it("verifies an area at its own point, with the places it found around it", async () => {
    const verifier = createAreaVerifier(searchHandWrittenPlaces);

    await expect(verifier.verify(TASCAS)).resolves.toEqual({
      kind: "verified",
      by: "area",
      lat: MOURARIA.lat,
      lng: MOURARIA.lng,
      placesAround: 6,
      source: "geoapify",
    });
  });

  it("leaves an area with fewer places of its kind than it asks unverified", async () => {
    await expect(createAreaVerifier(searchHandWrittenPlaces).verify(CAFES)).resolves.toEqual({
      kind: "unverified",
      reason: "too-few-places",
    });
  });

  it.each(["failed", "quota", "timeout", "no-key", "aborted"] as const)(
    "passes on a lookup that ended %s",
    async (failure) => {
      const verifier = createAreaVerifier(answering({ ok: false, failure }));
      await expect(verifier.verify(TASCAS)).resolves.toEqual({
        kind: "unverified",
        reason: failure,
      });
    },
  );

  it("answers a body that is not a Places answer, and a search that rejects, as failed", async () => {
    const geocodingBody = createAreaVerifier(answering(body(resultOf())));
    const rejecting = createAreaVerifier(() => Promise.reject(new Error("socket hang up")));
    const failed = { kind: "unverified", reason: "failed" };

    await expect(geocodingBody.verify(TASCAS)).resolves.toEqual(failed);
    await expect(rejecting.verify(TASCAS)).resolves.toEqual(failed);
  });

  it("asks nothing for a point no map holds", async () => {
    const search = vi.fn(searchHandWrittenPlaces);
    const area = { ...TASCAS, coordinates: { lat: 91, lng: MOURARIA.lng } };

    await expect(createAreaVerifier(search).verify(area)).resolves.toEqual({
      kind: "unverified",
      reason: "invalid-input",
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("passes the area's search and the caller's signal on", async () => {
    const search = vi.fn(searchHandWrittenPlaces);
    const { signal } = new AbortController();
    await createAreaVerifier(search).verify(TASCAS, signal);

    expect(search).toHaveBeenCalledWith(areaSearchParams(TASCAS), signal);
  });
});

describe("createPlaceVerifier", () => {
  function routed(kind: PlaceKind) {
    const geocode = vi.fn<Lookup>(() => Promise.resolve(body()));
    const places = vi.fn<Lookup>(() => Promise.resolve({ ok: true, body: { features: [] } }));
    const check = createPlaceVerifier({ geocode, places }).verify({ ...RAMIRO, kind }, LISBON);
    return { check, geocode, places };
  }

  it.each(AREA_KINDS)(
    "checks a %s place by the places around it, not by its name",
    async (kind) => {
      const { check, geocode, places } = routed(kind);

      await expect(check).resolves.toEqual({ kind: "unverified", reason: "too-few-places" });
      expect(places).toHaveBeenCalledWith(
        areaSearchParams({ kind, coordinates: RAMIRO.coordinates }),
        undefined,
      );
      expect(geocode).not.toHaveBeenCalled();
    },
  );

  it.each(PLACE_KINDS.filter((kind) => !(AREA_KINDS as readonly string[]).includes(kind)))(
    "checks a %s place by its name, as before",
    async (kind) => {
      const { check, geocode, places } = routed(kind);

      await expect(check).resolves.toEqual({ kind: "unverified", reason: "no-match" });
      expect(geocode).toHaveBeenCalledWith(
        placeSearchParams({ ...RAMIRO, kind }, LISBON),
        undefined,
      );
      expect(places).not.toHaveBeenCalled();
    },
  );
});

describe("placeCheckKey", () => {
  it("is the same for the same place in the same city, whoever built the object", () => {
    const copy = { ...RAMIRO, coordinates: { ...RAMIRO.coordinates } };
    expect(placeCheckKey(copy, { city: "Lisbon" })).toBe(placeCheckKey(RAMIRO, LISBON));
  });

  it("differs on anything the check reads", () => {
    const key = placeCheckKey(RAMIRO, LISBON);
    const moved = { ...RAMIRO, coordinates: { lat: 38.7225, lng: -9.1356 } };

    expect(placeCheckKey(moved, LISBON)).not.toBe(key);
    expect(placeCheckKey({ ...RAMIRO, kind: "bar" }, LISBON)).not.toBe(key);
    expect(placeCheckKey({ ...RAMIRO, neighborhood: "Arroios" }, LISBON)).not.toBe(key);
    expect(placeCheckKey({ ...RAMIRO, name: "Ramiro" }, LISBON)).not.toBe(key);
    expect(placeCheckKey(RAMIRO, { city: "Porto" })).not.toBe(key);
  });
});

describe("isCacheable", () => {
  const verified: PlaceCheck = {
    kind: "verified",
    by: "name",
    lat: 1,
    lng: 2,
    providerId: "id",
    source: "geoapify",
  };
  const verifiedArea: PlaceCheck = {
    kind: "verified",
    by: "area",
    lat: 1,
    lng: 2,
    placesAround: 6,
    source: "geoapify",
  };

  it("keeps what the provider answered, and nothing that only says the lookup did not finish", () => {
    expect(isCacheable(verified)).toBe(true);
    expect(isCacheable(verifiedArea)).toBe(true);
    expect(isCacheable({ kind: "unverified", reason: "no-match" })).toBe(true);
    expect(isCacheable({ kind: "unverified", reason: "too-few-places" })).toBe(true);
    for (const reason of [
      "failed",
      "timeout",
      "quota",
      "aborted",
      "no-key",
      "invalid-input",
    ] as const) {
      expect(isCacheable({ kind: "unverified", reason })).toBe(false);
    }
  });
});
