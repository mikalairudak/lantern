import { foldToLatin } from "@/lib/places/names";

/**
 * Words a model wrote without the accent the place's own spelling has: "Praca" for "Praça".
 * Sonnet leaves most of them off in Lisbon and Alicante, and no check saw it, since the checks
 * and the place match read names without accents (`docs/harness.md`, "The prompt versions",
 * `day-v5`). The spelling to hold a name to is the one at hand in a round: Geoapify's answers for
 * its city's places. A word Geoapify never returned is not judged, so a count is a floor.
 */

/** A word of letters, its marks included. */
const WORD = /[\p{L}\p{M}]+/gu;

/** A macron alone romanizes, and English writes the word without it: "Pontochō" is "Pontocho". */
const COMBINING_MACRON = String.fromCodePoint(0x304);

/** How Geoapify spells the words it writes with an accent, by their plain letters. */
export type Spellings = ReadonlyMap<string, string>;

interface Seen {
  accented: number;
  plain: number;
  spelling: string;
}

/** Whether a word carries a mark English writing keeps: "Praça", "Núñez", "Łódź", not "Pontochō". */
function isAccented(word: string): boolean {
  const withoutMacrons = word.normalize("NFD").replaceAll(COMBINING_MACRON, "");
  return foldToLatin(withoutMacrons) !== withoutMacrons.toLowerCase();
}

/**
 * Fields that hold no place's spelling: `query` echoes the model's own back, and an id, as a
 * recording's "recorded-lisbon-mosteiro-de-sao-vicente-de-fora", may spell one plain.
 */
const SKIPPED_KEYS: ReadonlySet<string> = new Set(["query", "place_id"]);
const LINK = /^(?:https?:\/\/|www\.)/i;

/** Every string in an answer that may spell a place, links and the fields above left out. */
function textsOf(node: unknown): string[] {
  if (typeof node === "string") return LINK.test(node) ? [] : [node];
  if (Array.isArray(node)) return node.flatMap(textsOf);
  if (typeof node === "object" && node !== null) {
    return Object.entries(node).flatMap(([key, value]) =>
      SKIPPED_KEYS.has(key) ? [] : textsOf(value),
    );
  }
  return [];
}

/**
 * The words a city's answers write with an accent more often than without: "praca" → "Praça".
 * The majority keeps OpenStreetMap's own slips, as "Rua de Sao Thomé", from unmarking a word.
 */
export function accentedSpellingsIn(answers: readonly unknown[]): Spellings {
  const seen = new Map<string, Seen>();
  for (const word of answers.flatMap(textsOf).flatMap((text) => text.match(WORD) ?? [])) {
    const key = foldToLatin(word);
    const entry = seen.get(key) ?? { accented: 0, plain: 0, spelling: word };
    if (isAccented(word)) {
      entry.accented += 1;
      if (!isAccented(entry.spelling)) entry.spelling = word;
    } else {
      entry.plain += 1;
    }
    seen.set(key, entry);
  }
  return new Map(
    [...seen]
      .filter(([, { accented, plain }]) => accented > plain)
      .map(([key, { spelling }]) => [key, spelling]),
  );
}

/** The words of a text written without the accent Geoapify gives them, each "Praca → Praça". */
export function lostAccentsIn(text: string, spellings: Spellings): string[] {
  return (text.match(WORD) ?? []).flatMap((word) => {
    const spelling = spellings.get(foldToLatin(word));
    return spelling === undefined || isAccented(word) ? [] : [`${word} → ${spelling}`];
  });
}

/** Whether a text holds a word Geoapify writes with an accent, kept or left off. */
export function needsAccent(text: string, spellings: Spellings): boolean {
  return (text.match(WORD) ?? []).some((word) => spellings.has(foldToLatin(word)));
}
