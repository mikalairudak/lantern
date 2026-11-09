/**
 * The root's font size at the browser's default text size, at which every pixel value in
 * code is set: the chart's drawing, the icons, the spans of the energy scale. The root
 * grows on a large screen (`--root-grows-*` in globals.css), and the browser's own text size
 * sets it too; what is drawn in pixels then scales by the root's size over this one.
 */
export const DEFAULT_ROOT_PX = 16;

/**
 * Marks the unseen element the root layout sets at the browser's own text size
 * (`BrowserTextSize`), which the root grows from.
 */
export const BROWSER_TEXT_ATTRIBUTE = "data-browser-text";

/** Pixels at the default root, as rems, which grow with the root as the type does. */
export function remsOf(px: number): string {
  return `${px / DEFAULT_ROOT_PX}rem`;
}
