import { DEK, draftDayOf } from "@/features/abacus/day-draft";
import { revealedOf } from "@/features/itinerary/revealed";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";

/**
 * Whether the stream has sent Lantern's words for the headline whole: the line about the day
 * begun, so every word before it in the schema's order is final; or an ending, which says
 * what shows instead. The start screen keeps its question until then, so the visitor's day
 * takes the page with every word of its sentence in hand, and the pen writes the line about
 * the day on the day's own page (`docs/decisions.md`, "The first screen asks one question, and no
 * day is drawn until a press").
 */
export function isSentenceStreamed(
  partial: PartialDay | null,
  outcome: DayOutcome | null,
): boolean {
  if (outcome !== null) return true;
  return revealedOf(partial, null).day.dek !== undefined;
}

/**
 * Whether the stream has sent a day's header whole: Lantern's words and the whole line about
 * the day, the stream having moved past it; or an ending, which says what shows instead.
 * The header holds room for the sun's times until the first place gives them, so it needs
 * nothing more.
 */
export function isHeaderStreamed(partial: PartialDay | null, outcome: DayOutcome | null): boolean {
  if (outcome !== null) return true;
  const draft = draftDayOf(revealedOf(partial, null));
  return draft.dek !== undefined && draft.writing !== DEK;
}

/**
 * Whether a day has begun: its header streamed whole and its first stop begun, or its
 * stream ended. A day whose stops close empty never begins, so one asked for while another
 * holds the page, a re-plan or a day asked for again after it came back empty, takes the
 * page only now: an empty day's header reaches the first test too.
 */
export function hasDayBegun(partial: PartialDay | null, outcome: DayOutcome | null): boolean {
  if (outcome !== null) return true;
  return isHeaderStreamed(partial, outcome) && (partial?.stops?.length ?? 0) > 0;
}
