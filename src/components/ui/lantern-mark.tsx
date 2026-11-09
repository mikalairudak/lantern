import { ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { cn } from "./cn";

/** The mark is drawn on the app's 24-unit icon grid (`docs/brand/README.md`). */
const GRID = 24;
/** Beside the wordmark the mark stands 26 px tall, 6 px before the word. */
const MARK_PX = 26;
const GAP_PX = 6;
/**
 * Set on the word's baseline, the mark is moved this far down, so its bead's centre stands
 * on the middle of the word's x-height.
 */
const DROP_PX = 7;
const UNITS_PER_PX = GRID / MARK_PX;
/** The box the mark is drawn in: its gap after it, and its drop below the baseline. */
const BOX_WIDTH = MARK_PX + GAP_PX;
const VIEW_BOX = `0 ${-DROP_PX * UNITS_PER_PX} ${BOX_WIDTH * UNITS_PER_PX} ${GRID}`;

/**
 * The bead at the wire's lowest point, a paper lantern's oval, and its two steps of light,
 * in grid units. A link's card draws the same mark larger from these (`opengraph-image.tsx`).
 */
export const BEAD = { cx: 12, cy: 12, rx: 3.25, ry: 3.5 };
export const LIGHT_NEAR_RADIUS = 5.75;
export const LIGHT_FAR_RADIUS = 8;
/** The wire sags to the bead and stops one stroke short of it on each side. */
const WIRE_LEFT = "M1 10.5 Q3.75 11.25 6.5 11.63";
const WIRE_RIGHT = "M17.5 11.63 Q20.25 11.25 23 10.5";

interface LanternMarkProps {
  className?: string;
}

/**
 * Lantern's mark, the lit bead, as it stands before the wordmark: drawn inline, so its ink
 * and lamp come from the tokens and follow `data-theme` as the rest of the page does. It
 * sits in the word's line, on its baseline, and carries its own gap; the word beside it says
 * the name, so the mark is unheard.
 */
export function LanternMark({ className }: LanternMarkProps) {
  return (
    <svg
      aria-hidden
      width={BOX_WIDTH}
      height={MARK_PX}
      viewBox={VIEW_BOX}
      className={cn("inline overflow-visible align-baseline", className)}
    >
      <circle cx={BEAD.cx} cy={BEAD.cy} r={LIGHT_FAR_RADIUS} className="fill-lamp-haze" />
      <circle cx={BEAD.cx} cy={BEAD.cy} r={LIGHT_NEAR_RADIUS} className="fill-lamp-glow" />
      <path
        d={WIRE_LEFT}
        fill="none"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
        className="stroke-ink"
      />
      <path
        d={WIRE_RIGHT}
        fill="none"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
        className="stroke-ink"
      />
      <ellipse {...BEAD} className="fill-lamp" />
    </svg>
  );
}
