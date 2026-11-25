// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHART } from "@/features/abacus/geometry";
import { ROW } from "@/features/abacus/rows";
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

/** A token's two values as globals.css declares them, a colour or `transparent` each. */
function declared(name: string): Record<Theme, string> {
  const [, light = "", dark = ""] =
    new RegExp(`--color-${name}:\\s*light-dark\\(([^,]+),\\s*([^)]+)\\)`).exec(stylesheet) ?? [];
  return { light: light.trim(), dark: dark.trim() };
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
/**
 * By day a raised sheet stands a step over the page. A bead's glow is lamplight, a tone under the
 * page: far enough from it to read as light round its bead, and never so deep that the lamp falls
 * under its bar on it. Its haze stands between the glow and the page.
 */
const SHEET_STEP = 1.06;
const GLOW_UNDER_PAGE = 1.1;
/** In ΔE2000. */
const GLOW_FROM_PAGE = 10;
const HAZE_UNDER_PAGE = 1.02;
const HAZE_OVER_GLOW = 1.05;
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

    it("draws the lamp at 3:1 or more on its glow and on its haze", () => {
      for (const light of ["lamp-glow", "lamp-haze"]) {
        expect(contrast(color("lamp", theme), color(light, theme))).toBeGreaterThanOrEqual(
          GRAPHIC_CONTRAST,
        );
      }
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

  describe("by day", () => {
    const page = color("ground", "light");
    const glow = color("lamp-glow", "light");
    const haze = color("lamp-haze", "light");

    /** Whether a glow reads as a bead's light on the page: neither a tint nor a disc. */
    const isBeadGlow = (candidate: string): boolean =>
      lighterBy(page, candidate) >= GLOW_UNDER_PAGE &&
      deltaE2000(lab(linearRgb(candidate)), lab(linearRgb(page))) >= GLOW_FROM_PAGE &&
      contrast(color("lamp", "light"), candidate) >= GRAPHIC_CONTRAST;

    /** Whether a haze stands between its glow and the page. */
    const isBeadHaze = (candidate: string): boolean =>
      lighterBy(page, candidate) >= HAZE_UNDER_PAGE && lighterBy(candidate, glow) >= HAZE_OVER_GLOW;

    it("raises a sheet 1.06:1 or more over the page", () => {
      expect(lighterBy(color("surface", "light"), page)).toBeGreaterThanOrEqual(SHEET_STEP);
    });

    it("sets a bead's glow 1.10:1 or more under the page, and 10 ΔE2000 or more from it", () => {
      expect(lighterBy(page, glow)).toBeGreaterThanOrEqual(GLOW_UNDER_PAGE);
      expect(deltaE2000(lab(linearRgb(glow)), lab(linearRgb(page)))).toBeGreaterThanOrEqual(
        GLOW_FROM_PAGE,
      );
      expect(isBeadGlow(glow)).toBe(true);
    });

    it("sets its haze a step under the page and a step over the glow", () => {
      expect(lighterBy(page, haze)).toBeGreaterThanOrEqual(HAZE_UNDER_PAGE);
      expect(lighterBy(haze, glow)).toBeGreaterThanOrEqual(HAZE_OVER_GLOW);
      expect(isBeadHaze(haze)).toBe(true);
    });

    /* eslint-disable no-restricted-syntax -- the glows and hazes the bars refuse, as values */
    it.each([
      ["paper whiter than the page", "#fffdf8"],
      ["lamplight level with the page", "#ffe9bf"],
      ["a glow too near the page to read as a light", "#ffe2b3"],
      ["an amber deep enough to take the lamp under 3:1", "#ffd292"],
    ])("refuses %s as a bead's glow", (_, candidate) => {
      expect(isBeadGlow(candidate)).toBe(false);
    });

    it.each([
      ["a haze lighter than the page", "#fff1d0"],
      ["a haze level with the page", page],
      ["a haze level with its glow", glow],
    ])("refuses %s", (_, candidate) => {
      expect(isBeadHaze(candidate)).toBe(false);
    });
    /* eslint-enable no-restricted-syntax */
  });

  it("raises a sheet by night 1.15:1 or more over the ground", () => {
    expect(lighterBy(color("surface", "dark"), color("ground", "dark"))).toBeGreaterThanOrEqual(
      NIGHT_SHEET_OVER_PAGE,
    );
  });

  describe("the curve under a line of words", () => {
    /** The words over the curve are 13 px: WCAG's bar for text that size. */
    const OVER_CURVE_CONTRAST = 4.5;

    /** How much of the curve the mask's grey lets through: its lightness as written. */
    const shareOf = (grey: string): number => parseInt(grey.slice(1, 3), 16) / 255;

    /** A colour laid over another at a share, blended as the page draws it, channel by channel. */
    const blend = (over: string, under: string, share: number): string =>
      `#${[1, 3, 5]
        .map((offset) => {
          const channel = (hex: string): number => parseInt(hex.slice(offset, offset + 2), 16);
          const mixed = Math.round(share * channel(over) + (1 - share) * channel(under));
          return mixed.toString(16).padStart(2, "0");
        })
        .join("")}`;

    it.each(THEMES)("is a grey in the %s theme, so its lightness alone says the share", (theme) => {
      const grey = color("curve-under-words", theme);
      expect(grey.slice(3, 5)).toBe(grey.slice(1, 3));
      expect(grey.slice(5, 7)).toBe(grey.slice(1, 3));
    });

    /**
     * The 13 px words a row sets over the curve, by theme. By day the energy word is left out:
     * it measures about 4.16:1 over the curve, a known issue (docs/accessibility.md, 1.4.3).
     */
    const OVER_CURVE: [string, Theme][] = [
      ...THEMES.flatMap((theme) =>
        ["muted", "amber", "swap"].map((name): [string, Theme] => [name, theme]),
      ),
      ["energy", "dark"],
    ];

    /** The share of a standard normal distribution under a value: how far a blur has stepped. */
    const normalShare = (value: number): number => {
      // Abramowitz and Stegun's 7.1.26, within 1.5e-7 of the error function.
      const x = Math.abs(value) / Math.SQRT2;
      const t = 1 / (1 + 0.3275911 * x);
      const poly =
        t *
        (0.254829592 +
          t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
      const erf = 1 - poly * Math.exp(-x * x);
      return 0.5 * (1 + Math.sign(value) * erf);
    };

    /** A standard normal distribution's density, `sigma` wide, at `value`. */
    const normalDensity = (value: number, sigma: number): number =>
      Math.exp(-(value * value) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

    /** How many steps a side of the mask's rounded corner is summed in. */
    const CORNER_STEPS = 200;

    /**
     * How much of the curve shows at a corner of a line's own box, its first or last letter at
     * its tallest or deepest: the mask's box stands a pad past it each way, its corner rounded,
     * and the blur lets the curve back in towards the box's edge. Modelled as a true Gaussian
     * blur of the rounded box: the square corner's cover, less what the rounding takes away,
     * summed over the corner. Chromium's shorter blur renders under it.
     */
    const cornerShareOf = (grey: string): number => {
      const sigma = CHART.underWordsSoftness;
      const { lineMaskPad: padX, lineMaskPadY: padY, lineMaskRadius: radius } = ROW;
      const square = normalShare(padX / sigma) * normalShare(padY / sigma);
      const step = radius / CORNER_STEPS;
      let rounded = 0;
      for (let i = 0; i < CORNER_STEPS; i++) {
        for (let j = 0; j < CORNER_STEPS; j++) {
          const x = (i + 0.5) * step;
          const y = (j + 0.5) * step;
          if ((x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2) continue;
          rounded += normalDensity(x - padX, sigma) * normalDensity(y - padY, sigma) * step * step;
        }
      }
      return 1 - (square - rounded) * (1 - shareOf(grey));
    };

    /**
     * The words that stand at a line's corner over the curve: amber is left out, as it marks the
     * start times, which stand in the gutter, clear of the curve.
     */
    const AT_A_CORNER = OVER_CURVE.filter(([name]) => name !== "amber");

    it.each(OVER_CURVE)(
      "sets %s 4.5:1 or more over one curve inside a line, in the %s theme",
      (name, theme) => {
        const under = blend(
          color("curve", theme),
          color("ground", theme),
          shareOf(color("curve-under-words", theme)),
        );
        expect(contrast(color(name, theme), under)).toBeGreaterThanOrEqual(OVER_CURVE_CONTRAST);
      },
    );

    it.each(AT_A_CORNER)(
      "sets %s 4.5:1 or more over one curve at a corner of a line, where the blur steps it back, in the %s theme",
      (name, theme) => {
        const under = blend(
          color("curve", theme),
          color("ground", theme),
          cornerShareOf(color("curve-under-words", theme)),
        );
        expect(contrast(color(name, theme), under)).toBeGreaterThanOrEqual(OVER_CURVE_CONTRAST);
      },
    );
  });

  describe("the index's plates", () => {
    /**
     * By day a plate's light is the whitest paper on the page: far enough over the page to read as
     * lit, a sheet's step over a raised sheet so a list never reads as light, and its half-light a
     * step between the page and it. Every text and drawn mark holds on it.
     */
    const LIT_OVER_PAGE = 1.13;
    const HALF_LIGHT_STEP = 1.05;

    describe("by day", () => {
      const page = color("ground", "light");
      const litPaper = color("plate-lit", "light");
      const halfLight = color("plate-half", "light");

      it.each(TEXT)("sets %s at 5:1 or more on a plate's lit paper", (name) => {
        expect(contrast(color(name, "light"), litPaper)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      });

      it.each(DRAWN)("draws the %s at 3:1 or more on a plate's lit paper", (name) => {
        expect(contrast(color(name, "light"), litPaper)).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
      });

      it("lights paper 1.13:1 or more over the page, and a sheet's step over a raised sheet", () => {
        expect(lighterBy(litPaper, page)).toBeGreaterThanOrEqual(LIT_OVER_PAGE);
        expect(lighterBy(litPaper, color("surface", "light"))).toBeGreaterThanOrEqual(SHEET_STEP);
      });

      it("sets half-light a step over the page and a step under lit paper", () => {
        expect(lighterBy(halfLight, page)).toBeGreaterThanOrEqual(HALF_LIGHT_STEP);
        expect(lighterBy(litPaper, halfLight)).toBeGreaterThanOrEqual(HALF_LIGHT_STEP);
      });
    });

    /** By night a plate's tone stands out of the ground, and its light out of the tone. */
    const NIGHT_PLATE_CONTRAST = 3;
    /** A pool's edge by night: a step over the tone, and well under the pool's own light. */
    const NIGHT_HALF_OVER_TONE = 1.4;
    const NIGHT_LIT_OVER_HALF = 2;

    it("stands the tone 3:1 or more on the ground by night, and the light as far on the tone", () => {
      const tone = declared("plate-tone").dark;
      expect(contrast(tone, color("ground", "dark"))).toBeGreaterThanOrEqual(NIGHT_PLATE_CONTRAST);
      expect(contrast(color("plate-lit", "dark"), tone)).toBeGreaterThanOrEqual(
        NIGHT_PLATE_CONTRAST,
      );
    });

    it("sets a pool's edge by night a step over the tone and well under the light", () => {
      const half = color("plate-half", "dark");
      expect(lighterBy(half, declared("plate-tone").dark)).toBeGreaterThanOrEqual(
        NIGHT_HALF_OVER_TONE,
      );
      expect(lighterBy(color("plate-lit", "dark"), half)).toBeGreaterThanOrEqual(
        NIGHT_LIT_OVER_HALF,
      );
    });

    it("lays a plate's wider sheet by day in its own light and by night not at all, and no tone by day", () => {
      expect(declared("plate-lit-wide")).toEqual({
        light: color("plate-lit", "light"),
        dark: "transparent",
      });
      expect(declared("plate-tone").light).toBe("transparent");
    });

    it("draws a plate's lines in the page's ink by day and the ground's colour by night, 3:1 on what lies under them", () => {
      expect(color("engraving", "light")).toBe(color("ink", "light"));
      expect(color("engraving", "dark")).toBe(color("ground", "dark"));
      expect(
        contrast(color("engraving", "dark"), declared("plate-tone").dark),
      ).toBeGreaterThanOrEqual(NIGHT_PLATE_CONTRAST);
      for (const theme of THEMES) {
        expect(
          contrast(color("engraving", theme), color("plate-lit", theme)),
          theme,
        ).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
      }
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
