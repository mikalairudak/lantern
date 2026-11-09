/**
 * A live model's pace, simulated: a wait before the first words, then bursts of a few
 * tokens, with a pause before the plan's middle stop and another before the options.
 * Seeded, so every run is the same.
 *
 * The waiting line shows after 0.4 s of quiet and takes about 0.8 s to read (`docs/decisions.md`,
 * "Designing for Dynamic UI"), so every quiet here is either well under 0.4 s or at least 1.2 s.
 */
export const UNEVEN_PACE = {
  firstTokenMs: 1400,
  midPlanPauseMs: 1200,
  pauseBeforeOptionsMs: 1200,
  burstMinChars: 20,
  burstMaxChars: 60,
  gapMinMs: 80,
  gapMaxMs: 200,
  seed: 20261021,
} as const;

export interface UnevenPace {
  kind: "uneven";
  /** Another seed gives other bursts and gaps; the pauses stay where they are. */
  seed?: number;
  /**
   * Divides the gaps between bursts. The wait for the first words and the two pauses keep
   * their length, so the waiting line shows in them as it would live.
   */
  speed?: number;
}

/** Where the long pauses fall, as character offsets into the streamed text. */
export interface DayTextOffsets {
  /** Where the plan's middle stop starts; null for a day without stops. */
  midPlan: number | null;
  /** Where the options start; null for a day without any. */
  options: number | null;
}

export interface Burst {
  /** The wait before this burst arrives. */
  delayMs: number;
  delta: string;
}

/**
 * Splits the text into bursts and the waits before them. No burst runs past the middle
 * stop or into the options, so each pause falls exactly where its part starts. A text cut
 * short is paced up to where it stops; a pause past its end never comes.
 */
export function unevenBursts(text: string, offsets: DayTextOffsets, pace: UnevenPace): Burst[] {
  const { seed = UNEVEN_PACE.seed, speed = 1 } = pace;
  if (!(speed > 0)) throw new RangeError(`Expected a speed above 0, got ${speed}`);
  const random = seededRandom(seed);
  const between = (min: number, max: number): number => min + (max - min) * random();
  const boundaries = [offsets.midPlan, offsets.options, text.length].filter(
    (offset): offset is number => offset !== null,
  );

  const waitBefore = (start: number): number => {
    if (start === 0) return UNEVEN_PACE.firstTokenMs;
    const gap = between(UNEVEN_PACE.gapMinMs, UNEVEN_PACE.gapMaxMs) / speed;
    if (start === offsets.midPlan) return gap + UNEVEN_PACE.midPlanPauseMs;
    if (start === offsets.options) return gap + UNEVEN_PACE.pauseBeforeOptionsMs;
    return gap;
  };

  const bursts: Burst[] = [];
  for (let start = 0; start < text.length;) {
    const size = Math.round(between(UNEVEN_PACE.burstMinChars, UNEVEN_PACE.burstMaxChars));
    const end = Math.min(start + size, ...boundaries.filter((offset) => offset > start));
    bursts.push({ delayMs: Math.round(waitBefore(start)), delta: text.slice(start, end) });
    start = end;
  }
  return bursts;
}

/** A small seeded generator (mulberry32): the same numbers in the same order every time. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
