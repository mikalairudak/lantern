"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { LINK_CLASSES } from "@/features/day/link-classes";
import { CURVE_NAME, useEnergyScaleWords } from "./chart-axes";
import { MAX_ENERGY } from "./curve";
import type { ChartScale } from "./geometry";

interface StickyScaleProps {
  scale: ChartScale;
  /** The curve can be dragged: the scale names it, is held at the top, and takes a change back. */
  isCurveNamed: boolean;
  /** How the day shown differs from its plan, as the headline says it; null when it does not. */
  clause: string | null;
  /** A hand is on the curve: the band, once held, steps aside for it. */
  isDragging?: boolean;
  /** Shows every stop's planned place again. */
  onBackToPlan: () => void;
  /** Held or not as a still of the lab's matrix says; on the page it follows the scroll. */
  isHeldInStill?: boolean;
  /**
   * An open stop's sheet lies over the band, as one that opens up from its stop does, over the
   * stops before it and the energy scale: where the band rests, clear, it goes under the sheet,
   * its words and its action with it, and comes back as the sheet closes.
   */
  isUnderSheet?: boolean;
}

/** Marks the band, with "held" once it stands at the screen's top, as specs read it. */
export const SCALE_BAND_ATTRIBUTE = "data-scale-band";

/** One line of the scale's words, as the chart's captions are set, a pointer target tall. */
const LINE_CLASSES = "flex min-h-6 items-center type-note";

/**
 * "Back to the plan", in the shared link's look: a whole 24 px target inside the band, with no
 * unseen reach past it, so it never lies over the rows passing under the band nor a bead's
 * edge showing at its foot: a reach there caught a bead's tap.
 */
const BACK_CLASSES = cn(
  LINK_CLASSES,
  "pointer-events-auto inline-flex min-h-6 shrink-0 items-center text-ink",
);

/**
 * The energy scale's words on a phone (2026-11-05), held at the screen's top while the chart is
 * in view: on a phone the drag happens with the header scrolled away, and the scale said what
 * the gesture does only where the chart began. It stands over the chart's ticks, on the
 * ground, and once held at the top a hairline under it parts it from the rows passing beneath.
 * It is held only once the curve can be dragged: while the day is written it stays where the
 * chart's own words stood. Once the day differs from its plan, it says how, in energy's colour
 * as the headline does, from the chart's left edge, and offers the way back to the plan. While
 * a hand is on the curve the held band steps aside, so the dragged bead and its name are never
 * under it. It is laid over the chart, in the room the chart keeps above its lanes, so nothing
 * moves for it.
 */
export function StickyScale({
  scale,
  isCurveNamed,
  clause,
  isDragging = false,
  onBackToPlan,
  isHeldInStill,
  isUnderSheet = false,
}: StickyScaleProps) {
  const { quieter, livelier, hasRoomForName } = useEnergyScaleWords(scale);
  // The band is held while the curve can be dragged.
  const isHoldable = isCurveNamed;
  // Held at the top: it stands a pixel past the screen's edge there, where it is, and no longer
  // where the chart puts it. Read as the page scrolls or resizes, a frame at a time.
  const band = useRef<HTMLDivElement>(null);
  const [isScrolledHeld, setIsScrolledHeld] = useState(false);
  useEffect(() => {
    const element = band.current;
    const frame = element?.parentElement;
    if (!element || !frame || !isHoldable || isHeldInStill !== undefined) return undefined;
    let pending = 0;
    const read = () => {
      pending = 0;
      const top = element.getBoundingClientRect().top;
      setIsScrolledHeld(top <= 0 && frame.getBoundingClientRect().top < top);
    };
    const schedule = () => {
      if (pending === 0) pending = requestAnimationFrame(read);
    };
    schedule();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(pending);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, [isHoldable, isHeldInStill]);
  const isHeld = isHeldInStill ?? (isHoldable && isScrolledHeld);
  // A finger or a pointer pressed on the chart under the held band: the band steps aside at
  // once, so what is pressed, a knob at the screen's top too, shows, even before a drag sets
  // off or where the knob has nowhere to go. Gone when the press is.
  const [isPressedUnder, setIsPressedUnder] = useState(false);
  useEffect(() => {
    const element = band.current;
    const frame = element?.parentElement?.parentElement;
    if (!element || !frame || !isHeld) return undefined;
    const press = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const isOnChart = !!target && frame.contains(target) && !target.closest("button");
      if (isOnChart && event.clientY <= element.getBoundingClientRect().bottom) {
        setIsPressedUnder(true);
      }
    };
    const release = () => setIsPressedUnder(false);
    addEventListener("pointerdown", press, { capture: true });
    addEventListener("pointerup", release, { capture: true });
    addEventListener("pointercancel", release, { capture: true });
    return () => {
      removeEventListener("pointerdown", press, { capture: true });
      removeEventListener("pointerup", release, { capture: true });
      removeEventListener("pointercancel", release, { capture: true });
      // Let go, a press it no longer hears the end of is not held over to the next time.
      release();
    };
  }, [isHeld]);
  const isSteppedAside = isHeld && (isDragging || isPressedUnder);
  // Held at the screen's top it stands on its own ground over whatever scrolls under it, a sheet
  // too; resting, clear, it has none, and its words and action would stand in the sheet's.
  const isHidden = isSteppedAside || (isUnderSheet && !isHeld);
  const isChanged = isCurveNamed && clause !== null;
  // The band runs from the chart's top to just over its ticks, its words at its foot, between
  // the scale's ends; where it rests it is clear, so the axis's head shows through it.
  const height = scale.plotTop - scale.chart.laneTick;
  const inset = { paddingLeft: scale.xOf(0), paddingRight: scale.width - scale.xOf(MAX_ENERGY) };
  // Held, a change is said from the chart's left edge, over the time column the band covers:
  // at 360 px, from the scale, "livelier in the morning" was cut short. Where it rests, clear,
  // it keeps off the head of the time axis, where the sun stands.
  const changedInset = isHeld ? { paddingRight: inset.paddingRight } : inset;
  const middle = { left: scale.xOf(MAX_ENERGY / 2) };
  return (
    // A phone's alone on the page; a still of the lab's matrix shows it at any width.
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-40",
        isHeldInStill === undefined && "sm:hidden",
      )}
    >
      <div
        ref={band}
        {...{ [SCALE_BAND_ATTRIBUTE]: isHeld ? "held" : "" }}
        className={cn(
          // Its ground and hairline come and go on the colours' transition; it steps aside for
          // a hand at once, so nothing pressed is under it for a frame.
          "flex items-end border-b transition-colors motion-reduce:transition-none",
          isHoldable && "max-sm:sticky max-sm:-top-px",
          isHeld ? "border-line bg-ground" : "border-transparent",
          isHidden && "opacity-0",
        )}
        // Under a sheet its action is out of reach, the legend's slot holding it on a laptop.
        inert={isUnderSheet && !isHeld}
        style={{ height }}
      >
        {/* Mounted from the start, so a screen reader hears the change as it comes; polite, and
            no second status on a page that has its own. */}
        <span aria-live="polite" className="sr-only">
          {isChanged ? clause : ""}
        </span>
        {isChanged ? (
          <div className={cn(LINE_CLASSES, "w-full justify-between gap-3")} style={changedInset}>
            <span aria-hidden className="min-w-0 truncate text-energy">
              {clause}
            </span>
            <button type="button" onClick={onBackToPlan} className={BACK_CLASSES}>
              Back to the plan
            </button>
          </div>
        ) : (
          <div className={cn(LINE_CLASSES, "relative w-full justify-between")} style={inset}>
            <span className="text-muted">{quieter}</span>
            {isCurveNamed && hasRoomForName && (
              <span className="absolute -translate-x-1/2 text-energy" style={middle}>
                {CURVE_NAME}
              </span>
            )}
            <span className="text-muted">{livelier}</span>
          </div>
        )}
      </div>
    </div>
  );
}
