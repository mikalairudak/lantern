import { INDEX_PICTURES } from "./index-picture-files";

/**
 * The index's pictures (`docs/decisions.md`, "The index's pictures are engravings of a city's
 * everyday thing"): each city one engraved scene, kept as a mask of its own tones, white where the
 * ink is, and drawn whole in both themes. Each stands on one field, 480 by 320 units with its
 * ground at 316, at one optical size, so a city's picture weighs what the others do. Each holds
 * one or two lamps, sources of light drawn in the scene, where its plate's light stands.
 */

/** A picture's scene: its box on the field, left, top, width and height, and its files. */
export interface PictureLayer {
  box: readonly [number, number, number, number];
  /** At 1.4 field units a pixel, for a phone's cell at twice its pixels, and at 2. */
  files: Readonly<Record<PictureDensity, string>>;
}

/** Where a lamp stands, as a share of its scene's box: across, then down. */
export type Lamp = readonly [number, number];

export interface IndexPicture {
  /** The whole scene, its setting and its subject, drawn in both themes. */
  scene: PictureLayer;
  /** Each source of light drawn in the scene, taken from where it is drawn. */
  lamps: readonly Lamp[];
}

export type PictureDensity = "narrow" | "wide";

/** The field's centre and its ground, in field units: every picture stands on that ground. */
const FIELD_CENTRE = 240;
const FIELD_GROUND = 316;
/** A little sky over a picture's highest point, and room under its ground, in field units. */
const SKY = 8;
const FOOT = 2;
/** Room each side of the widest scene, in field units: the field's width does not grow with the foot. */
const SIDE = 2;
/** The pixels a field unit each file holds, `narrow` and `wide`. */
const UNIT_PIXELS: Readonly<Record<PictureDensity, number>> = { narrow: 1.4, wide: 2 };

/** Where the files are served from (`public/pictures/`). */
const PICTURES_PATH = "/pictures";

/** The picture drawn for a day's city, by its slug (`daySlugOf`), or null where none is drawn. */
export function indexPictureOf(slug: string): IndexPicture | null {
  return Object.hasOwn(INDEX_PICTURES, slug) ? (INDEX_PICTURES[slug] ?? null) : null;
}

/**
 * The width of the field every picture is centred on: the widest scene of any city's, with a
 * little room each side, so the widest fills its cell and each keeps its one optical size.
 */
export const PICTURE_FIELD_WIDTH =
  Math.max(...Object.values(INDEX_PICTURES).map(({ scene }) => scene.box[2])) + 2 * SIDE;

/** A picture's view of the field: as wide as the field, from just over its scene's top to just under the ground. */
export function viewBoxOf(picture: IndexPicture): string {
  const top = Math.max(0, picture.scene.box[1] - SKY);
  const left = FIELD_CENTRE - PICTURE_FIELD_WIDTH / 2;
  return `${left} ${top} ${PICTURE_FIELD_WIDTH} ${FIELD_GROUND + FOOT - top}`;
}

/**
 * The file a cell of this width needs at the screen's pixel ratio: the narrow one while it holds
 * every pixel the cell shows, else the wide one.
 */
export function densityFor(cellWidth: number, pixelRatio: number): PictureDensity {
  const needed = (cellWidth * pixelRatio) / PICTURE_FIELD_WIDTH;
  return needed <= UNIT_PIXELS.narrow ? "narrow" : "wide";
}

/** A scene's file as the page asks for it. */
export function pictureSrcOf(layer: PictureLayer, density: PictureDensity): string {
  return `${PICTURES_PATH}/${layer.files[density]}`;
}
