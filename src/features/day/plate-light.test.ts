// @vitest-environment node
import { describe, expect, it } from "vitest";
import { INDEX_PICTURES } from "./index-picture-files";
import { NO_LAMPS_PICTURE } from "./index-picture-examples";
import {
  lampPointsOf,
  LIGHT_ROOM,
  lightBoxOf,
  POOL_SHARES,
  poolRadiiOf,
  poolsBoxOf,
  roundToHundredth,
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
  it.each(PICTURES)("holds %s's scene with room all round", (_, picture) => {
    const [left, top, width, height] = picture.scene.box;
    expect(lightBoxOf(picture)).toEqual([
      left - LIGHT_ROOM,
      top - LIGHT_ROOM,
      width + 2 * LIGHT_ROOM,
      height + 2 * LIGHT_ROOM,
    ]);
  });
});
