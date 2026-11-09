import { describe, expect, it } from "vitest";
import { isSameLines, lineBoxesOf, mergeLines, type LineBox } from "./line-boxes";

const NAME: LineBox = { x: 0, y: 0, width: 120, height: 24 };
// The kind sits on the name's baseline, 12 px after it, in a smaller size.
const KIND: LineBox = { x: 132, y: 6, width: 90, height: 18 };
const NOTE: LineBox = { x: 0, y: 26, width: 180, height: 20 };

describe("mergeLines", () => {
  it("joins a name and its kind on one line into one box, the gap included", () => {
    expect(mergeLines([NAME, KIND])).toEqual([{ x: 0, y: 0, width: 222, height: 24 }]);
  });

  it("keeps lines one under another apart, top first", () => {
    expect(mergeLines([NOTE, NAME])).toEqual([NAME, NOTE]);
  });

  it("drops pieces with no area", () => {
    expect(mergeLines([NAME, { x: 130, y: 0, width: 0, height: 24 }])).toEqual([NAME]);
  });
});

describe("isSameLines", () => {
  it("takes lines within half a pixel as the same, so a remeasure settles", () => {
    expect(isSameLines([NAME], [{ ...NAME, width: 120.3 }])).toBe(true);
    expect(isSameLines([NAME], [{ ...NAME, width: 121 }])).toBe(false);
    expect(isSameLines([NAME], [NAME, NOTE])).toBe(false);
  });
});

describe("lineBoxesOf", () => {
  it("measures nothing where the browser lays nothing out", () => {
    const element = document.createElement("p");
    element.textContent = "Honen-in";

    expect(lineBoxesOf(element)).toEqual([]);
  });
});
