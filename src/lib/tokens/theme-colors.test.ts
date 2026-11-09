// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS } from "./catalog";
import { themeColor, themeColorsOf } from "./theme-colors";

const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const COLORS = themeColorsOf(stylesheet);
const HEX = /^#[0-9a-f]{6}$/;

describe("themeColorsOf", () => {
  it("reads every colour the catalog lists, in both themes", () => {
    for (const { name } of COLOR_TOKENS) {
      const pair = COLORS.get(name);
      expect(pair, name).toBeDefined();
      expect(pair?.light).toMatch(HEX);
      expect(pair?.dark).toMatch(HEX);
    }
  });

  it("reads only colours declared for both themes", () => {
    // The stylesheet's own ink line, beside a colour with one value and a token that is none.
    const inkLine = stylesheet.split("\n").find((line) => line.includes("--color-ink:")) ?? "";
    const ink = COLORS.get("ink");
    const declared = themeColorsOf(`${inkLine}\n--color-flat: ${ink?.light};\n--space-1: 4px;`);

    expect(declared).toEqual(new Map([["ink", ink]]));
  });
});

describe("themeColor", () => {
  it("gives a token's value in the theme asked for", () => {
    const pair = COLORS.get("ground");

    expect(themeColor(COLORS, "ground", "dark")).toBe(pair?.dark);
    expect(themeColor(COLORS, "ground", "light")).toBe(pair?.light);
    expect(themeColor(COLORS, "ground", "dark")).not.toBe(themeColor(COLORS, "ground", "light"));
  });

  it("names a token the stylesheet does not declare", () => {
    expect(() => themeColor(COLORS, "moonlight", "dark")).toThrow("--color-moonlight");
  });
});
