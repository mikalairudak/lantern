import { describe, expect, it } from "vitest";
import { PLACE_KINDS } from "@/lib/schema/itinerary.schema";
import {
  KIND_CATEGORIES,
  RADIUS_METERS,
  bestMatch,
  isCategoryFor,
  isConfirmedBy,
  isWithinRadius,
  nameScore,
  namesAnotherKind,
  type Candidate,
} from "./match";
import type { CityToCheck, PlaceToCheck } from "./verify-place";

const LISBON: CityToCheck = { city: "Lisbon" };
const KYOTO: CityToCheck = { city: "Kyoto" };

function placeOf(fields: Partial<PlaceToCheck>): PlaceToCheck {
  return {
    name: "Cervejaria Ramiro",
    kind: "food",
    neighborhood: "Intendente",
    coordinates: { lat: 38.7224, lng: -9.1356 },
    ...fields,
  };
}

function candidateOf(fields: Partial<Candidate>): Candidate {
  return {
    names: ["Cervejaria Ramiro"],
    meters: 10,
    resultType: "amenity",
    category: "catering.restaurant",
    ...fields,
  };
}

describe("nameScore", () => {
  it("reads a name without its diacritics, case or punctuation", () => {
    const place = placeOf({ name: "Panteão Nacional" });
    expect(nameScore(place, LISBON, "PANTEAO-NACIONAL")).toBe(1);
  });

  it("ignores word order", () => {
    const place = placeOf({ name: "Nanzenji Junsei", neighborhood: "Okazaki" });
    expect(nameScore(place, KYOTO, "Junsei Nanzenji")).toBe(1);
  });

  it("leaves out the words that say what a place is", () => {
    const place = placeOf({ name: "Castillo de Santa Bárbara", neighborhood: "Benacantil" });
    expect(nameScore(place, { city: "Alicante" }, "Castell de Santa Bàrbara")).toBeCloseTo(2 / 3);
  });

  it("leaves out the place's own district and city", () => {
    const place = placeOf({ name: "Pontocho Masuda", neighborhood: "Pontocho" });
    expect(nameScore(place, KYOTO, "Mimasuya ITALIANO Pontocho")).toBe(0);
    expect(nameScore(placeOf({ name: "Lisbon Story Centre" }), LISBON, "Lisbon Cathedral")).toBe(0);
  });

  // "La cervecería" confirmed "Cervecería Sento" in the live days: the district word left out,
  // the head was all that matched.
  it("reads a head that says what a place is as no part of which one it is", () => {
    const sento = placeOf({ name: "Cervecería Sento", kind: "bar", neighborhood: "Centro" });
    expect(nameScore(sento, { city: "Alicante" }, "La cervecería")).toBe(0);
    expect(nameScore(sento, { city: "Alicante" }, "Cervecería Sento Barrio")).toBe(1);
    for (const head of ["Cafetería", "Pastelaria", "Bodega", "Izakaya", "Kissa"]) {
      const place = placeOf({ name: `${head} Lumen`, neighborhood: "Centro" });
      expect(nameScore(place, LISBON, `La ${head}`)).toBe(0);
      expect(nameScore(place, LISBON, `Lumen ${head}`)).toBe(1);
    }
  });

  it("finds nothing shared with a name in another script", () => {
    const place = placeOf({ name: "Gion Tokuya", neighborhood: "Gion" });
    expect(nameScore(place, KYOTO, "ぎおん徳屋")).toBe(0);
  });

  it("scores a name of common words only by its whole spelling", () => {
    const park = placeOf({ name: "Park", kind: "bar", neighborhood: "Bairro Alto" });
    expect(nameScore(park, LISBON, "Park")).toBe(1);
    expect(nameScore(park, LISBON, "Park Rooftop")).toBe(0);
  });

  it("never matches two names it can read no Latin letter of", () => {
    const kinkakuji = placeOf({ name: "金閣寺", kind: "sacred", neighborhood: "北区" });
    expect(nameScore(kinkakuji, KYOTO, "清水寺")).toBe(0);
    expect(nameScore(kinkakuji, KYOTO, "金閣寺")).toBe(0);
  });

  it("reads letters no decomposition breaks, as a visitor would type them", () => {
    const warsaw = { city: "Warsaw" };
    const lazienki = placeOf({
      name: "Łazienki Królewskie",
      kind: "garden",
      neighborhood: "Ujazdów",
    });
    expect(nameScore(lazienki, warsaw, "Lazienki Krolewskie")).toBe(1);

    const street = placeOf({ name: "Kaiserstraße", kind: "walk", neighborhood: "Innenstadt" });
    expect(nameScore(street, { city: "Frankfurt" }, "Kaiserstrasse")).toBe(1);
    const hygge = placeOf({ name: "Østergade Ærø", neighborhood: "Indre By" });
    expect(nameScore(hygge, { city: "Copenhagen" }, "Ostergade Aero")).toBe(1);
  });

  it("asks two names that each say two things or more to share two of them", () => {
    const barcelona = { city: "Barcelona" };
    const batllo = placeOf({ name: "Casa Batlló", kind: "architecture", neighborhood: "Eixample" });
    expect(nameScore(batllo, barcelona, "Casa Milà")).toBe(0);
    expect(nameScore(batllo, barcelona, "Casa Batlló Museum")).toBe(1);

    const castle = placeOf({ name: "Castillo de Santa Bárbara", neighborhood: "Benacantil" });
    expect(nameScore(castle, { city: "Alicante" }, "Castell de Santa Bàrbara")).toBeCloseTo(2 / 3);
  });

  it("lets one distinctive word stand for a name that says only one", () => {
    const maca = placeOf({ name: "MACA", kind: "museum", neighborhood: "Casco Antiguo" });
    const full = "MACA - Museo de Arte Contemporáneo de Alicante";
    expect(nameScore(maca, { city: "Alicante" }, full)).toBe(1);
  });
});

describe("isWithinRadius", () => {
  it("gives every kind of the schema a radius", () => {
    expect(Object.keys(RADIUS_METERS).sort()).toEqual([...PLACE_KINDS].sort());
    expect(Object.keys(KIND_CATEGORIES).sort()).toEqual([...PLACE_KINDS].sort());
  });

  it("lets a walk lie farther than a restaurant", () => {
    expect(isWithinRadius("food", 200)).toBe(true);
    expect(isWithinRadius("food", 201)).toBe(false);
    expect(isWithinRadius("walk", 425)).toBe(true);
    expect(isWithinRadius("walk", 701)).toBe(false);
  });

  // The live rounds' right names just outside the old rings (docs/grounding.md).
  it("measures a site with grounds from its middle, not its gate", () => {
    expect(isWithinRadius("sacred", 356)).toBe(true); // Konchi-in
    expect(isWithinRadius("garden", 436)).toBe(true); // Murin-an
    expect(isWithinRadius("market", 380)).toBe(true); // Alicante's central market
    expect(isWithinRadius("walk", 572)).toBe(true); // Plaça de l'Abat Penalva
    expect(isWithinRadius("sacred", 401)).toBe(false);
  });
});

describe("isCategoryFor", () => {
  it("takes a category by its dotted prefix", () => {
    expect(isCategoryFor("coffee", candidateOf({ category: "catering.cafe" }))).toBe(true);
    expect(isCategoryFor("garden", candidateOf({ category: "leisure.park.garden" }))).toBe(true);
    expect(isCategoryFor("shop", candidateOf({ category: "catering.cafe" }))).toBe(false);
    expect(isCategoryFor("food", candidateOf({ category: "cateringx" }))).toBe(false);
  });

  it("refuses a shop named for the walk", () => {
    const shop = candidateOf({ names: ["MODISH GION SHIRAKAWA"], category: "rental.bicycle" });
    expect(isCategoryFor("walk", shop)).toBe(false);
  });

  it("lets a street stand only for a walk", () => {
    const street = candidateOf({ resultType: "street", category: null });
    expect(isCategoryFor("walk", street)).toBe(true);
    expect(isCategoryFor("bar", street)).toBe(false);
  });

  it("never lets a house stand for architecture", () => {
    expect(isCategoryFor("architecture", candidateOf({ category: "building.residential" }))).toBe(
      false,
    );
    expect(isCategoryFor("architecture", candidateOf({ category: "building.historic" }))).toBe(
      true,
    );
  });

  it("takes a bar as a bar, a pub or a restaurant, not as any place to eat", () => {
    expect(isCategoryFor("bar", candidateOf({ category: "catering.pub" }))).toBe(true);
    expect(isCategoryFor("bar", candidateOf({ category: "catering.restaurant.tapas" }))).toBe(true);
    expect(isCategoryFor("bar", candidateOf({ category: "catering.fast_food" }))).toBe(false);
    expect(isCategoryFor("bar", candidateOf({ category: "catering.ice_cream" }))).toBe(false);
  });

  it("never takes a supermarket for a market or a shop", () => {
    for (const category of ["commercial.supermarket", "commercial.convenience"]) {
      expect(isCategoryFor("market", candidateOf({ category }))).toBe(false);
      expect(isCategoryFor("shop", candidateOf({ category }))).toBe(false);
    }
    expect(isCategoryFor("market", candidateOf({ category: "commercial.marketplace" }))).toBe(true);
    expect(isCategoryFor("shop", candidateOf({ category: "commercial.books" }))).toBe(true);
  });

  it("never lets an area stand for a place", () => {
    const city = candidateOf({ resultType: "city", category: "administrative" });
    expect(isCategoryFor("food", city)).toBe(false);
  });

  it("lets a site with no category through to the name and the distance", () => {
    const temple = candidateOf({ names: ["Hōnen Temple"], category: null });
    expect(isCategoryFor("sacred", temple)).toBe(true);
    expect(isCategoryFor("walk", temple)).toBe(true);
  });

  // An uncategorised Nanzen-ji confirmed the restaurant "Okutan Nanzen-ji" in the live days.
  it("never lets a result with no category stand for a place to eat or drink", () => {
    const temple = candidateOf({ names: ["Nanzen-ji"], category: null });
    for (const kind of ["food", "coffee", "bar"] as const) {
      expect(isCategoryFor(kind, temple)).toBe(false);
    }
  });
});

describe("isConfirmedBy", () => {
  const place = placeOf({});

  it("confirms a place only when distance, name and category all agree", () => {
    expect(isConfirmedBy(place, LISBON, candidateOf({}))).toBe(true);
    expect(isConfirmedBy(place, LISBON, candidateOf({ meters: 250 }))).toBe(false);
    expect(isConfirmedBy(place, LISBON, candidateOf({ names: ["Zambeze"] }))).toBe(false);
    expect(isConfirmedBy(place, LISBON, candidateOf({ category: "commercial.books" }))).toBe(false);
  });

  it("matches on any of the candidate's names", () => {
    const lift = placeOf({ name: "Elevador de Santa Justa", kind: "architecture" });
    const candidate = candidateOf({
      names: ["산타 주스타 엘리베이터", "Santa Justa Lift"],
      category: "tourism.attraction",
    });
    expect(isConfirmedBy(lift, LISBON, candidate)).toBe(true);
  });
});

describe("bestMatch", () => {
  const place = placeOf({ name: "Taberna da Rua das Flores", neighborhood: "Chiado" });

  it("takes a whole spelling over a name that only shares its words, then the nearest", () => {
    const near = candidateOf({ names: ["Das Flores"], meters: 5 });
    const exact = candidateOf({ names: ["Taberna da Rua das Flores"], meters: 90 });
    const nearer = candidateOf({ names: ["Taberna da Rua das Flores"], meters: 40 });

    expect(bestMatch(place, LISBON, [near, exact, nearer])).toBe(nearer);
  });

  it("takes the better name before the nearer one", () => {
    const lift = placeOf({ name: "Elevador de Santa Justa", kind: "architecture" });
    const half = candidateOf({ names: ["Santa Cruz"], meters: 5, category: "tourism" });
    const most = candidateOf({ names: ["Santa Justa Lift"], meters: 60, category: "tourism" });

    expect(bestMatch(lift, LISBON, [half, most])).toBe(most);
  });

  it("finds none when no candidate passes all three", () => {
    const street = candidateOf({ names: ["Rua das Flores"], resultType: "street", category: null });
    expect(bestMatch(place, LISBON, [street])).toBeNull();
    expect(bestMatch(place, LISBON, [])).toBeNull();
  });
});

// The live place rounds' misses and false matches (docs/grounding.md, "Better name matching").
describe("namesAnotherKind", () => {
  const shrine = placeOf({
    name: "Nishiki Tenmangu Shrine",
    kind: "sacred",
    neighborhood: "Nakagyo",
  });

  it("never takes a market for the shrine at its end, nor a square for the basilica on it", () => {
    const market = candidateOf({ names: ["Nishiki Market", "錦市場"], category: null });
    const basilica = placeOf({
      name: "Santa Maria Basilica",
      kind: "sacred",
      neighborhood: "Casco Antiguo",
    });
    const square = candidateOf({ names: ["Plaça de Santa Maria"], category: null });

    expect(namesAnotherKind(shrine, market)).toBe(true);
    expect(namesAnotherKind(basilica, square)).toBe(true);
    expect(isConfirmedBy(shrine, KYOTO, { ...market, meters: 227 })).toBe(false);
  });

  it("lets a religious house that is now a museum stand for it, as the categories do", () => {
    const monastery = placeOf({
      name: "Mosteiro de São Vicente de Fora",
      kind: "sacred",
      neighborhood: "São Vicente",
    });
    const museum = candidateOf({
      names: ["Museu de São Vicente de Fora"],
      category: "entertainment.museum",
    });

    expect(namesAnotherKind(monastery, museum)).toBe(false);
  });

  it("counts a kind the place's own name says as its own, in any language's word for it", () => {
    const square = placeOf({ name: "Plaza Gabriel Miró", kind: "garden", neighborhood: "Centro" });
    const placa = candidateOf({ names: ["Plaça de Gabriel Miró"], category: "leisure.park" });

    expect(namesAnotherKind(square, placa)).toBe(false);
  });
});

describe("isConfirmedBy, for the rounds' misses", () => {
  it("confirms a temple that gave its district its name by its whole name, never a street", () => {
    const temple = placeOf({ name: "Nanzen-ji Temple", kind: "sacred", neighborhood: "Nanzen-ji" });
    const park = placeOf({ name: "Okazaki Park", kind: "walk", neighborhood: "Okazaki" });
    const garden = placeOf({ name: "Jardim da Graça", kind: "garden", neighborhood: "Graça" });

    expect(
      isConfirmedBy(
        temple,
        KYOTO,
        candidateOf({ names: ["Nanzen-ji"], meters: 47, category: null }),
      ),
    ).toBe(true);
    expect(
      isConfirmedBy(
        park,
        KYOTO,
        candidateOf({
          names: ["Okazaki Street"],
          meters: 195,
          resultType: "street",
          category: null,
        }),
      ),
    ).toBe(false);
    expect(
      isConfirmedBy(
        garden,
        LISBON,
        candidateOf({ names: ["Jardim da Cerca da Graça"], meters: 356, category: "leisure.park" }),
      ),
    ).toBe(false);
  });

  it("confirms a walk by the street it is named after, the words of a route aside", () => {
    const canal = placeOf({ name: "Shirakawa Canal in Gion", kind: "walk", neighborhood: "Gion" });
    const path = placeOf({ name: "Philosopher's Path", kind: "walk", neighborhood: "Higashiyama" });
    const street = (name: string, meters: number): Candidate =>
      candidateOf({ names: [name], meters, resultType: "street", category: null });

    expect(isConfirmedBy(canal, KYOTO, street("Shirakawa South Street", 108))).toBe(true);
    expect(isConfirmedBy(path, KYOTO, street("Philosopher's Walk", 68))).toBe(true);
    expect(isConfirmedBy(path, KYOTO, street("Path of peace", 165))).toBe(false);
  });

  it("confirms a walk along a beach by the beach, where it was refused as no street", () => {
    const walk = placeOf({ name: "Playa del Postiguet", kind: "walk", neighborhood: "Centro" });
    const beach = candidateOf({
      names: ["El Postiguet Beach", "Platja del Postiguet", "Playa del Postiguet"],
      meters: 143,
      category: "beach",
    });

    expect(isConfirmedBy(walk, { city: "Alicante" }, beach)).toBe(true);
    expect(isCategoryFor("walk", { ...beach, category: "leisure.park" })).toBe(false);
  });

  it("confirms a viewpoint mapped as a square by a street spelled the same, and no other", () => {
    const largo = placeOf({
      name: "Largo das Portas do Sol",
      kind: "viewpoint",
      neighborhood: "Alfama",
    });
    const street = (name: string): Candidate =>
      candidateOf({ names: [name], meters: 20, resultType: "street", category: null });

    expect(isConfirmedBy(largo, LISBON, street("Largo das Portas do Sol"))).toBe(true);
    expect(isConfirmedBy(largo, LISBON, street("Rua das Portas do Sol"))).toBe(false);
  });
});
