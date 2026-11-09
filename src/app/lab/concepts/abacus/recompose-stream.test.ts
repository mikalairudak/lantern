import { describe, expect, it } from "vitest";
import { budgetAt } from "./pacing";
import { START, isSilent, stepPlayback } from "./playback";
import {
  FAIL_AFTER_SECONDS,
  RECOMPOSE_STREAM,
  recompositionBoundaries,
  recompositionOffsetsOf,
  recompositionStreamOf,
} from "./recompose-stream";
import { RECOMPOSITIONS } from "./recompositions";
import { WITH_FAMILY } from "./recompositions-evening";

const FRAME = 1 / 60;
const { generation } = WITH_FAMILY;
const OFFSETS = recompositionOffsetsOf(generation);

describe("a re-composition's stream", () => {
  it("orders the revisions, the stops, their versions and the line about the day", () => {
    expect(OFFSETS.stops[0]).toBeGreaterThan(0);
    expect(OFFSETS.alternatives).toBeGreaterThan(OFFSETS.stops.at(-1)!);
    expect(OFFSETS.dek).toBeGreaterThan(OFFSETS.alternatives);
    expect(OFFSETS.total).toBeGreaterThan(OFFSETS.dek);
  });

  it("is silent while the model thinks, long enough to wait and for a failure to give up", () => {
    const stream = recompositionStreamOf(generation);
    const boundaries = recompositionBoundaries(OFFSETS);
    let playback = START;
    let firstSilence: number | null = null;
    let firstWords: number | null = null;
    for (let seconds = 0; playback.shown < OFFSETS.total; seconds += FRAME) {
      playback = stepPlayback(playback, budgetAt(stream, seconds), seconds, boundaries);
      if (firstSilence === null && isSilent(playback, seconds, OFFSETS.total))
        firstSilence = seconds;
      if (firstWords === null && playback.shown > 0) firstWords = seconds;
    }

    expect(firstWords).toBeCloseTo(RECOMPOSE_STREAM.firstToken, 1);
    expect(firstSilence).toBeLessThan(FAIL_AFTER_SECONDS);
    expect(FAIL_AFTER_SECONDS).toBeLessThan(RECOMPOSE_STREAM.firstToken);
  });

  it.each(RECOMPOSITIONS.map((each) => [`${each.answer.key} ${each.answer.value}`, each]))(
    "writes %s in full, in a few seconds",
    (_, recomposition) => {
      const stream = recompositionStreamOf(recomposition.generation);
      const offsets = recompositionOffsetsOf(recomposition.generation);
      const end = stream.at(-1)!;
      const MAX_SECONDS = 8;

      expect(end.budget).toBe(offsets.total);
      expect(end.seconds).toBeLessThan(MAX_SECONDS);
    },
  );
});
