"use client";

import { animate, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SPRINGS } from "@/lib/tokens/motion";
import {
  MAX_ENERGY,
  SWITCH_MARGIN,
  bendCurve,
  candidatesOf,
  curveAt,
  energyOf,
  midOf,
  modelPick,
  pickAll,
  pullGain,
  restingCurve,
  switchingLevel,
  type CurveStop,
  type Selectable,
} from "./curve";
import { hasEnergy, type StopDraft } from "./day-draft";

export interface EnergyCurve {
  /** The desired energy per stop, as drawn; null while a stop's energy is not written. */
  curve: (number | null)[];
  /** What the chart shows: follows the curve while it is dragged. */
  selected: number[];
  /** What the list shows: catches up when the drag ends. */
  committed: number[];
  isDragging: boolean;
  startDrag: (centerMinutes: number) => void;
  /** Moves the grabbed point of the curve by this many levels from where it was grabbed. */
  drag: (pointerLevels: number) => void;
  endDrag: () => void;
  /**
   * Bends the curve at one stop just far enough that it shows its candidate at this
   * energy; neighbours follow, and the pull stops short of swapping them too.
   */
  pullTo: (stopIndex: number, energy: number) => void;
  choose: (stopIndex: number, candidateIndex: number) => void;
  /** Back to what the model selected. */
  reset: () => void;
  /**
   * Shows these candidates at once, by stop id, as the day was left on this device: no spring
   * and no gesture, the curve resting on what each stop shows. Nothing while a drag is on.
   */
  restore: (picks: Picks) => void;
  /**
   * The day a drag would give, changing nothing: the curve grabbed at this minute and moved
   * this many levels, as each stop would show it once let go. Null while a drag is on.
   */
  previewOf: (centerMinutes: number, pointerLevels: number) => CurvePreview | null;
  /**
   * The same stops with new plans (a new energy word): the visitor's picks go and the curve
   * springs from where it is drawn to rest on the new plans. Call it with the stops about to
   * be shown, before they are.
   */
  replan: (next: readonly StopDraft[]) => void;
}

/** A day a drag would give, per stop as in `EnergyCurve`: where the curve would rest, and what it would show. */
export interface CurvePreview {
  curve: (number | null)[];
  selected: number[];
}

/**
 * The candidate each stop shows, by stop id. A stop with no entry, or whose entry is not
 * one of its candidates (it was written again), shows the model's pick.
 */
type Picks = Readonly<Record<string, string>>;
/**
 * The curve's energy at each stop, keyed by the place the model wrote for it, so a stop
 * written again has no entry and rests on its new plan. A stop with no entry rests on
 * what it shows.
 */
type Levels = Readonly<Record<string, number>>;

/** A stop's key in `Levels`. */
function levelKey(stop: { primary: { id: string } }): string {
  return stop.primary.id;
}

interface Drag {
  /** The stops on the curve when the drag began, which it bends. */
  stops: readonly CurveStop[];
  mids: number[];
  base: number[];
  centerMinutes: number;
  /** The curve's energy at the grab point when the drag began. */
  grabbedEnergy: number;
  gain: number;
}

/** The candidate a stop shows: its pick while that is one of its candidates, else the model's. */
function shownIndex(stop: Selectable & { id: string }, picks: Picks): number {
  const picked = candidatesOf(stop).findIndex((place) => place.id === picks[stop.id]);
  return picked === -1 ? modelPick(stop) : picked;
}

function shownIndices(stops: readonly CurveStop[], picks: Picks): number[] {
  return stops.map((stop) => shownIndex(stop, picks));
}

/** Picks by id from candidate indices, for the given stops. */
function picksOf(stops: readonly CurveStop[], indices: readonly number[]): Picks {
  return Object.fromEntries(
    stops.flatMap((stop, index) => {
      const place = candidatesOf(stop)[indices[index] ?? -1];
      return place ? [[stop.id, place.id]] : [];
    }),
  );
}

/** The curve as drawn at each stop: its own entry, or the energy of what it shows. */
function levelsOf(stops: readonly CurveStop[], picks: Picks, curve: Levels): number[] {
  const resting = restingCurve(stops, shownIndices(stops, picks));
  return stops.map((stop, index) => curve[levelKey(stop)] ?? resting[index] ?? 0);
}

function withLevels(curve: Levels, stops: readonly CurveStop[], levels: readonly number[]): Levels {
  return {
    ...curve,
    ...Object.fromEntries(stops.map((stop, index) => [levelKey(stop), levels[index] ?? 0])),
  };
}

/**
 * The curve and the picks it makes. Dragging bends the curve like a rubber band and the
 * chart's picks follow at once; on release the list catches up and the curve settles
 * onto the candidates it picked. State is kept by stop and candidate id, so stops,
 * alternatives and energies can arrive while the day is written without disturbing the
 * others; a stop the visitor has not touched shows the model's selection.
 */
export function useEnergyCurve(stops: readonly StopDraft[]): EnergyCurve {
  const isReducedMotion = useReducedMotion();
  const onCurve = useMemo(() => stops.filter(hasEnergy), [stops]);

  const [curve, setCurve] = useState<Levels>({});
  const [selected, setSelected] = useState<Picks>({});
  const [committed, setCommitted] = useState<Picks>({});
  const [isDragging, setIsDragging] = useState(false);

  const curveRef = useRef(curve);
  const selectedRef = useRef(selected);
  const dragRef = useRef<Drag | null>(null);
  const settling = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => () => settling.current?.stop(), []);

  const drawCurve = useCallback((next: Levels) => {
    curveRef.current = next;
    setCurve(next);
  }, []);

  const showPicks = useCallback((next: Picks) => {
    selectedRef.current = next;
    setSelected(next);
  }, []);

  /** Springs the curve at these stops from one set of energies to another. */
  const settle = useCallback(
    (settled: readonly CurveStop[], from: readonly number[], to: readonly number[]) => {
      settling.current?.stop();
      if (isReducedMotion) {
        drawCurve(withLevels(curveRef.current, settled, to));
        return;
      }
      settling.current = animate(0, 1, {
        ...SPRINGS.layout,
        onUpdate: (progress) =>
          drawCurve(
            withLevels(
              curveRef.current,
              settled,
              from.map((energy, index) => energy + ((to[index] ?? energy) - energy) * progress),
            ),
          ),
      });
    },
    [isReducedMotion, drawCurve],
  );

  const commit = useCallback(
    (picks: Picks) => {
      const from = levelsOf(onCurve, selectedRef.current, curveRef.current);
      const to = restingCurve(onCurve, shownIndices(onCurve, picks));
      // Hold the curve where it is drawn, so stops it has no entry for do not jump to
      // their new picks before the spring moves them.
      drawCurve(withLevels(curveRef.current, onCurve, from));
      showPicks(picks);
      setCommitted(picks);
      settle(onCurve, from, to);
    },
    [onCurve, drawCurve, showPicks, settle],
  );

  const startDrag = useCallback(
    (centerMinutes: number) => {
      settling.current?.stop();
      const mids = onCurve.map((stop) => midOf(stops, stop));
      const base = levelsOf(onCurve, selectedRef.current, curveRef.current);
      dragRef.current = {
        stops: onCurve,
        mids,
        base,
        centerMinutes,
        grabbedEnergy: curveAt(base, mids, centerMinutes),
        gain: pullGain(mids, centerMinutes),
      };
      setIsDragging(true);
    },
    [onCurve, stops],
  );

  const drag = useCallback(
    (pointerLevels: number) => {
      const current = dragRef.current;
      if (!current) return;
      // The grab point follows the pointer and stops at the ends of the scale, so pulling
      // further does not keep bending the stops around it out of sight.
      const target = Math.min(MAX_ENERGY, Math.max(0, current.grabbedEnergy + pointerLevels));
      const delta = (target - current.grabbedEnergy) / current.gain;
      const bent = bendCurve(current.base, current.mids, current.centerMinutes, delta);
      drawCurve(withLevels(curveRef.current, current.stops, bent));
      const shown = shownIndices(current.stops, selectedRef.current);
      const picked = pickAll(current.stops, bent, shown, SWITCH_MARGIN);
      showPicks({ ...selectedRef.current, ...picksOf(current.stops, picked) });
    },
    [drawCurve, showPicks],
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    commit(selectedRef.current);
  }, [commit]);

  const pullTo = useCallback(
    (stopIndex: number, energy: number) => {
      if (dragRef.current) return;
      const at = onCurve.findIndex((stop) => stop.id === stops[stopIndex]?.id);
      if (at === -1) return;
      const stop = onCurve[at];
      if (!stop) return;
      const mids = onCurve.map((stop) => midOf(stops, stop));
      const from = levelsOf(onCurve, selectedRef.current, curveRef.current);
      const shown = shownIndex(stop, selectedRef.current);
      const energies = candidatesOf(stop).map(energyOf);
      const level = switchingLevel(energies, energies[shown] ?? energy, energy);
      const delta = level - (from[at] ?? level);
      const bent = bendCurve(from, mids, mids[at] ?? 0, delta);
      const picked = pickAll(
        onCurve,
        bent,
        shownIndices(onCurve, selectedRef.current),
        SWITCH_MARGIN,
      );
      commit({ ...selectedRef.current, ...picksOf(onCurve, picked) });
    },
    [stops, onCurve, commit],
  );

  const choose = useCallback(
    (stopIndex: number, candidateIndex: number) => {
      if (dragRef.current) return;
      const stop = stops[stopIndex];
      const place = stop ? candidatesOf(stop)[candidateIndex] : undefined;
      if (!stop || !place) return;
      commit({ ...selectedRef.current, [stop.id]: place.id });
    },
    [stops, commit],
  );

  const reset = useCallback(() => {
    if (dragRef.current) return;
    commit({});
  }, [commit]);

  const restore = useCallback(
    (picks: Picks) => {
      if (dragRef.current) return;
      settling.current?.stop();
      drawCurve({});
      showPicks(picks);
      setCommitted(picks);
    },
    [drawCurve, showPicks],
  );

  const replan = useCallback(
    (next: readonly StopDraft[]) => {
      if (dragRef.current) return;
      const nextOnCurve = next.filter(hasEnergy);
      // Read before the plan changes: afterwards the new plans would read as the rest.
      const from = levelsOf(onCurve, selectedRef.current, curveRef.current);
      drawCurve(withLevels(curveRef.current, onCurve, from));
      showPicks({});
      setCommitted({});
      settle(nextOnCurve, from, restingCurve(nextOnCurve, nextOnCurve.map(modelPick)));
    },
    [onCurve, drawCurve, showPicks, settle],
  );

  const previewOf = useCallback(
    (centerMinutes: number, pointerLevels: number): CurvePreview | null => {
      if (isDragging || onCurve.length === 0) return null;
      const mids = onCurve.map((stop) => midOf(stops, stop));
      // From where the curve rests on what each stop shows, not from a settle in flight.
      const base = restingCurve(onCurve, shownIndices(onCurve, selected));
      const grabbed = curveAt(base, mids, centerMinutes);
      const target = Math.min(MAX_ENERGY, Math.max(0, grabbed + pointerLevels));
      const bent = bendCurve(
        base,
        mids,
        centerMinutes,
        (target - grabbed) / pullGain(mids, centerMinutes),
      );
      const picked = pickAll(onCurve, bent, shownIndices(onCurve, selected), SWITCH_MARGIN);
      const resting = restingCurve(onCurve, picked);
      const at = new Map(onCurve.map((stop, index) => [stop.id, index]));
      return {
        curve: stops.map((stop) => {
          const index = at.get(stop.id);
          return index === undefined ? null : (resting[index] ?? null);
        }),
        selected: stops.map((stop) => {
          const index = at.get(stop.id);
          return (index === undefined ? undefined : picked[index]) ?? shownIndex(stop, selected);
        }),
      };
    },
    [isDragging, stops, onCurve, selected],
  );

  return {
    curve: stops.map((stop) => {
      if (!hasEnergy(stop)) return null;
      const shown = candidatesOf(stop)[shownIndex(stop, selected)] ?? stop.primary;
      return curve[levelKey(stop)] ?? energyOf(shown);
    }),
    selected: stops.map((stop) => shownIndex(stop, selected)),
    committed: stops.map((stop) => shownIndex(stop, committed)),
    isDragging,
    startDrag,
    drag,
    endDrag,
    pullTo,
    choose,
    reset,
    restore,
    replan,
    previewOf,
  };
}
