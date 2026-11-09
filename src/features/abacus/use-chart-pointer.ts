"use client";

import { useRef, useState, type PointerEvent } from "react";
import { CANDIDATE_ATTRIBUTE } from "./chart-stop";
import { candidatesOf } from "./curve";
import type { StopDraft } from "./day-draft";
import type { ChartScale } from "./geometry";
import type { EnergyCurve } from "./use-energy-curve";

/**
 * A press that moves less than this is a tap, not a drag, in pixels: a hand's slip, the
 * same at any size the chart is drawn at.
 */
const DRAG_THRESHOLD = 4;

interface Press {
  pointerId: number;
  startX: number;
  minutes: number;
  isDrag: boolean;
  /** The bead the press started on, if any: a tap on it picks it. */
  bead: { stopIndex: number; candidateIndex: number } | null;
}

type SvgPointerEvent = PointerEvent<SVGSVGElement>;

interface ChartPointerOptions {
  stops: readonly StopDraft[];
  /** Each stop's wire, as a minute of the day. */
  mids: readonly number[];
  /** The minutes the curve covers; a grab outside them is held at its nearest end. */
  curveFrom: number;
  curveTo: number;
  scale: ChartScale;
  energy: EnergyCurve;
  /** False while the day is being written: the pointer is ignored. */
  isInteractive: boolean;
  /** A tap off the beads: near a wire it names that stop, elsewhere null. */
  onTapStop: (index: number | null) => void;
  onHoverStop: (index: number | null) => void;
}

export interface ChartPointer {
  /** Where the pointer is on the curve, as a minute of the day, or null when it is away. */
  pointerMinutes: number | null;
  /** True after the first drag, pull or bead tap: the hint has done its job. */
  hasInteracted: boolean;
  markInteracted: () => void;
  handlers: {
    onPointerDown: (event: SvgPointerEvent) => void;
    onPointerMove: (event: SvgPointerEvent) => void;
    onPointerUp: (event: SvgPointerEvent) => void;
    onPointerCancel: (event: SvgPointerEvent) => void;
    onLostPointerCapture: (event: SvgPointerEvent) => void;
    onPointerLeave: () => void;
  };
}

function beadAt(target: EventTarget, stops: readonly StopDraft[]): Press["bead"] {
  if (!(target instanceof Element)) return null;
  const id = target.closest(`[${CANDIDATE_ATTRIBUTE}]`)?.getAttribute(CANDIDATE_ATTRIBUTE);
  if (!id) return null;
  for (const [stopIndex, stop] of stops.entries()) {
    const candidateIndex = candidatesOf(stop).findIndex((place) => place.id === id);
    if (candidateIndex !== -1) return { stopIndex, candidateIndex };
  }
  return null;
}

function local(event: SvgPointerEvent): { x: number; y: number } {
  const box = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

/**
 * The chart under a pointer: hovering follows the curve, a press that moves sideways
 * bends it, a tap on a bead picks that candidate and nothing more, and any other tap names
 * the stop whose wire it is near, or none.
 */
export function useChartPointer({
  stops,
  mids,
  curveFrom,
  curveTo,
  scale,
  energy,
  isInteractive,
  onTapStop,
  onHoverStop,
}: ChartPointerOptions): ChartPointer {
  const press = useRef<Press | null>(null);
  const [pointerMinutes, setPointerMinutes] = useState<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const onCurve = (minutes: number) => Math.min(curveTo, Math.max(curveFrom, minutes));

  const stopNear = (y: number): number | null => {
    const index = mids.findIndex((mid) => Math.abs(scale.yOf(mid) - y) <= scale.chart.wireReach);
    return index === -1 ? null : index;
  };

  const finishPress = (pointerId: number) => {
    const current = press.current;
    if (!current || current.pointerId !== pointerId) return null;
    press.current = null;
    if (current.isDrag) energy.endDrag();
    return current;
  };

  const onPointerDown = (event: SvgPointerEvent) => {
    // One hand on the curve at a time: a second finger is ignored, not a new grab.
    if (!isInteractive || event.button !== 0 || press.current) return;
    const { x, y } = local(event);
    const minutes = onCurve(scale.minutesAt(y));
    const svg = event.currentTarget;
    if ("setPointerCapture" in svg) svg.setPointerCapture(event.pointerId);
    press.current = {
      pointerId: event.pointerId,
      startX: x,
      minutes,
      isDrag: false,
      bead: beadAt(event.target, stops),
    };
    setPointerMinutes(minutes);
  };

  const onPointerMove = (event: SvgPointerEvent) => {
    if (!isInteractive) return;
    const { x, y } = local(event);
    const current = press.current;
    if (!current) {
      setPointerMinutes(onCurve(scale.minutesAt(y)));
      onHoverStop(stopNear(y));
      return;
    }
    if (current.pointerId !== event.pointerId) return;
    const dx = x - current.startX;
    if (!current.isDrag && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!current.isDrag) {
      current.isDrag = true;
      setHasInteracted(true);
      energy.startDrag(current.minutes);
    }
    energy.drag(dx / scale.laneStep);
  };

  const onPointerUp = (event: SvgPointerEvent) => {
    const finished = finishPress(event.pointerId);
    if (!finished || finished.isDrag) return;
    if (finished.bead) {
      setHasInteracted(true);
      energy.choose(finished.bead.stopIndex, finished.bead.candidateIndex);
      return;
    }
    onTapStop(stopNear(local(event).y));
  };

  const onPointerLeave = () => {
    if (!isInteractive || press.current) return;
    setPointerMinutes(null);
    onHoverStop(null);
  };

  return {
    pointerMinutes,
    hasInteracted,
    markInteracted: () => setHasInteracted(true),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: (event) => finishPress(event.pointerId),
      onLostPointerCapture: (event) => finishPress(event.pointerId),
      onPointerLeave,
    },
  };
}
