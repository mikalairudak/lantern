"use client";

import { useCallback, useEffect, useState } from "react";
import { NOTICE_HEARD_MS } from "./notice-status";
import { useSaidAgain } from "./said-again";

/**
 * The words that lead the line about the day while the day differs from its plan, said lower
 * case once a change brings the day back to it.
 */
export const AS_FIRST_PLANNED = "As first planned";

/**
 * The visitor's own change to the day, as it stood at the act: what is said of it is worked out
 * once, from the day as it stands once the status has stood empty after the act
 * (`useChangeHeard`), against the day as
 * the act found it: its clause, and whether every stop showed its planned place.
 */
export type DayChange =
  /** A swap at one stop: a version's arrow or swipe on the plan, a bead, a stop's arrow key. */
  | {
      kind: "stop";
      stopIndex: number;
      /** The id of the place the stop showed at the act, "" for a stop there is not. */
      placeIdBefore: string;
      clauseBefore: string | null;
      wasAsPlanned: boolean;
    }
  /** A drag of the curve, which can change several stops. */
  | { kind: "curve"; clauseBefore: string | null; wasAsPlanned: boolean }
  /** An energy press, said as its line counted it before the re-pick. */
  | { kind: "energy"; line: string };

/** A place a stop shows: its id, unique in the day, and its name, "" where it has none. */
export interface ShownPlace {
  id: string;
  name: string;
}

/** The day after a change, as the page shows it. */
export interface DayAfterChange {
  /** The headline's clause, null when it has none. */
  clause: string | null;
  /** Whether every stop shows the place the line about the day was written around. */
  isAsPlanned: boolean;
  /** The place a stop shows, null for a stop there is not. */
  placeAt: (stopIndex: number) => ShownPlace | null;
}

/**
 * What a screen reader is told of a change, "" for nothing: the place now standing at a swapped
 * stop, then what the change did to the day, the plan regained or the headline's new clause,
 * never a clause it left as it was. A place the act left as it was (the same place, by its id),
 * as at an act the curve refuses while a drag is held, is not said, nor is a place with no name, which leaves what the
 * act did to the day said alone (`docs/decisions.md`, "The visitor's own change to the day is
 * said from the header's status").
 */
export function changeLineOf(change: DayChange, after: DayAfterChange): string {
  if (change.kind === "energy") return change.line;
  const dayLine = dayChangeOf(change, after);
  if (change.kind === "curve") return dayLine;
  const place = after.placeAt(change.stopIndex);
  if (place === null || place.name === "" || place.id === change.placeIdBefore) return dayLine;
  return dayLine === "" ? place.name : `${place.name}, ${dayLine}`;
}

/**
 * What a change did to the day: the plan regained where the act brought every stop back to its
 * planned place, otherwise the headline's new clause where it has one, otherwise "".
 */
function dayChangeOf(
  before: { clauseBefore: string | null; wasAsPlanned: boolean },
  after: DayAfterChange,
): string {
  if (after.isAsPlanned && !before.wasAsPlanned) return AS_FIRST_PLANNED.toLowerCase();
  if (after.clause !== null && after.clause !== before.clauseBefore) return after.clause;
  return "";
}

/** The visitor's last change to the day, as the header's status says it. */
export interface ChangeHeard {
  /** What the status says of the change, "" for nothing. */
  line: string;
  /** Records an act on the day: the status empties, and says it once it has stood empty. */
  hear: (change: DayChange) => void;
  /** Lets the line go before its hold ends: the status empties and says nothing. */
  drop: () => void;
}

/**
 * What a screen reader is told of the visitor's last change to the day, for `NOTICE_HEARD_MS`.
 * Each act empties the status, so one that says the same words as the one before is still a
 * change heard; once it has stood empty (`useSaidAgain`), by when the day has taken the act,
 * its line is worked out from the day as it stands and kept as written. Once written, the line only ever gives way to "": a
 * change that is no act, a re-plan landing or picks brought back, never rewrites it
 * (`docs/decisions.md`, "The visitor's own change to the day is said from the header's status").
 */
export function useChangeHeard(after: DayAfterChange): ChangeHeard {
  const [change, setChange] = useState<DayChange | null>(null);
  const [acts, setActs] = useState(0);
  const isSaid = useSaidAgain(acts);
  // Written in the render the pause ends in, from the day as it stands then, and kept.
  const [written, setWritten] = useState<{ change: DayChange; line: string } | null>(null);
  if (isSaid && change !== null && written?.change !== change) {
    setWritten({ change, line: changeLineOf(change, after) });
  }
  useEffect(() => {
    if (change === null) return undefined;
    const quiet = window.setTimeout(() => setChange(null), NOTICE_HEARD_MS);
    return () => window.clearTimeout(quiet);
  }, [change]);
  const hear = useCallback((act: DayChange) => {
    setChange(act);
    setActs((count) => count + 1);
  }, []);
  const drop = useCallback(() => setChange(null), []);
  const line = change !== null && written?.change === change ? written.line : "";
  return { line, hear, drop };
}
