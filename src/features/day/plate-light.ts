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

/** How far a lit circle's falloff stays solid, as a share of its radius. */
export const LIT_SOLID_SHARE = 0.8;
/**
 * How far past the farthest corner of the scene's box a settled circle reaches, so the plate is
 * lit to its bounds' grained edge.
 */
export const LIT_REACH_PAST = 1.08;
/** Where the lit fill's grained front stands on its circle, as a share of its radius. */
const FRONT_SHARE = 0.94;
/** Steps across each side of the scene's box the covering reach walks, its border included. */
const COVER_GRID_STEPS = 24;

/** Where a plate's light grows from: its lamps, or the middle of its scene where it has none. */
export function lightSourcesOf(picture: IndexPicture): FieldPoint[] {
  const lamps = lampPointsOf(picture);
  if (lamps.length > 0) return lamps;
  const [left, top, width, height] = picture.scene.box;
  return [{ x: left + width / 2, y: top + height / 2 }];
}

/** The farthest corner of a box from a point. */
function farthestCornerOf(point: FieldPoint, [left, top, width, height]: FieldBox): number {
  const corners = [
    [left, top],
    [left + width, top],
    [left, top + height],
    [left + width, top + height],
  ] as const;
  return Math.max(...corners.map(([x, y]) => Math.hypot(x - point.x, y - point.y)));
}

/**
 * A circle's lit reach: settled, its solid share covers every corner of the box, and a little
 * more, so the plate is lit whole.
 */
export function litReachOf(point: FieldPoint, box: FieldBox): number {
  return roundToHundredth((farthestCornerOf(point, box) / LIT_SOLID_SHARE) * LIT_REACH_PAST);
}

/**
 * Each circle's covering reach: the least radius at which the plate still reads whole, so the
 * light starts to leave in the frame the plate is left. It is the farthest point of the scene's
 * box nearer that circle than any other, on a 25 by 25 grid, plus the sheet's spread, over where
 * the lit fill's grained front stands on its circle. One value serves both themes: a radius cannot
 * follow the theme, and the sheet's spread is the wider.
 */
export function coveringReachesOf(
  points: readonly FieldPoint[],
  [left, top, width, height]: FieldBox,
): number[] {
  const farthest = points.map(() => 0);
  for (let column = 0; column <= COVER_GRID_STEPS; column += 1) {
    for (let row = 0; row <= COVER_GRID_STEPS; row += 1) {
      const x = left + (width * column) / COVER_GRID_STEPS;
      const y = top + (height * row) / COVER_GRID_STEPS;
      const distances = points.map((point) => Math.hypot(x - point.x, y - point.y));
      const nearest = distances.indexOf(Math.min(...distances));
      farthest[nearest] = Math.max(farthest[nearest] ?? 0, distances[nearest] ?? 0);
    }
  }
  return farthest.map((distance) => roundToHundredth((distance + SHEET_SPREAD) / FRONT_SHARE));
}

/** The two reaches of one circle of a plate's light. */
export interface LightReaches {
  lit: number;
  covering: number;
}

/** Each circle of a plate's light, where it stands and how far it reaches. */
export function lightCirclesOf(
  picture: IndexPicture,
): readonly (FieldPoint & { reaches: LightReaches })[] {
  const sources = lightSourcesOf(picture);
  const covering = coveringReachesOf(sources, picture.scene.box);
  return sources.map((point, index) => ({
    ...point,
    reaches: { lit: litReachOf(point, picture.scene.box), covering: covering[index] ?? 0 },
  }));
}

/** The spring a circle moves on: `gentle` as the plate is lit, `brisk` as it is left. */
export type LightSpring = "gentle" | "brisk";

/** How a circle turns: from where it stands, set before the frame is painted, to its end. */
export interface LightTurn {
  from: number;
  to: number;
  spring: LightSpring;
}

/**
 * A circle's turn as its plate is lit or left, from the radius it stands at. Lit, it grows from
 * where it stands to its lit reach. Left, a circle wider than its covering reach is set to it at
 * once, so the light starts to go in the frame the plate is left, and one inside it withdraws from
 * where it stands: no circle ever grows as its plate is left.
 */
export function lightTurnOf(isLit: boolean, radius: number, reaches: LightReaches): LightTurn {
  if (isLit) return { from: radius, to: reaches.lit, spring: "gentle" };
  return { from: Math.min(radius, reaches.covering), to: 0, spring: "brisk" };
}

/** A plate's light held part-way, as a lab cell shows it: a share of one of its reaches. */
export interface PlateStill {
  reach: keyof LightReaches;
  share: number;
}

/** A circle's radius under a held light. */
export function stillRadiusOf(still: PlateStill, reaches: LightReaches): number {
  return roundToHundredth(reaches[still.reach] * still.share);
}
