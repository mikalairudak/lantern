import {
  FACT_KEYS,
  FACT_OPTIONS,
  type Answer,
  type DependsOn,
  type Fact,
  type FactKey,
  type FactSource,
  type Facts,
} from "@/features/day/facts";
import { FACT_PARTS } from "./dek";

/**
 * The lab's answers to the sentence: the Alicante request, and how an answer revises the
 * facts while the answer demo re-composes the day. The sentence's own shapes and labels
 * are the product's (`src/features/day/facts.ts`).
 */

export * from "@/features/day/facts";

/**
 * The answers the concept re-composes: the product's, but for home by eight, which came after it
 * and which its Alicante evening, a late dinner, leaves no room for.
 */
const CONCEPT_OPTIONS: Readonly<Record<FactKey, Fact["options"]>> = {
  ...FACT_OPTIONS,
  end: FACT_OPTIONS.end.filter(({ value }) => value !== "evening"),
};

function fact(key: FactKey, value: string | null, source: FactSource): Fact {
  return { key, value, options: CONCEPT_OPTIONS[key], source, reason: null, revisedFrom: null };
}

/**
 * The Alicante request: the visitor chose "calm", Lantern assumed the rest, and it asks who
 * is coming. Lantern answers first and asks after.
 */
export const ALICANTE_FACTS: Facts = {
  energy: fact("energy", "calm", "chosen"),
  travel: fact("travel", "on-foot", "assumed"),
  start: fact("start", "early", "assumed"),
  dinner: fact("dinner", "late", "assumed"),
  end: fact("end", "early", "assumed"),
  company: fact("company", null, "asked"),
};

/** What an answer does to the day. */
export type AnswerKind =
  /** The current value of a chosen fact: nothing changes. */
  | "none"
  /** The current value of an assumption: it becomes the visitor's word, nothing re-composes. */
  | "confirm"
  /** The energy word: every stop re-picks locally from the versions already written. */
  | "replan"
  /** Anything else: the stops that depend on it are re-composed by the model. */
  | "recompose";

export function answerKindOf(facts: Facts, { key, value }: Answer): AnswerKind {
  const current = facts[key];
  if (current.value === value) return current.source === "assumed" ? "confirm" : "none";
  return key === "energy" ? "replan" : "recompose";
}

function withFact(facts: Facts, key: FactKey, change: Partial<Fact>): Facts {
  return { ...facts, [key]: { ...facts[key], ...change } };
}

/** The visitor's word in the sentence: chosen, with no reason or revision of its own. */
export function chooseFact(facts: Facts, { key, value }: Answer): Facts {
  return withFact(facts, key, { value, source: "chosen", reason: null, revisedFrom: null });
}

/** Lantern changed an assumption because of an answer: the old value is kept to strike. */
export function reviseFact(facts: Facts, { key, value }: Answer, reason: string): Facts {
  const previous = facts[key];
  // Already so, perhaps by the visitor's own word: there is nothing to strike or explain.
  if (previous.value === value) return facts;
  return withFact(facts, key, {
    value,
    source: "assumed",
    reason,
    revisedFrom: previous.revisedFrom ?? previous.value,
  });
}

/**
 * The facts once an answer re-composes its part of the day, so the headline agrees with
 * the stops and the line about the day. The fixtures write each answer from the first day,
 * so within one part of the day they cannot combine two answers: the newer one wins, and
 * every other word in that part goes back to the first day's assumption, unless the answer
 * itself revises it (`revised`). A live model would combine them; this is a fixture limit.
 */
export function restorePart(
  facts: Facts,
  answer: Answer,
  revised: readonly FactKey[],
  first: Facts,
): Facts {
  if (answer.key === "energy") return facts;
  const part = FACT_PARTS[answer.key];
  return FACT_KEYS.reduce((restored, key) => {
    const isOther = key !== "energy" && key !== answer.key && !revised.includes(key);
    if (!isOther || FACT_PARTS[key] !== part) return restored;
    return restored[key].value === first[key].value ? restored : { ...restored, [key]: first[key] };
  }, facts);
}

/** At the next change, struck words fold away and their reasons with them. */
export function settleRevisions(facts: Facts): Facts {
  return FACT_KEYS.reduce(
    (settled, key) =>
      facts[key].revisedFrom === null
        ? settled
        : withFact(settled, key, { reason: null, revisedFrom: null }),
    facts,
  );
}

/**
 * The facts once a visitor answers, before anything is re-composed: their word goes into
 * the sentence and any struck words fold away. Choosing a chosen word again changes nothing.
 */
export function answerFacts(facts: Facts, answer: Answer): Facts {
  if (answerKindOf(facts, answer) === "none") return facts;
  return chooseFact(settleRevisions(facts), answer);
}

/** The revised fact whose reason the facts line gives, if any. */
export function revisedFactOf(facts: Facts): Fact | null {
  return FACT_KEYS.map((key) => facts[key]).find((each) => each.revisedFrom !== null) ?? null;
}

/** The stops an answer to these facts re-composes, in the day's order. */
export function dependentStops(
  stopIds: readonly string[],
  dependsOn: Readonly<Record<string, DependsOn>>,
  keys: readonly FactKey[],
): string[] {
  return stopIds.filter((id) => (dependsOn[id] ?? []).some((key) => keys.includes(key)));
}
