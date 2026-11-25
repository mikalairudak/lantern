import { describe, expect, it } from "vitest";
import { spacesBesideTextsOf } from "./server-markup";

describe("spacesBesideTextsOf", () => {
  it("finds a space written after a text, before an element", () => {
    expect(spacesBesideTextsOf("A<!-- --> <span>lively</span>")).toEqual(["A|lively"]);
  });

  it("finds a space written after an element, before a text", () => {
    expect(spacesBesideTextsOf("<span>lively</span> <!-- -->Saturday")).toEqual([
      "lively|Saturday",
    ]);
  });

  it("finds a space written between two texts", () => {
    expect(spacesBesideTextsOf("<p>kept for 30<!-- --> <!-- -->days.</p>")).toEqual(["30|days."]);
  });

  it("passes a space between two elements and a space inside a text of words", () => {
    expect(spacesBesideTextsOf("<span>lively</span> <span>Saturday</span> in<!-- --> ")).toEqual([
      "in|",
    ]);
    expect(spacesBesideTextsOf("<span>lively</span> <span>Saturday</span>")).toEqual([]);
    expect(spacesBesideTextsOf("kept for <!-- -->30<!-- --> days.")).toEqual([]);
  });
});
