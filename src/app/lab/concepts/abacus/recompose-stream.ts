import type { Keyframe } from "./pacing";
import { recompositionLength, type GeneratedRecomposition } from "./recompose";
import { seededRandom } from "./realistic-stream";

/**
 * A re-composition is always a live call, so it streams like the simulated live model: a
 * pause while the model thinks, then bursts, with a shorter pause before the other
 * versions. It is scoped, so it is short. Seeded, so every run is the same. Seconds and
 * characters.
 */
export const RECOMPOSE_STREAM = {
  firstToken: 1.1,
  burstMin: 30,
  burstMax: 70,
  gapMin: 0.06,
  gapMax: 0.14,
  pauseBeforeVersions: 0.45,
  seed: 20261022,
} as const;

/** A failing call gives up at the end of its first pause, before anything arrives. */
export const FAIL_AFTER_SECONDS = RECOMPOSE_STREAM.firstToken - 0.1;

/** Where each part of a re-composition starts in its stream, as a budget. */
export interface RecompositionOffsets {
  stops: number[];
  alternatives: number;
  dek: number;
  total: number;
}

export function recompositionOffsetsOf(generation: GeneratedRecomposition): RecompositionOffsets {
  const { revisions, stops, alternatives, dekPart } = generation;
  const before = (part: Partial<GeneratedRecomposition>): number =>
    recompositionLength({ revisions: [], stops: [], alternatives: [], ...part });
  return {
    stops: stops.map((_, index) => before({ revisions, stops: stops.slice(0, index) })),
    alternatives: before({ revisions, stops }),
    dek: before({ revisions, stops, alternatives, dekPart }),
    total: recompositionLength(generation),
  };
}

/** Where new arrivals begin, for the playback's steady beat: each stop, then the versions. */
export function recompositionBoundaries(offsets: RecompositionOffsets): number[] {
  return [...offsets.stops, offsets.alternatives];
}

/**
 * The re-composition as steps, as `realisticStreamOf` writes the day: each burst arrives
 * whole at its moment. A burst never runs into the versions; they wait for their pause.
 */
export function recompositionStreamOf(
  generation: GeneratedRecomposition,
  seed: number = RECOMPOSE_STREAM.seed,
): Keyframe[] {
  const offsets = recompositionOffsetsOf(generation);
  const random = seededRandom(seed);
  const between = (min: number, max: number) => min + (max - min) * random();

  const keyframes: Keyframe[] = [{ seconds: 0, budget: 0 }];
  let seconds: number = RECOMPOSE_STREAM.firstToken;
  let budget = 0;
  while (budget < offsets.total) {
    const ceiling = budget < offsets.alternatives ? offsets.alternatives : offsets.total;
    const next = Math.min(
      ceiling,
      budget + Math.round(between(RECOMPOSE_STREAM.burstMin, RECOMPOSE_STREAM.burstMax)),
    );
    keyframes.push({ seconds, budget }, { seconds, budget: next });
    budget = next;
    seconds += between(RECOMPOSE_STREAM.gapMin, RECOMPOSE_STREAM.gapMax);
    if (budget === offsets.alternatives) seconds += RECOMPOSE_STREAM.pauseBeforeVersions;
  }
  return keyframes;
}
