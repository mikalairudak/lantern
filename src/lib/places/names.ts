import { z } from "zod";

/**
 * Letters that no Unicode decomposition breaks into a base letter and a mark, so stripping
 * diacritics leaves them whole and a word splits at them: "Łazienki" would read "azienki".
 */
const LATIN_FOLDS: Readonly<Record<string, string>> = {
  ł: "l",
  ø: "o",
  ß: "ss",
  đ: "d",
  ı: "i",
  æ: "ae",
  œ: "oe",
  þ: "th",
  ð: "d",
};
const FOLDED_LETTERS = new RegExp(`[${Object.keys(LATIN_FOLDS).join("")}]`, "gu");

/** Lower case, in the plain Latin letters a visitor types: "Łódź" reads "lodz", "Straße" "strasse". */
export function foldToLatin(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(FOLDED_LETTERS, (letter) => LATIN_FOLDS[letter] ?? letter);
}

/**
 * A result's further names, as Geoapify gives them in `name_international` and `other_names`:
 * an object of strings, as OpenStreetMap tags them ("name:de": "Köln"), or a list.
 */
export const OtherNamesSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]);

/** The names in such a field; OpenStreetMap separates several in one tag with semicolons. */
export function namesIn(names: z.infer<typeof OtherNamesSchema> | undefined): string[] {
  if (names === undefined) return [];
  return Object.values(names)
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(";"))
    .map((name) => name.trim())
    .filter((name) => name !== "");
}
