import {
  COMPANIES,
  DAY_ENDS,
  DAY_STARTS,
  DINNER_TIMES,
  ENERGY_LEVELS,
  FACT_KEYS,
  TRAVEL_MODES,
  type AssumableFactKey,
  type FactKey,
  type FactSource,
} from "@/lib/schema/itinerary.schema";

/**
 * The request as the sentence shows it. The keys, vocabularies and sources are the schema's
 * (`src/lib/schema/itinerary.schema.ts`); what stays here is how each value reads, which
 * code decides and the model never writes, and the sentence's own state:
 *
 * - Each changeable word of the sentence is a fact: a key, a value from that key's typed
 *   vocabulary, and where the value came from. "chosen" is the visitor's word, "assumed"
 *   is Lantern's, and "asked" is the open question, which has no value until it is answered.
 * - A fact carries its options so the sentence can open any word in place.
 * - When an answer makes the model change another assumption, the revised fact keeps the
 *   value it replaced and a few words on why, for the sentence to strike and explain.
 * - Each stop lists the facts it depends on (`DependsOn`), so an answer re-composes only
 *   the stops that depend on it, and hovering a word can light the stops it shaped.
 */

export { FACT_KEYS };
export type { FactKey, FactSource };

/** Each fact's vocabulary, the schema's own. */
export const FACT_VOCABULARIES = {
  energy: ENERGY_LEVELS,
  travel: TRAVEL_MODES,
  start: DAY_STARTS,
  dinner: DINNER_TIMES,
  end: DAY_ENDS,
  company: COMPANIES,
} as const satisfies Record<FactKey, readonly string[]>;

/** One answer a fact can take, as the sentence says it. */
export interface FactOption {
  /** A value from the fact's vocabulary. */
  value: string;
  /** In the sentence: "with family". */
  label: string;
  /** On its own, as a retry names it: "family". */
  name: string;
}

export interface Fact {
  key: FactKey;
  /** A value from the fact's vocabulary; null while an asked fact has no answer. */
  value: string | null;
  options: readonly FactOption[];
  source: FactSource;
  /** Why Lantern revised the value, in a few words; null unless it did. */
  reason: string | null;
  /** The value a revision replaced, struck through in the sentence; null unless revised. */
  revisedFrom: string | null;
}

export type Facts = Readonly<Record<FactKey, Fact>>;

/** The facts a stop depends on: an answer to any of them re-composes it. */
export type DependsOn = readonly FactKey[];

/** A visitor's answer to one word. */
export interface Answer {
  key: FactKey;
  value: string;
}

const option = (value: string, label: string, name: string = label): FactOption => ({
  value,
  label,
  name,
});

/**
 * Labels for each vocabulary. The energy word reads "quiet" for reflective, the word a
 * visitor would use in a sentence; the others are the levels' own names.
 */
export const FACT_OPTIONS: Readonly<Record<FactKey, readonly FactOption[]>> = {
  energy: [
    option("reflective", "quiet"),
    option("calm", "calm"),
    option("balanced", "balanced"),
    option("lively", "lively"),
    option("social", "social"),
  ],
  travel: [
    option("on-foot", "on foot"),
    option("transit", "by public transport", "public transport"),
    option("taxi", "by taxi", "a taxi"),
  ],
  start: [option("early", "early start"), option("slow", "slow morning")],
  dinner: [option("early", "early dinner"), option("late", "eating late")],
  // Real hours, as a visitor says when they must be home (`docs/decisions.md`, "The end of the
  // day is said in real hours").
  end: [
    option("evening", "home by eight"),
    option("early", "home by eleven"),
    option("late", "out late"),
  ],
  company: [
    option("alone", "alone"),
    option("partner", "with a partner", "a partner"),
    option("family", "with family", "family"),
    option("friends", "with friends", "friends"),
  ],
};

/**
 * How the sentence says a word the model left empty, before it is answered: each its own
 * cue, the day's arc from morning to night, then who it is with. The company reads as a plain
 * phrase, "with anyone", rather than a word left unfinished, in muted ink as an open question
 * is, one tap from change. The energy is never left empty, since every request has one.
 */
export const ASKED_LABELS: Readonly<Record<AssumableFactKey, string>> = {
  travel: "getting around …",
  start: "morning …",
  dinner: "dinner …",
  end: "night …",
  company: "with anyone",
};

/** The option a value stands for, if it is one of the fact's. */
export function optionOf(fact: Pick<Fact, "options">, value: string | null): FactOption | null {
  return fact.options.find((each) => each.value === value) ?? null;
}

/** The fact as the sentence says it: its option's label, or its own open question. */
export function labelOf(fact: Fact): string {
  const label = optionOf(fact, fact.value)?.label;
  if (label !== undefined) return label;
  return fact.key === "energy" ? "" : ASKED_LABELS[fact.key];
}
