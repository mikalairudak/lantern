import { useLayoutEffect, useState } from "react";
import type { ShownPlaces } from "@/features/abacus/curve";
import type { StopDraft } from "@/features/abacus/day-draft";
import type { Arrivals } from "@/features/abacus/use-arrivals";
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
  /**
   * The visitor's picks on it where it is drawn as a day of its own, as a whole day taken or
   * taken back is, by stop id: those kept for that day, and none while it is being written.
   * Left out for a part's, which is drawn in the day on screen's place, with the picks made
   * there.
   */
  picks?: ShownPlaces;
}

/**
 * How long after a press a second one on the same control of a fork is taken as the same press:
 * a take flips the control under the finger to the other version, so a double press would take
 * it back.
 */
export const DOUBLE_PRESS_MS = 600;

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

/** The place a stop's plan shows: its primary, or the version its plan names. */
function plannedPlaceOf(stop: StopDraft) {
  return [stop.primary, ...stop.alternatives].find(({ id }) => id === stop.selectedPlaceId);
}

/**
 * A proposal's rows beside the day as the other version re-picked shows them: each drawn with
 * one place alone, so the visitor's hands never pick among them, that place the one its own
 * versions re-pick to, as the slip lists it. The day's own rows as they are.
 */
export function proposedAtOf(
  stops: readonly StopDraft[],
  proposed: ReadonlySet<string>,
  other: readonly StopDraft[],
): StopDraft[] {
  const byId = new Map(other.map((stop) => [stop.id, stop]));
  return stops.map((stop) => {
    const version = proposed.has(stop.id) ? byId.get(stop.id) : undefined;
    const place = version === undefined ? undefined : plannedPlaceOf(version);
    if (place === undefined || place.id === stop.primary.id) return stop;
    return { ...stop, primary: place, alternatives: [], selectedPlaceId: place.id };
  });
}

/**
 * The arrivals of the chart's rows, as `proposedAtOf` draws them: a proposal's row re-picked to
 * another of its places arrives as its stop does, its bead sliding to the place the row draws.
 * Arrivals are kept by the place written into a stop, and the re-picked place was never written
 * in, so read by its own its bead never filled.
 */
export function chartArrivalsOf(arrivals: Arrivals, stops: readonly StopDraft[]): Arrivals {
  const own = new Map(stops.map((stop) => [stop.id, stop]));
  return {
    ...arrivals,
    of: (row) => {
      const stop = own.get(row.id);
      return stop === undefined ? arrivals.of(row) : arrivals.of(stop, row);
    },
  };
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
 * Stops as the visitor sees them, each showing the place shown or picked for it, where that is
 * one of its own: a slip says what its version keeps, moves and adds against the day on screen,
 * and lists the other version with the picks taking it would show.
 */
export function asShownOf(stops: readonly StopDraft[], shown: ShownPlaces): StopDraft[] {
  return stops.map((stop) => {
    const placeId = shown[stop.id];
    const isOwn = [stop.primary, ...stop.alternatives].some(({ id }) => id === placeId);
    return !isOwn || placeId === undefined || placeId === stop.selectedPlaceId
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
 * What each part's head on the plan is kept by, beside its part (`PlanParts.keys`): the hour its
 * window opens at, which says where in the day the head stands. A take keeps the windows, so the
 * head stands where it was pressed; so does a part that opens the day when the route sends its
 * change on to the whole day, whose window opens there too. A part that opens at another hour
 * stands elsewhere, and its head folds in anew.
 */
export function headKeysOf(windows: readonly ReplanWindow[]): string[] {
  return windows.map(({ opens }) => `opens ${opens ?? "the day"}`);
}

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
 * column is whole, before the first paint, and kept in step as either is resized. Null until
 * both are measured: a slip waits for it, so a day drawn with a fork standing, as a whole day
 * taken is, never lays its slips out in the column first.
 */
export function useSlipPlacement(
  column: HTMLElement | null,
  whole: HTMLElement | null,
): SlipPlacement | null {
  const [placement, setPlacement] = useState<SlipPlacement | null>(null);
  useLayoutEffect(() => {
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
