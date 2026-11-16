import { useEffect, useState } from "react";
import type { ShownPlaces } from "@/features/abacus/curve";
import type { StopDraft } from "@/features/abacus/day-draft";
import { replanForEnergy } from "@/features/abacus/replan";
import type { ReplanWindow } from "@/features/abacus/replan-frame";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import { runningSpans } from "@/lib/time/clock";
import type { SlipPlacement } from "./part-slip";
import { partsOf } from "./part-slip-lines";

/**
 * A changed word's fork on the plan (`docs/decisions.md`, "The plan lists the day alone, and a
 * part's other version stands beside it as a slip"): the list is the day on screen and nothing
 * else, and each part's other version stands as a slip at the head of its part, in the column,
 * or in the margin beside it where the day's column is whole.
 */

/**
 * The other version of a fork, as far as it is written, and the energy it was planned for, so
 * an energy re-picked on the day re-picks it too: the proposal until it is taken, the day before
 * once it is.
 */
export interface ForkOther {
  stops: readonly StopDraft[];
  energy: EnergyLevel;
}

/** None of the other version written yet. */
const NO_STOPS: readonly StopDraft[] = [];

/**
 * The other version's stops as the slip lists them: re-picked for the energy the visitor chose
 * on the day, from the one it was planned for, as the day's own are (`replanForEnergy`). As
 * written where no energy was chosen; none with no fork.
 */
export function forkOtherAt(
  other: ForkOther | null,
  level: EnergyLevel | null,
): readonly StopDraft[] {
  if (other === null) return NO_STOPS;
  if (level === null) return other.stops;
  return replanForEnergy(
    other.stops,
    ENERGY_LEVELS.indexOf(other.energy),
    ENERGY_LEVELS.indexOf(level),
  );
}

/** A fork's parts as the plan draws them. */
export interface PlanFork {
  /** Each part's stops in the version on screen. */
  shown: StopDraft[][];
  /** Each part's stops in the other version. */
  other: StopDraft[][];
  /**
   * Over which of the day's stops each part's slip stands, by id: the part's first, or, for a
   * part the day on screen has no stop in, the first stop after it; null where none follows.
   */
  anchors: (string | null)[];
}

/**
 * The day's stops as the visitor sees them, each showing the place it shows on screen, so a
 * slip says what its version keeps, moves and adds against that.
 */
export function asShownOf(day: readonly StopDraft[], shown: ShownPlaces): StopDraft[] {
  return day.map((stop) => {
    const placeId = shown[stop.id];
    return placeId === undefined || placeId === stop.selectedPlaceId
      ? stop
      : { ...stop, selectedPlaceId: placeId };
  });
}

/** A fork's parts on the plan: each window's stops in either version, and where its slip stands. */
export function planForkOf(
  day: readonly StopDraft[],
  other: readonly StopDraft[],
  windows: readonly ReplanWindow[],
): PlanFork {
  const shown = partsOf(day, windows);
  const starts = runningSpans(day).map(({ from }) => from);
  const anchors = windows.map(({ opens }, part) => {
    const first = shown[part]?.[0];
    if (first) return first.id;
    const after = starts.findIndex((from) => from >= (opens ?? -Infinity));
    return day[after]?.id ?? null;
  });
  return { shown, other: partsOf(other, windows), anchors };
}

/** A part of a pixel's width a column may fall short by and still be read as whole. */
const SUBPIXEL = 0.5;

/**
 * Where a part's slip stands: in the margin once the day's column is whole, as wide as the plan
 * and its margin (`--container-day-column`), and in the column otherwise, as on a phone. Keyed on the
 * column, never the viewport, which a classic scrollbar leaves narrower than the screen.
 */
export function slipPlacementOf(columnWidth: number, wholeWidth: number): SlipPlacement {
  return wholeWidth > 0 && columnWidth + SUBPIXEL >= wholeWidth ? "margin" : "column";
}

/**
 * Where the day's slips stand, read from the day's column and an unseen box as wide as the
 * column is whole, kept in step as either is resized; in the column until both are measured.
 */
export function useSlipPlacement(
  column: HTMLElement | null,
  whole: HTMLElement | null,
): SlipPlacement {
  const [placement, setPlacement] = useState<SlipPlacement>("column");
  useEffect(() => {
    if (!column || !whole) return undefined;
    // Only a change of placement draws the day again: the column's height changes as it glides.
    const measure = () =>
      setPlacement(
        slipPlacementOf(column.getBoundingClientRect().width, whole.getBoundingClientRect().width),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    observer.observe(whole);
    return () => observer.disconnect();
  }, [column, whole]);
  return placement;
}
