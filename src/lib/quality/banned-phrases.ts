import { textsIn } from "./path";

/**
 * Travel-copy clichés. One hit fails the day. The day's prompt imports the same list, so the
 * model is told exactly what the check rejects. The reasons are in
 * `docs/voice.md`.
 */
export const BANNED_PHRASES = [
  "hidden gem",
  "nestled",
  "vibrant",
  "bustling",
  "must-see",
  "must-visit",
  "iconic",
  "breathtaking",
  "stunning",
  "picturesque",
  "charming",
  "quaint",
  "immerse",
  "delve",
  "tapestry",
  "boasts",
  "a testament to",
  "rich history",
  "steeped in",
  "off the beaten path",
  "whether you're",
  "perfect for",
  "something for everyone",
  "like a local",
  "feast for the senses",
  "unforgettable",
  "oasis",
  "a haven",
  "paradise",
  "instagrammable",
  "bucket list",
  "world-class",
  "look no further",
] as const;

/** The voice never raises itself, so any exclamation mark counts as a hit. */
const EXCLAMATION_MARK = "!";

/**
 * Proper names, not copy: a bar called Oasis is a name, not a cliché. A coffee, food or bar
 * place's name is copy since day-v4, a line about its food and its street, and the day's
 * banned-phrase check reads it by its kind (`checks.ts`), which this list cannot see.
 */
const NAME_KEYS: ReadonlySet<string> = new Set(["name", "neighborhood"]);

export interface BannedPhraseHit {
  /** Where the hit is, e.g. `stops[2].place.summary`. */
  path: string;
  phrase: string;
}

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole words and phrases in any case; a final "s" still counts, so "hidden gems" hits.
const PHRASE_PATTERNS = BANNED_PHRASES.map((phrase) => ({
  phrase,
  pattern: new RegExp(`\\b${escapeForPattern(phrase)}s?\\b`, "i"),
}));

/** A typographic apostrophe would hide "whether you’re" from the list's straight one. */
function straightenApostrophes(text: string): string {
  return text.replace(/[‘’]/g, "'");
}

/** The banned phrases in one text, with "!" for an exclamation mark. */
export function phrasesIn(text: string): string[] {
  const straight = straightenApostrophes(text);
  const found = PHRASE_PATTERNS.filter(({ pattern }) => pattern.test(straight)).map(
    ({ phrase }) => phrase,
  );
  return straight.includes(EXCLAMATION_MARK) ? [...found, EXCLAMATION_MARK] : found;
}

/**
 * Every banned phrase in every generated string of `value`, except place names and
 * neighbourhoods.
 */
export function findBannedPhrases(value: unknown): BannedPhraseHit[] {
  return textsIn(value, NAME_KEYS).flatMap(({ path, text }) =>
    phrasesIn(text).map((phrase) => ({ path, phrase })),
  );
}
