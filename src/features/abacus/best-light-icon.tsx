import { Sunrise, Sunset } from "lucide-react";
import { ICON_PX, ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import type { BestLight } from "./light";

const ICONS = { sunrise: Sunrise, sunset: Sunset } as const;

/**
 * Lucide scales its stroke with the icon, so a small mark is drawn with a heavier stroke
 * to keep the line weight of the list's marks.
 */
export const SMALL_MARK_STROKE = (ICON_STROKE_WIDTH * ICON_PX.sm) / ICON_PX.xs;

interface BestLightIconProps {
  light: BestLight;
  className: string;
}

/**
 * A place visited in its own best window, around sunrise or around sunset. Two different
 * marks, so the visitor need not wonder which sun is which.
 */
export function BestLightIcon({ light, className }: BestLightIconProps) {
  const Icon = ICONS[light];
  return (
    <Icon
      role="img"
      aria-label={`Best light: ${light}`}
      size={ICON_SIZES.sm}
      strokeWidth={ICON_STROKE_WIDTH}
      className={className}
    />
  );
}

interface SunMarkProps {
  light: BestLight;
  /** Where it sits inside the chart's drawing; inline text lays it out with its words. */
  x?: number;
  y?: number;
  /** Its size in the chart's drawing, in its pixels; inline, the smallest icon's rems. */
  size?: number;
  className: string;
}

/**
 * The sunrise or the sunset itself, where it happens on the time axis and as the key
 * beside its time in the facts line. Decorative: the facts line says it in words.
 */
export function SunMark({ light, x, y, size, className }: SunMarkProps) {
  const Icon = ICONS[light];
  return (
    <Icon
      aria-hidden
      x={x}
      y={y}
      size={size ?? ICON_SIZES.xs}
      strokeWidth={SMALL_MARK_STROKE}
      className={className}
    />
  );
}
