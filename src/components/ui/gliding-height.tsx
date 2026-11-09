"use client";

import {
  animate,
  cancelFrame,
  frame,
  motion,
  spring,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  SPRINGS,
  gestureGlideOver,
  goingOnOver,
  springOver,
  type PhysicalSpringOptions,
  type SpringOptions,
} from "@/lib/tokens/motion";
import { cn } from "./cn";
import { isRevealing } from "./reveal-in-view";

const MS_PER_SECOND = 1000;

/** A glide as it set off: from where, to where, at what pace, on which spring. */
interface Flight {
  from: number;
  to: number;
  velocity: number;
  spring: PhysicalSpringOptions;
}

/** How fast a glide that set off as `flight` moves `ms` into it, in px a second. */
function paceOf(flight: Flight, ms: number): number {
  const { from, to, velocity } = flight;
  return spring({ ...flight.spring, keyframes: [from, to], velocity }).velocity?.(ms) ?? 0;
}

interface GlidingHeightProps {
  className?: string;
  children: ReactNode;
  /** Told when a glide starts and when it has come to rest, for what waits on the height. */
  onGlide?: (isGliding: boolean) => void;
  /**
   * A height the box keeps while its content is shorter, so what follows holds still until
   * the floor is lifted. Lifting it glides the box to its content, and `onGlide` then says
   * the box has come to rest even when it had nowhere to go.
   */
  minHeight?: number;
  /**
   * The height the box is first drawn at, when it takes the place of a box that tall, as a
   * day's header takes the room of the one before: from there it glides to its content,
   * taller or shorter, rather than taking its first height at once. Read when it mounts.
   */
  fromHeight?: number;
  /**
   * Clips what stands taller than the box while it glides, so content that grew before its
   * room has opened never draws over what follows. At rest nothing is clipped, so a focus
   * ring on the content is whole, and a word's open panel is never clipped: it stands over
   * what follows by design.
   */
  isClippedWhileGliding?: boolean;
  /**
   * Takes every new height at once, in the frame its content changed, as under reduced
   * motion: for a change nothing visible stands under, which no one would see glide. Nothing
   * is clipped meanwhile, so what moves inside the box, as a word gliding to its place, is
   * drawn whole.
   */
  isInstant?: boolean;
  /**
   * Once its floor is lifted, a glide further than this takes proportionally longer, so it
   * moves no faster than over this distance (`springOver`): for a box that goes from one
   * content to another many lines apart, with a chart under it. Without it, or for a glide
   * no floor set off, the layout spring's time.
   */
  reachPx?: number;
  /**
   * Every glide keeps to `reachPx`, not only one a floor set off: for a box with rows under
   * it, as a row of the list to read, whose versions' line or a swap would otherwise move
   * the rows below faster than they can be read.
   */
  shouldAlwaysReach?: boolean;
  /**
   * Boxes whose glides set off in one frame, as the rows of a list a new energy changes at
   * once, are timed as one on the gentle spring by the farthest any of them moves what
   * stands under it (`gestureGlideOver`): timed each by its own, the rows under eight that
   * changed rode the sum of their glides, at 10 px a frame, and timed by the sum, settled in
   * 5 s. A box whose glide sets off alone keeps its own spring, a frame later.
   */
  glideGroup?: GlideGroup;
  /**
   * While the box stands wholly above the screen, the page scrolls by however far each
   * change of its height moved what follows, so what is on screen holds still. Chromium's
   * scroll anchoring does as much on its own, and then nothing has moved; WebKit, an iPhone's
   * engine, anchors less or not at all, and a swap moved the day under the hand by the
   * header's growth above it.
   */
  shouldHoldTheView?: boolean;
  /**
   * With `shouldHoldTheView`, the view is held while the box stands on the screen too: for
   * the moments after a hand acts below it, so what grows above the hand grows up and out of
   * the screen rather than pushing down what the hand is on.
   */
  isViewHeldOnScreen?: boolean;
}

/** Glides that set off together, timed as one (`GlidingHeight`'s `glideGroup`). */
export interface GlideGroup {
  /**
   * Adds a box's glide setting off this frame, by how far it grows (less than zero as it
   * shrinks) and where it stands. Gives back, once every box has joined, how many did and
   * the farthest any of their glides moves what stands under it.
   */
  join: (distancePx: number, topPx: number) => () => Together;
}

/** The glides a group's boxes set off with in one frame. */
export interface Together {
  count: number;
  farthestPx: number;
}

interface Joined {
  distance: number;
  top: number;
}

/**
 * The farthest glides move what stands under them: down the page, each box moves what is
 * under it by every glide above it and its own, so rows that grow and rows that shrink
 * cancel out as they would on the page.
 */
export function farthestShiftOf(joined: readonly Joined[]): number {
  let shift = 0;
  let farthest = 0;
  for (const { distance } of [...joined].sort((a, b) => a.top - b.top)) {
    shift += distance;
    farthest = Math.max(farthest, Math.abs(shift));
  }
  return farthest;
}

/** A group for the glides of boxes that change together. */
export function createGlideGroup(): GlideGroup {
  let joined: Joined[] = [];
  let isCounting = false;
  return {
    join(distancePx, topPx) {
      if (!isCounting) {
        isCounting = true;
        joined = [];
        frame.postRender(() => {
          isCounting = false;
        });
      }
      joined.push({ distance: distancePx, top: topPx });
      const these = joined;
      return () => ({ count: these.length, farthestPx: farthestShiftOf(these) });
    },
  };
}

/**
 * A box as tall as its content, whose height springs on `layout` when the content's
 * changes, so what follows it glides rather than jumps. Its content may stand taller than
 * the box while the box catches up. It takes its first height at once, and with reduced
 * motion or told to take them at once every height, as a step drawn in the frame its
 * content changed: it rests once Motion has drawn it too.
 */
export function GlidingHeight({
  className,
  children,
  onGlide,
  minHeight,
  fromHeight,
  isClippedWhileGliding = false,
  isInstant = false,
  reachPx,
  shouldAlwaysReach = false,
  glideGroup,
  shouldHoldTheView = false,
  isViewHeldOnScreen = false,
}: GlidingHeightProps) {
  const isReducedMotion = useReducedMotion();
  const height = useMotionValue<number | "auto">("auto");
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const onGlideNow = useRef(onGlide);
  const isInstantNow = useRef(isInstant);
  const hasFloorNow = useRef(minHeight !== undefined);
  const shouldAlwaysReachNow = useRef(shouldAlwaysReach);
  const glideGroupNow = useRef(glideGroup);
  const isHeldOnScreen = useRef(isViewHeldOnScreen);
  // Where the first glide sets off from, taken once: a box drawn again goes on from its own.
  const startFrom = useRef(fromHeight);
  /**
   * Measures the content now, asked by a floor that moved or by a render that may have
   * changed it; set by the effect that observes it.
   */
  const measureNow = useRef<((isAsked: boolean) => void) | null>(null);
  // Read before anything measures in the same commit: with reduced motion a new height is
  // taken in the commit its content changed, and a hold the commit turned on must hold it.
  useLayoutEffect(() => {
    onGlideNow.current = onGlide;
    isInstantNow.current = isInstant;
    hasFloorNow.current = minHeight !== undefined;
    shouldAlwaysReachNow.current = shouldAlwaysReach;
    glideGroupNow.current = glideGroup;
    isHeldOnScreen.current = isViewHeldOnScreen;
  });

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return undefined;
    let target: number | null = null;
    let glide: AnimationPlaybackControls | null = null;
    // A glide in a group sets off on the next frame, once the group knows all its distances.
    let setOff: (() => void) | null = null;
    let isGliding = false;
    // A box holding a floor, or let go of one, is on its way from one content to another, as
    // from one day's header to the next: a glide it sets off then, and any its content asks
    // before it comes to rest, keeps the reach's pace. Any other keeps the layout spring's.
    let isReaching = false;
    /**
     * The glide on its way, as it set off, so one whose end moves on goes on from where it
     * stands at the pace it has there. Set off again from rest each time its content grew, as
     * a header grows over a stream's first three deltas, a glide stalled for 2 to 4 frames
     * mid-way. Motion keeps no pace to go on from: a value born "auto", as the box's is so the
     * page is drawn whole before it is measured, never tracks its velocity; one born a number
     * read 0 or a fraction of it when the content changed in a frame drawn late, as a streamed
     * day's do; and a spring set by its time takes none. So the pace is the spring's own, read
     * where the glide stops, and given to the next one as its physics, which goes no faster
     * than the same glide from rest (`goingOnOver`).
     */
    let flight: Flight | null = null;
    // Marked on the box as it starts, before the frame is drawn, so a clip holds from the
    // glide's first frame rather than from React's next render. A height taken at once
    // leaves nothing standing taller than the box, so nothing is marked to clip.
    const markGliding = (isNow: boolean) => {
      isGliding = isNow;
      box.current?.toggleAttribute("data-gliding", isNow && !isInstantNow.current);
      onGlideNow.current?.(isNow);
    };
    const rest = () => {
      isReaching = false;
      flight = null;
      markGliding(false);
    };
    const measure = (isAsked: boolean) => {
      const next = element.getBoundingClientRect().height;
      if (next === target) {
        // Asked after a floor moved and nothing changed: at rest, unless still on its way.
        if (isAsked && !isGliding) rest();
        return;
      }
      const isFirst = target === null;
      // Stopped, Motion draws the glide on its way where it stands now: it goes on from there
      // at the pace it has there. That its time then reads now, not its last frame, is how
      // Motion 14.4 stops a running JS animation (`JSAnimation.stop` ticks it to `time.now()`)
      // and no documented promise: read before the stop, the pace is a frame old, which only
      // softens how it goes on.
      glide?.stop();
      const pace =
        glide !== null && flight !== null ? paceOf(flight, glide.time * MS_PER_SECOND) : 0;
      glide = null;
      flight = null;
      target = next;
      if (setOff) cancelFrame(setOff);
      setOff = null;
      if (isFirst) {
        // An effect run again, as React's strict mode does or a switch of reduced motion,
        // goes on from the height already drawn. A box that takes another's place sets off
        // from that one's height, once.
        const from = startFrom.current;
        startFrom.current = undefined;
        const drawn = height.get();
        if (drawn === "auto" && from !== undefined && from !== next) height.set(from);
        else if (drawn === "auto" || drawn === next) {
          height.set(next);
          return;
        }
      }
      if (isReducedMotion || isInstantNow.current) {
        // Drawn in the frame its content changed, so a box that clips never hides a line for
        // a frame. Motion draws the same height on its next frame, and what waits on the
        // height waits for that frame too. Taken at once mid-glide, its clip goes with it.
        height.set(next);
        if (box.current) box.current.style.height = `${next}px`;
        if (!isGliding || isInstantNow.current) markGliding(true);
        cancelFrame(rest);
        frame.postRender(rest);
        return;
      }
      // Timed by the way left, so a glide whose end moves on settles in its own time once it
      // has caught up, rather than creeping for the whole way.
      const drawn = height.get();
      const setsOff = (timed: SpringOptions & { restDelta?: number }) => {
        const distance = typeof drawn === "number" ? next - drawn : 0;
        // Only towards its new end, and only off its reach. A pace carried away from the end
        // would carry the box past where it stood before it turns; and a glide on its reach
        // keeps to it by setting off again from rest: carried on, a re-plan's header room
        // moved the rows under it with theirs faster than a row reads (4.8 to 7.7 px a frame
        // on a busy laptop, main 4.6 at most).
        const velocity = !isReaching && pace * distance > 0 ? pace : 0;
        const options = goingOnOver(timed, distance, velocity);
        if (typeof drawn === "number")
          flight = { from: drawn, to: next, velocity, spring: options };
        glide = animate(height, next, { ...options, velocity, onComplete: rest });
      };
      markGliding(true);
      if (isAsked || hasFloorNow.current || shouldAlwaysReachNow.current) isReaching = true;
      const glideOver = (distance: number) => {
        const glideSpring =
          reachPx === undefined || !isReaching || drawn === "auto"
            ? SPRINGS.layout
            : springOver(SPRINGS.layout, distance, reachPx);
        setsOff(glideSpring);
      };
      const group = glideGroupNow.current;
      if (drawn === "auto") {
        glideOver(0);
        return;
      }
      if (group === undefined) {
        glideOver(next - drawn);
        return;
      }
      const together = group.join(next - drawn, box.current?.getBoundingClientRect().top ?? 0);
      // One glide alone, as a row's versions coming in as the day is written or one swap,
      // keeps its own pace; several at once, as a new energy reshapes the list, take the
      // gesture's.
      setOff = () => {
        setOff = null;
        const { count, farthestPx } = together();
        if (count < 2) glideOver(next - drawn);
        else setsOff(gestureGlideOver(farthestPx));
      };
      frame.render(setOff);
    };
    measureNow.current = measure;
    measure(false);
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelFrame(rest);
      if (setOff) cancelFrame(setOff);
      measureNow.current = null;
      // Stopped with no glide after it, so whatever waits on the height is not left waiting.
      if (isGliding) markGliding(false);
      glide?.stop();
    };
  }, [height, isReducedMotion, reachPx]);

  // While the box stands wholly above the screen, each new height is written as it is set,
  // with where the box ends read just before and just after, in one call: what follows moved
  // by the difference, less whatever the browser's own anchoring scrolled at that layout, and
  // the page scrolls by what is left. Nothing between the two reads is the hand's or another
  // write's: read a frame apart, 70 to 100 px of a 120 px scroll through a swap were scrolled
  // back, and read around Motion's frame, writes it makes outside it slipped past, 1.2 px a
  // glide. Motion draws the same height after. The page scrolls by whole pixels, and a glide
  // moves a fraction of one a frame, so what is left over is kept for the next: dropped, a
  // 24 px glide scrolled 20. A reveal on its way scrolls the page alone (`revealInView`): it
  // reads where its element stands each frame, so the growth is in its way already.
  useLayoutEffect(() => {
    const element = box.current;
    if (!shouldHoldTheView || !element) return undefined;
    let owed = 0;
    return height.on("change", (value) => {
      if (typeof value !== "number") return;
      const before = element.getBoundingClientRect().bottom;
      if ((before > 0 && !isHeldOnScreen.current) || isRevealing()) {
        owed = 0;
        return;
      }
      element.style.height = `${value}px`;
      owed += element.getBoundingClientRect().bottom - before;
      const whole = Math.round(owed);
      if (whole === 0) return;
      const from = window.scrollY;
      window.scrollBy(0, whole);
      owed -= window.scrollY - from;
    });
  }, [height, shouldHoldTheView]);

  // A floor set or lifted is measured at once, rather than whenever the observer gets to it.
  const isFirstFloor = useRef(true);
  useLayoutEffect(() => {
    if (isFirstFloor.current) {
      isFirstFloor.current = false;
      return;
    }
    measureNow.current?.(true);
  }, [minHeight]);

  // Content a render changed is measured in that render's commit, before anything else can
  // run: the observer reports it only as the frame is drawn, and a pen that waits on the
  // glide, its timer due at once, wrote a word into a line a frame before the line opened.
  useLayoutEffect(() => {
    measureNow.current?.(false);
  });

  return (
    <motion.div
      ref={box}
      style={{ height }}
      className={cn(
        className,
        isClippedWhileGliding && "data-gliding:not-panel-open:overflow-y-clip",
      )}
    >
      <div ref={content} style={{ minHeight }}>
        {children}
      </div>
    </motion.div>
  );
}
