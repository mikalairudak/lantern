import { remsOf } from "./root";

/** Lucide icons are monoline at 1.5px, matching the hairline rules. */
export const ICON_STROKE_WIDTH = 1.5;

/**
 * Icon sizes in pixels at the root's default 16 px: `xs` sits inline with captions and on
 * the chart's axis, `sm` inline with metadata, `md` with body text, `lg` alone in a control,
 * as the start screen's arrow.
 */
export const ICON_PX = {
  xs: 12,
  sm: 16,
  md: 18,
  lg: 20,
} as const;

export type IconSize = keyof typeof ICON_PX;

/**
 * The icon sizes as a page draws them, in rems, so an icon grows with the root as the type
 * beside it does: on a large screen, and with the browser's own text size. An icon inside
 * the chart's drawing takes its pixels from the drawing (`CHART.sunMark`).
 */
export const ICON_SIZES: Readonly<Record<IconSize, string>> = {
  xs: remsOf(ICON_PX.xs),
  sm: remsOf(ICON_PX.sm),
  md: remsOf(ICON_PX.md),
  lg: remsOf(ICON_PX.lg),
};
