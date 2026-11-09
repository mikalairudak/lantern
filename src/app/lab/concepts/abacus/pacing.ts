import type { GeneratedDay } from "@/lib/schema/itinerary.schema";
import { SPRINGS } from "@/lib/tokens/motion";
import { WIRE_DRAWN_MS } from "@/features/abacus/use-arrivals";
import { revealLength, writtenLength } from "./stand-in-stream";

/**
 * How the replay is phrased (docs/design-direction.md, "As each stop arrives"). Time maps to phases
 * of the stream rather than to one character rate: the line about the day, the first stop on its
 * own, the other stops in a steady beat, a pause once the plan has settled, then the options. The
 * boundaries come from the day itself, so any day is phrased the same way. All times are in seconds
 * from the start of the replay.
 */
export const PHRASING = {
  dekFrom: 0.15,
  dekTo: 0.85,
  firstStopAt: 0.9,
  /** The first stop lands alone and has this long before the next one. */
  firstStopHold: 0.5,
  stopEvery: 0.3,
  /** A wire counts as drawn when it is about 90% across (`WIRE_DRAWN_MS`). */
  wireDrawn: WIRE_DRAWN_MS / 1000,
  /** After the last bead settles, before the options. */
  pause: 0.3,
  options: 0.8,
} as const;

/** How much of the day the replay has written at a moment. */
export interface Keyframe {
  seconds: number;
  budget: number;
}

/** Where each part of the day starts in the stream, as a budget. */
export interface StreamOffsets {
  dek: number;
  stops: number[];
  options: number;
  total: number;
}

/** The budget at which each part of the day starts, as the stream reveals it. */
export function offsetsOf(day: GeneratedDay): StreamOffsets {
  // The stand-in writes the assumptions after everything else, so only the total holds them.
  const assumed = writtenLength(day.assumptions);
  const before = (part: GeneratedDay): number => revealLength(part) - assumed;
  const head: GeneratedDay = { ...day, stops: [], alternatives: [] };
  return {
    dek: before({ ...head, dek: "" }),
    stops: day.stops.map((_, index) => before({ ...head, stops: day.stops.slice(0, index) })),
    options: before({ ...day, alternatives: [] }),
    total: revealLength(day),
  };
}

/** When each stop starts arriving, and how long it takes to be written. */
function stopWindows(count: number): { from: number; seconds: number }[] {
  return Array.from({ length: count }, (_, index) =>
    index === 0
      ? { from: PHRASING.firstStopAt, seconds: PHRASING.firstStopHold }
      : {
          from: PHRASING.firstStopAt + PHRASING.firstStopHold + (index - 1) * PHRASING.stopEvery,
          seconds: PHRASING.stopEvery,
        },
  );
}

/**
 * The replay's keyframes for a day: straight lines between them. The options wait until
 * the last bead can have settled: its window ends, its wire is drawn, its slide runs.
 */
export function phrasingOf(day: GeneratedDay): Keyframe[] {
  const offsets = offsetsOf(day);
  const windows = stopWindows(day.stops.length);
  const stops = windows.flatMap(({ from, seconds }, index) => [
    { seconds: from, budget: offsets.stops[index] ?? offsets.options },
    { seconds: from + seconds, budget: offsets.stops[index + 1] ?? offsets.options },
  ]);
  const last = windows.at(-1);
  const optionsAt = last
    ? last.from +
      Math.max(last.seconds, PHRASING.wireDrawn) +
      SPRINGS.layout.visualDuration +
      PHRASING.pause
    : PHRASING.firstStopAt;
  return [
    { seconds: 0, budget: 0 },
    { seconds: PHRASING.dekFrom, budget: offsets.dek },
    { seconds: PHRASING.dekTo, budget: offsets.stops[0] ?? offsets.options },
    ...stops,
    { seconds: optionsAt, budget: offsets.options },
    { seconds: optionsAt + PHRASING.options, budget: offsets.total },
  ];
}

/** How much of the day is written at a moment of the replay. */
export function budgetAt(keyframes: readonly Keyframe[], seconds: number): number {
  const next = keyframes.findIndex((keyframe) => keyframe.seconds > seconds);
  if (next === -1) return keyframes.at(-1)?.budget ?? 0;
  const to = keyframes[next];
  const from = keyframes[next - 1];
  if (!to || !from) return 0;
  const share = (seconds - from.seconds) / (to.seconds - from.seconds);
  return Math.floor(from.budget + (to.budget - from.budget) * share);
}
