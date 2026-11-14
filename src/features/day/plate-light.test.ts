// @vitest-environment node
import { describe, expect, it } from "vitest";
import { INDEX_PICTURES } from "./index-picture-files";
import { NO_LAMPS_PICTURE } from "./index-picture-examples";
import { FIELD_CENTRE, PICTURE_FIELD_WIDTH, viewBoxOf } from "./index-pictures";
import {
  coveringReachesOf,
  lampPointsOf,
  lightCirclesOf,
  LIGHT_PAST,
  LIGHT_SIDE,
  lightBoxFor,
  lightBoxOf,
  lightSourcesOf,
  lightTurnOf,
  litReachOf,
  LIT_SOLID_SHARE,
  POOL_SHARES,
  poolRadiiOf,
  poolsBoxOf,
  roundToHundredth,
  stillRadiusOf,
} from "./plate-light";

const PICTURES = Object.entries(INDEX_PICTURES);

describe("a plate's lamps", () => {
  it("stands each lamp on the field where its share of the scene's box puts it", () => {
    const rome = INDEX_PICTURES.rome!;
    const [left, top, width, height] = rome.scene.box;
    const [[across, down] = [0, 0]] = rome.lamps;
    expect(lampPointsOf(rome)).toEqual([{ x: left + across * width, y: top + down * height }]);
    expect(lampPointsOf(NO_LAMPS_PICTURE)).toEqual([]);
  });
});

describe("a lamp's pool at rest", () => {
  it.each(PICTURES)(
    "reaches 16%, 12% and 8% of %s's longer side, to the hundredth",
    (_, picture) => {
      const [, , width, height] = picture.scene.box;
      const longer = Math.max(width, height);
      const radii = poolRadiiOf(picture);
      expect(radii.edge).toBeCloseTo(longer * POOL_SHARES.edge, 2);
      expect(radii.pool).toBeCloseTo(longer * POOL_SHARES.pool, 2);
      expect(radii.heart).toBeCloseTo(longer * POOL_SHARES.heart, 2);
      for (const radius of Object.values(radii)) expect(roundToHundredth(radius)).toBe(radius);
    },
  );

  it("is Paris's at 33.09, 24.82 and 16.54 units", () => {
    expect(poolRadiiOf(INDEX_PICTURES.paris!)).toEqual({ edge: 33.09, pool: 24.82, heart: 16.54 });
  });

  it.each(PICTURES)("stands in a box that holds every one of %s's pools", (_, picture) => {
    const [left, top, width, height] = poolsBoxOf(picture)!;
    const { edge } = poolRadiiOf(picture);
    for (const { x, y } of lampPointsOf(picture)) {
      expect(x - edge).toBeGreaterThanOrEqual(left - 1e-9);
      expect(y - edge).toBeGreaterThanOrEqual(top - 1e-9);
      expect(x + edge).toBeLessThanOrEqual(left + width + 1e-9);
      expect(y + edge).toBeLessThanOrEqual(top + height + 1e-9);
    }
  });

  it("has no box on a plate with no lamps", () => {
    expect(poolsBoxOf(NO_LAMPS_PICTURE)).toBeNull();
  });
});

describe("a plate's light's box", () => {
  const fieldLeft = FIELD_CENTRE - PICTURE_FIELD_WIDTH / 2;
  const fieldRight = FIELD_CENTRE + PICTURE_FIELD_WIDTH / 2;

  it.each(PICTURES)(
    "stands %s's light from its picture's top to its foot, and at the sides no further than the scene less 26 or the field less 8",
    (_, picture) => {
      const [left, top, width, height] = lightBoxOf(picture);
      const [, viewTop, , viewHeight] = viewBoxOf(picture).split(" ").map(Number);
      const [sceneLeft, , sceneWidth] = picture.scene.box;
      expect(top).toBeCloseTo(viewTop!, 2);
      expect(top + height).toBeCloseTo(viewTop! + viewHeight!, 2);
      expect(left).toBeGreaterThanOrEqual(sceneLeft - LIGHT_SIDE - 0.005);
      expect(left).toBeGreaterThanOrEqual(fieldLeft - LIGHT_PAST - 0.005);
      expect(left + width).toBeLessThanOrEqual(sceneLeft + sceneWidth + LIGHT_SIDE + 0.005);
      expect(left + width).toBeLessThanOrEqual(fieldRight + LIGHT_PAST + 0.005);
      expect(lightBoxFor(picture.scene.box)).toEqual(picture.light);
    },
  );

  it("gives Seoul, the widest scene, a short side, and New York light past its picture", () => {
    expect(INDEX_PICTURES.seoul!.light).toEqual([107.05, 143.8, 265.9, 184.2]);
    expect(INDEX_PICTURES["new-york"]!.light).toEqual([108.4, 118.2, 263.3, 209.8]);
  });
});

describe("a plate's light", () => {
  /** Each lamp's covering reach, measured on the plates as drawn: the least at which each reads whole. */
  const COVERING_REACHES: Readonly<Record<string, readonly number[]>> = {
    paris: [201.22, 188.25],
    madrid: [260.88],
    tokyo: [144.87, 143.04],
    rome: [234.11],
    "new-york": [254.94],
    amsterdam: [161.55, 157.17],
    barcelona: [194.38],
    seoul: [146.77, 116.47],
  };

  it.each(PICTURES)("leaves %s from each lamp's covering reach", (slug, picture) => {
    expect(coveringReachesOf(lampPointsOf(picture), picture.scene.box)).toEqual(
      COVERING_REACHES[slug],
    );
  });

  /** Each lamp's lit reach: its solid share covers every corner of the light's box. */
  const LIT_REACHES: Readonly<Record<string, readonly number[]>> = {
    paris: [282.48, 272.75],
    madrid: [326.25],
    tokyo: [260.79, 275.79],
    rome: [288.48],
    "new-york": [319.45],
    amsterdam: [221.6, 259.06],
    barcelona: [242.14],
    seoul: [232.89, 278.85],
  };

  it.each(PICTURES)("lights %s whole from each lamp's lit reach", (slug, picture) => {
    const circles = lightCirclesOf(picture);
    expect(circles.map(({ reaches }) => reaches.lit)).toEqual(LIT_REACHES[slug]);
    const [left, top, width, height] = picture.light;
    for (const { x, y, reaches } of circles) {
      for (const [cornerX, cornerY] of [
        [left, top],
        [left + width, top],
        [left, top + height],
        [left + width, top + height],
      ] as const) {
        expect(Math.hypot(cornerX - x, cornerY - y)).toBeLessThanOrEqual(
          reaches.lit * LIT_SOLID_SHARE + 0.01,
        );
      }
    }
  });

  it.each(PICTURES)("settles each of %s's circles wider than it leaves from", (_, picture) => {
    for (const { reaches } of lightCirclesOf(picture)) {
      expect(reaches.covering).toBeLessThan(reaches.lit);
    }
  });

  it("lights a plate whole: each settled circle's solid share reaches every corner of the box", () => {
    const box = [100, 50, 200, 160] as const;
    const point = { x: 120, y: 70 };
    // A reach is kept to the hundredth, which may round it down by under a hundredth of a unit.
    expect(litReachOf(point, box) * LIT_SOLID_SHARE).toBeGreaterThanOrEqual(
      Math.hypot(300 - 120, 210 - 70) - 0.01,
    );
  });

  it("gives each of two lamps only the part of the scene nearer to it", () => {
    const box = [100, 50, 200, 160] as const;
    const [left = 0, right = 0] = coveringReachesOf(
      [
        { x: 120, y: 130 },
        { x: 280, y: 130 },
      ],
      box,
    );
    const [alone = 0] = coveringReachesOf([{ x: 120, y: 130 }], box);
    expect(left).toBeLessThan(alone);
    expect(right).toBeLessThanOrEqual(left);
  });

  it("lights a plate with no lamps from the middle of its scene, and draws no pool", () => {
    const [left, top, width, height] = NO_LAMPS_PICTURE.scene.box;
    expect(lightSourcesOf(NO_LAMPS_PICTURE)).toEqual([
      { x: left + width / 2, y: top + height / 2 },
    ]);
    expect(lightCirclesOf(NO_LAMPS_PICTURE)).toHaveLength(1);
  });
});

describe("a circle's turn", () => {
  const reaches = { lit: 280, covering: 200 };

  it("grows from where it stands to its lit reach on the gentle spring", () => {
    expect(lightTurnOf(true, 0, reaches)).toEqual({ from: 0, to: 280, spring: "gentle" });
  });

  it("is set to its covering reach as it is left, then goes to nothing on the brisk spring", () => {
    expect(lightTurnOf(false, 280, reaches)).toEqual({ from: 200, to: 0, spring: "brisk" });
  });

  it("withdraws from where it stands when left while coming on, and never grows", () => {
    const turn = lightTurnOf(false, 120, reaches);
    expect(turn).toEqual({ from: 120, to: 0, spring: "brisk" });
    expect(turn.from).toBeLessThanOrEqual(120);
  });

  it("grows again from where it stands when pointed at again while leaving", () => {
    expect(lightTurnOf(true, 90, reaches)).toEqual({ from: 90, to: 280, spring: "gentle" });
  });

  it("never sets a radius under nothing, nor sends one there", () => {
    for (const isLit of [true, false]) {
      for (const radius of [0, 50, 200, 280]) {
        const turn = lightTurnOf(isLit, radius, reaches);
        expect(turn.from).toBeGreaterThanOrEqual(0);
        expect(turn.to).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("holds a share of either reach for a lab cell, to the hundredth", () => {
    expect(stillRadiusOf({ reach: "lit", share: 0.5 }, reaches)).toBe(140);
    expect(stillRadiusOf({ reach: "covering", share: 1 / 3 }, reaches)).toBe(66.67);
  });
});
