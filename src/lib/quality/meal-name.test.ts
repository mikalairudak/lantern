import { describe, expect, it } from "vitest";
import { namedVenueIn } from "@/lib/places/venue";
import {
  AREA_KINDS_SAID,
  GeneratedPlaceSchema,
  MAX_MEAL_NAME_CHARS,
  MAX_MEAL_NAME_WORDS,
  MEAL_NAME_TWO_LINES_CHARS,
} from "@/lib/schema/itinerary.schema";
import { phrasesIn } from "./banned-phrases";
import { charactersIn, isPastTwoLines, mealNameFaults } from "./meal-name";

const nameOf = (characters: number) => "x".repeat(characters);

describe("mealNameFaults", () => {
  it("passes a line about the food and its street", () => {
    expect(mealNameFaults("Petiscos on Rua das Flores", "Lisbon")).toEqual([]);
    expect(mealNameFaults("Obanzai along Pontocho", "Kyoto")).toEqual([]);
  });

  it("lets what is drunk stand, since the line under it says café or bar", () => {
    expect(mealNameFaults("Coffee and pastéis on Rua Augusta", "Lisbon")).toEqual([]);
    expect(mealNameFaults("Drinks along Bairro Alto", "Lisbon")).toEqual([]);
  });

  it("finds a meal its line says, as a whole word and in the plural", () => {
    expect(mealNameFaults("Dinner on Rua das Flores", "Lisbon")).toEqual([
      'says "dinner", which its line says',
    ]);
    expect(mealNameFaults("Lunches along Pontocho", "Kyoto")).toEqual([
      'says "lunch", which its line says',
    ]);
    expect(mealNameFaults("Launch pads on the river", "Kyoto")).toEqual([]);
  });

  it("finds a venue's word, with or without its accent", () => {
    expect(mealNameFaults("Cafés of the Chiado", "Lisbon")).toEqual([
      'says "café", a venue\'s word',
    ]);
    expect(mealNameFaults("ZEN CAFE", "Kyoto")).toEqual(['says "café", a venue\'s word']);
    expect(mealNameFaults("Tapas bars on Calle Mayor", "Alicante")).toEqual([
      'says "bar", a venue\'s word',
    ]);
    expect(mealNameFaults("Barbecue in Gion", "Kyoto")).toEqual([]);
  });

  it("finds the city by all its words in a row, whatever the request adds after a comma", () => {
    expect(mealNameFaults("Pintxos of San Sebastián", "San Sebastián, Spain")).toEqual([
      "names the city, San Sebastián, Spain",
    ]);
    expect(mealNameFaults("Pintxos on San Jerónimo", "San Sebastián")).toEqual([]);
  });

  it("finds the city where it is the place, and not inside a longer proper name", () => {
    expect(mealNameFaults("Petiscos in Óbidos", "Óbidos")).toEqual(["names the city, Óbidos"]);
    expect(mealNameFaults("Lisbon petiscos", "Lisbon")).toEqual(["names the city, Lisbon"]);
    // Round A's false fails: a street named for the painter, and the imperial garden.
    expect(mealNameFaults("Soup on Rua Josefa de Óbidos", "Óbidos")).toEqual([]);
    expect(mealNameFaults("Tea at Kyoto Gyoen", "Kyoto")).toEqual([]);
  });

  it(`fails a name past ${MAX_MEAL_NAME_CHARS} characters, where a fourth line comes`, () => {
    expect(mealNameFaults(nameOf(MAX_MEAL_NAME_CHARS), "Kyoto")).toEqual([]);
    expect(mealNameFaults(nameOf(MAX_MEAL_NAME_CHARS + 1), "Kyoto")).toEqual([
      `runs ${MAX_MEAL_NAME_CHARS + 1} characters, past the ${MAX_MEAL_NAME_CHARS} three lines hold`,
    ]);
  });
});

describe("isPastTwoLines", () => {
  it(`warns from ${MEAL_NAME_TWO_LINES_CHARS + 1} characters, counted as a reader counts them`, () => {
    expect(isPastTwoLines(nameOf(MEAL_NAME_TWO_LINES_CHARS))).toBe(false);
    expect(isPastTwoLines(nameOf(MEAL_NAME_TWO_LINES_CHARS + 1))).toBe(true);
    expect(charactersIn("São")).toBe(3);
  });
});

/** The meal names the `name` description gives as examples: the model copies their form and length. */
/** A quoted name in the description's part for meals, and whether it is shown as a fault. */
interface Example {
  name: string;
  isFault: boolean;
}

function examplesIn(): Example[] {
  const description = GeneratedPlaceSchema.shape.name.description ?? "";
  const meals = description.slice(description.indexOf(`For ${AREA_KINDS_SAID}`));
  // A single quoted word is one the name never says ("lunch", "bar"), not an example.
  return [...meals.matchAll(/(not )?"([^"]+)"/g)]
    .map(([, not, name]) => ({ name: name ?? "", isFault: not !== undefined }))
    .filter(({ name }) => name.includes(" "));
}

/** The meal names the description gives as examples: the model copies their form and length. */
function mealExamples(): string[] {
  return examplesIn()
    .filter(({ isFault }) => !isFault)
    .map(({ name }) => name);
}

/** The names it shows as faults, each beside its fix. */
function faultExamples(): string[] {
  return examplesIn()
    .filter(({ isFault }) => isFault)
    .map(({ name }) => name);
}

const wordsIn = (name: string) => name.split(" ").length;

/** Every word of a name, and every two words in a row, as a venue's name. */
function venuesFrom(name: string): string[] {
  const words = name.split(" ");
  return [...words, ...words.slice(1).map((word, index) => `${words[index]} ${word}`)];
}

describe("the meal names the name's description gives as examples", () => {
  it("are there to copy", () => {
    expect(mealExamples()).toContain("Petiscos on Rua das Flores");
    expect(mealExamples().length).toBeGreaterThanOrEqual(3);
  });

  it.each(mealExamples())("passes every check on a meal's name, with no warning: %s", (name) => {
    const place = {
      name,
      kind: "food" as const,
      neighborhood: "",
      coordinates: { lat: 0, lng: 0 },
    };
    const city = { city: "Lisbon" };

    expect(namedVenueIn(place, city, [], venuesFrom(name))).toBeNull();
    expect(phrasesIn(name)).toEqual([]);
    expect(mealNameFaults(name, city.city)).toEqual([]);
    expect(isPastTwoLines(name)).toBe(false);
    expect(wordsIn(name)).toBeLessThanOrEqual(MAX_MEAL_NAME_WORDS);
  });

  // A fault shown beside its fix must be one: a long, legal name would teach the wrong thing.
  it("shows as faults only names that fail a check or run past the words asked", () => {
    expect(faultExamples().length).toBeGreaterThanOrEqual(3);
    for (const name of faultExamples()) {
      const fails = mealNameFaults(name, "Lisbon").length > 0;
      expect(fails || wordsIn(name) > MAX_MEAL_NAME_WORDS, name).toBe(true);
    }
  });
});
