import { isSameRequest } from "@/lib/days/request";
import type { IntakeRouteAnswer } from "@/lib/intake/signed-city";
import { writtenIntakeOf, writtenPhrasesOf } from "@/lib/intake/written-intake";
import {
  ASSUMABLE_FACT_KEYS,
  type AssumableFactKey,
  type FactKey,
} from "@/lib/schema/itinerary.schema";
import type { WrittenGist } from "./day";
import { FACT_OPTIONS, optionOf } from "./facts";

/**
 * A reading on the start screen. A request for a written day also names Lantern's words the
 * visitor's text said as they are: the day starts with them as the visitor's own.
 */
export type StartResult = IntakeRouteAnswer & { confirmed?: readonly AssumableFactKey[] };

/** Reads the visitor's text on the start screen into a start result. */
export type StartReader = (text: string, signal?: AbortSignal) => Promise<StartResult>;

/**
 * The reading with live generation off: the written intake, which plays a written city's whole day
 * and says nothing else back (`writtenIntakeOf`). A phrase of the text equal, in any case, to one
 * of Lantern's words in that day's sentence, as the sentence says it or as it is named alone, with
 * or without an article, makes that word the visitor's, as choosing it would: "Bologna, slow
 * morning" opens Bologna's day with its slow start undotted. A phrase that only means one ("slow
 * mornings") confirms nothing; the intake's model reads it once live generation is on, and this
 * leaves with the stand-in.
 */
export function readWrittenOnly(pool: readonly WrittenGist[]): StartReader {
  return (text) => {
    const result = writtenIntakeOf(text);
    if (result.kind !== "request") return Promise.resolve(result);
    const written = pool.find((each) => isSameRequest(each.request, result.request));
    if (!written) return Promise.resolve(result);
    const named = new Set(writtenPhrasesOf(text).map(wordOf));
    const isNamed = (key: FactKey) => wordsOf(written, key).some((word) => named.has(word));
    return Promise.resolve({
      ...result,
      confirmed: ASSUMABLE_FACT_KEYS.filter(
        (key) => written.facts[key].source === "assumed" && isNamed(key),
      ),
    });
  };
}

/** One word of the day's sentence as a phrase would match it: as it is said, and named alone. */
function wordsOf({ facts }: WrittenGist, key: FactKey): string[] {
  const option = optionOf({ options: FACT_OPTIONS[key] }, facts[key].value);
  // An asked word has no value: the sentence asks it rather than saying it.
  return option ? [wordOf(option.label), wordOf(option.name)] : [];
}

/** A leading article a visitor adds to a word: "a slow morning" says "slow morning". */
const ARTICLE = /^(?:a|an|the)\s+/;

function wordOf(phrase: string): string {
  return phrase.trim().toLowerCase().replace(ARTICLE, "");
}
