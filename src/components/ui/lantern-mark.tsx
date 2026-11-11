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

/**
 * Set in ems of the word beside it, the mark stands `MARK_EM` words tall and sinks below the
 * baseline so that its bead's centre stands on the middle of the word's x-height, Fira Sans's
 * 0.527 em, at every size: the mark and the word read as one line, where the mark set in pixels
 * is true for one size of word alone.
 */
const MARK_EM = 1.75;
const X_HEIGHT_EM = 0.527;
const BOX_UNITS = BOX_WIDTH * UNITS_PER_PX;
const EM_VIEW_BOX = `0 0 ${BOX_UNITS} ${GRID}`;
const EM_HEIGHT = `${MARK_EM}em`;
const EM_WIDTH = `${(MARK_EM * BOX_UNITS) / GRID}em`;
const EM_SINK = `${-(MARK_EM * ((GRID - BEAD.cy) / GRID) - X_HEIGHT_EM / 2)}em`;

interface LanternMarkProps {
  className?: string;
  /** Drawn in ems of the word beside it, as the first impression's masthead sets it. */
  isSetInEms?: boolean;
}

/**
 * Lantern's mark, the lit bead, as it stands before the wordmark: drawn inline, so its ink
 * and lamp come from the tokens and follow `data-theme` as the rest of the page does. It
 * sits in the word's line, on its baseline, and carries its own gap; the word beside it says
 * the name, so the mark is unheard.
 */
export function LanternMark({ className, isSetInEms = false }: LanternMarkProps) {
  const box = isSetInEms
    ? {
        viewBox: EM_VIEW_BOX,
        style: { height: EM_HEIGHT, width: EM_WIDTH, verticalAlign: EM_SINK },
        className: cn("inline overflow-visible", className),
      }
    : {
        width: BOX_WIDTH,
        height: MARK_PX,
        viewBox: VIEW_BOX,
        className: cn("inline overflow-visible align-baseline", className),
      };
  return (
    <svg aria-hidden {...box}>
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
