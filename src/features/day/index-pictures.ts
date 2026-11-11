import { INDEX_PICTURES } from "./index-picture-files";

/**
 * The index's pictures (`docs/decisions.md`, "The index's pictures are engravings of a city's
 * everyday thing"): each city one engraved scene, kept as two masks of its own tones, white where
 * the ink is. The light theme draws the whole scene; the dark theme draws the subject alone, its
 * faintest hatching left out, at its own size. Both stand on one field, 480 by 320 units with its
 * ground at 316, at one optical size, so a city's picture weighs what the others do.
 */

/** One layer of a picture: its box on the field, left, top, width and height, and its files. */
export interface PictureLayer {
  box: readonly [number, number, number, number];
  /** At 1.4 field units a pixel, for a phone's cell at twice its pixels, and at 2. */
  files: Readonly<Record<PictureDensity, string>>;
}

export interface IndexPicture {
  /** The whole scene, its setting and its subject, drawn in the light theme. */
  scene: PictureLayer;
  /** The subject alone, drawn in the dark theme. */
  subject: PictureLayer;
}

export type PictureDensity = "narrow" | "wide";

/** The field's centre and its ground, in field units: every picture stands on that ground. */
const FIELD_CENTRE = 240;
const FIELD_GROUND = 316;
/** A little sky over a picture's highest point, and room under its ground. */
const SKY = 8;
const FOOT = 2;
/** The pixels a field unit each file holds, `narrow` and `wide`. */
const UNIT_PIXELS: Readonly<Record<PictureDensity, number>> = { narrow: 1.4, wide: 2 };

/** Where the files are served from (`public/pictures/`). */
const PICTURES_PATH = "/pictures";

/** The picture drawn for a day's city, by its slug (`daySlugOf`), or null where none is drawn. */
export function indexPictureOf(slug: string): IndexPicture | null {
  return Object.hasOwn(INDEX_PICTURES, slug) ? (INDEX_PICTURES[slug] ?? null) : null;
}

/**
 * The width of the field every picture is centred on: the widest layer of any city's, with a
 * little room, so the widest fills its cell and each keeps its one optical size.
 */
export const PICTURE_FIELD_WIDTH =
  Math.max(
    ...Object.values(INDEX_PICTURES).flatMap(({ scene, subject }) => [
      scene.box[2],
      subject.box[2],
    ]),
  ) +
  2 * FOOT;

/**
 * A picture's view of the field: as wide as the field, from just over its scene's top, which is
 * never lower than its subject's, to just under the ground.
 */
export function viewBoxOf(picture: IndexPicture): string {
  const top = Math.max(0, Math.min(picture.scene.box[1], picture.subject.box[1]) - SKY);
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

/** A layer's file as the page asks for it. */
export function pictureSrcOf(layer: PictureLayer, density: PictureDensity): string {
  return `${PICTURES_PATH}/${layer.files[density]}`;
}
