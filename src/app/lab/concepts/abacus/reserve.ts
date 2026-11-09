import { possibleClauses } from "@/features/abacus/clause";
import type { StopDraft } from "@/features/abacus/day-draft";
import type { FactKey, Facts } from "./facts";
import { wordViewsOf } from "./request-sentence";
import type { WordView } from "@/features/day/sentence-word";
import type { Slot } from "./use-request";

/**
 * What the header holds room for. At rest that is the day on screen with every clause the
 * curve can add to it, so a drag never moves anything: the hand is on the chart. An answer
 * is different, the hand and the eye are in the header, so at the click the header takes
 * that answer's tallest state at once, the chart and the list glide there once, and then
 * nothing moves while the answer writes itself in.
 */

/** One state of the header: its words, the day its clauses come from, its lines and end. */
export interface HeaderState {
  facts: Facts;
  /** The day the curve's clauses are drawn from. */
  stops: readonly StopDraft[];
  /** Every line about the day this state can show while it is written. */
  deks: readonly string[];
  slot: Slot;
}

/** The unseen copies that hold the header at its tallest. */
export interface HeaderReserve {
  sentences: readonly Readonly<Record<FactKey, WordView>>[];
  /** The longest clauses, and null for the sentence without one. */
  clauses: readonly (string | null)[];
  deks: readonly string[];
  slots: readonly Slot[];
}

/**
 * How many of the longest clauses the header holds room for. A longer clause needs as many
 * lines or more, so the longest few are enough, and each is one more unseen sentence.
 */
export const RESERVED_CLAUSES = 8;

/** Worked out once per day: a day is the same array until an answer changes it. */
const CLAUSES = new WeakMap<readonly StopDraft[], string[]>();

function clausesOf(stops: readonly StopDraft[]): string[] {
  const known = CLAUSES.get(stops);
  if (known) return known;
  const clauses = possibleClauses(stops);
  CLAUSES.set(stops, clauses);
  return clauses;
}

/** The reserve for the states the header can be in now. */
export function headerReserveOf(states: readonly HeaderState[]): HeaderReserve {
  const clauses = [...new Set(states.flatMap((state) => clausesOf(state.stops)))]
    .toSorted((a, b) => b.length - a.length)
    .slice(0, RESERVED_CLAUSES);
  return {
    sentences: states.map((state) => wordViewsOf(state.facts, () => null)),
    clauses: [null, ...clauses],
    deks: [...new Set(states.flatMap((state) => state.deks))],
    slots: states.map((state) => state.slot),
  };
}
