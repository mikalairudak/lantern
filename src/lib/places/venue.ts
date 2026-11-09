import {
  contextWordsOf,
  distinctiveWordsOf,
  isSameSpelling,
  MIN_SHARED_WORDS_OF_LONGER_NAMES,
  wordsOf,
} from "./match";
import type { CityToCheck, PlaceToCheck } from "./verify-place";

/**
 * Whether a meal's words name one venue, the café, restaurant or bar Lantern never names
 * (`docs/decisions.md`, "Lantern names no restaurant, café or bar"). Since day-v4 a meal's name is
 * a line about its food and its street, "Seafood paella on the Explanada", whose dish shares a word
 * with many a restaurant's name, "La Paella"; so the one shared word that confirms a sight by its
 * name names no venue here. The venues it reads are the provider's: the places of the meal's kind
 * around its point and the geocoder's answers for its name, within the kind's radius. A live round
 * counts what it finds; no route reads it.
 */

/** Words that join a meal's food to its street: "Obanzai along Pontocho". */
const LINK_WORDS: ReadonlySet<string> = new Set(
  "on along at in by near off around below above beside behind under over past".split(" "),
);

/**
 * How much of each name the other must say for the meal's name to be the venue's, both ways:
 * "Cervecería Sento" is "Sento", while "Petiscos on Rua das Flores" is not "Das Flores".
 */
export const MIN_VENUE_SHARE = 0.75;

/** One of a meal's lines, where a check found it. */
export interface MealLine {
  /** As a place's fields are named: `summary`, `sensory.texture`, `aesthetic[1]`. */
  field: string;
  text: string;
}

/** A venue a meal's words name, and where. */
export interface NamedVenue {
  /** `name`, or the line's field. */
  field: string;
  /** As the provider names it. */
  venue: string;
}

// A token opens with a capital after any quote or bracket; a sentence ends at its stop.
const CAPITALISED = /^\P{L}*\p{Lu}/u;
const SENTENCE_END = /[.!?]["'”’)\]]*$/u;

/**
 * The words a text writes with a capital, folded. In a line a sentence's first word is left
 * out, since the sentence capitalises it rather than a name.
 */
function capitalisedWordsOf(text: string, isLine: boolean): Set<string> {
  const capitalised = new Set<string>();
  let opensSentence = true;
  for (const token of text.split(/\s+/).filter((part) => part !== "")) {
    if (!(isLine && opensSentence) && CAPITALISED.test(token)) {
      for (const word of wordsOf(token)) capitalised.add(word);
    }
    opensSentence = SENTENCE_END.test(token);
  }
  return capitalised;
}

/**
 * Whether the meal's name is the venue's: spelled as it is, nearly the same words both ways, or
 * holding two of its proper words or more written with a capital, as "Tapas at Casa Paco"
 * holds "Casa Paco". A one-word venue inside a longer name ("Rice at Piripi") is missed: its
 * word cannot be told from the street's.
 */
function isNamedByName(place: PlaceToCheck, city: CityToCheck, venue: string): boolean {
  if (isSameSpelling(place.name, venue)) return true;
  const leftOut = new Set([...contextWordsOf(place, city), ...LINK_WORDS]);
  const ours = distinctiveWordsOf(place.name, leftOut);
  const theirs = distinctiveWordsOf(venue, leftOut);
  if (ours.size === 0 || theirs.size === 0) return false;
  const shared = [...theirs].filter((word) => ours.has(word)).length;
  if (shared / ours.size >= MIN_VENUE_SHARE && shared / theirs.size >= MIN_VENUE_SHARE) {
    return true;
  }
  const capitalised = capitalisedWordsOf(place.name, false);
  return (
    theirs.size >= MIN_SHARED_WORDS_OF_LONGER_NAMES &&
    [...theirs].every((word) => capitalised.has(word))
  );
}

/**
 * Whether a line says the venue: every word of the venue's name that the meal's name, quarter
 * and city do not already say, written with a capital and not opening a sentence. A venue named
 * after the meal's own street says nothing new and is missed, as is one that opens a sentence.
 */
function isSaidInLine(
  place: PlaceToCheck,
  city: CityToCheck,
  venue: string,
  text: string,
): boolean {
  const leftOut = new Set([...contextWordsOf(place, city), ...LINK_WORDS, ...wordsOf(place.name)]);
  const theirs = distinctiveWordsOf(venue, leftOut);
  if (theirs.size === 0) return false;
  const capitalised = capitalisedWordsOf(text, true);
  return [...theirs].every((word) => capitalised.has(word));
}

/** The first venue the meal's name names, or else one of its lines; null when none does. */
export function namedVenueIn(
  place: PlaceToCheck,
  city: CityToCheck,
  lines: readonly MealLine[],
  venues: readonly string[],
): NamedVenue | null {
  const byName = venues.find((venue) => isNamedByName(place, city, venue));
  if (byName !== undefined) return { field: "name", venue: byName };
  for (const { field, text } of lines) {
    const inLine = venues.find((venue) => isSaidInLine(place, city, venue, text));
    if (inLine !== undefined) return { field, venue: inLine };
  }
  return null;
}
