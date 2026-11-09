import { describe, expect, it } from "vitest";
import { revealDay, revealLength } from "./stand-in-stream";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { draftDayOf } from "@/features/abacus/day-draft";
import { PHRASING, budgetAt, phrasingOf } from "./pacing";
import { generatedDayOf } from "./stream";

const GENERATED = generatedDayOf(ABACUS_DAY);
const KEYFRAMES = phrasingOf(GENERATED);

function dayAt(seconds: number) {
  return draftDayOf(revealDay(GENERATED, budgetAt(KEYFRAMES, seconds)));
}

describe("phrasingOf", () => {
  it("writes nothing at first and the whole day at the end", () => {
    expect(budgetAt(KEYFRAMES, 0)).toBe(0);
    expect(budgetAt(KEYFRAMES, 60)).toBe(revealLength(GENERATED));
  });

  it("never takes anything back", () => {
    const budgets = Array.from({ length: 600 }, (_, step) => budgetAt(KEYFRAMES, step / 100));

    budgets
      .slice(1)
      .forEach((budget, index) => expect(budget).toBeGreaterThanOrEqual(budgets[index]!));
  });

  it("writes the line about the day between 0.15 and 0.85 seconds", () => {
    expect(dayAt(PHRASING.dekFrom).dek ?? "").toBe("");
    expect(dayAt(0.5).dek?.length).toBeGreaterThan(0);
    expect(dayAt(0.5).dek).not.toBe(GENERATED.dek);
    expect(dayAt(PHRASING.dekTo).dek).toBe(GENERATED.dek);
    expect(dayAt(PHRASING.dekTo).stops).toEqual([]);
  });

  it("lands the first stop alone at 0.9 seconds and holds it for half a second", () => {
    expect(dayAt(0.89).stops).toHaveLength(0);
    expect(dayAt(0.92).stops).toHaveLength(1);
    expect(dayAt(1.39).stops).toHaveLength(1);
  });

  it("lands the other stops one every 0.3 seconds from 1.4", () => {
    const landings = [1, 2, 3, 4, 5, 6, 7].map(
      (count) => [1.39 + (count - 1) * 0.3, 1.42 + (count - 1) * 0.3] as const,
    );

    landings.forEach(([before, after], index) => {
      expect(dayAt(before).stops).toHaveLength(index + 1);
      expect(dayAt(after).stops).toHaveLength(index + 2);
    });
  });

  it("pauses after the last bead settles, then writes the options by about 5 seconds", () => {
    const optionsAt = KEYFRAMES.at(-2)!.seconds;
    const done = KEYFRAMES.at(-1)!.seconds;

    expect(optionsAt).toBeCloseTo(4.2);
    expect(done).toBeCloseTo(5.0);
    expect(dayAt(optionsAt - 0.01).stops.every((stop) => stop.alternatives.length === 0)).toBe(
      true,
    );
    expect(dayAt(done).isComplete).toBe(true);
  });

  it("phrases a shorter day the same way, with its options sooner", () => {
    const short = phrasingOf({ ...GENERATED, stops: GENERATED.stops.slice(0, 2) });

    expect(short.at(-2)!.seconds).toBeCloseTo(1.4 + 0.3 + 0.4 + 0.3);
    expect(short.at(-1)!.budget).toBe(
      revealLength({ ...GENERATED, stops: GENERATED.stops.slice(0, 2) }),
    );
  });
});
