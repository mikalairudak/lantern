// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { themeColor, themeColorsOf, type Theme } from "./theme-colors";

/*
 * The palette's bars (docs/decisions.md, "Tokens are enforced, not documented"), read from
 * globals.css itself, so a token edit that breaks one fails here rather than on someone's screen.
 */

const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

const THEMES: Theme[] = ["light", "dark"];
const COLORS = themeColorsOf(stylesheet);

function color(name: string, theme: Theme): string {
  return themeColor(COLORS, name, theme);
}

type Rgb = [number, number, number];

function linearRgb(hex: string): Rgb {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return [channel(1), channel(3), channel(5)];
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colours. */
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(linearRgb(a)), luminance(linearRgb(b))].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

/** How much lighter the first colour is than the second, as a contrast ratio; under 1 if darker. */
function lighterBy(lighter: string, darker: string): number {
  return (luminance(linearRgb(lighter)) + 0.05) / (luminance(linearRgb(darker)) + 0.05);
}

type Lab = [number, number, number];

function lab([r, g, b]: Rgb): Lab {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number =>
    t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** CIEDE2000 colour difference, the measure the palette's distances are given in. */
function deltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const chromaMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(chromaMean ** 7 / (chromaMean ** 7 + 25 ** 7)));
  const [a1p, a2p] = [(1 + g) * a1, (1 + g) * a2];
  const [c1, c2] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)];
  const hue = (a: number, b: number): number => (toDegrees(Math.atan2(b, a)) + 360) % 360;
  const [h1, h2] = [hue(a1p, b1), hue(a2p, b2)];
  let hueStep = c1 * c2 === 0 ? 0 : h2 - h1;
  if (hueStep > 180) hueStep -= 360;
  if (hueStep < -180) hueStep += 360;
  const deltaH = 2 * Math.sqrt(c1 * c2) * Math.sin(toRadians(hueStep / 2));
  const lMean = (l1 + l2) / 2;
  const cMean = (c1 + c2) / 2;
  let hMean = h1 + h2;
  if (c1 * c2 !== 0) hMean = Math.abs(h1 - h2) > 180 ? (h1 + h2 + 360) / 2 : (h1 + h2) / 2;
  const t =
    1 -
    0.17 * Math.cos(toRadians(hMean - 30)) +
    0.24 * Math.cos(toRadians(2 * hMean)) +
    0.32 * Math.cos(toRadians(3 * hMean + 6)) -
    0.2 * Math.cos(toRadians(4 * hMean - 63));
  const rotation =
    -Math.sin(toRadians(60 * Math.exp(-(((hMean - 275) / 25) ** 2)))) *
    2 *
    Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cMean;
  const sh = 1 + 0.015 * cMean * t;
  const [dl, dc, dh] = [(l2 - l1) / sl, (c2 - c1) / sc, deltaH / sh];
  return Math.sqrt(dl ** 2 + dc ** 2 + dh ** 2 + rotation * dc * dh);
}

type Deficiency = "protan" | "deutan";

/** Machado, Oliveira and Fernandes (2009), full severity, applied in linear RGB. */
const DEFICIENCIES: Record<Deficiency, readonly [Rgb, Rgb, Rgb]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

function seenWith(hex: string, deficiency: Deficiency): Rgb {
  const [r, g, b] = linearRgb(hex);
  const channel = ([wr, wg, wb]: Rgb): number => Math.min(1, Math.max(0, wr * r + wg * g + wb * b));
  const [red, green, blue] = DEFICIENCIES[deficiency];
  return [channel(red), channel(green), channel(blue)];
}

function distanceSeenWith(a: string, b: string, deficiency: Deficiency): number {
  return deltaE2000(lab(seenWith(a, deficiency)), lab(seenWith(b, deficiency)));
}

/** Text tokens: each is set as words somewhere, so each holds the app's 5:1. */
const TEXT = ["ink", "ink-soft", "muted", "amber", "energy", "swap"];
const TEXT_CONTRAST = 5;
/**
 * What is drawn rather than read (WCAG 1.4.11's bar for graphics): the lamp draws light, the
 * curve draws energy, swap-drawn the versions. Each is its words' colour freed from the 5:1
 * of text, so it can be bright where the words have to be deep, or stand back from the ink.
 */
const DRAWN = ["lamp", "curve", "swap-drawn"];
const GRAPHIC_CONTRAST = 3;
/** The wires sit between a rule and text: about 2:1. */
const WIRE_CONTRAST = { least: 1.9, most: 2.3 };
/** A hairline is a rule, not a mark: seen on the ground, and never as heavy as a wire. */
const LINE_CONTRAST = { least: 1.25, most: 1.5 };
/** By night a raised sheet stands a step up from the ground on its own hue. */
const NIGHT_SHEET_OVER_PAGE = 1.15;
const ACCENTS = ["amber", "lamp", "energy", "curve", "swap", "swap-drawn"] as const;
/**
 * Light, energy and swap stay told apart by protan and deutan eyes (about 1 man in 12),
 * in words and drawn, from each other and from the quieter inks they stand beside: "calm"
 * by "with anyone", "drag the curve" between "quieter" and "livelier", a version's ring on the
 * curve. A meaning's two tokens are one colour said two ways, so they are not kept apart.
 */
const ACCENT_PAIRS = [
  ["lamp", "energy"],
  ["lamp", "curve"],
  ["lamp", "swap"],
  ["lamp", "swap-drawn"],
  ["amber", "energy"],
  ["amber", "curve"],
  ["amber", "swap"],
  ["amber", "swap-drawn"],
  ["energy", "swap"],
  ["energy", "swap-drawn"],
  ["curve", "swap"],
  ["curve", "swap-drawn"],
  ...ACCENTS.flatMap((accent) => [[accent, "muted"] as const, [accent, "ink-soft"] as const]),
] as const;
const LEAST_ACCENT_DISTANCE = 12;

describe("the palette", () => {
  describe.each(THEMES)("in the %s theme", (theme) => {
    const grounds = ["ground", "surface"].map((name) => color(name, theme));

    it.each(TEXT)("sets %s at 5:1 or more on the ground and on a sheet", (name) => {
      for (const ground of grounds) {
        expect(contrast(color(name, theme), ground)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      }
    });

    it.each(DRAWN)("draws the %s at 3:1 or more on the ground and on a sheet", (name) => {
      for (const ground of grounds) {
        expect(contrast(color(name, theme), ground)).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
      }
    });

    it("draws the wires at about 2:1 on the ground", () => {
      const ratio = contrast(color("wire", theme), color("ground", theme));
      expect(ratio).toBeGreaterThanOrEqual(WIRE_CONTRAST.least);
      expect(ratio).toBeLessThanOrEqual(WIRE_CONTRAST.most);
    });

    it("draws a hairline between 1.25:1 and 1.5:1 on the ground", () => {
      const ratio = contrast(color("line", theme), color("ground", theme));
      expect(ratio).toBeGreaterThanOrEqual(LINE_CONTRAST.least);
      expect(ratio).toBeLessThanOrEqual(LINE_CONTRAST.most);
    });

    it.each(
      ACCENT_PAIRS.flatMap(([a, b]) =>
        (Object.keys(DEFICIENCIES) as Deficiency[]).map(
          (deficiency) => [a, b, deficiency] as const,
        ),
      ),
    )("keeps %s and %s apart for %s vision", (a, b, deficiency) => {
      expect(distanceSeenWith(color(a, theme), color(b, theme), deficiency)).toBeGreaterThanOrEqual(
        LEAST_ACCENT_DISTANCE,
      );
    });
  });

  it("raises a sheet by night 1.15:1 or more over the ground", () => {
    expect(lighterBy(color("surface", "dark"), color("ground", "dark"))).toBeGreaterThanOrEqual(
      NIGHT_SHEET_OVER_PAGE,
    );
  });

  it("draws each of the index's engravings in the page's ink, in its one theme only", () => {
    const declared = (name: string) => {
      const [, light = "", dark = ""] =
        new RegExp(`--color-${name}:\\s*light-dark\\(([^,]+),\\s*([^)]+)\\)`).exec(stylesheet) ??
        [];
      return { light: light.trim(), dark: dark.trim() };
    };
    expect(declared("engraving")).toEqual({ light: color("ink", "light"), dark: "transparent" });
    expect(declared("engraving-night")).toEqual({
      light: "transparent",
      dark: color("ink", "dark"),
    });
  });

  it("would have caught Sage, where light and energy looked alike to protan eyes", () => {
    // eslint-disable-next-line no-restricted-syntax -- the old palette's colours prove the bar bites
    const sageAmber = "#8a5214";
    // eslint-disable-next-line no-restricted-syntax -- the old palette's colours prove the bar bites
    const sageOlive = "#4f5c26";
    expect(distanceSeenWith(sageAmber, sageOlive, "protan")).toBeLessThan(LEAST_ACCENT_DISTANCE);
  });
});
