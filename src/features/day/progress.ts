import type { StopDraft } from "@/features/abacus/day-draft";

/**
 * How far the day on screen is written, as the line under its chart says it (`docs/decisions.md`,
 * "Designing for Dynamic UI"): its stops so far, then the versions stop by stop. Once written whole
 * it says nothing: the day's end takes its place (`DayEnd`). Read from the stream alone, so nothing
 * new is asked of the model.
 */
export type DayProgress =
  /** The stops are being written; how many are placed so far, the total still unknown. */
  | { kind: "stops"; count: number }
  /**
   * The versions are being written, after every stop: the model writes them stop by stop,
   * so the last stop with one says how far down the day they have come.
   */
  | { kind: "versions"; reached: number; of: number }
  /** Written whole. */
  | { kind: "written" };

/** How far a day is written, from its stops as the stream has them. */
export function progressOf(
  stops: readonly Pick<StopDraft, "alternatives">[],
  isWritten: boolean,
): DayProgress {
  if (isWritten) return { kind: "written" };
  const reached = stops.findLastIndex((stop) => stop.alternatives.length > 0) + 1;
  if (reached > 0) return { kind: "versions", reached, of: stops.length };
  return { kind: "stops", count: stops.length };
}

/** A space a line never breaks at, so a count keeps its unit: "4 of 9 stops". */
const TIED = "\u00a0";

/** The words the line under the chart says above its sources, or none. */
export function progressWordsOf(progress: DayProgress): string | null {
  switch (progress.kind) {
    case "stops":
      // Before the first stop the header is still being written, and says so itself.
      if (progress.count === 0) return null;
      return `Writing the day · ${progress.count}${TIED}${progress.count === 1 ? "stop" : "stops"} so far`;
    case "versions":
      return `Writing quieter and livelier versions · ${progress.reached}${TIED}of${TIED}${progress.of}${TIED}stops`;
    case "written":
      return null;
  }
}
