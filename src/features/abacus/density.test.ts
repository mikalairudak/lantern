import { describe, expect, it } from "vitest";
import { densityOf } from "./density";

describe("densityOf", () => {
  it("opens calm rows, keeps balanced ones and folds lively ones", () => {
    expect([0, 1, 2, 3, 4].map(densityOf)).toEqual([
      "open",
      "open",
      "standard",
      "folded",
      "folded",
    ]);
  });

  it("folds a row until its energy is written, so a row only ever grows once weighed", () => {
    expect(densityOf(null)).toBe("folded");
  });
});
