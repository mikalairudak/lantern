import { foldToLatin } from "@/lib/places/names";
import {
  MAX_MEAL_NAME_CHARS,
  MEAL_NAME_TWO_LINES_CHARS,
  MEAL_WORDS,
  VENUE_WORDS,
} from "@/lib/schema/itinerary.schema";

/**
 * A meal's name since day-v4 is a line about what is eaten there and where, "Petiscos on Rua
 * das Flores", and the row writes the meal and the quarter under it (`docs/decisions.md`, "Lantern
 * names no restaurant, café or bar"). These are the ways it can go wrong that a check can read: it
 * says a meal its line already says, a venue's word or the city, or it runs past three lines on a
 * phone. A repeated quarter is not among them: the row leaves a quarter its name says out of the
 * line.
 */

/** A text's words, lower case and without accents: "Café" reads "cafe". */
function wordsOf(text: string): string[] {
  return foldToLatin(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
}

// A plural counts as its word: "lunches", "bars".
const PLURAL_ENDINGS = ["", "s", "es"] as const;

function listedIn(words: readonly string[], listed: readonly string[]): string[] {
  return listed.filter((word) => {
    const [folded] = wordsOf(word);
    return words.some((said) => PLURAL_ENDINGS.some((ending) => said === `${folded}${ending}`));
  });
}

/** The words that bind a city's name into a longer proper name: "Rua Josefa de Óbidos". */
const NAME_PARTICLES = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "di",
  "del",
  "della",
  "du",
  "des",
  "von",
  "van",
]);

/** A name's words as written, case kept, beside the forms the checks compare. */
function writtenWordsOf(text: string): { written: string; folded: string }[] {
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "")
    .map((written) => ({ written, folded: wordsOf(written)[0] ?? "" }));
}

/**
 * Whether the name names the city as its place: every word of the city in a row, "Petiscos in
 * Lisbon", "Pintxos of San Sebastián". Not when the city is part of a longer proper name, bound
 * by a particle before it, a street named for the painter Josefa de Óbidos, or followed by a
 * capitalized word, "Kyoto Gyoen", the imperial garden: round A's only false fails.
 */
function namesCity(name: string, city: string): boolean {
  const cityWords = wordsOf(city.split(",")[0] ?? "");
  if (cityWords.length === 0) return false;
  const words = writtenWordsOf(name);
  return words.some((_, start) => {
    if (!cityWords.every((word, offset) => words[start + offset]?.folded === word)) return false;
    const before = words[start - 1];
    const after = words[start + cityWords.length];
    const isBound = before !== undefined && NAME_PARTICLES.has(before.folded);
    const isFollowedByName = after !== undefined && /^\p{Lu}/u.test(after.written);
    return !isBound && !isFollowedByName;
  });
}

/** Characters as a reader counts them: "São" is three. */
export function charactersIn(name: string): number {
  return [...name.normalize("NFC")].length;
}

/** What is wrong with a meal's name, each as a clause after the name; empty when nothing is. */
export function mealNameFaults(name: string, city: string): string[] {
  const words = wordsOf(name);
  const characters = charactersIn(name);
  return [
    ...listedIn(words, MEAL_WORDS).map((word) => `says "${word}", which its line says`),
    ...listedIn(words, VENUE_WORDS).map((word) => `says "${word}", a venue's word`),
    ...(namesCity(name, city) ? [`names the city, ${city}`] : []),
    ...(characters > MAX_MEAL_NAME_CHARS
      ? [`runs ${characters} characters, past the ${MAX_MEAL_NAME_CHARS} three lines hold`]
      : []),
  ];
}

/**
 * Whether a meal's name may take a third line where its bead stands mid-scale: a warning, since
 * the row grows to hold it, and the name is asked to keep to two.
 */
export function isPastTwoLines(name: string): boolean {
  return charactersIn(name) > MEAL_NAME_TWO_LINES_CHARS;
}
