/** A theme Lantern's colours carry: the plate paper by day, the petrol night. */
export type Theme = "light" | "dark";

/** A colour token's value in each theme. */
export type ThemePair = Record<Theme, string>;

/** `--color-<name>: light-dark(#light, #dark)`, as `globals.css` declares every colour. */
const DECLARATION = /--color-([a-z-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/g;

/**
 * Every colour token a stylesheet declares, by name, with its value in each theme. The
 * stylesheet is the one source: what cannot read it as CSS, such as a link's card drawn
 * to an image, reads its values here rather than writing them a second time.
 */
export function themeColorsOf(stylesheet: string): Map<string, ThemePair> {
  const colors = new Map<string, ThemePair>();
  for (const [, name = "", light = "", dark = ""] of stylesheet.matchAll(DECLARATION)) {
    colors.set(name, { light, dark });
  }
  return colors;
}

/** One token's value in one theme; a name the stylesheet does not declare fails loudly. */
export function themeColor(colors: Map<string, ThemePair>, name: string, theme: Theme): string {
  const pair = colors.get(name);
  if (!pair) throw new Error(`The stylesheet declares no --color-${name}`);
  return pair[theme];
}
