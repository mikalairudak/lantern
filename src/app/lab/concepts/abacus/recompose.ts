import type { GeneratedPlace } from "@/lib/schema/itinerary.schema";
import { formatClock, minutesOf, runningSpans, runningStart } from "@/lib/time/clock";
import {
  FREE_TEXT_KEYS,
  revealValue,
  writtenLength,
  type DeepPartial,
  type RevealedValue,
} from "./stand-in-stream";
import {
  clockTimeOf,
  DEK,
  draftFieldsOf,
  STOP_FIELD_PATH,
  versionsOf,
  isEmptied,
  type GeneratedOption,
  type StopDraft,
} from "@/features/abacus/day-draft";
import type { DekFragments, DekPart } from "./dek";
import {
  dependentStops,
  reviseFact,
  type Answer,
  type DependsOn,
  type FactKey,
  type Facts,
} from "./facts";

// Lives in the product now; re-exported for the lab pages that import it from here.
export { replanForEnergy } from "@/features/abacus/replan";

/**
 * A re-composition: what the model writes when an answer changes the day, scoped to what
 * depends on it. A proposal for the generation schema, beside `GeneratedDaySchema`. Its
 * field order is its render order, as the day's is: the assumptions the answer forced the
 * model to revise, then each stop it rewrites by the stable id of the stop it replaces,
 * then their other versions, and last the line about the day. Stops that do not depend on
 * the answer are not written at all, so they hold still.
 */

/** An assumption the model had to change, written first: which, to what, and why. */
export interface GeneratedRevision {
  key: FactKey;
  value: string;
  /** A few words, for the end of the facts line. */
  reason: string;
}

/**
 * A stop written again, by the id of the one it replaces. It keeps that stop's place in
 * the day and the facts it depends on; a live model would write those with it.
 */
export interface GeneratedRewrite {
  id: string;
  startTime: string;
  durationMinutes: number;
  place: GeneratedPlace;
}

export interface GeneratedRecomposition {
  revisions: GeneratedRevision[];
  stops: GeneratedRewrite[];
  /** The other versions of each rewritten stop, after all of them. */
  alternatives: { stopId: string; options: GeneratedOption[] }[];
  /** The part of the day whose fragment of the line about the day is rewritten. */
  dekPart: DekPart;
  /** That fragment, written last; empty when the part has nothing to say any more. */
  dek: string;
}

/** A hand-written re-composition for one answer, with the picker's line for it. */
export interface Recomposition {
  answer: Answer;
  /** One short line in the picker saying what the answer would change. */
  consequence: string;
  generation: GeneratedRecomposition;
}

/** The `writing` key while a revision's reason is being written. */
export const REASON = "reason";

/** A revision's reason grows as it is written, as the day's free text does. */
const FREE_TEXT: ReadonlySet<string> = new Set([...FREE_TEXT_KEYS, "reason"]);

const REVISION_REASON_PATH = /^revisions\.\d+\.reason$/;

/** The day once it is written, whatever has re-composed it since. */
export interface DayState {
  /** The line about the day, a fragment from the latest answer that touched each part. */
  fragments: DekFragments;
  stops: readonly StopDraft[];
  dependsOn: Readonly<Record<string, DependsOn>>;
}

/** The re-composition as far as the stream has written it. */
export function revealRecomposition(
  generation: GeneratedRecomposition,
  budget: number,
): RevealedValue<GeneratedRecomposition> {
  return revealValue(generation, budget, FREE_TEXT);
}

/** How many characters a re-composition, or any part of one, takes to write. */
export function recompositionLength(value: unknown): number {
  return writtenLength(value, FREE_TEXT);
}

/** The revisions whose new value has arrived, in order. */
export function arrivedRevisions(
  revealed: DeepPartial<GeneratedRecomposition>,
): { key: FactKey; value: string; reason: string }[] {
  return (revealed.revisions ?? []).flatMap((revision) =>
    revision.key !== undefined && revision.value !== undefined
      ? [{ key: revision.key, value: revision.value, reason: revision.reason ?? "" }]
      : [],
  );
}

/** The facts as the stream has revised them so far. */
export function revisedFacts(facts: Facts, revealed: DeepPartial<GeneratedRecomposition>): Facts {
  return arrivedRevisions(revealed).reduce(
    (revised, { key, value, reason }) => reviseFact(revised, { key, value }, reason),
    facts,
  );
}

/** Ids for the places of a stop written again, unique to the run that wrote them. */
export function rewritePrefix(stopId: string, run: number): string {
  return `${stopId}:r${run}`;
}

/** A stop being written again, as far as its rewrite has arrived. */
function rewrittenStop(
  before: StopDraft,
  rewrite: DeepPartial<GeneratedRewrite> | undefined,
  options: readonly DeepPartial<GeneratedOption>[],
  run: number,
): StopDraft {
  const prefix = rewritePrefix(before.id, run);
  const primaryId = `${prefix}:p`;
  const { durationMinutes, place } = rewrite ?? {};
  const startTime = clockTimeOf(rewrite?.startTime);
  const isPlaced = place !== undefined && startTime !== null && durationMinutes !== undefined;
  // Until its new time is whole, the stop holds its old one: its row and wire stay put.
  const stop: StopDraft = {
    id: before.id,
    startTime: isPlaced ? startTime : before.startTime,
    durationMinutes: isPlaced ? durationMinutes : before.durationMinutes,
    primary: isPlaced ? { id: primaryId, ...draftFieldsOf(place) } : { id: primaryId },
    alternatives: [],
    selectedPlaceId: primaryId,
    dependsOn: before.dependsOn,
  };
  // The concept's rewrites are written by hand and never normalized: each version is drawn.
  return { ...stop, alternatives: versionsOf(stop, options, prefix) };
}

/** The text being written, keyed as the chart and the list read it. */
function writingOf(
  activePath: string | null,
  rewrites: readonly DeepPartial<GeneratedRewrite>[],
  run: number,
): string | null {
  if (activePath === DEK) return DEK;
  if (activePath !== null && REVISION_REASON_PATH.test(activePath)) return REASON;
  const match = activePath === null ? null : STOP_FIELD_PATH.exec(activePath);
  const stopId = match ? rewrites[Number(match[1])]?.id : undefined;
  if (!match || stopId === undefined) return null;
  return `${rewritePrefix(stopId, run)}:p.${match[2]}`;
}

/** The day while an answer re-composes it, as far as the stream has written. */
export interface RecomposingDay {
  /**
   * In a re-composition, the new fragment of the line about the day as far as it is
   * written, undefined before it starts; in the first write-in, the whole line so far.
   */
  dek: string | undefined;
  stops: StopDraft[];
  writing: string | null;
  /** The stops being written again, by id, in the day's order. */
  rewriting: string[];
  isComplete: boolean;
}

/**
 * A stop still empty never sits before the one above it: when the stop before it moves
 * later, it moves along, so wires never cross while several stops are written again.
 */
function makeRoom(stops: readonly StopDraft[], isEmpty: (stop: StopDraft) => boolean) {
  return stops.reduce<StopDraft[]>((placed, stop) => {
    // Running minutes, so a stop after midnight is later than one before it, not earlier.
    const end = runningSpans(placed).at(-1)?.to;
    if (end === undefined || !isEmpty(stop)) return [...placed, stop];
    if (runningStart(minutesOf(stop.startTime), end) >= end) return [...placed, stop];
    return [...placed, { ...stop, startTime: formatClock(end) }];
  }, []);
}

/**
 * The day with an answer's re-composition laid over it. Every stop that depends on the
 * answer, or on an assumption the stream has revised, is written again in place: it
 * empties at once, keeps its old time until the new one arrives (or moves along to make
 * room for the stop before it), and fills as its rewrite streams in. The other stops are
 * the day's own objects, untouched.
 */
export function recomposedDayOf(
  day: DayState,
  answer: Answer,
  run: number,
  revealed: RevealedValue<GeneratedRecomposition>,
): RecomposingDay {
  const { value } = revealed;
  const keys = [answer.key, ...arrivedRevisions(value).map((revision) => revision.key)];
  const rewriting = dependentStops(
    day.stops.map((stop) => stop.id),
    day.dependsOn,
    keys,
  );
  const rewrites = value.stops ?? [];
  const stops = day.stops.map((stop) => {
    if (!rewriting.includes(stop.id)) return stop;
    const rewrite = rewrites.find((each) => each.id === stop.id);
    const options = (value.alternatives ?? [])
      .filter((set) => set.stopId === stop.id)
      .flatMap((set) => set.options ?? []);
    return rewrittenStop(stop, rewrite, options, run);
  });
  return {
    dek: value.dek,
    stops: makeRoom(stops, (stop) => isEmptied(stop, rewriting)),
    writing: writingOf(revealed.activePath, rewrites, run),
    rewriting,
    isComplete: revealed.isComplete,
  };
}

/** The stops an answer re-composes, as its whole re-composition says: by `dependsOn`. */
export function stopsRecomposedBy(day: DayState, recomposition: Recomposition): string[] {
  const keys = [
    recomposition.answer.key,
    ...recomposition.generation.revisions.map((revision) => revision.key),
  ];
  return dependentStops(
    day.stops.map((stop) => stop.id),
    day.dependsOn,
    keys,
  );
}

/** The level a stop's plan moves to when the day's energy shifts, on the scale. */
