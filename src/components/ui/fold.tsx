"use client";

import {
  PresenceContext,
  animate,
  motion,
  useMotionValue,
  usePresence,
  usePresenceData,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SPRINGS, springOver, type SpringName } from "@/lib/tokens/motion";
import { cn } from "./cn";

/** Arriving content shows only once its fold is this far open, so it is never sliced. */
const ARRIVING_FROM = 1 / 3;
/** Leaving content is gone by the time its fold is this far closed. */
const LEAVING_BY = 1 / 2;
/**
 * The most a fold's moving edge is feathered, in pixels, so a line it cuts through fades
 * out rather than being sliced mid-glyph. It is never more than what is clipped, so it is
 * gone the moment the fold is fully open.
 */
const EDGE_FEATHER = 16;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * How opaque content is at an openness from 0 to 1, by which way it moves: what leaves
 * fades over the first half of its collapse, what arrives shows from a third open. Both
 * follow the openness, so nothing fades ahead of the height it sits in, unless its ink is on
 * its spring (`useUnfolding`).
 */
export function opacityAt(openness: number, isLeaving: boolean): number {
  return isLeaving
    ? clampUnit((openness - (1 - LEAVING_BY)) / LEAVING_BY)
    : clampUnit((openness - ARRIVING_FROM) / (1 - ARRIVING_FROM));
}

interface Unfolding {
  /** 0 folded, 1 open, on the layout spring. */
  openness: MotionValue<number>;
  opacity: MotionValue<number>;
  /**
   * Told to go at once and leaving: unseen from the render that closes it, before its effect
   * removes it, so no frame drawn in between shows it, nor the old picture of a theme's crossing.
   */
  isGoneAtOnce: boolean;
}

/**
 * What an `AnimatePresence` can tell a fold as it leaves, through its `custom` prop: to go
 * at once, when what replaces it takes its place without folding.
 */
export interface FoldExit {
  isInstant: boolean;
}

function isInstantExit(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as FoldExit).isInstant === true;
}

/**
 * How far something is open, on its spring: it opens when it mounts or comes back, and
 * inside `AnimatePresence` it closes before it leaves, unless told to go at once.
 * Everything that unfolds or folds at one moment starts in the same frame on the same
 * spring, so the openness flows from what leaves to what arrives. With reduced motion it
 * changes at once.
 *
 * @param isAppearing Opens from nothing when it mounts. By default it does, except on the
 * first render of an `AnimatePresence` with `initial={false}`.
 * @param spring The layout spring by default, for what reflows with the day; a panel a tap
 * opens takes the snappy one, as a stop's sheet does.
 * @param reach Given, a fold taller than its pixels takes proportionally longer
 * (`springOver`), so what it moves below never moves faster than over that distance.
 * @param onGlide Told as it sets off to open or close and as it comes to rest, or is stopped.
 * @param isInkOnItsSpring Arriving among what stands, its ink comes in on the spring's own time,
 * never stretched by `reach`, while its height still opens over it, its edge's feather alone
 * hiding a line the edge cuts; leaving, its ink follows its height, from the ink it has, so one
 * that leaves while still opening fades rather than vanishing in a frame. Read as it mounts: one
 * drawn with its `AnimatePresence`, as with a row drawn anew, inks with its height, as the row
 * does.
 */
function useUnfolding(
  isAppearing?: boolean,
  spring: SpringName = "layout",
  reach?: { px: number; height: MotionValue<number> },
  onGlide?: (isGliding: boolean) => void,
  isInkOnItsSpring = false,
): Unfolding {
  const isReducedMotion = useReducedMotion();
  const [isPresent, safeToRemove] = usePresence();
  const isInstant = isInstantExit(usePresenceData());
  const presence = useContext(PresenceContext);
  const [isInkOwn] = useState(isInkOnItsSpring && presence?.initial !== false);
  const isUnfolding = (isAppearing ?? presence?.initial !== false) && !isReducedMotion;
  const openness = useMotionValue(isUnfolding ? 0 : 1);
  // How far its ink has come in, on the spring's own time: read only where it arrives so.
  const inked = useMotionValue(isUnfolding ? 0 : 1);
  const isLeaving = useMotionValue(false);
  const opacity = useTransform(() => {
    const open = openness.get();
    const ink = inked.get();
    const leaving = isLeaving.get();
    if (!isInkOwn) return opacityAt(open, leaving);
    return opacityAt(leaving ? Math.max(open, ink) : ink, leaving);
  });
  const remove = useRef(safeToRemove);
  const onGlideNow = useRef(onGlide);
  const reachPx = reach?.px;
  const reachHeight = reach?.height;

  useEffect(() => {
    remove.current = safeToRemove;
    onGlideNow.current = onGlide;
  });

  useEffect(() => {
    isLeaving.set(!isPresent);
    const target = isPresent ? 1 : 0;
    const finish = () => {
      if (!isPresent) remove.current?.();
    };
    if (isReducedMotion || (!isPresent && isInstant)) {
      openness.set(target);
      inked.set(target);
      finish();
      return;
    }
    // The way left, in pixels: a fold that turns back mid-way goes as far as it has come.
    const distance = (reachHeight?.get() ?? 0) * Math.abs(target - openness.get());
    const settings =
      reachPx === undefined ? SPRINGS[spring] : springOver(SPRINGS[spring], distance, reachPx);
    // Only a fold with somewhere to go glides: one drawn open, as a list's first rows, rests.
    let isGliding = openness.get() !== target;
    if (isGliding) onGlideNow.current?.(true);
    const rest = () => {
      if (!isGliding) return;
      isGliding = false;
      onGlideNow.current?.(false);
    };
    const controls = animate(openness, target, {
      ...settings,
      onComplete: () => {
        rest();
        finish();
      },
    });
    const inking = isInkOwn ? animate(inked, target, SPRINGS[spring]) : null;
    return () => {
      controls.stop();
      inking?.stop();
      rest();
    };
  }, [
    isPresent,
    isInstant,
    isReducedMotion,
    openness,
    inked,
    isInkOwn,
    isLeaving,
    spring,
    reachPx,
    reachHeight,
  ]);

  return { openness, opacity, isGoneAtOnce: !isPresent && isInstant };
}

interface FoldProps {
  /** See `useUnfolding`. */
  isAppearing?: boolean;
  /** See `useUnfolding`. */
  spring?: SpringName;
  /** See `useUnfolding`'s `reach`: the furthest it moves what is below in its spring's time. */
  reachPx?: number;
  /** See `useUnfolding`: for what waits on what the fold moves below it, as a day's end does. */
  onGlide?: (isGliding: boolean) => void;
  /**
   * See `useUnfolding`: words that say something has begun read in full ink as soon as a short
   * fold's would, however tall the room it opens. Not for a fold open to the side, which has no
   * feather.
   */
  isInkOnItsSpring?: boolean;
  /** A span, set as a block, where only phrasing content may go, such as in a heading. */
  as?: "div" | "span";
  /**
   * Clips only above and below, only while it folds, and feathers no edge: the feather is a
   * mask, which hides all it holds outside its box, as a part's slip set out in the margin beside
   * the plan from the row it heads. Its opacity alone hides a line its moving edge cuts.
   */
  isOpenToTheSide?: boolean;
  /** Classes for the clipping box. */
  className?: string;
  children: ReactNode;
}

/**
 * Content that unfolds and folds in place. Its openness sets its height, its opacity and
 * a feather on its moving edge, so a fold that leaves and one that arrives trade places
 * without a gap opening between them, and no line is ever seen sliced.
 */
export function Fold({
  isAppearing,
  spring,
  reachPx,
  onGlide,
  isInkOnItsSpring,
  as = "div",
  isOpenToTheSide = false,
  className,
  children,
}: FoldProps) {
  const contentHeight = useMotionValue(0);
  const { openness, opacity, isGoneAtOnce } = useUnfolding(
    isAppearing,
    spring,
    reachPx === undefined ? undefined : { px: reachPx, height: contentHeight },
    onGlide,
    isInkOnItsSpring,
  );
  const content = useRef<HTMLElement>(null);

  // Fully open, it follows its content, so a fold inside it can move freely.
  const height = useTransform(() =>
    openness.get() >= 1 ? "auto" : clampUnit(openness.get()) * contentHeight.get(),
  );
  // A mask works on alpha alone: black keeps, transparent hides, whatever the theme.
  const maskImage = useTransform(() => {
    const clipped = (1 - clampUnit(openness.get())) * contentHeight.get();
    const feather = Math.min(EDGE_FEATHER, clipped);
    return feather < 1
      ? "none"
      : `linear-gradient(to bottom, black calc(100% - ${feather}px), transparent)`;
  });
  // Open to the side, it clips nothing once fully open, and only up and down until then.
  const overflowY = useTransform(() => (openness.get() >= 1 ? "visible" : "clip"));

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => contentHeight.set(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [contentHeight]);

  const setContent = (element: HTMLElement | null) => {
    content.current = element;
  };
  if (as === "span") {
    return (
      <motion.span
        style={{ height, opacity, maskImage }}
        className={cn("block overflow-hidden", className, isGoneAtOnce && "invisible")}
      >
        <span ref={setContent} className="block">
          {children}
        </span>
      </motion.span>
    );
  }
  if (isOpenToTheSide) {
    return (
      <motion.div
        style={{ height, opacity, overflowY }}
        className={cn(className, isGoneAtOnce && "invisible")}
      >
        <div ref={setContent}>{children}</div>
      </motion.div>
    );
  }
  return (
    <motion.div
      style={{ height, opacity, maskImage }}
      className={cn("overflow-hidden", className, isGoneAtOnce && "invisible")}
    >
      <div ref={setContent}>{children}</div>
    </motion.div>
  );
}
