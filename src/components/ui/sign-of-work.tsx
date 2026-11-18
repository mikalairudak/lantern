"use client";

import { useId } from "react";
import { ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { signHeldAt, type SignMoment } from "@/lib/tokens/motion";
import { cn } from "./cn";

/** The sign is drawn on the mark's 24 grid (`docs/brand/README.md`, "The sign of work"). */
const GRID = 24;
const MIDDLE = GRID / 2;
/** The paper lantern: an ellipse at the grid's middle, its outline in ink. */
const LANTERN = { cx: MIDDLE, cy: MIDDLE, rx: 5.25, ry: 5.75 };
const OUTLINE_STROKE = 1.25;
/** The mark's wire, ended at the lantern's sides. */
const WIRE_LEFT = "M1 10.5 Q2.75 10.98 4.5 11.3";
const WIRE_RIGHT = "M19.5 11.3 Q21.25 10.98 23 10.5";
/**
 * The pen's one stroke: each of the four ribs in turn, left to right and back, joined by the
 * arc of the outline between their ends, which lies under the outline's own ink.
 */
const PEN_PATH =
  "M7.906 8.4 Q12 8.95 16.094 8.4 A5.25 5.75 0 0 1 17.134 10.8 Q12 11.35 6.866 10.8 A5.25 5.75 0 0 0 6.866 13.2 Q12 13.75 17.134 13.2 A5.25 5.75 0 0 1 16.094 15.6 Q12 16.15 7.906 15.6";
const PEN_STROKE = 1;
/** Where along the pen's stroke each rib ends, as a share of its length. */
const RIB_ENDS = [0.184, 0.473, 0.757, 1] as const;
/** The ribs a whole lantern has: the tally's count before it is lit. */
export const SIGN_RIBS = RIB_ENDS.length;
/**
 * The same stroke over lit paper, where no outline hides its turns: each rib runs on a unit
 * past the lantern's edge along its own curve and turns outside it, and the paper's shape cuts
 * it.
 */
const PAPER_PEN_PATH =
  "M6.906 8.249 Q12 9.101 17.094 8.249 L18.134 10.682 Q12 11.468 5.866 10.682 L5.866 13.082 Q12 13.868 18.134 13.082 L17.094 15.449 Q12 16.301 6.906 15.449";
const PAPER_PEN_STROKE = 0.9;
/** The lantern's light, two flat steps round its middle, inside the grid. */
const GLOW_RADIUS = 8.2;
const HAZE_RADIUS = 10.8;
/** The lit paper at its wick: a quarter of its size. */
const WICK_SCALE = 0.25;
/**
 * A stroke drawn by its dash: shown whole at an offset of 0, and not at all at 1. Its gap is
 * twice the path, so at 1 no dash of no length starts at the path's end, where its round cap
 * would draw a dot.
 */
const DASHES = "1 2";
const UNDRAWN = 1;
const DRAWN = 0;
const HIDDEN = 0;
const SHOWN = 1;

/** Each part's loop, behind `motion-safe:`, so where motion is reduced it never runs. */
const LOOP_CLASSES = {
  pen: "motion-safe:animate-sign-cut",
  haze: "motion-safe:animate-sign-haze",
  glow: "motion-safe:animate-sign-glow",
  paper: "motion-safe:animate-sign-light",
  paperRibs: "motion-safe:animate-sign-ribs",
} as const;

/**
 * What the sign holds with no loop running: a tally of the work. `cut` is the outline with
 * `ribs` of its ribs cut, none to `SIGN_RIBS`; `wick` is the lantern cut whole with its wick
 * lit; `lit` is the lantern lit whole, its ribs through the paper, its glow and haze round it.
 */
export type SignTally = { kind: "cut"; ribs: number } | { kind: "wick" } | { kind: "lit" };

/** The work the sign says: the loop, or a tally held still. */
export type SignWork = { kind: "running" } | SignTally;

/** The outline alone, which the loop starts from and the tally starts at. */
const SIGN_UNCUT: SignTally = { kind: "cut", ribs: 0 };

interface HeldParts {
  penOffset: number;
  penOpacity: number;
  paperScale: number;
  paperRibsOffset: number;
  lightOpacity: number;
}

/** The parts' still values for a tally; the running sign draws the loop's start. */
function heldPartsOf(work: SignWork): HeldParts {
  const tally = work.kind === "running" ? SIGN_UNCUT : work;
  const unlit = { penOpacity: SHOWN, paperRibsOffset: UNDRAWN, lightOpacity: HIDDEN };
  switch (tally.kind) {
    case "cut": {
      const ribs = Math.min(Math.max(Math.round(tally.ribs), 0), SIGN_RIBS);
      const drawn = RIB_ENDS[ribs - 1] ?? 0;
      return { ...unlit, penOffset: UNDRAWN - drawn, paperScale: 0 };
    }
    case "wick":
      return { ...unlit, penOffset: DRAWN, paperScale: WICK_SCALE };
    case "lit":
      return {
        penOffset: DRAWN,
        penOpacity: HIDDEN,
        paperScale: 1,
        paperRibsOffset: DRAWN,
        lightOpacity: SHOWN,
      };
  }
}

interface SignOfWorkProps {
  /** Running plays the loop wherever motion is allowed; a tally is drawn still. */
  work: SignWork;
  /** The running loop held still at one of its named moments, as a lab cell shows it. */
  heldAt?: SignMoment;
  className?: string;
}

/**
 * The sign that Lantern is working: a paper lantern on the mark's wire, cut in one stroke of
 * the pen and lit from its wick, as a plate is lit from its lamps (`docs/design-direction.md`,
 * "A pen and its lantern, not a spinner"). Running, its five parts loop on `--animate-sign-*`
 * behind `motion-safe:`, and their still values, the outline alone, stand where motion is
 * reduced; a tally draws the same parts still, with no loop. Its colours are tokens, so it
 * follows `data-theme`, and under forced colours, which leave what SVG draws in the page's
 * colours, its glow and haze stand on the canvas of their own theme, as the mark's do. The words
 * beside it say the work, so the sign is unheard.
 */
export function SignOfWork({ work, heldAt, className }: SignOfWorkProps) {
  const paperId = useId();
  const isRunning = work.kind === "running";
  const held = isRunning && heldAt !== undefined ? signHeldAt(heldAt) : undefined;
  const parts = heldPartsOf(work);
  const middle = `translate(${MIDDLE} ${MIDDLE})`;
  return (
    <svg
      aria-hidden
      width={GRID}
      height={GRID}
      viewBox={`0 0 ${GRID} ${GRID}`}
      className={cn("block shrink-0", className)}
    >
      <defs>
        <clipPath id={paperId}>
          <ellipse {...LANTERN} />
        </clipPath>
      </defs>
      <ellipse {...LANTERN} fill="none" strokeWidth={OUTLINE_STROKE} className="stroke-ink" />
      <path
        data-part="pen"
        d={PEN_PATH}
        pathLength={1}
        fill="none"
        strokeWidth={PEN_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={DASHES}
        strokeDashoffset={parts.penOffset}
        opacity={parts.penOpacity}
        style={held}
        className={cn("stroke-ink", isRunning && LOOP_CLASSES.pen)}
      />
      {/* Glow and haze are drawn round the grid's origin and moved to the middle, so a scale needs no origin of its own. */}
      <g transform={middle}>
        <circle
          data-part="haze"
          r={HAZE_RADIUS}
          opacity={parts.lightOpacity}
          style={held}
          className={cn("fill-lamp-haze", isRunning && LOOP_CLASSES.haze)}
        />
      </g>
      <g transform={middle}>
        <circle
          data-part="glow"
          r={GLOW_RADIUS}
          opacity={parts.lightOpacity}
          style={held}
          className={cn("fill-lamp-glow", isRunning && LOOP_CLASSES.glow)}
        />
      </g>
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
      {/* The lit paper, its wick at a quarter of its size: there is no separate wick. */}
      <g transform={middle}>
        <g
          data-part="paper"
          transform={`scale(${parts.paperScale})`}
          style={held}
          className={cn(isRunning && LOOP_CLASSES.paper)}
        >
          <g transform={`translate(${-MIDDLE} ${-MIDDLE})`}>
            <ellipse {...LANTERN} className="fill-lamp" />
            <g clipPath={`url(#${paperId})`}>
              <path
                data-part="paper-ribs"
                d={PAPER_PEN_PATH}
                pathLength={1}
                fill="none"
                strokeWidth={PAPER_PEN_STROKE}
                strokeLinejoin="round"
                strokeDasharray={DASHES}
                strokeDashoffset={parts.paperRibsOffset}
                style={held}
                className={cn("stroke-ground", isRunning && LOOP_CLASSES.paperRibs)}
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
