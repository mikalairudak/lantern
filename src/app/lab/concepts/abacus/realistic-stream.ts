import type { GeneratedDay } from "@/lib/schema/itinerary.schema";
import { offsetsOf, type Keyframe } from "./pacing";

/**
 * A live model, simulated, so waiting can be judged on something like the real thing: a
 * pause before the first words, then bursts, with a pause before the plan's middle stop and
 * another before the options. The pauses match the app's uneven pace
 * (`src/lib/stream/uneven-pace.ts`): every quiet is well under the waiting line's 0.4 s or
 * long enough to read it. Seeded, so every run is the same. Seconds and characters.
 */
export const REALISTIC = {
  firstToken: 1.4,
  burstMin: 20,
  burstMax: 60,
  gapMin: 0.08,
  gapMax: 0.2,
  midPlanPause: 1.2,
  pauseBeforeOptions: 1.2,
  seed: 20261021,
} as const;

/** A small seeded generator (mulberry32): the same numbers in the same order every time. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The stream as steps: each burst arrives whole at its moment, so between two bursts
 * nothing changes. Steps are pairs of keyframes at the same moment, which `budgetAt` reads
 * as a jump. No burst runs past the start of the middle stop or into the options, so each
 * pause falls exactly where its part starts.
 */
export function realisticStreamOf(day: GeneratedDay, seed: number = REALISTIC.seed): Keyframe[] {
  const offsets = offsetsOf(day);
  const midPlan = offsets.stops[Math.floor(day.stops.length / 2)] ?? null;
  const boundaries = [midPlan, offsets.options, offsets.total].filter(
    (offset): offset is number => offset !== null,
  );
  const random = seededRandom(seed);
  const between = (min: number, max: number) => min + (max - min) * random();

  const keyframes: Keyframe[] = [{ seconds: 0, budget: 0 }];
  let seconds: number = REALISTIC.firstToken;
  let budget = 0;
  while (budget < offsets.total) {
    const ceiling = Math.min(...boundaries.filter((offset) => offset > budget));
    const next = Math.min(
      ceiling,
      budget + Math.round(between(REALISTIC.burstMin, REALISTIC.burstMax)),
    );
    keyframes.push({ seconds, budget }, { seconds, budget: next });
    budget = next;
    seconds += between(REALISTIC.gapMin, REALISTIC.gapMax);
    if (budget === midPlan) seconds += REALISTIC.midPlanPause;
    if (budget === offsets.options) seconds += REALISTIC.pauseBeforeOptions;
  }
  return keyframes;
}
