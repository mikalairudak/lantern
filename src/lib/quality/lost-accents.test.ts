import { describe, expect, it } from "vitest";
import { accentedSpellingsIn, lostAccentsIn, needsAccent } from "./lost-accents";

// Two answers written by hand in the shapes Geoapify documents, cut to the fields that carry
// names; they are not recordings. `query` echoes the text asked, here in the model's spelling.
const PLACES = {
  type: "FeatureCollection",
  features: [
    {
      properties: {
        name: "Café A Brasileira",
        street: "Praça Luís de Camões",
        district: "São Paulo",
      },
    },
    {
      properties: {
        name: "Tasca",
        street: "Rua de São Miguel",
        datasource: { raw: { street: "Rua de Sao Miguel" } },
      },
    },
    { properties: { name: "Sé de Lisboa", street: "Largo da Sé" } },
  ],
};
const GEOCODE = {
  results: [{ name: "Pontochō", street: "Kiyamachi-dōri", formatted: "Pontochō, Kyoto" }],
  query: {
    text: "Coffee on Praca Luis de Camoes, Lisbon",
    parsed: { street: "praca luis de camoes" },
  },
};
const SPELLINGS = accentedSpellingsIn([PLACES, GEOCODE]);

describe("accentedSpellingsIn", () => {
  it("keeps each word an answer writes with an accent, by its plain letters", () => {
    expect(SPELLINGS.get("praca")).toBe("Praça");
    expect(SPELLINGS.get("camoes")).toBe("Camões");
    expect(SPELLINGS.get("se")).toBe("Sé");
  });

  it("reads past the query, which echoes the model's spelling, and a minority written plain", () => {
    expect(SPELLINGS.get("luis")).toBe("Luís");
    expect(SPELLINGS.get("sao")).toBe("São");
  });

  it("leaves out a word whose only mark is a macron, which English writes without", () => {
    expect(SPELLINGS.has("pontocho")).toBe(false);
    expect(SPELLINGS.has("dori")).toBe(false);
  });

  it("leaves out a word the answers write plain more often than accented", () => {
    const spellings = accentedSpellingsIn([{ names: ["Maria", "Maria", "María"] }]);
    expect(spellings.has("maria")).toBe(false);
  });
});

describe("lostAccentsIn", () => {
  it("names each word written without the accent Geoapify gives it", () => {
    expect(lostAccentsIn("Coffee on Praca Luis de Camoes", SPELLINGS)).toEqual([
      "Praca → Praça",
      "Luis → Luís",
      "Camoes → Camões",
    ]);
    expect(lostAccentsIn("Se de Lisboa", SPELLINGS)).toEqual(["Se → Sé"]);
  });

  it("finds nothing in a name that keeps its accents, or in words Geoapify never wrote", () => {
    expect(lostAccentsIn("Coffee on Praça Luís de Camões", SPELLINGS)).toEqual([]);
    expect(lostAccentsIn("Dinner along Pontocho", SPELLINGS)).toEqual([]);
    expect(lostAccentsIn("Beer on Rua da Atalaia", SPELLINGS)).toEqual([]);
  });

  it("reads a letter and its mark written apart as accented", () => {
    expect(lostAccentsIn("Praça".normalize("NFD"), SPELLINGS)).toEqual([]);
  });
});

describe("needsAccent", () => {
  it("says whether a name holds a word Geoapify writes accented, kept or not", () => {
    expect(needsAccent("Coffee on Praca Luis de Camoes", SPELLINGS)).toBe(true);
    expect(needsAccent("Coffee on Praça Luís de Camões", SPELLINGS)).toBe(true);
    expect(needsAccent("Beer on Rua da Atalaia", SPELLINGS)).toBe(false);
  });
});
