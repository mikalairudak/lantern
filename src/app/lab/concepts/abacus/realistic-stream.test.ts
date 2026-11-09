import { describe, expect, it } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { budgetAt, offsetsOf } from "./pacing";
import { REALISTIC, realisticStreamOf } from "./realistic-stream";
import { generatedDayOf } from "./stream";

const GENERATED = generatedDayOf(ABACUS_DAY);
const OFFSETS = offsetsOf(GENERATED);
const STREAM = realisticStreamOf(GENERATED);
const MID_PLAN = OFFSETS.stops[Math.floor(OFFSETS.stops.length / 2)];
/** Each burst as it lands: its moment and how much it brings. */
const BURSTS = STREAM.slice(1)
  .filter((_, index) => index % 2 === 1)
  .map((keyframe, index, bursts) => ({
    seconds: keyframe.seconds,
    budget: keyframe.budget,
    size: keyframe.budget - (bursts[index - 1]?.budget ?? 0),
  }));
const GAPS = BURSTS.slice(1).map((burst, index) => ({
  seconds: burst.seconds - BURSTS[index]!.seconds,
  after: BURSTS[index]!.budget,
}));

describe("realisticStreamOf", () => {
  it("is the same stream every time", () => {
    expect(realisticStreamOf(GENERATED)).toEqual(STREAM);
    expect(realisticStreamOf(GENERATED, 7)).not.toEqual(STREAM);
  });

  it("says nothing for 1.4 seconds, then writes the whole day", () => {
    expect(budgetAt(STREAM, REALISTIC.firstToken - 0.01)).toBe(0);
    expect(budgetAt(STREAM, REALISTIC.firstToken)).toBeGreaterThan(0);
    expect(STREAM.at(-1)?.budget).toBe(OFFSETS.total);
  });

  it("writes in bursts of 20 to 60 characters, one every 80 to 200 milliseconds", () => {
    const regular = GAPS.filter((gap) => gap.seconds <= REALISTIC.gapMax + 1e-9);

    BURSTS.slice(0, -1).forEach((burst) => {
      if (burst.budget === MID_PLAN || burst.budget === OFFSETS.options) return;
      expect(burst.size).toBeGreaterThanOrEqual(REALISTIC.burstMin);
      expect(burst.size).toBeLessThanOrEqual(REALISTIC.burstMax);
    });
    regular.forEach((gap) => expect(gap.seconds).toBeGreaterThanOrEqual(REALISTIC.gapMin));
    expect(GAPS.length - regular.length).toBe(2);
  });

  it("pauses exactly where the middle stop starts and where the options start", () => {
    const pauses = GAPS.filter((gap) => gap.seconds > REALISTIC.gapMax + 1e-9);
    const [midPlan, beforeOptions] = pauses;

    expect(midPlan!.seconds).toBeGreaterThanOrEqual(REALISTIC.midPlanPause);
    expect(midPlan!.after).toBe(MID_PLAN);
    expect(beforeOptions!.seconds).toBeGreaterThanOrEqual(REALISTIC.pauseBeforeOptions);
    expect(beforeOptions!.after).toBe(OFFSETS.options);
  });

  it("reads as steps: nothing changes between two bursts", () => {
    const [first, second] = BURSTS;

    expect(budgetAt(STREAM, first!.seconds)).toBe(first!.budget);
    expect(budgetAt(STREAM, (first!.seconds + second!.seconds) / 2)).toBe(first!.budget);
    expect(budgetAt(STREAM, second!.seconds)).toBe(second!.budget);
  });
});
