import type { IndexPicture } from "./index-pictures";

/**
 * Where a plate's light stands, as numbers on the field: its lamps, their pools at rest, and the
 * box the light and the tone are drawn in. Every length is in field units.
 */

/** A point on the field. */
export interface FieldPoint {
  x: number;
  y: number;
}

/** A box on the field: left, top, width and height. */
export type FieldBox = readonly [number, number, number, number];

/**
 * Each step of a lamp's pool at rest, as a share of its scene's longer side: the pool's edge, the
 * pool and its heart. The heart is the pool's own colour and thickens its middle.
 */
export const POOL_SHARES = { edge: 0.16, pool: 0.12, heart: 0.08 } as const;

export type PoolStep = keyof typeof POOL_SHARES;

/** The pool's steps, bottom first. */
export const POOL_STEPS: readonly PoolStep[] = ["edge", "pool", "heart"];

/**
 * How far the scene's ink is spread to bound a plate's light: the footprint, which bounds the
 * tone and the night's light, and the sheet, which bounds the day's and lies wider.
 */
export const FOOTPRINT_SPREAD = 7;
export const SHEET_SPREAD = 14;
/** How far either bound is softened past its spread. */
export const BOUNDS_SOFTENING = 10;

/**
 * The room round a scene its light and tone are drawn in: the sheet's spread and its softening
 * fall inside it.
 */
export const LIGHT_ROOM = 40;

/** A length to the hundredth, so the page's first HTML and a running page draw the same radius. */
export function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Each lamp of a picture, on the field. */
export function lampPointsOf(picture: IndexPicture): FieldPoint[] {
  const [left, top, width, height] = picture.scene.box;
  return picture.lamps.map(([across, down]) => ({
    x: left + across * width,
    y: top + down * height,
  }));
}

/** The radius of each step of a lamp's pool, the same for every lamp of a picture. */
export function poolRadiiOf(picture: IndexPicture): Readonly<Record<PoolStep, number>> {
  const [, , width, height] = picture.scene.box;
  const longer = Math.max(width, height);
  return {
    edge: roundToHundredth(longer * POOL_SHARES.edge),
    pool: roundToHundredth(longer * POOL_SHARES.pool),
    heart: roundToHundredth(longer * POOL_SHARES.heart),
  };
}

/** The box every pool of a picture stands in, to its edge, or null for a picture with no lamps. */
export function poolsBoxOf(picture: IndexPicture): FieldBox | null {
  const lamps = lampPointsOf(picture);
  if (lamps.length === 0) return null;
  const { edge } = poolRadiiOf(picture);
  const left = Math.min(...lamps.map(({ x }) => x)) - edge;
  const top = Math.min(...lamps.map(({ y }) => y)) - edge;
  const right = Math.max(...lamps.map(({ x }) => x)) + edge;
  const bottom = Math.max(...lamps.map(({ y }) => y)) + edge;
  return [left, top, right - left, bottom - top];
}

/** The box a plate's light and tone are drawn in, each filter's region and each mask's. */
export function lightBoxOf(picture: IndexPicture): FieldBox {
  const [left, top, width, height] = picture.scene.box;
  return [left - LIGHT_ROOM, top - LIGHT_ROOM, width + 2 * LIGHT_ROOM, height + 2 * LIGHT_ROOM];
}

/** A box as an SVG element's position and size. */
export function rectOf([x, y, width, height]: FieldBox): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return { x, y, width, height };
}
