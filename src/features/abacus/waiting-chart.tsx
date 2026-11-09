"use client";

import { AnimatePresence, motion } from "motion/react";
import { HAIRLINE, type ChartScale } from "./geometry";
import { FADE, type Waiting } from "./waiting";

/**
 * The chart's half of the waiting line: a tick on the time axis at the pen, the minute the
 * writing has reached, reaching `CHART.penTick` either side of the axis. The phrase and the
 * ruled line the next row will close with are the row's half, set where the next name will
 * be, so the light runs through one place, not two.
 */

interface ChartWaitingProps {
  waiting: Waiting | null;
  scale: ChartScale;
}

/** The waiting line's tick in the chart, if it is showing. */
export function ChartWaiting({ waiting, scale }: ChartWaitingProps) {
  const y = waiting ? Math.round(scale.yOf(waiting.pen.minutes)) + 0.5 : 0;
  return (
    <AnimatePresence>
      {/* Before the options the pen is at the plan's end, so the tick closes the day. */}
      {waiting && (
        <motion.g
          key="voice"
          aria-hidden
          data-waiting="voice"
          {...FADE}
          className="pointer-events-none"
        >
          <line
            x1={scale.axisX - scale.chart.penTick}
            x2={scale.axisX + scale.chart.penTick}
            y1={y}
            y2={y}
            strokeWidth={HAIRLINE}
            className="stroke-muted"
          />
        </motion.g>
      )}
    </AnimatePresence>
  );
}
