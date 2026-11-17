import { parsePartialJson } from "ai";
import type { StopDraft } from "@/features/abacus/day-draft";
import { dayContextOf } from "@/features/abacus/light";
import {
  replanFrameOf,
  windowsOf,
  writtenStopsOf,
  writtenVersionOf,
  WHOLE_DAY_WINDOW,
  type PartialReplanDraft,
  type ReplanFrame,
  type ReplanWindow,
} from "@/features/abacus/replan-frame";
import type { WorkReceipt } from "@/features/abacus/work-line";
import { forkReceiptOf } from "@/features/day/part-slip-lines";
import type { ReplanWritten } from "@/features/day/replan-controls";
import { wholeDayWrittenOf, writtenOf } from "@/features/day/replan-work";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import {
  UTRECHT_EARLY_MORNING,
  UTRECHT_MORNING_BASIS,
} from "@/lib/fixtures/replan/utrecht-morning";
import type { DayContext } from "@/lib/geo/sun";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { mergeShownReplan, type ReplanBasis } from "@/lib/replan/merge";
import type {
  AssumableFactKey,
  DayRequest,
  GeneratedDay,
  Stop,
} from "@/lib/schema/itinerary.schema";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { dayText } from "@/lib/stream/simulate-day-stream";

/**
 * The fork bench's days: a changed word on a real day, its two versions whole, and the frames
 * of its proposal's stream, read from the stream's own text as the page reads it, so the bench
 * steps through what the page would show without a timer.
 */

/** A day as the model wrote it, with its request: the whole day's proposal. */
export interface BenchDay {
  request: DayRequest;
  day: GeneratedDay;
}

/** One frame of the proposal's stream, as far as it is written. */
export interface WritingStep {
  label: string;
  /** A beat has passed since the press, so the search is said. */
  isLookingDue: boolean;
  /** A part's proposal beside the day; null for a whole day's, and before the route answers. */
  frame: ReplanFrame | null;
  /** How far a whole day's stream is written; null for a part's. */
  written: ReplanWritten | null;
  /** The proposal's version of the day as far as the stream has finished it, in order. */
  finished: StopDraft[];
}

export interface ForkBench {
  change: { word: AssumableFactKey; from: string; to: string };
  reach: "part" | "whole";
  idPrefix: string;
  windows: readonly ReplanWindow[];
  before: readonly Stop[];
  after: readonly Stop[];
  daylight: DayContext;
  receipts: { proposal: WorkReceipt; before: WorkReceipt };
  /** The frames to step through while the proposal is written. */
  steps: () => Promise<WritingStep[]>;
}

/**
 * What the proposal would change against the day, and the day before once it is taken, worked
 * out from the two versions as the page draws them (`forkReceiptOf`).
 */
function receiptsOf(
  fork: Pick<ForkBench, "change" | "reach" | "windows">,
  before: readonly Stop[],
  after: readonly Stop[],
): ForkBench["receipts"] {
  return {
    proposal: forkReceiptOf({ ...fork, side: "to", day: before, other: after }),
    before: forkReceiptOf({ ...fork, side: "from", day: after, other: before }),
  };
}

/** The press, before the route has answered: the fork's head alone. */
const PRESSED: WritingStep = {
  label: "the press",
  isLookingDue: false,
  frame: null,
  written: null,
  finished: [],
};

/**
 * The first prefix of a stream's text at which what it holds reaches a state, by halves: the
 * stream only adds, so once reached it stays reached.
 */
async function firstAt<Value>(
  text: string,
  isReached: (value: Value) => boolean,
): Promise<{ at: number; value: Value }> {
  const valueAt = async (at: number) =>
    ((await parsePartialJson(text.slice(0, at))).value ?? {}) as Value;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (isReached(await valueAt(middle))) high = middle;
    else low = middle + 1;
  }
  return { at: low, value: await valueAt(low) };
}

/** A part's proposal, step by step: each of its stops finished, then its versions, then its line. */
async function partStepsOf(basis: ReplanBasis, replan: GeneratedReplan): Promise<WritingStep[]> {
  const text = JSON.stringify(replan);
  const stepOf = (label: string, partial: PartialReplanDraft): WritingStep => {
    const frame = replanFrameOf(basis, partial);
    return { label, isLookingDue: true, frame, written: null, finished: writtenVersionOf(frame) };
  };
  const steps = [PRESSED, stepOf("looking", {})];
  for (let count = 1; count <= replan.stops.length; count += 1) {
    const { value } = await firstAt<PartialReplanDraft>(
      text,
      (partial) => writtenStopsOf(replanFrameOf(basis, partial)).length >= count,
    );
    steps.push(stepOf(`${count} of ${replan.stops.length} stops finished`, value));
  }
  const versions = await firstAt<PartialReplanDraft>(
    text,
    (partial) => (partial.alternatives?.length ?? 0) > 1,
  );
  steps.push(stepOf("their versions", versions.value));
  const dek = await firstAt<PartialReplanDraft>(text, (partial) => partial.dek !== undefined);
  steps.push(stepOf("its line about the day", dek.value));
  return steps;
}

/** A whole day's proposal, step by step: each of its stops finished, then its versions. */
async function wholeStepsOf(day: GeneratedDay): Promise<WritingStep[]> {
  const text = dayText(day);
  const stepOf = (label: string, partial: PartialDay): WritingStep => ({
    label,
    isLookingDue: true,
    frame: null,
    written: writtenOf(partial),
    finished: wholeDayWrittenOf(partial),
  });
  const steps = [PRESSED, stepOf("looking", {})];
  for (let count = 1; count <= day.stops.length; count += 1) {
    const { value } = await firstAt<PartialDay>(
      text,
      (partial) => wholeDayWrittenOf(partial).length >= count,
    );
    steps.push(stepOf(`${count} of ${day.stops.length} stops finished`, value));
  }
  const versions = await firstAt<PartialDay>(
    text,
    (partial) => (partial.alternatives?.length ?? 0) > 1,
  );
  steps.push(stepOf("their versions", versions.value));
  return steps;
}

/** A part's fork on a real day: its proposal merged as the page merges it. */
function partBenchOf(
  basis: ReplanBasis,
  replan: GeneratedReplan,
  change: ForkBench["change"],
): ForkBench {
  const merged = mergeShownReplan({ ...basis, replan });
  if (!merged.ok) throw new Error(`The bench's proposal does not merge: ${merged.reason}`);
  const before = basis.itinerary.stops;
  const after = merged.itinerary.stops;
  const windows = windowsOf(basis.itinerary, basis.windows);
  return {
    change,
    reach: "part",
    idPrefix: basis.idPrefix,
    windows,
    before,
    after,
    daylight: dayContextOf(basis.itinerary),
    receipts: receiptsOf({ change, reach: "part", windows }, before, after),
    steps: () => partStepsOf(basis, replan),
  };
}

/** Elche's dinner changed to "eating late": its lunch and its evening, two parts of one fork. */
export const ELCHE_BENCH = partBenchOf(ELCHE_DINNER_BASIS, ELCHE_LATE_DINNER_UNREPEATED, {
  word: "dinner",
  from: "early dinner",
  to: "eating late",
});

/** Utrecht's slow morning changed to an early start: the coffee and the tower, and a park. */
export const UTRECHT_BENCH = partBenchOf(UTRECHT_MORNING_BASIS, UTRECHT_EARLY_MORNING, {
  word: "start",
  from: "slow morning",
  to: "early start",
});

/**
 * Kyoto's written day, an early start for anyone, written again whole with friends: another
 * Kyoto day the model wrote for friends stands as the proposal.
 */
export function kyotoBenchOf(friends: BenchDay): ForkBench {
  const normalized = normalizeDay(friends.request, friends.day);
  if (!normalized.ok) throw new Error(`Kyoto's day for friends does not normalize`);
  const before = KYOTO_ITINERARY.stops;
  const after = normalized.itinerary.stops;
  const change = { word: "company", from: "with anyone", to: "with friends" } as const;
  return {
    change,
    reach: "whole",
    idPrefix: "",
    windows: [WHOLE_DAY_WINDOW],
    before,
    after,
    daylight: dayContextOf(KYOTO_ITINERARY),
    receipts: receiptsOf({ change, reach: "whole", windows: [WHOLE_DAY_WINDOW] }, before, after),
    steps: () => wholeStepsOf(friends.day),
  };
}
