/**
 * The words that lead the line about the day while the day differs from its plan, said lower
 * case once a change brings the day back to it.
 */
export const AS_FIRST_PLANNED = "As first planned";

/**
 * The visitor's own change to the day, as it stood at the act: what is said of it is worked out
 * from the day after it (`changeLineOf`).
 */
export type DayChange =
  /** A swap at one stop: a version's arrow or swipe on the plan, a bead, a stop's arrow key. */
  | { kind: "stop"; stopIndex: number; clauseBefore: string | null }
  /** A drag of the curve, which can change several stops. */
  | { kind: "curve"; clauseBefore: string | null }
  /** An energy press, said as its line counted it before the re-pick. */
  | { kind: "energy"; line: string };

/** The day after a change, as the page shows it. */
export interface DayAfterChange {
  /** The headline's clause, null when it has none. */
  clause: string | null;
  /** Whether every stop shows the place the line about the day was written around. */
  isAsPlanned: boolean;
  /** The name of the place a stop shows. */
  placeAt: (stopIndex: number) => string;
}

/**
 * What a screen reader is told of a change, "" for nothing: the place now standing at a swapped
 * stop, then what the change did to the headline's clause, never a clause it left as it was
 * (`docs/decisions.md`, "The visitor's own change to the day is said from the header's status").
 */
export function changeLineOf(change: DayChange, after: DayAfterChange): string {
  if (change.kind === "energy") return change.line;
  const clauseLine = clauseChangeOf(change.clauseBefore, after);
  if (change.kind === "curve") return clauseLine;
  const place = after.placeAt(change.stopIndex);
  return clauseLine === "" ? place : `${place}, ${clauseLine}`;
}

/** What a change did to the headline's clause: its new words, the plan regained, or "". */
function clauseChangeOf(before: string | null, after: DayAfterChange): string {
  if (after.clause === before) return "";
  if (after.clause !== null) return after.clause;
  return after.isAsPlanned ? AS_FIRST_PLANNED.toLowerCase() : "";
}
