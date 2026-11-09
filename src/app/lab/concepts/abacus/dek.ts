import type { FactKey } from "./facts";

/**
 * The line about the day, in fragments, one per part of the day. A proposal beside the
 * facts: an answer touches one part of the day, and the model rewrites only that part's
 * fragment, so the rest of the line never leaves. Joined, the fragments read as one
 * sentence: "Sunrise …, the old town before it wakes, rice on the marina, and tapas …".
 */

export const DEK_PARTS = ["morning", "midday", "dusk", "evening"] as const;
export type DekPart = (typeof DEK_PARTS)[number];

/** A fragment per part; an empty one says nothing, as dusk does on the first day. */
export type DekFragments = Readonly<Record<DekPart, string>>;

/**
 * How each fragment joins the one before. The morning opens the sentence, so its fragment
 * starts with a capital; the evening closes it, after "and", with the full stop.
 */
const LEADS: Readonly<Record<DekPart, string>> = {
  morning: "",
  midday: ", ",
  dusk: ", ",
  evening: ", and ",
};
const CLOSING = ".";

/** The part of the day each fact shapes, so an answer to it rewrites that fragment. */
export const FACT_PARTS: Readonly<Record<Exclude<FactKey, "energy">, DekPart>> = {
  start: "morning",
  travel: "dusk",
  dinner: "evening",
  end: "evening",
  company: "evening",
};

/** The first day's line, in its fragments. */
export const ALICANTE_DEK: DekFragments = {
  morning: "Sunrise from the beach under the castle, the old town before it wakes",
  midday: "rice on the marina",
  dusk: "",
  evening: "tapas standing up after nine",
};

/**
 * One fragment as it stands in the line: with what joins it to the one before, and the
 * full stop after the evening once it is written in full. An empty fragment is nothing.
 */
export function pieceOf(part: DekPart, fragment: string, isComplete = true): string {
  if (fragment === "") return "";
  return `${LEADS[part]}${fragment}${part === "evening" && isComplete ? CLOSING : ""}`;
}

/** The whole line about the day. */
export function dekOf(fragments: DekFragments): string {
  return DEK_PARTS.map((part) => pieceOf(part, fragments[part])).join("");
}

/** The fragments with one part rewritten. */
export function withFragment(fragments: DekFragments, part: DekPart, text: string): DekFragments {
  return { ...fragments, [part]: text };
}
