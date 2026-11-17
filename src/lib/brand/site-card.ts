/**
 * The site's link card, laid out in px on its 1200 by 630 sheet (`docs/decisions.md`, "The link
 * card is drawn by day, a lit plate between two at rest"): three of the index's plates on one foot,
 * the middle one lit, and Lantern's lockup and the site's line centred under them, as an index
 * cell's words stand centred under its plate. Every word stays inside the middle square, the
 * crop a feed or a chat may show.
 */

/** The sheet's centre across. */
const CENTRE_X = 600;

/** The square a feed or a chat may crop the card to, x 285 to 915. */
export const CARD_SQUARE = { left: 285, right: 915 } as const;

/** A plate at rest burns low at its lamps; a lit one is lit whole from every source. */
export type CardPlateLight = "rest" | "lit";

/** One plate on the card: its city's slug, its field's centre across, and its light. */
export interface CardPlate {
  slug: string;
  centre: number;
  light: CardPlateLight;
}

/**
 * The plates' scale in px a field unit, and their one foot. A cell is then 350 px wide, so the
 * three stand side by side across the card, and the middle one is the plate the square keeps whole.
 */
const PLATE_SCALE = 1.4;
const PLATE_PITCH = 350;

/**
 * Paris and New York at rest, Tokyo between them lit from its two lanterns: the index's own
 * order with the cities between left out, three unlike outlines, and the lit one in the middle.
 */
export const SITE_CARD_PLATES = {
  scale: PLATE_SCALE,
  foot: 361,
  plates: [
    { slug: "paris", centre: CENTRE_X - PLATE_PITCH, light: "rest" },
    { slug: "tokyo", centre: CENTRE_X, light: "lit" },
    { slug: "new-york", centre: CENTRE_X + PLATE_PITCH, light: "rest" },
  ],
} as const satisfies { scale: number; foot: number; plates: readonly CardPlate[] };

/** The lockup, its word at 72 px, centred under the plates. */
export const SITE_CARD_LOCKUP = {
  size: 72,
  baseline: 453,
  x: CENTRE_X,
  align: "centre",
} as const;

/**
 * The site's line under the lockup, each row centred, in the body text's line height
 * (`--text-body--line-height` in globals.css), its ascenders 24 rows under the mark's light.
 */
export const SITE_CARD_LINE = {
  size: 30,
  lineHeight: 1.55,
  firstBaseline: 524,
  x: CENTRE_X,
} as const;
