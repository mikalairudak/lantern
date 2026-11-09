import { SPRINGS } from "@/lib/tokens/motion";
import { hasEnergy, type StopDraft } from "./day-draft";
import type { DaySpan } from "./geometry";
import { penOf, phraseOf, rewritingPhraseOf, startingPhraseOf, type Pen } from "./waiting-pen";

/**
 * What shows while the day is still being written: the next part of the day named in its
 * own words where the next row will be, on a ruled line in the chart at the pen's time,
 * with one light passing through both. It appears only after a silence, leaves on the next
 * arrival, and never moves layout: it sits over space that is already there. With reduced
 * motion its light holds still.
 */

/** The waiting line as the chart and the list receive it: where the pen is, and its words. */
export interface Waiting {
  pen: Pen;
  /** The next part of the day in its own words. */
  phrase: string;
  /**
   * In the place of a stop being written again, rather than below the last one: the pen is
   * on that stop's wire, and the list shows it in that row.
   */
  isInPlace?: boolean;
  /**
   * The bare row it stands in, which the list draws it over; left out in place, it stands in
   * the row being written again, which draws it itself.
   */
  stopId?: string;
}

/** The waiting line over the stops written so far. */
export function waitingOver(stops: readonly StopDraft[], day: DaySpan): Waiting {
  const pen = penOf(stops, day);
  return { pen, phrase: phraseOf(stops, pen) };
}

/**
 * The waiting line in the place of a stop being written again: the stop as it was names
 * what is being rewritten, and the pen sits on its wire, at the middle of its time as drawn.
 */
export function waitingInPlace(
  before: Pick<StopDraft, "startTime" | "primary">,
  wireMinutes: number,
): Waiting {
  return {
    pen: { next: "stop", minutes: wireMinutes },
    phrase: rewritingPhraseOf(before),
    isInPlace: true,
  };
}

/**
 * The waiting line in a bare row's own place, after a silence of its own: the part of the
 * day the row begins, by its own time beside it, and the pen on the row's wire.
 */
export function waitingInBareRow(
  stops: readonly StopDraft[],
  bare: StopDraft,
  wireMinutes: number,
): Waiting {
  return {
    pen: { next: "stop", minutes: wireMinutes },
    phrase: startingPhraseOf(stops, bare),
    isInPlace: true,
    stopId: bare.id,
  };
}

/**
 * The stop whose row stands bare while it is written: placed on its time, its words unseen until
 * its bead is weighed (`docs/decisions.md`, "A row's words go where its bead comes to rest, and
 * rows ease rather than jump"). Known from its time alone, which is all its place says. Only the
 * first: the rows land in order.
 */
export function bareStopOf(stops: readonly StopDraft[]): StopDraft | null {
  return stops.find((stop) => !hasEnergy(stop)) ?? null;
}

/** In when the silence starts, out on the next arrival. */
export const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: SPRINGS.snappy,
} as const;

/**
 * The waiting line's light: one soft band fixed to the screen and moved across it, so every
 * shape that carries it shows the same light at the same moment, in the chart and the list.
 * Add the light's color with `via-*`; with reduced motion only the shape stays.
 */
export const PASS_CLASSES =
  "bg-linear-100 from-transparent to-transparent bg-fixed bg-size-pass bg-no-repeat motion-safe:animate-pass motion-reduce:bg-none";
