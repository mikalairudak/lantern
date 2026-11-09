import { describe, expect, it } from "vitest";
import { namedVenueIn, type MealLine } from "./venue";
import type { PlaceToCheck } from "./verify-place";

const ALICANTE = { city: "Alicante" };
const LISBON = { city: "Lisbon" };

function meal(name: string, neighborhood = "Centro"): PlaceToCheck {
  return { name, kind: "food", neighborhood, coordinates: { lat: 38.34, lng: -0.48 } };
}

const summary = (text: string): MealLine[] => [{ field: "summary", text }];

describe("namedVenueIn", () => {
  it("names no venue whose one word is the meal's dish or its street", () => {
    const paella = meal("Seafood paella on the Explanada");

    expect(
      namedVenueIn(paella, ALICANTE, [], ["La Paella", "Explanada", "Seafood & Paella Bar"]),
    ).toBeNull();
    expect(
      namedVenueIn(
        meal("Petiscos on Rua das Flores", "Chiado"),
        LISBON,
        [],
        ["Das Flores", "Taberna da Rua das Flores"],
      ),
    ).toBeNull();
  });

  it("finds a venue the name is, or holds as two proper words", () => {
    expect(namedVenueIn(meal("Cervecería Sento"), ALICANTE, [], ["Sento"])).toEqual({
      field: "name",
      venue: "Sento",
    });
    expect(
      namedVenueIn(meal("Tapas at Casa Paco on Calle Mayor"), ALICANTE, [], ["Casa Paco"]),
    ).toEqual({ field: "name", venue: "Casa Paco" });
    expect(
      namedVenueIn(
        meal("Taberna da Rua das Flores", "Chiado"),
        LISBON,
        [],
        ["Taberna da Rua das Flores"],
      ),
    ).toEqual({ field: "name", venue: "Taberna da Rua das Flores" });
  });

  it("finds a venue a line names with capitals, past its sentence's first word", () => {
    const paella = meal("Seafood paella on the Explanada");

    expect(
      namedVenueIn(paella, ALICANTE, summary("The rice at Piripi comes out at two."), ["Piripi"]),
    ).toEqual({ field: "summary", venue: "Piripi" });
    expect(
      namedVenueIn(
        paella,
        ALICANTE,
        [
          { field: "summary", text: "Most terraces serve rice at two." },
          { field: "sensory.texture", text: "Pans scraped at Casa Paco, the sea behind." },
        ],
        ["Casa Paco"],
      ),
    ).toEqual({ field: "sensory.texture", venue: "Casa Paco" });
  });

  it("leaves a line's dish, its street and a sentence's first word to the meal", () => {
    const flores = meal("Petiscos on Rua das Flores", "Chiado");

    expect(
      namedVenueIn(
        meal("Seafood paella on the Explanada"),
        ALICANTE,
        summary("A paella for two, as every terrace here makes it."),
        ["La Paella"],
      ),
    ).toBeNull();
    expect(
      namedVenueIn(flores, LISBON, summary("The tascas of Rua das Flores fill by eight."), [
        "Das Flores",
      ]),
    ).toBeNull();
    // The known miss: a venue that opens a sentence reads as the sentence's capital.
    expect(
      namedVenueIn(flores, LISBON, summary("Piripi grills sardines at eight."), ["Piripi"]),
    ).toBeNull();
  });

  it("reads a venue's word the quarter says as said already", () => {
    const pontocho = meal("Obanzai along Pontocho", "Pontocho");

    expect(namedVenueIn(pontocho, { city: "Kyoto" }, [], ["Pontocho Masuda"])).toBeNull();
    expect(
      namedVenueIn(
        pontocho,
        { city: "Kyoto" },
        summary("Counters open at five, and the one at Masuda fills first."),
        ["Pontocho Masuda"],
      ),
    ).toEqual({ field: "summary", venue: "Pontocho Masuda" });
  });
});
