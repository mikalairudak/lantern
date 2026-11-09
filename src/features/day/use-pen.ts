"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * The header's pen: a stream lands several words at once, and a day at the landing pace
 * lands its line about the day in a fifth of a second. The pen lets what has arrived onto
 * the page one piece at a time, a beat apart, in the order the sentence reads, so the
 * header is seen being written rather than appearing. Each piece then writes itself in.
 */
export const PEN_BEAT_MS = 150;
/**
 * The chart's beat: stops that arrive together land no faster than one per beat, and the
 * lab's stand-in stream lets its stops in at the same beat.
 */
export const STOP_BEAT_SECONDS = 0.3;

/**
 * How many of the pieces that have arrived the pen has reached: one more each beat, and
 * at once after a pause longer than the beat, so a slow stream is never held back. While
 * `isHeld` it reaches nothing more, as while the room for what has arrived is still opening,
 * and goes on once it is let go. With reduced motion every piece shows as it arrives. The
 * chart lets its stops in on the same pen, at the abacus's own beat.
 */
export function usePen(
  arrived: number,
  beatMs: number = PEN_BEAT_MS,
  isHeld: boolean = false,
): number {
  const isReducedMotion = useReducedMotion() ?? false;
  const [reached, setReached] = useState(0);
  // When the pen last reached a piece; null before the first.
  const reachedAt = useRef<number | null>(null);

  useEffect(() => {
    if (isReducedMotion || isHeld || reached >= arrived) return undefined;
    const since = reachedAt.current === null ? Infinity : performance.now() - reachedAt.current;
    const timer = window.setTimeout(
      () => {
        reachedAt.current = performance.now();
        setReached((count) => count + 1);
      },
      Math.max(0, beatMs - since),
    );
    return () => window.clearTimeout(timer);
  }, [arrived, reached, isReducedMotion, isHeld, beatMs]);

  return isReducedMotion ? arrived : Math.min(reached, arrived);
}
