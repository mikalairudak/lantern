import type { CSSProperties, JSX } from "react";
import {
  BEAD,
  LARGE_MARK_FROM_PX,
  LIGHT_FAR_RADIUS,
  LIGHT_NEAR_RADIUS,
  MARK_BOX_PER_HEIGHT,
  MARK_EM,
  MARK_GRID,
  MARK_WIRES,
  X_HEIGHT_EM,
  type MarkWire,
} from "@/components/ui/lantern-mark";
import { SITE_NAME } from "@/lib/site";

/**
 * The mark beside the wordmark held still, for an image renderer that reads no stylesheet, as a
 * link's card draws it: the masthead's lockup (`docs/brand/README.md`, "Beside the wordmark")
 * at any size, its colours given rather than read from classes.
 */

/** The colour tokens the lockup is drawn in. */
export type StillLockupToken = "ink" | "lamp" | "lamp-glow" | "lamp-haze";

/** Where the lockup stands: the word's size and baseline, in px, and the x it starts at or is centred on. */
export interface LockupPlacement {
  size: number;
  baseline: number;
  x: number;
  align: "start" | "centre";
}

/** The lockup laid out on the image, in px. */
export interface LockupLayout {
  /** The mark's square, the drawing for its size, and its bead's centre. */
  mark: { left: number; top: number; size: number; wire: MarkWire; bead: { x: number; y: number } };
  /** The word's line box at line height 1. */
  word: { left: number; top: number; size: number };
  /** From the mark's box to the word's end. */
  width: number;
}

/**
 * The lockup laid out: the mark `MARK_EM` of the word tall, its box with its gap after it, the
 * word starting where the box ends, and the bead's centre on the middle of the word's x-height.
 * `wordWidth` is the word's width at its size, and `baselineShare` where its baseline stands in
 * a line box at line height 1, as a share of its size, both from the wordmark's font.
 */
export function lockupLayoutOf(
  { size, baseline, x, align }: LockupPlacement,
  wordWidth: number,
  baselineShare: number,
): LockupLayout {
  const markSize = MARK_EM * size;
  const boxWidth = markSize * MARK_BOX_PER_HEIGHT;
  const width = boxWidth + wordWidth;
  const left = align === "centre" ? x - width / 2 : x;
  const beadY = baseline - (X_HEIGHT_EM / 2) * size;
  const unit = markSize / MARK_GRID;
  return {
    mark: {
      left,
      top: beadY - BEAD.cy * unit,
      size: markSize,
      wire: markSize >= LARGE_MARK_FROM_PX ? MARK_WIRES.large : MARK_WIRES.master,
      bead: { x: left + BEAD.cx * unit, y: beadY },
    },
    word: { left: left + boxWidth, top: baseline - baselineShare * size, size },
    width,
  };
}

const PLACED_STYLE: CSSProperties = { position: "absolute" };
/** The wordmark: the voice's italic, at line height 1, so its box's top places its baseline. */
const WORD_STYLE: CSSProperties = {
  ...PLACED_STYLE,
  display: "flex",
  lineHeight: 1,
  fontStyle: "italic",
};

/** The lockup on the image, as two elements the renderer places itself. */
export function stillLockupOf({
  layout: { mark, word },
  colors,
}: {
  layout: LockupLayout;
  colors: Readonly<Record<StillLockupToken, string>>;
}): JSX.Element {
  return (
    <>
      <svg
        width={mark.size}
        height={mark.size}
        viewBox={`0 0 ${MARK_GRID} ${MARK_GRID}`}
        style={{ ...PLACED_STYLE, left: mark.left, top: mark.top }}
      >
        <circle cx={BEAD.cx} cy={BEAD.cy} r={LIGHT_FAR_RADIUS} fill={colors["lamp-haze"]} />
        <circle cx={BEAD.cx} cy={BEAD.cy} r={LIGHT_NEAR_RADIUS} fill={colors["lamp-glow"]} />
        {[mark.wire.left, mark.wire.right].map((half) => (
          <path
            key={half}
            d={half}
            fill="none"
            stroke={colors.ink}
            strokeWidth={mark.wire.stroke}
            strokeLinecap="round"
          />
        ))}
        <ellipse {...BEAD} fill={colors.lamp} />
      </svg>
      <div
        style={{
          ...WORD_STYLE,
          left: word.left,
          top: word.top,
          fontSize: word.size,
          color: colors.ink,
        }}
      >
        {SITE_NAME}
      </div>
    </>
  );
}
