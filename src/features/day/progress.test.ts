import { describe, expect, it } from "vitest";
import { progressOf, progressWordsOf } from "./progress";

const stop = (versions: number) => ({ alternatives: Array.from({ length: versions }, () => ({})) });
const stops = (...versions: number[]) =>
  versions.map(stop) as unknown as Parameters<typeof progressOf>[0];

describe("progressOf", () => {
  it("counts the stops so far while they are written", () => {
    expect(progressOf(stops(0, 0, 0), false)).toEqual({ kind: "stops", count: 3 });
  });

  it("follows the versions down the day, by the last stop that has one", () => {
    // A stop with no versions in the middle does not hold the count back.
    expect(progressOf(stops(2, 0, 1, 0, 0), false)).toEqual({
      kind: "versions",
      reached: 3,
      of: 5,
    });
  });

  it("says the day is written", () => {
    expect(progressOf(stops(2, 2), true)).toEqual({ kind: "written" });
  });
});

describe("progressWordsOf", () => {
  it.each([
    [{ kind: "stops", count: 0 } as const, null],
    [{ kind: "stops", count: 1 } as const, "Writing the day · 1\u00a0stop so far"],
    [{ kind: "stops", count: 6 } as const, "Writing the day · 6\u00a0stops so far"],
    [
      { kind: "versions", reached: 4, of: 9 } as const,
      "Writing quieter and livelier versions · 4\u00a0of\u00a09\u00a0stops",
    ],
    // Written whole, the line gives its place to the day's end.
    [{ kind: "written" } as const, null],
  ])("says %o as %s", (progress, words) => {
    expect(progressWordsOf(progress)).toBe(words);
  });
});
