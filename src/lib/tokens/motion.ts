import { spring as springPath } from "motion";
import type { Transition } from "motion/react";

/**
 * Springs for everything that moves. Components pick one by intent and never inline
 * spring values, so the feel of the whole app is tuned here. `visualDuration` is the
 * time to visually settle, in seconds; `bounce` is overshoot, from 0 (none) to 1.
 * Color and opacity changes on hover or focus are CSS transitions, timed by
 * `--default-transition-*` in globals.css.
 */
export const SPRINGS = {
  // Taps and toggles: settles fast, barely overshoots.
  snappy: { type: "spring", visualDuration: 0.2, bounce: 0.1 },
  // Rows reflowing as the energy changes, and swaps morphing in place.
  layout: { type: "spring", visualDuration: 0.4, bounce: 0.12 },
  // Stops arriving while the day streams in.
  gentle: { type: "spring", visualDuration: 0.6, bounce: 0 },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof SPRINGS;

/** A spring's settings, as the named ones are written. */
export interface SpringOptions {
  type: "spring";
  visualDuration: number;
  bounce: number;
}

/**
 * How far the gentle spring carries a whole day's frame end in its own time: Kyoto's 90 px,
 * at most about 4.9 px a 60 Hz frame. A spring that does not bounce moves faster the further
 * it goes, so a longer glide is given proportionally longer and moves no faster.
 */
export const GENTLE_REACH_PX = 90;

/**
 * How far the layout spring carries a day's header room in its own time: about a line and a
 * quarter of the line about the day on a phone, at most about 3.1 px a 60 Hz frame. A day
 * played from the city word can be lines taller or shorter than the one before it (four,
 * Kyoto to Nafplio), and the chart under the header glides that far. A room on its reach that
 * changes again mid-glide as the header streams sets off again from rest (`GlidingHeight`), so
 * it never outruns its reach; the margin under 4 px is for the frames a busy page draws late.
 */
export const ROOM_REACH_PX = 36;
/**
 * How far the layout spring carries a row of the list to read in its own time: about 2.4 px
 * a 60 Hz frame, so the rows below a row that opens, takes its versions or swaps glide
 * under 3 px a frame, a frame dropped on a busy machine included.
 */
export const ROW_REACH_PX = 28;

/** `spring` for a glide of `distancePx`: as fast as over `reachPx`, never faster. */
export function springOver(
  spring: SpringOptions,
  distancePx: number,
  reachPx: number,
): SpringOptions {
  const stretch = Math.max(1, Math.abs(distancePx) / reachPx);
  return { ...spring, visualDuration: spring.visualDuration * stretch };
}

/** The gentle spring for a glide of `distancePx`: as fast as over its reach, never faster. */
export function gentleOver(distancePx: number): SpringOptions {
  return springOver(SPRINGS.gentle, distancePx, GENTLE_REACH_PX);
}

/**
 * The most the page scrolls in one frame as it brings something into view (`revealInView`):
 * the gentle spring's own peak over a sheet's way on a phone is about 20 px a 60 Hz frame,
 * and a frame drawn late, as a page busy with a swap draws them, catches up over the next
 * frames rather than jumping the whole way in one.
 */
export const REVEAL_STEP_PX = 24;

/**
 * How far the gentle spring carries what a visitor's gesture moves in its own time: about
 * 3 px a 60 Hz frame. A swap moves the rows under it this far or less.
 */
export const GESTURE_REACH_PX = 55;

/**
 * How little of its way a glide that ends leaves to its last frame: Motion's default let a
 * long glide's last half pixel go at once, one row a frame, and the rows under them stepped.
 */
export const GLIDE_REST_PX = 0.05;

/** A spring's settings with how it comes to rest. */
export interface RestingSpringOptions extends SpringOptions {
  restDelta: number;
}

/** A spring as Motion's physics: stiffness, damping and mass, and what it rests by. */
export interface PhysicalSpringOptions {
  type: "spring";
  stiffness: number;
  damping: number;
  mass: number;
  restDelta?: number;
}

/** Motion takes a spring's visual duration as 1.2 of its undamped period. */
const PERIODS_PER_VISUAL_DURATION = 1.2;
/** The least damping ratio Motion gives a spring set by its time. */
const LEAST_DAMPING_RATIO = 0.05;

/**
 * `spring` as stiffness, damping and mass, resolved as Motion resolves a spring set by its
 * time with a bounce of 0 or more: from rest it moves as `spring` does. Motion gives a spring
 * set by its time no velocity, so a glide set off again on its way, as a box whose content
 * grows again mid-glide, started from rest and stalled; one set by its physics goes on at
 * the pace it is given.
 */
export function physicsOf(spring: SpringOptions & { restDelta?: number }): PhysicalSpringOptions {
  if (spring.bounce < 0) {
    throw new Error(`A spring with a bounce under 0 (${spring.bounce}) has no physics here`);
  }
  const dampingRatio = Math.max(1 - spring.bounce, LEAST_DAMPING_RATIO);
  const angularFrequency = (2 * Math.PI) / (spring.visualDuration * PERIODS_PER_VISUAL_DURATION);
  const stiffness = angularFrequency * angularFrequency;
  return {
    type: "spring",
    stiffness,
    damping: 2 * dampingRatio * Math.sqrt(stiffness),
    mass: 1,
    ...(spring.restDelta === undefined ? {} : { restDelta: spring.restDelta }),
  };
}

/** A 60 Hz frame, in milliseconds: the frame a glide's pace is read by. */
const FRAME_MS = 1000 / 60;
/** A second, in milliseconds. */
const MS_PER_SECOND = 1000;
/** Ten seconds of frames, longer than any glide here takes to rest. */
const MOST_FRAMES = 600;
/** How far a glide that sets off on its way is stretched at most, and how finely. */
const MOST_STRETCH = 8;
const STRETCH_STEPS = 12;

/** The most a spring moves in one 60 Hz frame over `distancePx`, setting off at `velocity`. */
export function peakStepOf(
  spring: SpringOptions | PhysicalSpringOptions,
  distancePx: number,
  velocity = 0,
): number {
  const path = springPath({ ...spring, keyframes: [0, distancePx], velocity });
  let last = 0;
  let peak = 0;
  for (let frame = 1; frame <= MOST_FRAMES; frame += 1) {
    const { value, done } = path.next(frame * FRAME_MS);
    peak = Math.max(peak, Math.abs(value - last));
    last = value;
    if (done) break;
  }
  return peak;
}

/**
 * `spring` for a glide of `distancePx` that sets off at `velocity` px a second, as its
 * physics (`physicsOf`): from rest, the spring as it is; on its way, stretched until it moves
 * no faster than the same glide from rest, or than it already goes. A glide whose end moved on
 * then goes on at its pace and is never faster for it: set off on the spring as it is, a
 * header room's glide peaked up to 0.7 px a frame faster than from rest, and one on its reach
 * 3.6 px a frame where its reach keeps it to 3.1.
 */
export function goingOnOver(
  spring: SpringOptions & { restDelta?: number },
  distancePx: number,
  velocity: number,
): PhysicalSpringOptions {
  const asItIs = physicsOf(spring);
  if (velocity === 0) return asItIs;
  const most = Math.max(peakStepOf(asItIs, distancePx), (Math.abs(velocity) * FRAME_MS) / 1000);
  const stretched = (stretch: number) =>
    physicsOf({ ...spring, visualDuration: spring.visualDuration * stretch });
  if (peakStepOf(asItIs, distancePx, velocity) <= most) return asItIs;
  let fast = 1;
  let slow = MOST_STRETCH;
  for (let step = 0; step < STRETCH_STEPS; step += 1) {
    const stretch = (fast + slow) / 2;
    if (peakStepOf(stretched(stretch), distancePx, velocity) <= most) slow = stretch;
    else fast = stretch;
  }
  return stretched(slow);
}

/**
 * The gentle spring for what a gesture moves `distancePx` in all, as a new energy moves a
 * whole list: in its own time over `GESTURE_REACH_PX`, and longer for a longer way only by
 * the square root of how much longer, so the day answers the gesture in about 1.5 s
 * whatever its length (Kyoto's list on a phone, 330 px). Rows on screen as it is made move
 * at most about 3 px a frame; rows past the screen's foot, further, move faster
 * (`docs/decisions.md`, "A row's words go where its bead comes to rest, and rows ease rather than
 * jump").
 */
export function gestureGlideOver(distancePx: number): RestingSpringOptions {
  const stretch = Math.sqrt(Math.max(1, Math.abs(distancePx) / GESTURE_REACH_PX));
  return {
    ...SPRINGS.gentle,
    visualDuration: SPRINGS.gentle.visualDuration * stretch,
    restDelta: GLIDE_REST_PX,
  };
}

/** A row's way as a tap sets it off: how far it goes, and where along it the visitor sees it. */
export interface SeenWay {
  distancePx: number;
  /** Whether the row is on the screen once it has come `travelledPx` of its way. */
  isSeenAt: (travelledPx: number) => boolean;
}

/** How much longer each try at a fold's glide is, and how many tries at most: 18 times as long. */
const FOLD_STRETCH = 1.05;
const FOLD_TRIES = 60;

/**
 * The most a glide on `spring` from rest moves its row in one 60 Hz frame while the row is on
 * the screen. Every spring here that does not bounce comes to rest without overshoot, so a way
 * is a share of its distance that only grows.
 */
function seenPeakOf(spring: SpringOptions, way: SeenWay): number {
  const angularFrequency = Math.sqrt(physicsOf(spring).stiffness);
  let peak = 0;
  let last = 0;
  for (let frame = 1; frame <= MOST_FRAMES; frame += 1) {
    const time = (frame * FRAME_MS) / MS_PER_SECOND;
    const share = 1 - (1 + angularFrequency * time) * Math.exp(-angularFrequency * time);
    const travelled = share * way.distancePx;
    if (way.isSeenAt(travelled) || way.isSeenAt(last)) peak = Math.max(peak, travelled - last);
    last = travelled;
    if (way.distancePx - travelled < GLIDE_REST_PX) break;
  }
  return peak;
}

/**
 * The gentle spring for the rows a fork folds or unfolds at a tap, set off together and timed
 * as one (`docs/decisions.md`, "A changed word proposes its part beside the day, and the
 * visitor takes it"): as a gesture over the whole way the farthest of them goes, `farthestPx`,
 * and longer until no row moves faster than a gesture's rows on screen do, about 3 px a frame,
 * in any frame it is on screen. A row that rises onto the screen from under its foot counts
 * from there, and rows that stay past the foot ride it faster, unseen.
 */
export function foldGlideOver(ways: readonly SeenWay[], farthestPx: number): RestingSpringOptions {
  const pace = peakStepOf(SPRINGS.gentle, GESTURE_REACH_PX);
  let spring = gestureGlideOver(farthestPx);
  for (let tries = 0; tries < FOLD_TRIES; tries += 1) {
    if (ways.every((way) => seenPeakOf(spring, way) <= pace)) return spring;
    spring = { ...spring, visualDuration: spring.visualDuration * FOLD_STRETCH };
  }
  return spring;
}
