import { describe, expect, it } from "vitest";
import { opacityAt } from "./fold";

/** Openness of the fold that arrives; the one that leaves is at the complement. */
const STEPS = Array.from({ length: 101 }, (_, step) => step / 100);

describe("a fold's opacity against its height", () => {
  it("keeps leaving content until the collapse starts, and has it gone by half closed", () => {
    expect(opacityAt(1, true)).toBe(1);
    expect(opacityAt(0.75, true)).toBeGreaterThan(0);
    expect(opacityAt(0.5, true)).toBe(0);
  });

  it("shows arriving content only once its fold is a third open", () => {
    expect(opacityAt(0.3, false)).toBe(0);
    expect(opacityAt(0.5, false)).toBeGreaterThan(0);
    expect(opacityAt(1, false)).toBe(1);
  });

  it("never leaves a moment with neither the leaving nor the arriving content showing", () => {
    const shown = STEPS.map((arriving) =>
      Math.max(opacityAt(arriving, false), opacityAt(1 - arriving, true)),
    );

    expect(Math.min(...shown)).toBeGreaterThan(0);
  });
});
