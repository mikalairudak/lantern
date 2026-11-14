/**
 * The color, type, spacing, radius and root tokens globals.css defines, and its focus rings,
 * listed for /lab. A test keeps these lists and the stylesheet in step, so /lab shows every
 * one of them and nothing that is gone.
 */

export const COLOR_TOKENS = [
  { name: "ground", role: "The page: plate paper by day, the petrol sky by night" },
  {
    name: "surface",
    role: "A raised sheet over the page: a list, the day's menu, an open stop's words, a lit row's words",
  },
  { name: "ink", role: "Primary text and filled meter segments" },
  { name: "ink-soft", role: "Secondary text" },
  { name: "muted", role: "Metadata and collapsed notes" },
  { name: "engraving", role: "The index's engraved scene: ink by day, nothing by night" },
  {
    name: "engraving-night",
    role: "The index's engraved subject alone: ink by night, nothing by day",
  },
  { name: "line", role: "Hairline rules and empty meter segments" },
  { name: "wire", role: "Abacus wires: the chart's structure, between a rule and text" },
  {
    name: "amber",
    role: "Light in words: sunrise and sunset, and a stop's time in golden hour",
  },
  { name: "lamp", role: "Light drawn: the mark's bead, the sun, the time axis in golden hour" },
  {
    name: "lamp-glow",
    role: "The light round the mark's bead and a lit bead: lamplight by day, an ember by night",
  },
  {
    name: "lamp-haze",
    role: "The mark's outer step of light: lamplight's haze by day, an ember's by night",
  },
  { name: "energy", role: 'Energy in words: the energy word and clause, "drag the curve"' },
  { name: "curve", role: "Energy drawn: the curve and the rings on it" },
  { name: "swap", role: 'Versions in words: alternatives, their controls, "instead of …"' },
  { name: "swap-drawn", role: "Versions drawn: the hollow beads and the ring that names one" },
] as const;

/**
 * The colours drawn in one theme only, transparent in the other, so a layer of the index's
 * engraving shows in its theme alone. Each is the page's ink where it shows (palette.test.ts).
 */
export const ONE_THEME_COLOR_TOKENS: readonly ColorToken[] = ["engraving", "engraving-night"];

export const TEXT_TOKENS = [
  "display",
  "title",
  "heading",
  "sentence",
  "dek",
  "quote",
  "body",
  "small",
  "meta",
  "caption",
] as const;

export const SPACING_TOKENS = [
  "0",
  "0.5",
  "1",
  "1.5",
  "2",
  "3",
  "4",
  "5",
  "6",
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "16",
  "20",
  "24",
  "day",
  "phone-height",
] as const;

export const RADIUS_TOKENS = ["sm"] as const;

/**
 * How the page grows on a large screen: the root's size, and every rem with it, from the
 * browser's own at the first width to a quarter more at the second. Counted in the browser's
 * own rems, so at its default 16 px they are 1440 and 2560 px.
 */
export const ROOT_TOKENS = [
  { name: "grows-from", role: "The viewport's width, in rems, where the root starts to grow" },
  { name: "grows-to", role: "The width, in rems, where it stops growing" },
  { name: "grows-by", role: "How much larger the root is from there on" },
] as const;

/**
 * The lengths of what is timed in CSS rather than on a spring, each named for its one use. The
 * pointer's colour changes take Tailwind's `--default-transition-duration`.
 */
export const DURATION_TOKENS = [
  {
    name: "theme",
    role: "The theme's crossing: the whole page from one theme to the other, linear",
  },
] as const;

/** The waits before what CSS shows, each named for its one use. */
export const DELAY_TOKENS = [
  {
    name: "helper",
    role: "How long a pointer rests on an icon before its helper shows",
  },
] as const;

/** The rings the keyboard's focus draws, each a `@utility` in globals.css. */
export const FOCUS_RING_TOKENS = [
  { name: "focus-ring", role: "Ink, 2 px outside the box: a link or a button" },
  {
    name: "focus-ring-inset",
    role: "Ink, 2 px inside the box, where what stands around it would cut the ring",
  },
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number]["name"];
export type TextToken = (typeof TEXT_TOKENS)[number];
export type SpacingToken = (typeof SPACING_TOKENS)[number];
export type RadiusToken = (typeof RADIUS_TOKENS)[number];
export type RootToken = (typeof ROOT_TOKENS)[number]["name"];
export type FocusRingToken = (typeof FOCUS_RING_TOKENS)[number]["name"];
