import { spring } from "motion";
import { describe, expect, it } from "vitest";
import {
  GENTLE_REACH_PX,
  GESTURE_REACH_PX,
  GLIDE_REST_PX,
  ROOM_REACH_PX,
  ROW_REACH_PX,
  SPRINGS,
  foldGlideOver,
  gestureGlideOver,
  gentleOver,
  goingOnOver,
  peakStepOf,
  physicsOf,
  springOver,
  type PhysicalSpringOptions,
  type SpringOptions,
} from "./motion";

/** A 60 Hz frame, in milliseconds. */
const FRAME_MS = 1000 / 60;
/** Long enough for any glide here to come to rest. */
const SAMPLED_FRAMES = 360;
/** Kyoto's whole-day shrink on the gentle spring, measured on the page: 4.85 to 4.9 px. */
const GENTLE_PEAK_PX = 4.9;
/** The longest a whole day's frame can shrink: 540 px down to the chart's least, 400. */
const LONGEST_SHRINK_PX = 140;

describe("gentleOver", () => {
  it("is the gentle spring itself for a glide no longer than its reach", () => {
    expect(gentleOver(GENTLE_REACH_PX)).toEqual(SPRINGS.gentle);
    expect(gentleOver(30)).toEqual(SPRINGS.gentle);
  });

  it("never moves faster than the gentle spring over its reach, however far it goes", () => {
    const reachPeak = peakStepOf(SPRINGS.gentle, GENTLE_REACH_PX);
    expect(reachPeak).toBeLessThanOrEqual(GENTLE_PEAK_PX);
    for (const distance of [GENTLE_REACH_PX, 137, LONGEST_SHRINK_PX, 200]) {
      expect(peakStepOf(gentleOver(distance), distance)).toBeLessThanOrEqual(GENTLE_PEAK_PX);
    }
    // Unstretched, the longest shrink ran at about 7.5 px a frame.
    expect(peakStepOf(SPRINGS.gentle, LONGEST_SHRINK_PX)).toBeGreaterThan(7);
  });
});

/** The most the chart under a day's header may move in a 60 Hz frame and read as a glide. */
const ROOM_PEAK_PX = 4;
/** Kyoto's header to Nafplio's on a phone: four lines of the line about the day. */
const KYOTO_TO_NAFPLIO_PX = 117;

describe("springOver", () => {
  it("keeps the spring as it is over its reach, and keeps it in either direction", () => {
    expect(springOver(SPRINGS.layout, ROOM_REACH_PX, ROOM_REACH_PX)).toEqual(SPRINGS.layout);
    expect(springOver(SPRINGS.layout, -20, ROOM_REACH_PX)).toEqual(SPRINGS.layout);
    expect(
      springOver(SPRINGS.layout, -2 * ROOM_REACH_PX, ROOM_REACH_PX).visualDuration,
    ).toBeCloseTo(0.8);
  });

  it("glides a day's header room no faster than a glide reads, however many lines it moves", () => {
    expect(peakStepOf(SPRINGS.layout, ROOM_REACH_PX)).toBeLessThanOrEqual(ROOM_PEAK_PX);
    for (const distance of [29, 58, 87, KYOTO_TO_NAFPLIO_PX]) {
      const spring = springOver(SPRINGS.layout, distance, ROOM_REACH_PX);
      expect(peakStepOf(spring, distance)).toBeLessThanOrEqual(ROOM_PEAK_PX);
    }
    // Unstretched, Kyoto to Nafplio ran at about 10 px a frame.
    expect(peakStepOf(SPRINGS.layout, KYOTO_TO_NAFPLIO_PX)).toBeGreaterThan(9);
  });

  it("glides the rows under a row of the list to read under 3 px a frame, however tall it is", () => {
    // A row's versions coming in, on one line and on two on a phone, and a row of Kyoto's let in.
    for (const distance of [22, 45, 155, 224]) {
      const spring = springOver(SPRINGS.layout, distance, ROW_REACH_PX);
      expect(peakStepOf(spring, distance)).toBeLessThanOrEqual(2.5);
    }
  });
});

describe("gestureGlideOver", () => {
  it("moves a swap's rows under 3 px a frame, in the gentle spring's own time", () => {
    for (const distance of [22, 45, 55]) {
      const spring = gestureGlideOver(distance);
      expect(spring.visualDuration).toBe(SPRINGS.gentle.visualDuration);
      expect(peakStepOf(spring, distance)).toBeLessThanOrEqual(3);
    }
  });

  it("settles a whole list a new energy reshapes in about 1.5 s, not in time with its length", () => {
    // Kyoto's list on a phone, calm to lively: the line under it moved 330 px.
    expect(gestureGlideOver(330).visualDuration).toBeLessThanOrEqual(1.5);
    // Twice as far takes not twice as long.
    expect(gestureGlideOver(660).visualDuration).toBeLessThan(
      2 * gestureGlideOver(330).visualDuration * 0.75,
    );
    expect(gestureGlideOver(330).restDelta).toBeLessThan(0.5);
  });
});

describe("foldGlideOver", () => {
  /** A row seen all its way, as one on screen as the tap is made and as it rests. */
  const seen = (distancePx: number) => ({ distancePx, isSeenAt: () => true });
  /** A row the screen's foot cuts its way at, `belowPx` of it under the foot. */
  const risingOnto = (distancePx: number, belowPx: number) => ({
    distancePx,
    isSeenAt: (travelled: number) => travelled >= belowPx,
  });
  const pace = peakStepOf(SPRINGS.gentle, GESTURE_REACH_PX);

  it("keeps a row on screen to a gesture's pace, however far it goes", () => {
    // Elche's lunch on a phone as its old version folds away: 174 px on screen, 372 below it.
    const spring = foldGlideOver([seen(174), { distancePx: 372, isSeenAt: () => false }], 372);
    expect(peakStepOf(spring, 174)).toBeLessThanOrEqual(pace);
    expect(peakStepOf(spring, 372)).toBeGreaterThan(pace);
  });

  it("keeps a row rising onto the screen from under its foot to the same pace, from there", () => {
    // Elche's garden on a Pixel 7, 64 px of its 196 under the foot as the tap is made.
    const rising = risingOnto(196, 64);
    const spring = foldGlideOver([seen(132), rising], 196);
    expect(peakStepOf(foldGlideOver([seen(132)], 196), 196)).toBeGreaterThan(pace);
    expect(peakStepOf(spring, 196)).toBeLessThanOrEqual(pace * 1.1);
  });

  it("is a gesture over the whole way where no row on screen goes past its reach", () => {
    expect(foldGlideOver([seen(40)], 330)).toEqual(gestureGlideOver(330));
    expect(foldGlideOver([], 0)).toEqual(gestureGlideOver(0));
  });
});

/** Where a spring stands each 60 Hz frame from rest over `distance`, as Motion runs it. */
function pathOf(options: SpringOptions | PhysicalSpringOptions, distance: number): number[] {
  const generator = spring({ keyframes: [0, distance], ...options });
  return Array.from(
    { length: SAMPLED_FRAMES },
    (_, frame) => generator.next(frame * FRAME_MS).value,
  );
}

/**
 * How a header room glides on the layout spring, as one off its reach does, when, `atMs` into
 * a glide of `first` px, it is told to go on to `second`: its pace carried on (`goingOnOver`),
 * or set off again from rest. On its reach a glide always sets off again from rest.
 */
function retargetedOf(first: number, second: number, atMs: number, isCarried: boolean) {
  const one = spring({ keyframes: [0, first], ...physicsOf(SPRINGS.layout) });
  let last = 0;
  let peak = 0;
  let frame = 1;
  let before = 0;
  for (; frame * FRAME_MS < atMs; frame += 1) {
    const { value } = one.next(frame * FRAME_MS);
    before = value - last;
    peak = Math.max(peak, Math.abs(before));
    last = value;
  }
  const pace = isCarried ? (one.velocity?.((frame - 1) * FRAME_MS) ?? 0) : 0;
  const options = goingOnOver(SPRINGS.layout, second - last, pace);
  const two = spring({ keyframes: [last, second], ...options, velocity: pace });
  let after = 0;
  let restsAt = frame;
  for (let next = 1; next <= SAMPLED_FRAMES; next += 1) {
    const { value } = two.next(next * FRAME_MS);
    if (next === 1) after = value - last;
    peak = Math.max(peak, Math.abs(value - last));
    if (Math.abs(second - value) > GLIDE_REST_PX * 10) restsAt = frame + next;
    last = value;
  }
  return { peak, before, after, restsAtMs: restsAt * FRAME_MS };
}

/** A pace a glide on its way can have, in px a second. */
const MOVING_PX_A_SECOND = 500;
/** A peak this much over another is the same peak, sampled. */
const STEP_ROUNDING_PX = 0.01;
/** A glide that goes on moves at least this share of its last frame's way in its next. */
const GOES_ON_SHARE = 0.8;

describe("physicsOf", () => {
  it("moves from rest as the spring set by its time, every spring a glide sets off on", () => {
    const springs = [
      SPRINGS.layout,
      SPRINGS.gentle,
      SPRINGS.snappy,
      springOver(SPRINGS.layout, KYOTO_TO_NAFPLIO_PX, ROOM_REACH_PX),
      gestureGlideOver(330),
    ];
    for (const timed of springs) {
      const physical = pathOf(physicsOf(timed), KYOTO_TO_NAFPLIO_PX);
      pathOf(timed, KYOTO_TO_NAFPLIO_PX).forEach((at, frame) => {
        expect(physical[frame]).toBeCloseTo(at, 6);
      });
    }
  });

  it("keeps how close a glide comes to rest", () => {
    expect(physicsOf(gestureGlideOver(330)).restDelta).toBe(gestureGlideOver(330).restDelta);
    expect(physicsOf(SPRINGS.layout)).not.toHaveProperty("restDelta");
  });

  it("takes the pace it is given, where a spring set by its time takes none", () => {
    const firstFrame = (options: SpringOptions | PhysicalSpringOptions, velocity: number) =>
      spring({ keyframes: [0, KYOTO_TO_NAFPLIO_PX], ...options, velocity }).next(FRAME_MS).value;
    expect(firstFrame(SPRINGS.layout, MOVING_PX_A_SECOND)).toBeCloseTo(
      firstFrame(SPRINGS.layout, 0),
      6,
    );
    expect(firstFrame(physicsOf(SPRINGS.layout), MOVING_PX_A_SECOND)).toBeGreaterThan(
      firstFrame(physicsOf(SPRINGS.layout), 0) + (MOVING_PX_A_SECOND * FRAME_MS) / 1000 / 2,
    );
  });

  it("carries a header room's pace on when its end moves on, no faster than from rest", () => {
    for (const [first, second] of [
      [29, 58],
      [36, 72],
      [58, KYOTO_TO_NAFPLIO_PX],
      [29, KYOTO_TO_NAFPLIO_PX],
    ] as const) {
      for (const atMs of [50, 100, 200, 300]) {
        const carried = retargetedOf(first, second, atMs, true);
        const fromRest = retargetedOf(first, second, atMs, false);
        // Never faster than the same glide set off again from rest.
        expect(carried.peak).toBeLessThanOrEqual(fromRest.peak + STEP_ROUNDING_PX);
        // It goes on at its pace.
        expect(carried.after).toBeGreaterThan(carried.before * GOES_ON_SHARE);
      }
    }
    // Set off again from rest a tenth of a second in, as the header did, it stalled.
    const stalled = retargetedOf(36, 72, 100, false);
    expect(stalled.after).toBeLessThan(stalled.before * GOES_ON_SHARE);
  });

  it("sets off from rest on the spring as it is", () => {
    expect(goingOnOver(SPRINGS.layout, KYOTO_TO_NAFPLIO_PX, 0)).toEqual(physicsOf(SPRINGS.layout));
  });

  it("never sets a glide on its way off slower than it already goes", () => {
    // Told to go back a little while going fast the other way: it slows from its pace.
    const options = goingOnOver(SPRINGS.layout, -10, MOVING_PX_A_SECOND);
    const first = spring({ keyframes: [0, -10], ...options, velocity: MOVING_PX_A_SECOND }).next(
      FRAME_MS,
    ).value;
    expect(first).toBeGreaterThan(0);
  });

  it("has no physics for a spring that bounces under 0", () => {
    expect(() => physicsOf({ type: "spring", visualDuration: 0.4, bounce: -0.2 })).toThrow(
      /bounce under 0/,
    );
  });
});
