"use client";

import { motion, useReducedMotion } from "motion/react";
import { SPRINGS } from "@/lib/tokens/motion";
import type { ChartSizes } from "./geometry";

interface KnobProps {
  x: number;
  y: number;
  /** The pixels of the chart it is drawn on. */
  chart: ChartSizes;
}

/** Where a pull would grab the curve: a ring, so the bead it sits on stays in view. */
export function Knob({ x, y, chart }: KnobProps) {
  return (
    <circle
      cx={x}
      cy={y}
      r={chart.knobRadius}
      strokeWidth={chart.knobStroke}
      className="pointer-events-none fill-none stroke-curve"
    />
  );
}

interface InvitationProps {
  /** The ring's place: on the curve at the invited stop. */
  x: number;
  y: number;
  chart: ChartSizes;
  /**
   * Hidden while the pointer is over the chart, where the knob follows it instead, and
   * while its stop is open, where the version tags sit.
   */
  isShown: boolean;
}

/** How far each arrow stands from the ring, its half height and its depth, in the ring's radii. */
const ARROW_GAP = 0.5;
const ARROW_HALF = 0.5;
const ARROW_DEPTH = 0.38;

/** A chevron either side of the ring, pointing away from it along the wire. */
function Arrows({ x, y, chart }: KnobProps) {
  const r = chart.knobRadius;
  const chevron = (side: -1 | 1) => {
    const inner = x + side * r * (1 + ARROW_GAP);
    const tip = inner + side * r * ARROW_DEPTH;
    return `M${inner},${y - r * ARROW_HALF} L${tip},${y} L${inner},${y + r * ARROW_HALF}`;
  };
  return (
    <path
      d={`${chevron(-1)} ${chevron(1)}`}
      strokeWidth={chart.ringStroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none fill-none stroke-curve"
    />
  );
}

/**
 * The invitation to drag: a ring on the curve at the invited stop, an arrow either side of
 * it along its wire, the way it moves. It waits there until the first drag or tap, beside
 * the example the chart draws from it. It fades in once; after that it comes and goes with
 * the pointer at once. What the curve is for is said on the energy scale, where it stays.
 */
export function Invitation({ x, y, chart, isShown }: InvitationProps) {
  const isReducedMotion = useReducedMotion();
  const fadeIn = isReducedMotion ? false : { opacity: 0 };
  return (
    <g aria-hidden data-invitation className="pointer-events-none">
      <motion.g initial={fadeIn} animate={{ opacity: 1 }} transition={SPRINGS.snappy}>
        {isShown && (
          <>
            <Knob x={x} y={y} chart={chart} />
            <Arrows x={x} y={y} chart={chart} />
          </>
        )}
      </motion.g>
    </g>
  );
}
