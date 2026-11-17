// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fontMeasuresOf } from "./font-advances";

const FONTS = join(__dirname, "..", "..", "..", "assets/fonts");
const ROMAN = fontMeasuresOf(readFileSync(join(FONTS, "Literata36pt-Regular.latin.ttf")));
const ITALIC = fontMeasuresOf(readFileSync(join(FONTS, "Literata72pt-Italic.latin.ttf")));

describe("a font's measures", () => {
  it("sets a row as wide as the sum of its letters' advances, at any size", () => {
    expect(ITALIC.widthOf("Lantern", 72)).toBeCloseTo(262.7, 1);
    expect(ROMAN.widthOf("One day in a city, planned hour by hour,", 30)).toBeCloseTo(569.2, 1);
    expect(ROMAN.widthOf("as quiet or as lively as you want it.", 30)).toBeCloseTo(479.3, 1);
    expect(ROMAN.widthOf("Lantern", 60)).toBeCloseTo(2 * ROMAN.widthOf("Lantern", 30));
  });

  it("measures a row of two letters as the two alone", () => {
    expect(ROMAN.widthOf("ab", 30)).toBeCloseTo(ROMAN.widthOf("a", 30) + ROMAN.widthOf("b", 30));
    expect(ROMAN.widthOf("", 30)).toBe(0);
  });

  it("measures the middle dot the cards set between a day and its word", () => {
    expect(ROMAN.widthOf("·", 34)).toBeGreaterThan(0);
  });

  it("fails on a letter its cut does not hold, rather than set it as nothing", () => {
    expect(() => ROMAN.widthOf("Kraków", 30)).toThrow('The font has no glyph for "ó"');
  });

  it("stands the baseline where the files' ascent of 950 and descent of 250 put it", () => {
    expect(ROMAN.baselineShareAt(1)).toBeCloseTo(0.85);
    expect(ITALIC.baselineShareAt(1)).toBeCloseTo(0.85);
    // The leading is shared over and under the face: 1.55 at 30 px puts it 33.75 px down.
    expect(ROMAN.baselineShareAt(1.55) * 30).toBeCloseTo(33.75);
  });

  it("refuses a file with no table it reads", () => {
    const empty = new Uint8Array(12);
    expect(() => fontMeasuresOf(empty)).toThrow("The font has no head table");
  });
});
