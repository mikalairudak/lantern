"use client";

import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useLayoutEffect } from "react";
import { SPRINGS } from "@/lib/tokens/motion";
import { useDrawing } from "./drawing";
import type { LabelSide } from "./rows";

/**
 * Where a stop's words start, as a motion value. The bead they sit by and the side they
 * hang on spring on `layout`; their width does not, so words written to the left of a bead
 * grow leftwards letter by letter without lagging into it, and words that change sides
 * cross in one move. They take their first place at once, every place while `isImmediate`
 * (as the day is first placed and measured, or a row lands), and with reduced motion every
 * place. While `isRiding`, as their bead slides in, they take each place the bead is drawn
 * at at once, so they move with it frame for frame, and only a change of side glides.
 */
export function useWordsX(
  beadX: number,
  side: LabelSide,
  width: number,
  isImmediate: boolean = false,
  isRiding: boolean = false,
): MotionValue<number> {
  const isReducedMotion = useReducedMotion() ?? false;
  const { beadClear } = useDrawing().row;
  const bead = useMotionValue(beadX);
  const leftward = useMotionValue(side === "left" ? 1 : 0);
  const wide = useMotionValue(width);

  useLayoutEffect(() => {
    wide.set(width);
  }, [wide, width]);

  useLayoutEffect(() => {
    if (isReducedMotion || isImmediate || isRiding) {
      bead.set(beadX);
      return undefined;
    }
    const glide = animate(bead, beadX, SPRINGS.layout);
    return () => glide.stop();
  }, [bead, beadX, isReducedMotion, isImmediate, isRiding]);

  useLayoutEffect(() => {
    const target = side === "left" ? 1 : 0;
    if (isReducedMotion || isImmediate) {
      leftward.set(target);
      return undefined;
    }
    const glide = animate(leftward, target, SPRINGS.layout);
    return () => glide.stop();
  }, [leftward, side, isReducedMotion, isImmediate]);

  return useTransform(() => {
    const at = bead.get();
    const share = leftward.get();
    const right = at + beadClear;
    const left = at - beadClear - wide.get();
    return right + (left - right) * share;
  });
}
