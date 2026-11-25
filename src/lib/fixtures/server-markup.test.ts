import { describe, expect, it } from "vitest";
import { spacesBesideTextsOf, wordsAre } from "./server-markup";

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

describe("wordsAre", () => {
  it("finds an element by its whole words, its space in a box of its own", () => {
    const holder = document.createElement("div");
    holder.innerHTML = "<p>Sat 28 Nov · <span>sunrise<span> </span>06:44</span></p>";
    const [line, sun] = [holder.querySelector("p"), holder.querySelector("span")];

    expect(wordsAre("sunrise 06:44")("", sun)).toBe(true);
    expect(wordsAre("sunrise 06:44")("", line)).toBe(false);
    expect(wordsAre("sunrise 06:44")("", null)).toBe(false);
  });
});
