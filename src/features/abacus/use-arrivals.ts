"use client";

import { animate, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SPRINGS } from "@/lib/tokens/motion";
import { energyOf, midOf, plannedPlace } from "./curve";
import { hasEnergy, type StopDraft } from "./day-draft";

/** Where a stop is in its arrival. A stop that does not arrive is settled from the start. */
export interface StopArrival {
  /** Drawn in with motion (wire, landing, beads) rather than shown in its final state. */
  isArriving: boolean;
  /**
   * Its wire has drawn in. Anything drawn again after this (a remount, a resize that
   * hides the chart) appears whole rather than arriving a second time.
   */
  isDrawn: boolean;
  /** Its bead is filled; the list shows its energy and sun from here. */
  isReady: boolean;
  /** Its bead has finished sliding and the curve has reached it, or neither had to. */
  isSettled: boolean;
  /** The energy its bead and the curve show while it slides or waits; null otherwise. */
  slide: number | null;
  /** How much of the curve's stretch from the stop before is drawn, from 0 to 1. */
  grown: number;
  /** How far the bend at the stop before has eased into its new shape, from 0 to 1. */
  eased: number;
  /**
   * The curve passes through it: once its stretch starts to grow, or all along when it is
   * rewritten.
   */
  isOnCurve: boolean;
  /** The middle of its time as drawn this frame, while it glides to a new time; else null. */
  mid: number | null;
  /** Written again in place, from where its bead was, rather than arriving new. */
  isRewritten: boolean;
  /**
   * Its energy was written by the time it landed, as for the stops held back while the
   * header is written: its row stands as it will rest from its first frame, and only what
   * its bead adds waits for the bead.
   */
  hasLandedWeighed: boolean;
}

/** Where a stop's bead was when the stop began to be written again. */
export interface ArrivalOrigin {
  energy: number;
  /** The middle of its old time, in minutes. */
  mid: number;
}

export interface Arrivals {
  of: (stop: StopDraft) => StopArrival;
  /** No bead is sliding or waiting to slide, and the curve has reached every stop. */
  isSettled: boolean;
  /**
   * The day's rows say which stops' rows have opened the room their words need, by stop id.
   * A bead fills only once its row's room is open, so its words take their layout inside it;
   * a chart whose rows never say waits for nothing.
   */
  onRoomsOpen: (stopIds: ReadonlySet<string>) => void;
}

/** A wire counts as drawn when it is about 90% across, not at the end of its spring. */
export const WIRE_DRAWN_MS = 300;
/**
 * A stretch of the curve is fully drawn when it is this far through its growth. On `layout`
 * that takes about as long as the beat between stops, so the next stretch, which waits for
 * it, is not held back.
 */
const STRETCH_DRAWN_AT = 0.9;
const NO_ORIGINS: Readonly<Record<string, ArrivalOrigin>> = {};

const SETTLED: StopArrival = {
  isArriving: false,
  isDrawn: true,
  isReady: true,
  isSettled: true,
  slide: null,
  grown: 1,
  eased: 1,
  isOnCurve: true,
  mid: null,
  isRewritten: false,
  hasLandedWeighed: true,
};

/** A rewritten stop's wire on its way from one time to another, in minutes. */
interface Glide {
  from: number;
  to: number;
  /** From 0 to 1, on the layout spring. */
  value: number;
}

/** An arrival is one place written into a stop: a stop written again arrives again. */
function keyOf(stop: StopDraft): string {
  return stop.primary.id;
}

/** Where a rewritten stop's wire is now: on its glide, or where it was before. */
function glideMid(glide: Glide | undefined, origin: ArrivalOrigin): number {
  return glide ? glide.from + (glide.to - glide.from) * glide.value : origin.mid;
}

function withKey<T>(record: Readonly<Record<string, T>>, key: string, value: T) {
  return { ...record, [key]: value };
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string) {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

/**
 * The stops arriving while the day is written. Each wire draws in first; then, once its row's
 * room is open, its bead fills and slides from the requested energy to its own. Its stretch of
 * the curve grows from the stop before once the curve has reached that stop, and passes
 * through the bead where it is drawn each frame, so the bead and the curve move together; a
 * bead never waits for the one before it, so when it fills first the curve reaches it after.
 * Stops already there when the day first renders, and every stop under reduced motion, appear
 * in their final state instead.
 *
 * A stop written again by a re-composition keeps its wire and its place on the curve. Its
 * bead empties where it was (`origins`, by stop id, from the latest re-composition, kept
 * after it ends), glides with its wire to the new time when that arrives, then fills and
 * slides to its new energy. Only the lab's re-composition passes `origins`
 * (`src/app/lab/concepts/abacus`); the product's re-plan rewrites its rows through
 * `replanFrameOf`, and its stops arrive as any do.
 */
export function useArrivals(
  stops: readonly StopDraft[],
  requestedEnergy: number,
  origins: Readonly<Record<string, ArrivalOrigin>> = NO_ORIGINS,
): Arrivals {
  const isReducedMotion = useReducedMotion() ?? false;
  const [present] = useState(() => new Set(stops.map(keyOf)));
  const [drawn, setDrawn] = useState<ReadonlySet<string>>(() => new Set());
  const [progress, setProgress] = useState<Readonly<Record<string, number>>>({});
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());
  // How far each new stop's stretch of the curve has grown, and the stops it has reached.
  const [reach, setReach] = useState<Readonly<Record<string, number>>>({});
  const [reached, setReached] = useState<ReadonlySet<string>>(() => new Set());
  const [glides, setGlides] = useState<Readonly<Record<string, Glide>>>({});
  // Whether each arrival's energy was written when it landed, by arrival, noted in the
  // render it first appears in.
  const [landings, setLandings] = useState<Readonly<Record<string, boolean>>>({});
  const unseen = stops.filter((stop) => landings[keyOf(stop)] === undefined);
  if (unseen.length > 0) {
    setLandings({
      ...landings,
      ...Object.fromEntries(unseen.map((stop) => [keyOf(stop), hasEnergy(stop)])),
    });
  }
  // The stops whose rows have opened their room, as the rows last said; null until they
  // first say. The rows say it as they lay out a frame, so a bead due in that frame fills in
  // it. The slides read it as last said when they look, so a room the rows have just found
  // opening again is never taken for one open.
  const [roomsOpen, setRoomsOpen] = useState<ReadonlySet<string> | null>(null);
  const roomsOpenNow = useRef<ReadonlySet<string> | null>(null);
  const wires = useRef(new Map<string, number>());
  const slides = useRef(new Map<string, AnimationPlaybackControls>());
  const stretches = useRef(new Map<string, AnimationPlaybackControls>());
  const moves = useRef(new Map<string, AnimationPlaybackControls>());
  /** The middle of its time each rewritten stop is gliding to, by arrival. */
  const heading = useRef(new Map<string, number>());

  const originOf = useCallback(
    (stop: StopDraft): ArrivalOrigin | undefined =>
      present.has(keyOf(stop)) ? undefined : origins[stop.id],
    [present, origins],
  );

  const isArriving = useCallback(
    (stop: StopDraft) => !isReducedMotion && !present.has(keyOf(stop)),
    [isReducedMotion, present],
  );

  /** Whether a rewritten stop is at its time as written now, so its bead may slide. */
  const isAtItsTime = useCallback(
    (stop: StopDraft, origin: ArrivalOrigin) => {
      const glide = glides[keyOf(stop)];
      const target = midOf(stops, stop);
      return glide ? glide.to === target && glide.value >= 1 : origin.mid === target;
    },
    [glides, stops],
  );

  /** Whether the curve has reached this stop, so the next stretch may grow from it. */
  const hasGrown = useCallback(
    (stop: StopDraft | undefined) =>
      stop === undefined ||
      !isArriving(stop) ||
      originOf(stop) !== undefined ||
      reached.has(keyOf(stop)) ||
      (reach[keyOf(stop)] ?? 0) >= STRETCH_DRAWN_AT,
    [isArriving, originOf, reached, reach],
  );

  const onRoomsOpen = useCallback((stopIds: ReadonlySet<string>) => {
    roomsOpenNow.current = stopIds;
    setRoomsOpen((current) =>
      current?.size === stopIds.size && [...stopIds].every((id) => current.has(id))
        ? current
        : stopIds,
    );
  }, []);

  /**
   * Whether a bead may fill and slide now: its energy is known, its wire is in place (drawn
   * for a new stop, at its new time for a rewritten one) and its row's room is open.
   */
  const isSlideDue = useCallback(
    (stop: StopDraft, open: ReadonlySet<string> | null = roomsOpen) => {
      const key = keyOf(stop);
      const origin = originOf(stop);
      const isInPlace = origin ? isAtItsTime(stop, origin) : drawn.has(key);
      const isRoomOpen = open?.has(stop.id) ?? true;
      return isArriving(stop) && !settled.has(key) && isInPlace && isRoomOpen && hasEnergy(stop);
    },
    [originOf, isAtItsTime, drawn, roomsOpen, isArriving, settled],
  );

  /**
   * Whether a new stop's stretch of the curve may grow now: its bead has filled (`isFilled`)
   * and the curve has reached the stop before.
   */
  const isStretchDue = useCallback(
    (stop: StopDraft, isFilled: boolean) => {
      const key = keyOf(stop);
      const before = stops[stops.findIndex((each) => keyOf(each) === key) - 1];
      return (
        isArriving(stop) &&
        originOf(stop) === undefined &&
        !reached.has(key) &&
        isFilled &&
        hasGrown(before)
      );
    },
    [isArriving, originOf, reached, hasGrown, stops],
  );

  // Each wire draws in as its stop appears; a rewritten stop's wire is already there.
  useEffect(() => {
    for (const stop of stops) {
      const key = keyOf(stop);
      const isWaiting = !isArriving(stop) || originOf(stop) !== undefined;
      if (isWaiting || drawn.has(key) || wires.current.has(key)) continue;
      const timer = window.setTimeout(
        () => setDrawn((current) => new Set(current).add(key)),
        WIRE_DRAWN_MS,
      );
      wires.current.set(key, timer);
    }
  }, [stops, isArriving, originOf, drawn]);

  // A rewritten stop glides with its wire to each new time it is given: making room for
  // the stop before it while empty, then to its own once that is written.
  useEffect(() => {
    for (const stop of stops) {
      const key = keyOf(stop);
      const origin = originOf(stop);
      if (!origin || !isArriving(stop)) continue;
      const target = midOf(stops, stop);
      if (target === (heading.current.get(key) ?? origin.mid)) continue;
      const from = glideMid(glides[key], origin);
      heading.current.set(key, target);
      moves.current.get(key)?.stop();
      const move = animate(0, 1, {
        ...SPRINGS.layout,
        onUpdate: (value) =>
          setGlides((current) => withKey(current, key, { from, to: target, value })),
        onComplete: () =>
          setGlides((current) => withKey(current, key, { from, to: target, value: 1 })),
      });
      moves.current.set(key, move);
    }
  }, [stops, isArriving, originOf, glides]);

  // Each bead slides once it is due, and each new stop's stretch of the curve grows once it
  // is: in the same frame as the slide when nothing holds it, on the same spring.
  useEffect(() => {
    stops.forEach((stop) => {
      const key = keyOf(stop);
      if (isSlideDue(stop, roomsOpenNow.current) && !slides.current.has(key)) {
        const slide = animate(progress[key] ?? 0, 1, {
          ...SPRINGS.layout,
          onUpdate: (value) => setProgress((current) => withKey(current, key, value)),
          onComplete: () => {
            setSettled((current) => new Set(current).add(key));
            setProgress((current) => withoutKey(current, key));
          },
        });
        slides.current.set(key, slide);
      }
      const isFilled = slides.current.has(key) || settled.has(key);
      if (!isStretchDue(stop, isFilled) || stretches.current.has(key)) return;
      const stretch = animate(reach[key] ?? 0, 1, {
        ...SPRINGS.layout,
        onUpdate: (value) => setReach((current) => withKey(current, key, value)),
        onComplete: () => {
          setReached((current) => new Set(current).add(key));
          setReach((current) => withoutKey(current, key));
        },
      });
      stretches.current.set(key, stretch);
    });
  }, [stops, isSlideDue, isStretchDue, settled, progress, reach]);

  // Stop everything and forget it, so effects that run again (Fast Refresh, a hidden
  // Activity shown again) start what is still unfinished instead of skipping it.
  useEffect(() => {
    const timers = wires.current;
    const running = slides.current;
    const growing = stretches.current;
    const moving = moves.current;
    const headings = heading.current;
    return () => {
      headings.clear();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      running.forEach((slide) => slide.stop());
      running.clear();
      growing.forEach((stretch) => stretch.stop());
      growing.clear();
      moving.forEach((move) => move.stop());
      moving.clear();
    };
  }, []);

  const rewrittenOf = (stop: StopDraft, origin: ArrivalOrigin): StopArrival => {
    const key = keyOf(stop);
    const mid = isAtItsTime(stop, origin) ? null : glideMid(glides[key], origin);
    const value = progress[key] ?? (isSlideDue(stop) ? 0 : undefined);
    const waiting = {
      ...SETTLED,
      isArriving: true,
      isReady: false,
      isSettled: false,
      slide: origin.energy,
      mid,
      isRewritten: true,
    };
    if (value === undefined || !hasEnergy(stop)) return waiting;
    const to = energyOf(plannedPlace(stop));
    return { ...waiting, isReady: true, slide: origin.energy + (to - origin.energy) * value };
  };

  const arrivalOf = (stop: StopDraft): StopArrival => {
    const key = keyOf(stop);
    const origin = originOf(stop);
    const isEnergetic = hasEnergy(stop);
    const isSlid = settled.has(key);
    // A rewritten stop is on the curve all along; a new one is done once the curve reaches it.
    if (!isArriving(stop) || (isSlid && (origin !== undefined || reached.has(key)))) {
      // Under reduced motion a rewritten stop waits for its energy where its bead was.
      if (origin && !isEnergetic) {
        return { ...SETTLED, isReady: false, slide: origin.energy, isRewritten: true };
      }
      return {
        ...SETTLED,
        isArriving: isArriving(stop),
        isReady: isEnergetic,
        isOnCurve: isEnergetic,
        isRewritten: origin !== undefined,
      };
    }
    if (origin) return rewrittenOf(stop, origin);
    // A bead due in this frame fills in it, before its slide's first step.
    const value = progress[key] ?? (isSlideDue(stop) ? 0 : undefined);
    if (!isEnergetic || (value === undefined && !isSlid)) {
      return {
        ...SETTLED,
        isArriving: true,
        isDrawn: drawn.has(key),
        isReady: false,
        isSettled: false,
        grown: 0,
        eased: 0,
        isOnCurve: false,
      };
    }
    const target = energyOf(plannedPlace(stop));
    const stretch = reach[key] ?? (isStretchDue(stop, true) ? 0 : undefined);
    return {
      ...SETTLED,
      isArriving: true,
      isSettled: false,
      // A bead that has slid all the way shows its own energy while the curve comes to it.
      slide: value === undefined ? null : requestedEnergy + (target - requestedEnergy) * value,
      grown: stretch === undefined ? 0 : Math.min(1, stretch / STRETCH_DRAWN_AT),
      eased: stretch === undefined ? 0 : Math.min(1, stretch),
      isOnCurve: stretch !== undefined,
    };
  };

  const of = (stop: StopDraft): StopArrival => ({
    ...arrivalOf(stop),
    hasLandedWeighed: landings[keyOf(stop)] ?? hasEnergy(stop),
  });

  return {
    of,
    isSettled: stops.every((stop) => !hasEnergy(stop) || arrivalOf(stop).isSettled),
    onRoomsOpen,
  };
}
