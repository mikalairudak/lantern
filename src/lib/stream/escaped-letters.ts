/**
 * Letters a model escaped twice. Now and then Sonnet writes "ç" in its JSON as `\\u00e7`: an
 * escaped backslash, then the text "u00e7". The JSON is valid, so its string parses to
 * `Pra\u00e7a`, and the page would show that (`docs/decisions.md`, "A letter the model escaped
 * twice is unescaped by the reader"). Every parse of a day's text for the visitor takes its strings
 * through here; the generation log keeps the text as written, and the `escaped-letters` check
 * counts how often it happens.
 */

/** Backslashes, then `u` and four hex digits: one UTF-16 code unit spelled out as text. */
const ESCAPED_LETTER = /\\+u([0-9a-fA-F]{4})/g;

/**
 * An escape a stream has cut: the string so far ends in backslashes, perhaps with `u` and
 * fewer than four digits. The partial parser shows it as it is, so `Pra\u00` would flash on
 * the page before the letter arrives; the SDK already drops a cut escape that is single.
 */
const CUT_ESCAPE = /\\+(?:u[0-9a-fA-F]{0,3})?$/;

/**
 * A surrogate pair, or half of one. Half renders as a replacement mark: an emoji cut between
 * its two escapes leaves one, written twice or once. The prompt asks for no emoji; this keeps
 * a slip from showing as a box while the second half streams. A pair matches first and is
 * kept; no lookbehind, so the reader's module parses in any browser.
 */
const SURROGATES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

const HEX = 16;

/**
 * A string with the letters it spells as escapes written as letters, an escape cut at its end
 * dropped, and any half of a surrogate pair dropped. A string without them comes back as it is.
 */
export function unescapeLetters(text: string): string {
  return text
    .replace(CUT_ESCAPE, "")
    .replace(ESCAPED_LETTER, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, HEX)))
    .replace(SURROGATES, (units) => (units.length === 2 ? units : ""));
}

/** A parsed value with every string in it, at any depth, through `unescapeLetters`. */
export function withLettersUnescaped<T>(value: T): T {
  // The walk keeps every object, array and value where it was and maps strings to strings,
  // so the value keeps its type.
  return unescapedIn(value) as T;
}

function unescapedIn(value: unknown): unknown {
  if (typeof value === "string") return unescapeLetters(value);
  if (Array.isArray(value)) return value.map(unescapedIn);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unescapedIn(item)]));
  }
  return value;
}

/** The escapes a string spells out as text, as written: `á` in `Santa Bárbara`. */
export function escapedLettersIn(text: string): string[] {
  return text.match(ESCAPED_LETTER) ?? [];
}
