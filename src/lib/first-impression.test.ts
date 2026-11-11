import { describe, expect, it } from "vitest";
import { isFirstImpression } from "./first-impression";

describe("isFirstImpression", () => {
  it("is on only for exactly 1", () => {
    expect(isFirstImpression({ FIRST_IMPRESSION: "1" })).toBe(true);
  });

  it("is off when unset, empty or anything else", () => {
    for (const value of [undefined, "", "0", "true", " 1", "yes"]) {
      expect(isFirstImpression({ FIRST_IMPRESSION: value })).toBe(false);
    }
  });
});
